/**
 * TradingOrchestra - Multi-Agent Trading Orchestra
 * V40: Four-agent collaboration with regime-aware dynamic weight adjustment
 * 
 * Coordinates TrendAgent, MeanReversionAgent, ArbitrageAgent, RiskControlAgent
 * with regime-aware weight adjustment and self-evolution based on performance
 */
import type {
  AgentDecision,
  AgentPerformance,
  MarketContext,
  MarketRegime,
  OrchestraConfig,
  OrchestratedDecision,
  RegimeWeightMap,
  TradingAgent,
} from './types';
import { trendAgent } from './TrendAgent';
import { meanReversionAgent } from './MeanReversionAgent';
import { arbitrageAgent } from './ArbitrageAgent';
import { riskControlAgent, RiskMetrics } from './RiskControlAgent';
import { RegimeDetector } from '../regime/RegimeDetector';
import { tradingMemoryManager } from '../memory/TradingMemoryManager';

// Regime-based weight configurations
const REGIME_WEIGHTS: RegimeWeightMap = {
  BULL: {
    trend: 0.4,
    mean_reversion: 0.2,
    arbitrage: 0.2,
    risk_control: 0.2,
  },
  BEAR: {
    trend: 0.2,
    mean_reversion: 0.4,
    arbitrage: 0.2,
    risk_control: 0.2,
  },
  RANGEBOUND: {
    trend: 0.2,
    mean_reversion: 0.4,
    arbitrage: 0.2,
    risk_control: 0.2,
  },
  HIGH_VOL: {
    trend: 0.2,
    mean_reversion: 0.3,
    arbitrage: 0.3,
    risk_control: 0.2,
  },
  LOW_VOL: {
    trend: 0.3,
    mean_reversion: 0.3,
    arbitrage: 0.2,
    risk_control: 0.2,
  },
  UNKNOWN: {
    trend: 0.25,
    mean_reversion: 0.25,
    arbitrage: 0.25,
    risk_control: 0.25,
  },
};

export class TradingOrchestra {
  private agents: Map<string, TradingAgent> = new Map();
  private currentRegime: MarketRegime = 'UNKNOWN';
  private agentPerformance: Map<string, AgentPerformance> = new Map();
  private config: OrchestraConfig = {
    enableEvolution: true,
    evolutionThreshold: 0.7,
    confidenceThreshold: 0.6,
    autoDetectRegime: true,
  };
  private lastEvolutionTime = 0;
  private evolutionIntervalMs = 24 * 60 * 60 * 1000; // Daily evolution

  constructor() {
    // Register default agents
    this.registerAgent(trendAgent);
    this.registerAgent(meanReversionAgent);
    this.registerAgent(arbitrageAgent);
    this.registerAgent(riskControlAgent);
  }

  /**
   * Register a trading agent
   */
  registerAgent(agent: TradingAgent): void {
    this.agents.set(agent.name, agent);
    this.agentPerformance.set(agent.name, {
      agent: agent.name,
      totalDecisions: 0,
      successfulDecisions: 0,
      failedDecisions: 0,
      avgPnL: 0,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Main orchestration decision - coordinated multi-agent decision making
   */
  async decide(context: MarketContext): Promise<OrchestratedDecision> {
    // 1. Auto-detect regime if enabled
    if (this.config.autoDetectRegime && !context.regime) {
      const regimeResult = await RegimeDetector.detect();
      context.regime = regimeResult.regime;
    }
    this.currentRegime = context.regime || 'UNKNOWN';

    // 2. Apply regime-based weights
    this.applyRegimeWeights();

    // 3. Gather decisions from all agents in parallel
    const decisions = await Promise.all(
      Array.from(this.agents.values()).map(agent => agent.decide(context))
    );

    // 4. Aggregate decisions with voting
    const orchestrated = this.aggregateDecisions(decisions);

    // 5. Record performance
    this.recordDecision(orchestrated);

    return orchestrated;
  }

  /**
   * Aggregate agent decisions using weighted voting
   */
  private aggregateDecisions(decisions: AgentDecision[]): OrchestratedDecision {
    const voteWeights: Record<string, number> = {};
    const actionScores: Record<string, number> = {};

    // Initialize
    for (const decision of decisions) {
      const agent = this.agents.get(decision.agent);
      const weight = agent?.weight || 0.25;
      voteWeights[decision.agent] = weight;

      if (!actionScores[decision.action]) {
        actionScores[decision.action] = 0;
      }
      actionScores[decision.action] += weight * decision.confidence;
    }

    // Find winning action
    let bestAction = 'hold';
    let bestScore = 0;
    for (const [action, score] of Object.entries(actionScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    // Confidence is the score of winning action
    const totalWeight = Object.values(voteWeights).reduce((a, b) => a + b, 0);
    const confidence = totalWeight > 0 ? bestScore / totalWeight : 0;

    // Build reasoning
    const agentReasons = decisions.map(d => `${d.agent}:${d.action}(${d.confidence.toFixed(2)})`).join(', ');
    const reasoning = `多Agent投票 [${agentReasons}] → 最终决策: ${bestAction} (置信度: ${(confidence * 100).toFixed(0)}%)`;

    return {
      action: bestAction as OrchestratedDecision['action'],
      confidence,
      reasoning,
      votes: decisions,
      regime: this.currentRegime,
      timestamp: Date.now(),
      weights: voteWeights,
    };
  }

  /**
   * Apply regime-based weights to agents
   */
  private applyRegimeWeights(): void {
    const regimeWeights = REGIME_WEIGHTS[this.currentRegime] || REGIME_WEIGHTS.UNKNOWN;

    for (const [agentName, weight] of Object.entries(regimeWeights)) {
      const agent = this.agents.get(agentName);
      if (agent) {
        agent.weight = weight;
      }
    }
  }

  /**
   * Detect current market regime from market data
   */
  async detectRegime(marketData: { close: number; high: number; low: number; volume: number; open?: number }[]): Promise<MarketRegime> {
    if (marketData.length < 60) {
      return 'UNKNOWN';
    }

    const closes = marketData.map(d => d.close);
    const highs = marketData.map(d => d.high);
    const lows = marketData.map(d => d.low);
    const volumes = marketData.map(d => d.volume);

    // Calculate indicators
    const currentPrice = closes[closes.length - 1];
    const ma20 = closes.slice(-20).reduce((a, b) => a + b) / Math.min(20, closes.length);
    const ma60 = closes.slice(-60).reduce((a, b) => a + b) / Math.min(60, closes.length);
    
    // Volatility: ATR-based
    const atr = highs.slice(-14).reduce((sum, high, i) => {
      const lowIdx = lows.length - 14 + i;
      const low = lows[lowIdx] || lows[lows.length - 1];
      const prevCloseIdx = lowIdx - 1;
      const prevClose = closes[prevCloseIdx] || currentPrice;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      return sum + tr;
    }, 0) / 14;
    const volatility = atr / currentPrice;

    // Volume trend
    const avgVolume = volumes.reduce((a, b) => a + b) / volumes.length;
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b) / 5;
    const volumeRatio = recentVolume / avgVolume;

    // Trend detection
    const trend = ma20 > ma60 ? 1 : ma20 < ma60 ? -1 : 0;

    // Determine regime
    let regime: MarketRegime = 'RANGEBOUND';
    
    if (volatility > 0.03) {
      regime = 'HIGH_VOL';
    } else if (volatility < 0.01 && volumeRatio < 0.7) {
      regime = 'LOW_VOL';
    } else if (trend > 0 && volatility > 0.015) {
      regime = 'BULL';
    } else if (trend < 0 && volatility > 0.015) {
      regime = 'BEAR';
    }

    this.currentRegime = regime;
    return regime;
  }

  /**
   * Record decision for performance tracking
   */
  private recordDecision(decision: OrchestratedDecision): void {
    for (const vote of decision.votes) {
      const perf = this.agentPerformance.get(vote.agent);
      if (perf) {
        perf.totalDecisions++;
        perf.lastUpdated = Date.now();
      }
    }
  }

  /**
   * Report trade outcome to update agent performance
   */
  async reportOutcome(ticker: string, action: string, pnl: number): Promise<void> {
    // Update agents based on outcome
    // This should be called after a trade completes with its P&L
    for (const agent of this.agents.values()) {
      const perf = this.agentPerformance.get(agent.name);
      if (!perf) continue;

      perf.totalDecisions++;
      if (pnl > 0) {
        perf.successfulDecisions++;
      } else {
        perf.failedDecisions++;
      }
      perf.avgPnL = (perf.avgPnL * (perf.totalDecisions - 1) + pnl) / perf.totalDecisions;
      perf.lastUpdated = Date.now();

      // Update agent weight based on performance
      const successRate = perf.totalDecisions > 0 
        ? perf.successfulDecisions / perf.totalDecisions 
        : 0.5;
      agent.updateWeight(successRate);
    }
  }

  /**
   * Evolve orchestra based on historical performance
   * Called daily or after significant market changes
   */
  async evolveOrchestra(): Promise<void> {
    if (!this.config.enableEvolution) return;
    if (Date.now() - this.lastEvolutionTime < this.evolutionIntervalMs) return;

    this.lastEvolutionTime = Date.now();

    try {
      // Get recent decisions from memory
      // Note: Would need actual implementation with tradingMemoryManager
      const agentStats: Record<string, { success: number; total: number }> = {};

      for (const [name, perf] of this.agentPerformance) {
        const successRate = perf.totalDecisions > 0 
          ? perf.successfulDecisions / perf.totalDecisions 
          : 0.5;
        agentStats[name] = { success: successRate, total: perf.totalDecisions };

        // Crystallize successful decisions as skills
        if (successRate >= this.config.evolutionThreshold && perf.successfulDecisions >= 3) {
          // Would crystallize to TradingMemoryManager
          console.log(`[Orchestra] ${name} success rate ${(successRate * 100).toFixed(0)}% - crystallizing skill`);
        }
      }

      // Adjust weights based on success rates
      const totalSuccessRate = Object.values(agentStats)
        .filter(s => s.total > 0)
        .reduce((sum, s) => sum + s.success / Object.keys(agentStats).length, 0);

      for (const [name, stats] of Object.entries(agentStats)) {
        if (stats.total === 0) continue;
        
        const agent = this.agents.get(name);
        if (!agent) continue;

        // Boost weight for good performance, reduce for poor
        const relativePerformance = stats.success / (totalSuccessRate || 0.5);
        const adjustment = (relativePerformance - 1) * 0.1;
        agent.weight = Math.max(0.1, Math.min(0.5, agent.weight + adjustment));
      }

      // Evolve strategy pool
      await tradingMemoryManager.evolveStrategyPool();

      const agentWeightSummary = Array.from(this.agents.values()).map(a => `${a.name}:${a.weight.toFixed(2)}`).join(', ');
      console.log(`[Orchestra] Evolution complete: ${agentWeightSummary}`);
    } catch (error) {
      console.error('[Orchestra] Evolution failed:', error);
    }
  }

  /**
   * Get current agent weights
   */
  getWeights(): Record<string, number> {
    const weights: Record<string, number> = {};
    for (const [name, agent] of this.agents) {
      weights[name] = agent.weight;
    }
    return weights;
  }

  /**
   * Get current regime
   */
  getRegime(): MarketRegime {
    return this.currentRegime;
  }

  /**
   * Get agent performance stats
   */
  getPerformance(): Record<string, AgentPerformance> {
    const result: Record<string, AgentPerformance> = {};
    for (const [name, perf] of this.agentPerformance) {
      result[name] = { ...perf };
    }
    return result;
  }

  /**
   * Update risk metrics for risk control agent
   */
  updateRiskMetrics(metrics: Partial<RiskMetrics>): void {
    riskControlAgent.updateRiskMetrics(metrics);
  }

  /**
   * Configure orchestra
   */
  configure(config: Partial<OrchestraConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
export const tradingOrchestra = new TradingOrchestra();