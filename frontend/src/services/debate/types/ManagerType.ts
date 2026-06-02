/**
 * Manager Types - Strategy and Portfolio manager specializations
 */

export enum ManagerType {
  STRATEGY = 'STRATEGY',
  PORTFOLIO = 'PORTFOLIO',
}

export interface ManagerConfig {
  type: ManagerType;
  enabled: boolean;
  maxPositions: number;
  riskTolerance: 'low' | 'medium' | 'high';
}

export interface StrategySignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  positionSize?: number;
  rationale: string;
  sourceAgents: string[];
  timestamp: number;
}

export interface StrategyPlan {
  id: string;
  name: string;
  signals: StrategySignal[];
  overallConfidence: number;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    maxDrawdown?: number;
    var?: number;
  };
  expectedReturn?: number;
  timestamp: number;
}

export interface StrategyManagerPayload {
  stockCode: string;
  analysisResults: {
    fundamental?: unknown;
    technical?: unknown;
    market?: unknown;
    sentiment?: unknown;
  };
  debateResults?: {
    bullArguments: unknown[];
    bearArguments: unknown[];
    verdict?: unknown;
  };
  currentPositions: {
    symbol: string;
    quantity: number;
    avg_cost: number;
  }[];
  portfolioCash: number;
}

export interface StrategyManagerResponse {
  type: ManagerType.STRATEGY;
  stockCode: string;
  plan: StrategyPlan;
  timestamp: number;
}

export interface PortfolioAllocation {
  symbol: string;
  targetWeight: number;
  currentWeight: number;
  action: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
  shares: number;
  estimatedPrice: number;
  priority: number;
}

export interface PortfolioRebalance {
  cashNeeded: number;
  cashAvailable: number;
  trades: {
    symbol: string;
    action: 'BUY' | 'SELL';
    shares: number;
    estimatedProceeds: number;
  }[];
  timestamp: number;
}

export interface PortfolioManagerPayload {
  currentPositions: {
    symbol: string;
    quantity: number;
    avg_cost: number;
    currentPrice: number;
    marketValue: number;
  }[];
  portfolioCash: number;
  signals: StrategySignal[];
  targetTotalValue?: number;
}

export interface PortfolioManagerResponse {
  type: ManagerType.PORTFOLIO;
  allocations: PortfolioAllocation[];
  rebalance?: PortfolioRebalance;
  portfolioValue: number;
  cashBalance: number;
  timestamp: number;
}

export type ManagerResponse = StrategyManagerResponse | PortfolioManagerResponse;