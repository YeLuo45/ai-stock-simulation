/**
 * DebatePipeline - 6 Phase Orchestrator
 * Scan → Analyze → Research → Debate → Execute → Review
 * 
 * Coordinates all 13 agents through the debate pipeline
 */

import { DebatePhase, PhaseResult, PipelineContext, PHASE_SEQUENCE, PHASE_NAMES } from './types';
import { FundamentalAnalyst } from '../agents/FundamentalAnalyst';
import { TechnicalAnalyst } from '../agents/TechnicalAnalyst';
import { MarketAnalyst } from '../agents/MarketAnalyst';
import { SentimentAnalyst } from '../agents/SentimentAnalyst';
import { DataResearcher } from '../agents/DataResearcher';
import { NewsResearcher } from '../agents/NewsResearcher';
import { BullAgent } from '../BullAgent';
import { BearAgent } from '../BearAgent';
import { JudgeAgent } from '../JudgeAgent';
import { StrategyManager } from '../agents/StrategyManager';
import { PortfolioManager } from '../agents/PortfolioManager';
import { TradingTrader } from '../agents/TradingTrader';
import { createAgentMessage, createTraceId } from '../../../agents/messages';
import type { AgentMessage } from '../../../agents/messages';
import type { AnalystPayload } from '../types/AnalystType';
import type { ResearcherPayload } from '../types/ResearcherType';
import type { DebateArgument } from '../types/DebaterType';
import type { StrategyManagerPayload } from '../types/ManagerType';
import type { PortfolioManagerPayload } from '../types/ManagerType';
import type { TradingPayload } from '../types/TraderType';

export class DebatePipeline {
  private traceId: string;
  private context: PipelineContext;
  private phaseResults: Map<DebatePhase, PhaseResult>;

  constructor(stockCode: string, candidates: string[] = []) {
    this.traceId = createTraceId();
    this.phaseResults = new Map();
    this.context = {
      traceId: this.traceId,
      stockCode,
      candidates,
      phaseResults: this.phaseResults,
      currentPhase: DebatePhase.SCAN,
      startTime: Date.now(),
      errors: [],
    };
  }

  /**
   * Execute the full 6-phase pipeline
   */
  async execute(): Promise<PipelineContext> {
    console.log(`[DebatePipeline] Starting pipeline ${this.traceId} for ${this.context.stockCode}`);

    for (const phase of PHASE_SEQUENCE) {
      this.context.currentPhase = phase;
      const result = await this.executePhase(phase);
      this.phaseResults.set(phase, result);
      this.context.phaseResults.set(phase, result);

      if (!result.success) {
        console.warn(`[DebatePipeline] Phase ${phase} failed: ${result.error}`);
        this.context.errors.push(`Phase ${phase}: ${result.error}`);
      }

      console.log(`[DebatePipeline] Phase ${phase} completed in ${result.duration}ms`);
    }

    this.context.endTime = Date.now();
    console.log(`[DebatePipeline] Pipeline ${this.traceId} completed in ${this.context.endTime - this.context.startTime}ms`);

    return this.context;
  }

  /**
   * Execute a single phase
   */
  private async executePhase(phase: DebatePhase): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      switch (phase) {
        case DebatePhase.SCAN:
          return await this.executeScan();
        case DebatePhase.ANALYZE:
          return await this.executeAnalyze();
        case DebatePhase.RESEARCH:
          return await this.executeResearch();
        case DebatePhase.DEBATE:
          return await this.executeDebate();
        case DebatePhase.EXECUTE:
          return await this.executeExecute();
        case DebatePhase.REVIEW:
          return await this.executeReview();
        default:
          return { phase, success: false, error: 'Unknown phase', duration: 0, timestamp: Date.now() };
      }
    } catch (err) {
      return {
        phase,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Phase 1: SCAN - Scan market data, identify candidate stocks
   */
  private async executeScan(): Promise<PhaseResult> {
    const startTime = Date.now();

    // In production, this would scan real market data
    const candidates = this.context.candidates.length > 0 
      ? this.context.candidates 
      : [this.context.stockCode];

    return {
      phase: DebatePhase.SCAN,
      success: true,
      data: { candidates, count: candidates.length },
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * Phase 2: ANALYZE - Run all 4 analysts in parallel
   */
  private async executeAnalyze(): Promise<PhaseResult> {
    const startTime = Date.now();

    const analysts = [
      { name: 'fundamental_analyst', handler: FundamentalAnalyst },
      { name: 'technical_analyst', handler: TechnicalAnalyst },
      { name: 'market_analyst', handler: MarketAnalyst },
      { name: 'sentiment_analyst', handler: SentimentAnalyst },
    ];

    const payload: AnalystPayload = {
      stockCode: this.context.stockCode,
    };

    const message = createAgentMessage('supervisor', 'fundamental_analyst', 'request', payload, this.traceId);

    // Run analysts in parallel
    const results = await Promise.all(
      analysts.map(async ({ name, handler }) => {
        try {
          const response = await handler.process(message);
          return { name, success: response.type !== 'error', data: response.payload };
        } catch {
          return { name, success: false, data: null };
        }
      })
    );

    const analysisResults = results.reduce((acc, r) => {
      acc[r.name] = r.data;
      return acc;
    }, {} as Record<string, unknown>);

    return {
      phase: DebatePhase.ANALYZE,
      success: results.every(r => r.success),
      data: analysisResults,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * Phase 3: RESEARCH - Run both researchers in parallel
   */
  private async executeResearch(): Promise<PhaseResult> {
    const startTime = Date.now();

    const researchers = [
      { name: 'data_researcher', handler: DataResearcher },
      { name: 'news_researcher', handler: NewsResearcher },
    ];

    const payload: ResearcherPayload = {
      stockCode: this.context.stockCode,
      query: { symbol: this.context.stockCode, metrics: ['PE', 'PB'], interval: '1d' as const, maxResults: 10 },
    };

    const message = createAgentMessage('supervisor', 'data_researcher', 'request', payload, this.traceId);

    // Run researchers in parallel
    const results = await Promise.all(
      researchers.map(async ({ name, handler }) => {
        try {
          const response = await handler.process(message);
          return { name, success: response.type !== 'error', data: response.payload };
        } catch {
          return { name, success: false, data: null };
        }
      })
    );

    const researchResults = results.reduce((acc, r) => {
      acc[r.name] = r.data;
      return acc;
    }, {} as Record<string, unknown>);

    return {
      phase: DebatePhase.RESEARCH,
      success: results.every(r => r.success),
      data: researchResults,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * Phase 4: DEBATE - Run Bull/Bear/Judge debate
   */
  private async executeDebate(): Promise<PhaseResult> {
    const startTime = Date.now();

    // Get analysis from previous phases
    const analyzeResult = this.phaseResults.get(DebatePhase.ANALYZE);
    const fundamentalAnalysis = (analyzeResult?.data as Record<string, unknown>)?.fundamental_analyst;
    
    const bullPayload = {
      stockCode: this.context.stockCode,
      analysisSummary: JSON.stringify(fundamentalAnalysis || {}),
    };

    const bearPayload = {
      stockCode: this.context.stockCode,
      analysisSummary: JSON.stringify(fundamentalAnalysis || {}),
    };

    // Run bull and bear in parallel
    const [bullResponse, bearResponse] = await Promise.all([
      BullAgent.process(createAgentMessage('supervisor', 'bull', 'request', bullPayload, this.traceId)),
      BearAgent.process(createAgentMessage('supervisor', 'bear', 'request', bearPayload, this.traceId)),
    ]);

    const bullArguments = (bullResponse.payload as { arguments?: DebateArgument[] })?.arguments || [];
    const bearArguments = (bearResponse.payload as { arguments?: DebateArgument[] })?.arguments || [];

    // Run judge with bull/bear arguments
    const judgePayload = {
      stockCode: this.context.stockCode,
      bullArguments,
      bearArguments,
      positions: [],
      portfolioCash: 100000,
    };

    const judgeResponse = await JudgeAgent.process(
      createAgentMessage('supervisor', 'judge', 'request', judgePayload, this.traceId)
    );

    return {
      phase: DebatePhase.DEBATE,
      success: judgeResponse.type === 'response',
      data: {
        bullArguments,
        bearArguments,
        verdict: judgeResponse.payload,
      },
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * Phase 5: EXECUTE - Strategy and Portfolio management, then trade
   */
  private async executeExecute(): Promise<PhaseResult> {
    const startTime = Date.now();

    // Get debate result
    const debateResult = this.phaseResults.get(DebatePhase.DEBATE);
    const verdict = (debateResult?.data as { verdict?: unknown })?.verdict;

    // Strategy manager
    const strategyPayload: StrategyManagerPayload = {
      stockCode: this.context.stockCode,
      analysisResults: {},
      debateResults: {
        bullArguments: ((debateResult?.data as { bullArguments?: DebateArgument[] })?.bullArguments || []) as unknown[],
        bearArguments: ((debateResult?.data as { bearArguments?: DebateArgument[] })?.bearArguments || []) as unknown[],
        verdict: verdict as unknown,
      },
      currentPositions: [],
      portfolioCash: 100000,
    };

    const strategyResponse = await StrategyManager.process(
      createAgentMessage('supervisor', 'strategy_manager', 'request', strategyPayload, this.traceId)
    );

    const signals = ((strategyResponse.payload as { plan?: { signals?: unknown[] } })?.plan?.signals || []);

    // Portfolio manager
    const portfolioPayload: PortfolioManagerPayload = {
      currentPositions: [],
      portfolioCash: 100000,
      signals: signals as any[],
    };

    const portfolioResponse = await PortfolioManager.process(
      createAgentMessage('supervisor', 'portfolio_manager', 'request', portfolioPayload, this.traceId)
    );

    // Trading trader (dry run)
    const allocations = (portfolioResponse.payload as { allocations?: unknown[] })?.allocations || [];
    const firstSignal = signals[0] as { action?: string; symbol?: string } | undefined;

    if (firstSignal && (firstSignal.action === 'BUY' || firstSignal.action === 'SELL')) {
      const tradingPayload: TradingPayload = {
        stockCode: this.context.stockCode,
        action: firstSignal.action as 'BUY' | 'SELL',
        quantityType: 'percentage',
        quantity: 10,
        priceType: 'market',
        dryRun: true,
      };

      await TradingTrader.process(
        createAgentMessage('supervisor', 'trading_trader', 'request', tradingPayload, this.traceId)
      );
    }

    return {
      phase: DebatePhase.EXECUTE,
      success: true,
      data: {
        strategy: strategyResponse.payload,
        portfolio: portfolioResponse.payload,
        allocations,
      },
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * Phase 6: REVIEW - Review and update memory
   */
  private async executeReview(): Promise<PhaseResult> {
    const startTime = Date.now();

    // Summarize pipeline results
    const summary = {
      traceId: this.traceId,
      stockCode: this.context.stockCode,
      duration: Date.now() - this.context.startTime,
      phases: Array.from(this.phaseResults.entries()).map(([phase, result]) => ({
        phase,
        success: result.success,
        duration: result.duration,
      })),
      verdict: (this.phaseResults.get(DebatePhase.DEBATE)?.data as { verdict?: unknown })?.verdict,
    };

    return {
      phase: DebatePhase.REVIEW,
      success: true,
      data: summary,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * Get pipeline context
   */
  getContext(): PipelineContext {
    return this.context;
  }

  /**
   * Get phase result
   */
  getPhaseResult(phase: DebatePhase): PhaseResult | undefined {
    return this.phaseResults.get(phase);
  }

  /**
   * Get all phase results
   */
  getAllPhaseResults(): Map<DebatePhase, PhaseResult> {
    return new Map(this.phaseResults);
  }
}

/**
 * Create a new pipeline instance
 */
export function createDebatePipeline(stockCode: string, candidates?: string[]): DebatePipeline {
  return new DebatePipeline(stockCode, candidates);
}