/**
 * TradingPhaseEngine - Trading Workflow Phase Orchestrator
 * Implements zero-code trading workflow orchestration based on TradingChainConfig.json
 * Supports regime-aware flow switching and multi-phase message bus integration
 */
import { messageBus, Channel } from '../messageBus';
import type { Regime } from '../regime/types';
import type { PhaseConfig as JsonPhaseConfig, PhaseResult as JsonPhaseResult } from './types';

// ============================================================================
// Trading Chain Configuration Types (from JSON config)
// ============================================================================

export interface PhaseConfig {
  id: string;
  name: string;
  agent: string;
  tools: string[];
  input: string[];
  output: string;
  condition?: string;
  timeout: number;
  retry: number;
}

export interface ChainConfig {
  id: string;
  name: string;
  description: string;
  phases: PhaseConfig[];
}

export interface TradingChainConfig {
  version: string;
  defaultChain: string;
  chains: {
    [chainId: string]: ChainConfig;
  };
  regimeTriggers: {
    [regime: string]: string;
  };
  agents: {
    [agentName: string]: {
      name: string;
      description: string;
      model: string;
    };
  };
}

// ============================================================================
// Trading Context Types
// ============================================================================

export interface MarketContext {
  ticker: string;
  regime: Regime;
  price: number;
  volume: number;
  signals?: any[];
}

export interface PhaseHistoryEntry {
  phaseId: string;
  agent: string;
  output: unknown;
  duration: number;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

export interface TradingContext extends MarketContext {
  currentPhase: string;
  phaseHistory: PhaseHistoryEntry[];
  sharedData: Map<string, unknown>;
}

export interface TradingResult {
  chainId: string;
  regime: string;
  totalDuration: number;
  decision: {
    action: 'buy' | 'sell' | 'hold';
    quantity: number;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
  };
  phases: PhaseHistoryEntry[];
  status: 'completed' | 'partial' | 'rejected';
}

// ============================================================================
// Phase Result Types
// ============================================================================

export interface PhaseResult {
  phaseId: string;
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  success: boolean;
  data?: unknown;
  error?: string;
  duration?: number;
  timestamp: number;
  message?: string;
}

// ============================================================================
// TradingPhaseEngine Implementation
// ============================================================================

export class TradingPhaseEngine {
  private config: TradingChainConfig;
  private messageBus: typeof import('../messageBus').messageBus;
  private currentTicker: string = '';
  private marketContext: MarketContext | null = null;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(config: TradingChainConfig) {
    this.config = config;
    this.messageBus = messageBus;
    this.setupRegimeListener();
  }

  /**
   * Set up regime change listener for automatic chain switching
   */
  private setupRegimeListener(): void {
    this.messageBus.on<{ regime: Regime; confidence: number }>(
      Channel.REGIME_DETECTED,
      ({ regime }) => {
        this.onRegimeChange(regime);
      }
    );
  }

  /**
   * Handle regime change - automatically switch to appropriate chain
   */
  public onRegimeChange(newRegime: Regime): void {
    const chainId = this.config.regimeTriggers[newRegime] || this.config.defaultChain;
    console.log(`[TradingPhaseEngine] Regime changed to ${newRegime}, switching to chain: ${chainId}`);

    // Emit regime change event for UI
    this.messageBus.emit(Channel.REGIME_CHANGED, {
      previousRegime: this.marketContext?.regime,
      newRegime,
      chainId,
      timestamp: Date.now(),
    });

    // If currently running, switch chain
    if (this.isRunning && this.marketContext) {
      this.shouldStop = true;
      // Start new chain after current completes
      setTimeout(() => {
        this.executeChain(chainId, this.currentTicker, this.marketContext!);
      }, 100);
    }
  }

  /**
   * Execute a complete trading chain
   */
  public async executeChain(
    chainId: string,
    ticker: string,
    marketData: MarketContext
  ): Promise<TradingResult> {
    const chain = this.config.chains[chainId];
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`);
    }

    this.currentTicker = ticker;
    this.marketContext = marketData;
    this.isRunning = true;
    this.shouldStop = false;

    const startTime = Date.now();
    const phaseHistory: PhaseHistoryEntry[] = [];

    console.log(`[TradingPhaseEngine] Starting chain: ${chain.name} for ${ticker}`);

    // Emit workflow start event
    this.messageBus.emit(Channel.WORKFLOW_START, {
      chainId,
      ticker,
      chain,
      timestamp: startTime,
    });

    // Execute each phase in sequence
    for (const phase of chain.phases) {
      if (this.shouldStop) {
        console.log(`[TradingPhaseEngine] Chain execution stopped`);
        break;
      }

      // Check condition if present
      if (phase.condition && !this.evaluateCondition(phase.condition)) {
        console.log(`[TradingPhaseEngine] Phase ${phase.id} skipped due to condition: ${phase.condition}`);
        phaseHistory.push({
          phaseId: phase.id,
          agent: phase.agent,
          output: null,
          duration: 0,
          status: 'skipped',
        });
        continue;
      }

      // Create trading context for this phase
      const ctx: TradingContext = {
        ...marketData,
        currentPhase: phase.id,
        phaseHistory,
        sharedData: new Map(),
      };

      // Emit phase start event
      this.messageBus.emit(Channel.WORKFLOW_PHASE_START, {
        phaseId: phase.id,
        agent: phase.agent,
        chainId,
        timestamp: Date.now(),
      });

      try {
        const phaseResult = await this.executePhase(phase, ctx);
        phaseHistory.push({
          phaseId: phase.id,
          agent: phase.agent,
          output: phaseResult.data,
          duration: phaseResult.duration || 0,
          status: phaseResult.success ? 'success' : 'failed',
          error: phaseResult.error,
        });

        // Emit phase complete event
        this.messageBus.emit(Channel.WORKFLOW_PHASE_COMPLETE, {
          phaseId: phase.id,
          result: phaseResult,
          chainId,
          timestamp: Date.now(),
        });

        // Update shared data
        if (phaseResult.data) {
          ctx.sharedData.set(phase.output, phaseResult.data);
        }

        // Check if phase failed
        if (!phaseResult.success) {
          console.warn(`[TradingPhaseEngine] Phase ${phase.id} failed: ${phaseResult.error}`);
        }
      } catch (err) {
        const errorResult: PhaseResult = {
          phaseId: phase.id,
          agent: phase.agent,
          status: 'failed',
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: Date.now(),
        };

        phaseHistory.push({
          phaseId: phase.id,
          agent: phase.agent,
          output: null,
          duration: 0,
          status: 'failed',
          error: errorResult.error,
        });

        // Emit error event
        this.messageBus.emit(Channel.WORKFLOW_ERROR, {
          phaseId: phase.id,
          error: errorResult.error,
          chainId,
          timestamp: Date.now(),
        });
      }
    }

    this.isRunning = false;
    const totalDuration = Date.now() - startTime;

    // Build final decision from last successful decision phase
    const lastDecision = phaseHistory.find(h => h.output && (h.output as any).action);
    const decision = lastDecision?.output as TradingResult['decision'] || {
      action: 'hold' as const,
      quantity: 0,
      entryPrice: marketData.price,
    };

    const result: TradingResult = {
      chainId,
      regime: marketData.regime,
      totalDuration,
      decision,
      phases: phaseHistory,
      status: this.shouldStop ? 'partial' : 'completed',
    };

    // Emit workflow complete event
    this.messageBus.emit(Channel.WORKFLOW_COMPLETE, {
      chainId,
      result,
      timestamp: Date.now(),
    });

    console.log(`[TradingPhaseEngine] Chain completed: ${chain.name} in ${totalDuration}ms`);

    return result;
  }

  /**
   * Execute a single phase
   */
  private async executePhase(
    phase: PhaseConfig,
    ctx: TradingContext
  ): Promise<PhaseResult> {
    const phaseStartTime = Date.now();

    console.log(`[TradingPhaseEngine] Executing phase: ${phase.id} with agent: ${phase.agent}`);

    // Simulate agent execution based on agent type
    // In a real implementation, this would call actual agents
    let data: unknown = null;
    let error: string | undefined;

    try {
      switch (phase.agent) {
        case 'NewsAnalyst':
          data = await this.runNewsAnalyst(ctx);
          break;
        case 'TechnicalAnalyst':
          data = await this.runTechnicalAnalyst(ctx);
          break;
        case 'StrategyPool':
          data = await this.runStrategyPool(ctx);
          break;
        case 'TradingAgent':
          data = await this.runTradingAgent(ctx);
          break;
        case 'OrderExecutor':
          data = await this.runOrderExecutor(ctx);
          break;
        case 'RiskAnalyst':
          data = await this.runRiskAnalyst(ctx);
          break;
        case 'RegimeDetector':
          data = await this.runRegimeDetector(ctx);
          break;
        default:
          data = { message: `Agent ${phase.agent} executed`, phaseId: phase.id };
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - phaseStartTime;

    return {
      phaseId: phase.id,
      agent: phase.agent,
      status: error ? 'failed' : 'completed',
      success: !error,
      data,
      error,
      duration,
      timestamp: Date.now(),
      message: error ? `Phase failed: ${error}` : `Phase ${phase.id} completed successfully`,
    };
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string): boolean {
    // Simple condition evaluator for regime-based conditions
    // Format examples: "regime != 'volatile'", "marketRegime == 'bull'"
    try {
      const ctx = {
        regime: this.marketContext?.regime,
        marketRegime: this.marketContext?.regime,
      };
      // Very basic eval - in production would use a proper expression evaluator
      const testCondition = condition.replace(/'/g, '"');
      // This is intentionally limited - real implementation would use sandboxed eval
      return true; // Default to true for now
    } catch {
      console.warn(`[TradingPhaseEngine] Failed to evaluate condition: ${condition}`);
      return true;
    }
  }

  // ============================================================================
  // Agent Execution Methods (stub implementations)
  // ============================================================================

  private async runNewsAnalyst(ctx: TradingContext): Promise<{ news: string[]; sentiment: string }> {
    // Simulate news analysis
    await this.delay(100);
    return {
      news: [
        `分析 ${ctx.ticker} 近期市场动态`,
        `行业趋势：整体向好`,
        `资金流向：净流入`,
      ],
      sentiment: 'bullish',
    };
  }

  private async runTechnicalAnalyst(ctx: TradingContext): Promise<{ signals: any[]; trend: string }> {
    // Simulate technical analysis
    await this.delay(150);
    return {
      signals: [
        { type: 'MA', value: 'golden_cross', strength: 0.8 },
        { type: 'RSI', value: 55, strength: 0.6 },
        { type: 'MACD', value: 'bullish', strength: 0.7 },
      ],
      trend: 'uptrend',
    };
  }

  private async runStrategyPool(ctx: TradingContext): Promise<{ strategy: string; params: any }> {
    // Simulate strategy selection based on regime
    await this.delay(100);
    const strategyMap: Record<Regime, string> = {
      BULL: 'momentum_strategy',
      BEAR: 'defensive_strategy',
      RANGEBOUND: 'mean_reversion',
      UNKNOWN: 'momentum_strategy',
    };
    return {
      strategy: strategyMap[ctx.regime] || 'default_strategy',
      params: {
        stopLoss: 0.08,
        takeProfit: 0.25,
        positionSize: 0.2,
      },
    };
  }

  private async runTradingAgent(ctx: TradingContext): Promise<TradingResult['decision']> {
    // Simulate Bull/Bear debate and decision
    await this.delay(200);
    const bullScore = 0.6 + Math.random() * 0.3;
    const bearScore = 0.3 + Math.random() * 0.2;
    const confidence = Math.max(bullScore, bearScore);
    const action = bullScore > bearScore ? 'buy' : bearScore > bullScore + 0.1 ? 'sell' : 'hold';

    return {
      action,
      quantity: action === 'hold' ? 0 : Math.floor(100 + Math.random() * 100),
      entryPrice: ctx.price,
      stopLoss: action !== 'hold' ? ctx.price * 0.95 : undefined,
      takeProfit: action === 'buy' ? ctx.price * 1.25 : undefined,
    };
  }

  private async runOrderExecutor(ctx: TradingContext): Promise<{ orderId: string; status: string }> {
    // Simulate order execution
    await this.delay(150);
    return {
      orderId: `ORD-${Date.now()}`,
      status: 'success',
    };
  }

  private async runRiskAnalyst(ctx: TradingContext): Promise<{ cvar: number; riskLevel: string }> {
    // Simulate risk assessment
    await this.delay(120);
    return {
      cvar: 0.05 + Math.random() * 0.1,
      riskLevel: ctx.regime === 'volatile' ? 'high' : 'medium',
    };
  }

  private async runRegimeDetector(ctx: TradingContext): Promise<{ regime: Regime; confidence: number }> {
    // Return current regime
    await this.delay(50);
    return {
      regime: ctx.regime,
      confidence: 0.8,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get available chains
   */
  public getChains(): string[] {
    return Object.keys(this.config.chains);
  }

  /**
   * Get chain configuration
   */
  public getChain(chainId: string): ChainConfig | undefined {
    return this.config.chains[chainId];
  }

  /**
   * Get default chain
   */
  public getDefaultChain(): string {
    return this.config.defaultChain;
  }

  /**
   * Get regime to chain mapping
   */
  public getRegimeTriggers(): Record<string, string> {
    return { ...this.config.regimeTriggers };
  }

  /**
   * Check if engine is currently running
   */
  public isEngineRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Stop the current execution
   */
  public stop(): void {
    this.shouldStop = true;
    this.isRunning = false;
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let engineInstance: TradingPhaseEngine | null = null;

export function createTradingPhaseEngine(config?: TradingChainConfig): TradingPhaseEngine {
  if (!config) {
    // Load from default JSON config
    config = loadDefaultConfig();
  }
  engineInstance = new TradingPhaseEngine(config);
  return engineInstance;
}

export function getTradingPhaseEngine(): TradingPhaseEngine | null {
  return engineInstance;
}

function loadDefaultConfig(): TradingChainConfig {
  try {
    // Dynamic import of JSON config
    const configJson = __CHAIN_CONFIG__;
    return configJson as TradingChainConfig;
  } catch {
    // Fallback to inline default
    return {
      version: '1.0.0',
      defaultChain: 'standard',
      chains: {
        standard: {
          id: 'standard',
          name: '标准交易流程',
          description: '标准五阶段流程',
          phases: [
            { id: 'research', name: '市场研究', agent: 'NewsAnalyst', tools: [], input: [], output: 'marketNews', timeout: 30, retry: 2 },
            { id: 'analysis', name: '技术分析', agent: 'TechnicalAnalyst', tools: [], input: ['marketNews'], output: 'technicalSignals', timeout: 25, retry: 1 },
            { id: 'strategy', name: '策略制定', agent: 'StrategyPool', tools: [], input: ['technicalSignals'], output: 'strategy', timeout: 20, retry: 1 },
            { id: 'decision', name: '交易决策', agent: 'TradingAgent', tools: [], input: ['strategy'], output: 'tradingDecision', timeout: 30, retry: 2 },
            { id: 'execution', name: '订单执行', agent: 'OrderExecutor', tools: [], input: ['tradingDecision'], output: 'executionReport', timeout: 15, retry: 3 },
          ],
        },
      },
      regimeTriggers: {
        BULL: 'standard',
        BEAR: 'defensive',
        RANGEBOUND: 'standard',
      },
      agents: {},
    };
  }
}

export default TradingPhaseEngine;