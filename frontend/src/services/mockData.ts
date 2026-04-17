/**
 * Mock data for demo mode (GitHub Pages deployment)
 * Used when VITE_DEMO_MODE=true
 */
import type {
  StockSelectionResponse,
  Portfolio,
  Trade,
  BacktestResponse,
  TechnicalAnalysis,
  AIModelConfig,
  IPOEvaluationResult,
  DataSourceResponse,
  AIModelPriorityResponse,
} from "../types";

// Stock search results
export const mockStocks = [
  { symbol: "000001", name: "平安银行", market: "深圳", price: 12.35, change_pct: 1.23, volume: 45678900, pe: 8.5, pb: 0.92, roe: 10.8, market_cap: 238000000000 },
  { symbol: "600519", name: "贵州茅台", market: "上海", price: 1688.00, change_pct: -0.45, volume: 2345678, pe: 32.1, pb: 11.2, roe: 35.2, market_cap: 2120000000000 },
  { symbol: "000002", name: "万科A", market: "深圳", price: 8.92, change_pct: 2.34, volume: 34567890, pe: 7.2, pb: 0.85, roe: 11.5, market_cap: 104000000000 },
  { symbol: "600036", name: "招商银行", market: "上海", price: 35.67, change_pct: 0.89, volume: 12345678, pe: 9.8, pb: 1.23, roe: 12.5, market_cap: 896000000000 },
  { symbol: "000858", name: "五粮液", market: "深圳", price: 145.23, change_pct: -1.12, volume: 5678901, pe: 22.5, pb: 5.8, roe: 25.8, market_cap: 563000000000 },
  { symbol: "688001", name: "华兴源创", market: "科创板", price: 28.45, change_pct: 3.45, volume: 1234567, pe: 45.2, pb: 3.2, roe: 8.5, market_cap: 128000000000 },
  { symbol: "300750", name: "宁德时代", market: "创业板", price: 189.50, change_pct: 1.78, volume: 9876543, pe: 28.5, pb: 6.8, roe: 24.2, market_cap: 4420000000000 },
];

export const mockPortfolio: Portfolio = {
  id: 1,
  name: "我的模拟账户",
  cash: 856789.45,
  total_market_value: 143210.55,
  total_assets: 1000000,
  total_profit_loss: -15000,
  total_profit_loss_pct: -1.5,
  positions: [
    { id: 1, symbol: "600519", name: "贵州茅台", quantity: 50, avg_cost: 1750.00, current_price: 1688.00, market_value: 84400, profit_loss: -3100, profit_loss_pct: -3.54 },
    { id: 2, symbol: "000001", name: "平安银行", quantity: 5000, avg_cost: 11.80, current_price: 12.35, market_value: 61750, profit_loss: 2750, profit_loss_pct: 4.66 },
    { id: 3, symbol: "300750", name: "宁德时代", quantity: 100, avg_cost: 195.00, current_price: 189.50, market_value: 18950, profit_loss: -550, profit_loss_pct: -2.82 },
  ],
};

export const mockTrades: Trade[] = [
  { id: 1, symbol: "600519", name: "贵州茅台", trade_type: "buy", price: 1750.00, quantity: 50, commission: 87.50, total_cost: 87587.50, timestamp: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 2, symbol: "000001", name: "平安银行", trade_type: "buy", price: 11.80, quantity: 5000, commission: 59.00, total_cost: 59059.00, timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 3, symbol: "300750", name: "宁德时代", trade_type: "buy", price: 195.00, quantity: 100, commission: 19.50, total_cost: 19519.50, timestamp: new Date(Date.now() - 86400000 * 1).toISOString() },
  { id: 4, symbol: "000002", name: "万科A", trade_type: "sell", price: 9.20, quantity: 2000, commission: 18.40, total_cost: -18381.60, timestamp: new Date(Date.now() - 86400000 * 5).toISOString() },
];

export const mockBacktestResults: BacktestResponse[] = [
  {
    id: 1,
    strategy_name: "价值投资策略",
    total_return: 28.5,
    annual_return: 14.2,
    max_drawdown: -12.3,
    sharpe_ratio: 1.35,
    win_rate: 0.62,
    total_trades: 24,
    equity_curve: Array.from({ length: 30 }, (_, i) => ({ date: `2026-0${Math.floor(i / 3) + 1}-${(i % 30) + 1}`, value: 1000000 + (i * 8000) + Math.sin(i) * 20000 })),
  },
  {
    id: 2,
    strategy_name: "趋势跟踪策略",
    total_return: 18.3,
    annual_return: 9.1,
    max_drawdown: -18.5,
    sharpe_ratio: 0.88,
    win_rate: 0.55,
    total_trades: 42,
    equity_curve: Array.from({ length: 30 }, (_, i) => ({ date: `2026-0${Math.floor(i / 3) + 1}-${(i % 30) + 1}`, value: 1000000 + (i * 6000) + Math.cos(i) * 15000 })),
  },
];

export const mockTechnicalAnalysis: TechnicalAnalysis = {
  symbol: "600519",
  name: "贵州茅台",
  current_price: 1688.00,
  indicators: {
    MA5: 1695.20, MA10: 1688.50, MA20: 1675.30, MA60: 1650.80,
    RSI: 48.5, MACD: 12.35, MACD_SIGNAL: 10.20, MACD_HIST: 2.15,
    KDJ_K: 45.2, KDJ_D: 48.8, KDJ_J: 38.0,
    BOLL_MID: 1680.00, BOLL_UPPER: 1725.50, BOLL_LOWER: 1634.50,
  },
  ai_summary: "贵州茅台当前处于震荡调整阶段，RSI指标显示市场情绪偏中性。MACD红柱有所收窄，KDJ指标形成死叉，短期可能面临调整压力。长期来看，作为白酒龙头，基本面稳健，建议逢低布局。",
  support_resistance: { support: 1650, resistance: 1750 },
};

export const mockModelConfigs: AIModelConfig[] = [
  { model_name: "minimax", base_url: "https://api.minimax.chat", api_protocol: "openai_compatible", is_active: true, has_api_key: true },
  { model_name: "zhipu", base_url: "https://open.bigmodel.cn", api_protocol: "openai_compatible", is_active: false, has_api_key: false },
  { model_name: "claude", base_url: "https://api.anthropic.com", api_protocol: "anthropic", is_active: false, has_api_key: false },
  { model_name: "gemini", base_url: "https://generativelanguage.googleapis.com", api_protocol: "google", is_active: false, has_api_key: false },
];

export const mockIPOResult: IPOEvaluationResult = {
  stock_code: "688001",
  stock_name: "华兴源创",
  score: 72,
  recommendation: "推荐",
  fundamental: { pe: 45.2, pb: 3.2, roe: 8.5, gross_margin: 45.2, revenue_growth: 15.3, net_profit_growth: 12.8, issue_price: 24.25, current_price: 28.45, listing_days: 156 },
  technical: { trend: "上涨", rsi: 62.5, macd_signal: "金叉", support_level: 25.50, resistance_level: 30.20, ma5: 27.80, ma20: 26.50, current_price: 28.45, change_pct: 3.45 },
  analysis: "华兴源创作为科创板首批上市企业，主营平板显示及集成电路检测设备，受益于半导体国产替代趋势。公司营收保持稳定增长，毛利率维持在较高水平。技术面上，股价处于上升趋势，RSI指标健康，MACD形成金叉，短期有望继续走强。综合评分72分，给予「推荐」评级。",
  data_sources: ["东方财富", "同花顺"],
  evaluated_at: new Date().toISOString(),
};

export const mockDataSources: DataSourceResponse = {
  sources: [
    { id: "eastmoney", name: "东方财富", enabled: true, priority: 1, status: "available" },
    { id: "tonghuashun", name: "同花顺", enabled: true, priority: 2, status: "available" },
    { id: "joinquant", name: "聚宽", enabled: false, priority: 3, status: "disabled" },
  ],
};

export const mockAIModelPriority: AIModelPriorityResponse = {
  priority: ["minimax", "zhipu", "claude", "gemini"],
};

// Stock selection mock
export const mockStockSelection = async (query: string): Promise<StockSelectionResponse> => {
  await new Promise(r => setTimeout(r, 800));
  const filtered = mockStocks.filter(s =>
    s.name.includes(query) || s.symbol.includes(query)
  );
  return {
    stocks: filtered.length > 0 ? filtered : mockStocks.slice(0, 3),
    ai_reasoning: `根据"${query}"的语义分析，筛选出以下符合条件的高质量股票：${filtered.length > 0 ? filtered.map(s => s.name).join('、') : '平安银行、贵州茅台、招商银行'}。这些股票具有良好的流动性和基本面支撑，适合中长期配置。`,
  };
};
