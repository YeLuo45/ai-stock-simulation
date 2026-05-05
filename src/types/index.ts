// Shared types for the AI Stock Simulation frontend

export interface StockInfo {
  symbol: string;
  name: string;
  market?: string;
  price: number;
  change_pct: number;
  volume: number;
  pe?: number;
  pb?: number;
  roe?: number;
  market_cap?: number;
}

export interface StockSelectionRequest {
  query: string;
}

export interface StockSelectionResponse {
  stocks: StockInfo[];
  ai_reasoning: string;
}

export interface Position {
  id: number;
  symbol: string;
  name: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  profit_loss: number;
  profit_loss_pct: number;
}

export interface Portfolio {
  id: number;
  name: string;
  cash: number;
  total_market_value: number;
  total_assets: number;
  total_profit_loss: number;
  total_profit_loss_pct: number;
  positions: Position[];
}

export interface TradeRequest {
  symbol: string;
  name: string;
  trade_type: "buy" | "sell";
  quantity: number;
  price?: number;
}

export interface Trade {
  id: number;
  symbol: string;
  name: string;
  trade_type: string;
  price: number;
  quantity: number;
  commission: number;
  stamp_tax?: number; // Only applicable for sell trades
  total_cost: number;
  timestamp: string;
}

export interface BacktestRequest {
  strategy_name: string;
  symbols?: string[];
  start_date: string;
  end_date: string;
  initial_cash: number;
  params: Record<string, unknown>;
}

export interface EquityPoint {
  date: string;
  value: number;
}

export interface DrawdownPoint {
  date: string;
  drawdown: number;
  peak: number;
  equity: number;
}

export interface ReturnDistribution {
  range: string;
  count: number;
  percentage: number;
}

export interface BacktestResponse {
  id: number;
  strategy_name: string;
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  profit_loss_ratio: number;
  total_trades: number;
  equity_curve: EquityPoint[];
  drawdown_curve: DrawdownPoint[];
  return_distribution: ReturnDistribution[];
  monthly_returns: { month: string; return_pct: number }[];
  trades: BacktestTrade[];
  kline_data?: { time: string; open: number; high: number; low: number; close: number; volume: number }[];
}

export interface BacktestTrade {
  date: string;
  symbol: string;
  type: "buy" | "sell";
  price: number;
  quantity: number;
  amount: number;
  profit?: number;
}

export interface TechnicalIndicators {
  MA5?: number;
  MA10?: number;
  MA20?: number;
  MA60?: number;
  RSI?: number;
  MACD?: number;
  MACD_SIGNAL?: number;
  MACD_HIST?: number;
  KDJ_K?: number;
  KDJ_D?: number;
  KDJ_J?: number;
  BOLL_MID?: number;
  BOLL_UPPER?: number;
  BOLL_LOWER?: number;
}

export interface TechnicalAnalysis {
  symbol: string;
  name: string;
  current_price: number;
  indicators: TechnicalIndicators;
  ai_summary: string;
  support_resistance: {
    support: number;
    resistance: number;
  };
}

export type APIProtocol = "openai_compatible" | "anthropic" | "google";

export interface AIModelConfig {
  model_name: string;
  api_key?: string;
  base_url?: string;
  api_protocol?: APIProtocol;
  is_active: boolean;
  has_api_key?: boolean;
}

export type Page = "home" | "selection" | "backtest" | "trading" | "analysis" | "settings" | "ipo";

// ============== IPO Evaluation ==============

export interface FundamentalData {
  pe?: number;
  pb?: number;
  roe?: number;
  gross_margin?: number;
  revenue_growth?: number;
  net_profit_growth?: number;
  issue_price?: number;
  current_price?: number;
  listing_days?: number;
}

export interface TechnicalData {
  trend: "上涨" | "震荡" | "下跌";
  rsi?: number;
  macd_signal?: string;
  support_level?: number;
  resistance_level?: number;
  ma5?: number;
  ma20?: number;
  current_price?: number;
  change_pct?: number;
}

export type Recommendation = "强烈推荐" | "推荐" | "中性" | "回避" | "强烈回避";

export interface IPOEvaluationResult {
  stock_code: string;
  stock_name: string;
  score: number;
  recommendation: Recommendation;
  fundamental: FundamentalData;
  technical: TechnicalData;
  analysis: string;
  data_sources: string[];
  evaluated_at: string;
}

// ============== Data Source ==============

export interface DataSourceItem {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  status: string;
}

export interface DataSourceResponse {
  sources: DataSourceItem[];
}

// ============== AI Model Priority ==============

export interface AIModelPriorityResponse {
  priority: string[];
}

