/**
 * Trading Orchestra Types - Multi-Agent Trading System
 * V40: Four-agent collaboration with regime-aware evolution
 */

// Market regime types (aligned with existing RegimeDetector)
export type MarketRegime = 'BULL' | 'BEAR' | 'RANGEBOUND' | 'HIGH_VOL' | 'LOW_VOL' | 'UNKNOWN';

// Agent decision types
export type AgentAction = 'buy' | 'sell' | 'hold' | 'pass' | 'buy_spot_sell_future' | 'buy_future_sell_spot';

export interface AgentDecision {
  agent: string;
  action: AgentAction;
  confidence: number; // 0-1
  reasoning: string;
  timestamp: number;
  regime?: MarketRegime;
}

// Market context for agent decisions
export interface MarketContext {
  symbol: string;
  price: number;
  change_pct: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number;
  ma5?: number;
  ma20?: number;
  ma60?: number;
  rsi?: number;
  macd?: number;
  macd_signal?: number;
  macd_hist?: number;
  volume_ratio?: number;
  regime?: MarketRegime;
}

// Orchestrated decision (aggregated from all agents)
export interface OrchestratedDecision {
  action: AgentAction;
  confidence: number;
  reasoning: string;
  votes: AgentDecision[];
  regime: MarketRegime;
  timestamp: number;
  weights: Record<string, number>; // agent weights at decision time
}

// Trading agent interface
export interface TradingAgent {
  name: string;
  role: string;
  weight: number;
  decide(context: MarketContext): Promise<AgentDecision>;
  updateWeight(performance: number): void;
}

// Agent performance record
export interface AgentPerformance {
  agent: string;
  totalDecisions: number;
  successfulDecisions: number;
  failedDecisions: number;
  avgPnL: number;
  lastUpdated: number;
}

// Regime weights mapping
export interface RegimeWeightMap {
  [regime: string]: {
    trend: number;
    mean_reversion: number;
    arbitrage: number;
    risk_control: number;
  };
}

// Orchestrator config
export interface OrchestraConfig {
  enableEvolution: boolean;
  evolutionThreshold: number; // success rate threshold to trigger evolution
  confidenceThreshold: number; // minimum confidence to execute trade
  autoDetectRegime: boolean;
}