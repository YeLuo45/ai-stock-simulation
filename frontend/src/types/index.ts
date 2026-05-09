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

export interface Account {
  id: number;
  name: string;
  created_at: string;
}

export interface AccountWithPortfolio extends Account {
  portfolio: Portfolio;
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

export interface BacktestResponse {
  id: number;
  strategy_name: string;
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  total_trades: number;
  equity_curve: EquityPoint[];
}

export interface BatchBacktestResult {
  symbol: string;
  name: string;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  trade_count: number;
  strategy_type?: string;
}

export interface BatchBacktestResponse {
  results: BatchBacktestResult[];
  failed: string[];
  progress: number;
}

// ============== Backtest Compare ==============

export interface MonthlyStat {
  month: string;
  return: number;
}

export interface BacktestTrade {
  date: string;
  type: string;
  symbol: string;
  price: number;
  quantity: number;
  pnl: number;
}

export interface BacktestResult {
  strategyName: string;
  annualReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitLossRatio: number;
  totalTrades: number;
  equityCurve: { date: string; value: number }[];
  monthlyStats: MonthlyStat[];
  tradeLog: BacktestTrade[];
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
  base_url?: string;
  api_protocol?: APIProtocol;
  is_active: boolean;
  has_api_key: boolean;
}

export type Page = "home" | "selection" | "backtest" | "trading" | "analysis" | "settings" | "ipo" | "stockpool" | "optimize" | "strategybuilder" | "market" | "capitalflow" | "contest" | "portfolio_optimizer" | "evolution" | "memory" | "factor_editor" | "strategy_market" | "backtest_compare";

// ============== Stock Pool ==============

export interface StockPool {
  id: string;
  name: string;
  description?: string;
  stocks: StockInfo[];
  created_at: string;
  updated_at: string;
}

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

// ============== Parameter Optimization ==============

export interface ParameterRange {
  min: number;
  max: number;
  step: number;
}

export interface OptimizeRequest {
  strategy_name?: string;
  symbols?: string[];
  symbol?: string;  // 用于 demo 模式单只股票真实K线优化
  start_date?: string;
  end_date?: string;
  initial_cash?: number;
  ma_short_range: ParameterRange;
  ma_long_range: ParameterRange;
  stop_loss_range: ParameterRange;
  take_profit_range: ParameterRange;
  position_range: ParameterRange;
}

export interface OptimizeCombination {
  ma_short: number;
  ma_long: number;
  stop_loss: number;
  take_profit: number;
  position: number;
}

export interface OptimizeMetrics {
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  total_trades: number;
}

export interface OptimizeResultItem {
  params: OptimizeCombination;
  metrics: OptimizeMetrics;
}

export interface HeatmapPoint {
  ma_short: number;
  ma_long: number;
  total_return: number;
}

export interface ScatterPoint {
  max_drawdown: number;
  total_return: number;
  ma_short: number;
  ma_long: number;
}

export interface OptimizeResponse {
  batch_id: string;
  total_combinations: number;
}

export interface OptimizeProgress {
  batch_id: string;
  status: string;
  total_combinations: number;
  completed_combinations: number;
  current_combo: OptimizeCombination | null;
}

export interface OptimizeResultsResponse {
  batch_id: string;
  status: string;
  total_combinations: number;
  completed_combinations: number;
  top3: OptimizeResultItem[];
  heatmap_data: HeatmapPoint[];
  scatter_data: ScatterPoint[];
}

// ============== Stock Screener ==============

export interface FinancialCriteria {
  min_pe?: number;
  max_pe?: number;
  min_roe?: number;
  max_roe?: number;
  min_pb?: number;
  max_pb?: number;
  min_market_cap?: number; // in 亿
  max_market_cap?: number;
  dividend_yield_min?: number;
}

export interface TechnicalCriteria {
  ma_cross?: "golden" | "death"; // 金叉/死叉
  rsi_above?: number;
  rsi_below?: number;
  macd_signal?: "golden" | "death";
  volume_ratio_min?: number;
}

export interface SentimentCriteria {
  news_positive?: boolean;
}

export interface StockScreenerRequest {
  financial?: FinancialCriteria;
  technical?: TechnicalCriteria;
  sentiment?: SentimentCriteria;
}

export interface StockScreenerResponse {
  stocks: StockInfo[];
  total_count: number;
  filters_applied: string[];
}

// ============== Strategy Params (from Evolution) =============

export interface StrategyParams {
  ma_fast: number;
  ma_slow: number;
  rsi_oversold: number;
  rsi_overbought: number;
  bb_std: number;
  volume_threshold: number;
}

export interface AppliedStrategy {
  id: string;
  timestamp: number;
  fitness: number;
  params: StrategyParams;
  source: 'evolution';
}

// ============== Evolution / Genetic Algorithm ==============

export interface GeneRange {
  name: string;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
}

export interface EvolutionConfig {
  populationSize: number;
  generations: number;
  crossoverRate: number;
  mutationRate: number;
  elitismCount: number;
  tournamentSize: number;
  geneRanges: GeneRange[];
  optimizationDirection: 'maximize' | 'minimize';
  objectiveWeights?: number[];
}

export interface Chromosome {
  genes: number[];
  fitness: number;
  metrics?: OptimizeMetrics;
}

export interface EvolutionState {
  generation: number;
  population: Chromosome[];
  bestChromosome: Chromosome;
  bestEver: Chromosome;
  history: { generation: number; bestFitness: number; avgFitness: number }[];
  diversityScore: number;
}

export interface GAOptimizationRequest {
  strategy_name?: string;
  symbols?: string[];
  symbol?: string;
  start_date?: string;
  end_date?: string;
  initial_cash?: number;
  /** Override GA config */
  ga_config?: Partial<EvolutionConfig>;
  /** Use hybrid (grid search + GA) */
  hybrid?: boolean;
}

export interface GAOptimizationResponse {
  batch_id: string;
  status: 'running' | 'completed' | 'aborted';
  generation: number;
  total_generations: number;
  best_fitness: number;
  best_params?: Record<string, number>;
  best_metrics?: OptimizeMetrics;
  progress_pct: number;
}

// ============== Saved Strategy ==============

export interface SavedStrategy {
  id: string;
  name: string;
  tab: "financial" | "technical" | "sentiment";
  financial?: FinancialCriteria;
  technical?: TechnicalCriteria;
  sentiment?: SentimentCriteria;
  created_at: string;
}

// ============== Strategy Market ==============

export type StrategyCategory = 'technical' | 'fundamental' | 'quantitative' | 'ai' | 'hybrid';
export type StrategyRiskLevel = 'low' | 'medium' | 'high';
export type StrategyStatus = 'active' | 'inactive' | 'archived';

export interface StrategyAuthor {
  id: string;
  name: string;
  avatar?: string;
  verified?: boolean;
}

export interface StrategyMarketItem {
  id: string;
  name: string;
  description: string;
  author: StrategyAuthor;
  category: StrategyCategory;
  tags: string[];
  // Performance metrics
  total_return: number;
  annual_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
  // Risk assessment
  risk_level: StrategyRiskLevel;
  volatility: number;
  // Usage stats
  subscribers: number;
  rating: number;
  review_count: number;
  // Metadata
  version: string;
  created_at: string;
  updated_at: string;
  status: StrategyStatus;
  is_premium: boolean;
  is_featured: boolean;
  // Backtest summary
  backtest_start_date: string;
  backtest_end_date: string;
  initial_cash: number;
  // Strategy config snapshot
  config_snapshot?: {
    entry_conditions: string[];
    exit_conditions: string[];
    position_size: number;
    stop_loss: number;
    take_profit: number;
  };
}

export interface StrategyReview {
  id: string;
  strategy_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  content: string;
  pros: string[];
  cons: string[];
  created_at: string;
  helpful_count: number;
}

export interface StrategySubscription {
  id: string;
  strategy_id: string;
  user_id: string;
  subscribed_at: string;
  status: 'active' | 'cancelled';
}

export interface StrategyMarketFilters {
  category?: StrategyCategory;
  risk_level?: StrategyRiskLevel;
  min_rating?: number;
  min_annual_return?: number;
  max_drawdown?: number;
  tags?: string[];
  search?: string;
  sort_by: 'rating' | 'annual_return' | 'subscribers' | 'recent';
  sort_order: 'asc' | 'desc';
}

export interface StrategyMarketStats {
  total_strategies: number;
  total_subscribers: number;
  avg_rating: number;
  categories: Record<StrategyCategory, number>;
}

// ============== Follow Trading / Strategy Signals ==============

export interface StrategySignal {
  id: string;
  strategy_id: string;
  strategy_name: string;
  strategy_author: string;
  category: StrategyCategory;
  /** 'buy' | 'sell' | 'watch' */
  action: 'buy' | 'sell' | 'watch';
  symbol: string;
  name: string;
  /** Suggested entry price */
  price: number;
  /** Target price (for sell) or stop loss */
  target_price?: number;
  stop_loss?: number;
  /** Signal confidence 0-100 */
  confidence: number;
  /** Why this signal was generated */
  reason: string;
  /** Key conditions that triggered this signal */
  trigger_conditions: string[];
  /** ISO timestamp */
  generated_at: string;
  /** true once user has executed the trade */
  executed: boolean;
  /** true if signal has expired */
  expired: boolean;
  /** Strategy's risk level for this signal */
  risk_level: StrategyRiskLevel;
}

export interface FollowTrade {
  id: string;
  signal_id: string;
  strategy_id: string;
  strategy_name: string;
  symbol: string;
  name: string;
  action: 'buy' | 'sell';
  price: number;
  quantity: number;
  executed_at: string;
  /** P&L if closed */
  pnl?: number;
  pnl_pct?: number;
  /** Linking to trade record */
  trade_id?: number;
}

// ============== Memory / Notes ==============

export type MemoryType = "insight" | "note" | "trade_log" | "analysis" | "idea" | "trade_decision";

export interface MemoryTag {
  id: string;
  name: string;
  color?: string;
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  symbol?: string;       // associated stock symbol
  created_at: string;
  updated_at: string;
  is_pinned?: boolean;
  is_favorite?: boolean;
  // === 策略记忆系统增强字段 ===
  linkedTradeId?: string;
  linkedPositionId?: string;
  outcome?: 'pending' | 'profit' | 'loss' | 'stop_loss' | 'take_profit';
  pnlPercent?: number;
  holdingDays?: number;
  decisionFactors?: string[];
  auto?: boolean;        // 标记是否自动生成
}

export interface MemoryStats {
  total: number;
  byType: Record<MemoryType, number>;
  recentCount: number;
  favoriteCount: number;
}

// ============== Factor Engine ==============

export type FactorCategory = 'price' | 'technical' | 'financial' | 'sentiment' | 'custom';
export type FactorDataType = 'number' | 'boolean' | 'enum';
export type FactorScope = 'stock' | 'market';

export interface FactorDefinition {
  id: string;
  name: string;
  name_cn: string;
  description: string;
  category: FactorCategory;
  data_type: FactorDataType;
  scope: FactorScope;
  /** JSONata or simple expression formula for computed factors */
  formula?: string;
  /** Available parameters in formula */
  params?: string[];
  /** Default value when data unavailable */
  default_value?: number | boolean;
  /** Min/Max for normalization reference */
  norm_min?: number;
  norm_max?: number;
  /** UI display order */
  order: number;
  /** Hidden from editor */
  hidden?: boolean;
}

export interface FactorValue {
  factor_id: string;
  symbol: string;
  value: number | boolean;
  timestamp: string;
}

export interface FactorSignal {
  factor_id: string;
  symbol: string;
  signal: 'long' | 'short' | 'neutral';
  strength: number; // 0-1
  value: number;
  timestamp: string;
}

export interface FactorPortfolio {
  id: string;
  name: string;
  description?: string;
  factors: FactorWeight[];
  created_at: string;
  updated_at: string;
}

export interface FactorWeight {
  factor_id: string;
  weight: number; // can be negative for short
  direction: 'long' | 'short' | 'both';
}

export interface FactorBacktestRequest {
  portfolio_id?: string;
  factors?: FactorWeight[];
  symbols: string[];
  start_date: string;
  end_date: string;
  initial_cash?: number;
  rebalance_interval?: number; // days, default 5
  top_n?: number; // top N stocks to hold
  long_short?: boolean; // include long/short portfolio
}

export interface FactorBacktestResult {
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  total_trades: number;
  equity_curve: EquityPoint[];
  long_return: number;
  short_return: number;
  long_short_return: number;
  factor_returns: Record<string, number>; // factor_id -> return contribution
  trades: FactorTrade[];
}

export interface FactorTrade {
  date: string;
  symbol: string;
  action: 'buy' | 'sell';
  price: number;
  reason: string;
  factor_values: Record<string, number>;
}

export interface SavedFactor {
  id: string;
  name: string;
  name_cn: string;
  description: string;
  category: FactorCategory;
  formula: string;
  params: string[];
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  tags: string[];
}

// Factor screening
export interface FactorScreenerRequest {
  factors: FactorWeight[];
  symbols: string[];
  filters?: {
    min_value?: number;
    max_value?: number;
    include_symbols?: string[];
    exclude_symbols?: string[];
  };
  sort_by?: string;
  sort_desc?: boolean;
  limit?: number;
}

export interface FactorScreenerResult {
  symbol: string;
  name: string;
  scores: Record<string, number>;
  composite_score: number;
  rank: number;
}

