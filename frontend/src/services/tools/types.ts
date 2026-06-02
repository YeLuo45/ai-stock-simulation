/**
 * Trading Tools System - Shared Types
 * Based on nanobot-design tool registry pattern
 */

// ============ Core Types ============

export type ToolCategory = 'indicator' | 'risk' | 'data' | 'backtest' | 'mcp';
export type RegimeType = 'bull' | 'bear' | 'sideways' | 'volatile';

export interface ToolInput {
  [key: string]: unknown;
}

export interface ToolOutput {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime?: number;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  parameters: Record<string, unknown>;
  isMcp?: boolean;
}

export interface TradingTool {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  execute(input: ToolInput): Promise<ToolOutput>;
  getDefinition(): ToolDefinition;
}

// ============ Strategy Skill Types ============

export interface StrategySkill {
  id: string;
  name: string;
  pattern: {
    tickers: string[];
    regime: RegimeType;
  };
  successRate: number;
  avgReturn: number;
  usageCount: number;
  code: string;
  createdAt: string;
  entryConditions: string[];
  exitConditions: string[];
  stopLoss: number;
  takeProfit: number;
}

export interface StrategyCrystallizeRequest {
  sessionId: string;
  ticker: string;
  regime: RegimeType;
  decision: TradingDecision;
  outcome: TradeOutcome;
}

export interface TradingDecision {
  id: string;
  ticker: string;
  regime: string;
  strategy: string;
  action: 'buy' | 'sell' | 'hold';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string;
  timestamp: number;
}

export interface TradeOutcome {
  tradeId: string;
  action: 'buy' | 'sell' | 'hold';
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  realized: boolean;
  timestamp: number;
}

// ============ Indicator Types ============

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MAResult {
  ma5: number;
  ma10: number;
  ma20: number;
  ma60: number;
}

export interface RSIResult {
  value: number;
  status: 'oversold' | 'overbought' | 'neutral';
}

export interface MACDResult {
  macd: number;
  signal: number;
  hist: number;
  status: 'bullish' | 'bearish' | 'neutral';
}

export interface BollingerBandsResult {
  mid: number;
  upper: number;
  lower: number;
  bandwidth: number;
  position: number; // %B
}

export interface ATRResult {
  value: number;
  smoothed: number;
}

// ============ Risk Calculator Types ============

export interface PositionSizeInput {
  accountBalance: number;
  riskPercent: number;
  entryPrice: number;
  stopLoss: number;
}

export interface PositionSizeResult {
  positionSize: number;
  riskAmount: number;
  maxLoss: number;
  rewardRiskRatio: number;
}

export interface RiskEvaluatorInput {
  accountBalance: number;
  positionValue: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
}

export interface RiskEvaluatorResult {
  riskRewardRatio: number;
  probabilityOfLoss: number;
  expectedValue: number;
  kellyFraction: number;
  positionSizing: PositionSizeResult;
}

// ============ Backtest Types ============

export interface BacktestConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  initialCash: number;
  strategyType: 'trend' | 'mean_reversion' | 'rsi' | 'macd' | 'boll' | 'custom';
  params: Record<string, number>;
}

export interface BacktestSignal {
  date: string;
  type: 'buy' | 'sell' | 'hold';
  price: number;
  quantity: number;
  pnl?: number;
  reason: string;
}

export interface BacktestMetrics {
  totalReturn: number;
  annualReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitLossRatio: number;
  totalTrades: number;
  avgHoldingPeriod: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  metrics: BacktestMetrics;
  equityCurve: { date: string; value: number }[];
  trades: BacktestSignal[];
  monthlyStats: { month: string; return: number }[];
}

export interface MonteCarloConfig {
  simulations: number;
  years: number;
  initialInvestment: number;
  annualReturn: number;
  volatility: number;
}

export interface MonteCarloResult {
  median: number;
  percentile5: number;
  percentile95: number;
  probabilityOfLoss: number;
  projections: number[][];
}

// ============ Data Provider Types ============

export interface DataProviderConfig {
  name: string;
  enabled: boolean;
  priority: number;
  apiKey?: string;
  baseUrl?: string;
}

export interface MarketDataRequest {
  symbol: string;
  startDate?: string;
  endDate?: string;
  interval?: '1d' | '1w' | '1m';
}

export interface MarketDataResponse {
  symbol: string;
  data: OHLCV[];
  provider: string;
  timestamp: number;
}

// ============ Sandbox Types ============

export interface SandboxConfig {
  maxExecutionTime: number; // ms
  allowedDomains: string[];
  enableNetwork: boolean;
  enableFileSystem: boolean;
  memoryLimit?: number;
}

export interface SandboxExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
  memoryUsed?: number;
}

// ============ MCP Types ============

export interface MCPBrokerConfig {
  broker: string;
  apiKey: string;
  accountId?: string;
  enabled: boolean;
}

export interface MCPRealTimeQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
}