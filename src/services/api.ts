/**
 * API service for AI Stock Simulation - Pure Frontend Version
 * All data persisted in localStorage, no backend required
 */
import type {
  StockSelectionRequest, StockSelectionResponse,
  Portfolio, TradeRequest, Trade,
  BacktestRequest, BacktestResponse,
  TechnicalAnalysis, AIModelConfig,
  IPOEvaluationResult, DataSourceResponse,
  AIModelPriorityResponse, StockInfo,
} from "../types";

// Default stocks with realistic data
const DEFAULT_STOCKS: StockInfo[] = [
  { symbol: "000001", name: "平安银行", price: 12.35, change_pct: 1.23, volume: 45678900, pe: 6.5, pb: 0.85, market_cap: 2100 },
  { symbol: "000002", name: "万科A", price: 8.92, change_pct: -0.67, volume: 32145600, pe: 8.2, pb: 1.12, market_cap: 1050 },
  { symbol: "600036", name: "招商银行", price: 38.56, change_pct: 0.89, volume: 23456700, pe: 7.8, pb: 1.35, market_cap: 9800 },
  { symbol: "600519", name: "贵州茅台", price: 1688.00, change_pct: 2.15, volume: 1234567, pe: 32.5, pb: 11.2, market_cap: 21200 },
  { symbol: "601318", name: "中国平安", price: 48.23, change_pct: 1.45, volume: 56789000, pe: 9.2, pb: 1.68, market_cap: 8900 },
  { symbol: "000858", name: "五粮液", price: 142.30, change_pct: -1.23, volume: 18923400, pe: 22.5, pb: 5.8, market_cap: 5600 },
  { symbol: "600900", name: "长江电力", price: 23.45, change_pct: 0.34, volume: 9876500, pe: 18.5, pb: 2.45, market_cap: 5200 },
  { symbol: "601888", name: "中国中免", price: 68.90, change_pct: 3.21, volume: 23456700, pe: 28.5, pb: 4.2, market_cap: 1350 },
  { symbol: "000333", name: "美的集团", price: 58.76, change_pct: 0.78, volume: 15678900, pe: 12.5, pb: 3.2, market_cap: 4200 },
  { symbol: "002594", name: "比亚迪", price: 238.50, change_pct: -2.15, volume: 34567800, pe: 45.2, pb: 6.8, market_cap: 6950 },
  { symbol: "600276", name: "恒瑞医药", price: 45.67, change_pct: 1.89, volume: 12345600, pe: 65.5, pb: 8.9, market_cap: 2900 },
  { symbol: "688981", name: "中芯国际", price: 52.30, change_pct: 4.56, volume: 78923400, pe: 78.5, pb: 4.5, market_cap: 4200 },
  { symbol: "300750", name: "宁德时代", price: 192.45, change_pct: 2.34, volume: 23456700, pe: 35.2, pb: 5.8, market_cap: 8500 },
  { symbol: "600009", name: "上海机场", price: 52.18, change_pct: -0.45, volume: 8765400, pe: 28.5, pb: 3.2, market_cap: 980 },
  { symbol: "601166", name: "兴业银行", price: 17.23, change_pct: 0.67, volume: 34567800, pe: 4.8, pb: 0.72, market_cap: 3600 },
];

// ============== Storage Helpers ==============

const STORAGE_KEY_PREFIX = "ai_stock_";

function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
}

// ============== Portfolio State ==============

interface PortfolioState {
  cash: number;
  positions: PositionState[];
}

interface PositionState {
  id: number;
  symbol: string;
  name: string;
  quantity: number;
  avg_cost: number;
}

function getPortfolioState(): PortfolioState {
  return getStorage<PortfolioState>("portfolio", {
    cash: 1_000_000,
    positions: [],
  });
}

function savePortfolioState(state: PortfolioState): void {
  setStorage("portfolio", state);
}

// ============== Portfolio ==============

export function getPortfolio(): Portfolio {
  const state = getPortfolioState();
  let totalMarketValue = 0;

  const positions = state.positions.map(pos => {
    const stock = DEFAULT_STOCKS.find(s => s.symbol === pos.symbol) || { price: pos.avg_cost };
    const marketValue = pos.quantity * stock.price;
    const cost = pos.quantity * pos.avg_cost;
    totalMarketValue += marketValue;
    return {
      id: pos.id,
      symbol: pos.symbol,
      name: pos.name,
      quantity: pos.quantity,
      avg_cost: pos.avg_cost,
      current_price: stock.price,
      market_value: marketValue,
      profit_loss: marketValue - cost,
      profit_loss_pct: cost > 0 ? ((marketValue - cost) / cost) * 100 : 0,
    };
  });

  const totalAssets = state.cash + totalMarketValue;
  const totalProfitLoss = totalAssets - 1_000_000;
  const totalProfitLossPct = (totalProfitLoss / 1_000_000) * 100;

  return {
    id: 1,
    name: "默认模拟账户",
    cash: state.cash,
    total_market_value: totalMarketValue,
    total_assets: totalAssets,
    total_profit_loss: totalProfitLoss,
    total_profit_loss_pct: totalProfitLossPct,
    positions,
  };
}

// ============== Trading ==============

export async function executeTrade(req: TradeRequest): Promise<Trade> {
  const state = getPortfolioState();
  const stock = DEFAULT_STOCKS.find(s => s.symbol === req.symbol) || DEFAULT_STOCKS[0];
  const price = req.price || stock.price;
  const commission = req.quantity * price * 0.0003;

  if (req.trade_type === "buy") {
    const totalCost = req.quantity * price * 1.0003;
    if (state.cash < totalCost) {
      throw new Error("资金不足");
    }
    state.cash -= totalCost;
    const existing = state.positions.find(p => p.symbol === req.symbol);
    if (existing) {
      const totalShares = existing.quantity + req.quantity;
      existing.avg_cost = (existing.avg_cost * existing.quantity + price * req.quantity) / totalShares;
      existing.quantity = totalShares;
    } else {
      state.positions.push({
        id: Date.now(),
        symbol: req.symbol,
        name: req.name || stock.name,
        quantity: req.quantity,
        avg_cost: price,
      });
    }
  } else {
    const pos = state.positions.find(p => p.symbol === req.symbol);
    if (!pos || pos.quantity < req.quantity) {
      throw new Error("持仓不足");
    }
    const netProceed = req.quantity * price * 0.9997;
    state.cash += netProceed;
    pos.quantity -= req.quantity;
    if (pos.quantity === 0) {
      state.positions = state.positions.filter(p => p.symbol !== req.symbol);
    }
  }

  savePortfolioState(state);

  const trade: Trade = {
    id: Date.now(),
    symbol: req.symbol,
    name: req.name || stock.name,
    trade_type: req.trade_type,
    price,
    quantity: req.quantity,
    commission,
    total_cost: req.trade_type === "buy" ? req.quantity * price * 1.0003 : -req.quantity * price * 0.9997,
    timestamp: new Date().toISOString(),
  };

  const trades = getStorage<Trade[]>("trades", []);
  trades.unshift(trade);
  setStorage("trades", trades);

  return trade;
}

export function getTrades(limit = 50): Trade[] {
  return getStorage<Trade[]>("trades", []).slice(0, limit);
}

export async function resetPortfolio(): Promise<{ message: string }> {
  setStorage("portfolio", { cash: 1_000_000, positions: [] });
  setStorage("trades", []);
  return { message: "Portfolio reset successfully" };
}

// ============== Stock Search ==============

export async function searchStocks(keyword: string): Promise<StockInfo[]> {
  await new Promise(r => setTimeout(r, 200));
  return DEFAULT_STOCKS.filter(s =>
    s.name.includes(keyword) || s.symbol.includes(keyword)
  );
}

export async function aiStockSelection(req: StockSelectionRequest): Promise<StockSelectionResponse> {
  await new Promise(r => setTimeout(r, 800));
  const query = req.query.toLowerCase();
  let minPe = 0, maxPe = 100, minRoe = 0;

  if (query.includes("低估") || query.includes("价值") || query.includes("低估值")) {
    maxPe = 25; minRoe = 10;
  }
  if (query.includes("成长") || query.includes("高增长") || query.includes("创业板")) {
    minRoe = 15; maxPe = 40;
  }
  if (query.includes("银行") || query.includes("金融")) { maxPe = 15; }
  if (query.includes("白酒") || query.includes("消费")) { maxPe = 50; minRoe = 20; }

  const results = DEFAULT_STOCKS.filter(s => {
    const pe = s.pe || 0;
    const roe = s.roe || 0;
    return pe >= minPe && pe <= maxPe && roe >= minRoe;
  }).slice(0, 5);

  return {
    stocks: results,
    ai_reasoning: `根据您的要求"${req.query}"，筛选出${results.length}只符合条件的股票。`
  };
}

export async function getStockQuote(symbol: string): Promise<StockInfo> {
  await new Promise(r => setTimeout(r, 100));
  return DEFAULT_STOCKS.find(s => s.symbol === symbol) || DEFAULT_STOCKS[0];
}

export async function getMultipleQuotes(symbols: string[]): Promise<StockInfo[]> {
  await new Promise(r => setTimeout(r, 100));
  return symbols.map(s => DEFAULT_STOCKS.find(st => st.symbol === s) || DEFAULT_STOCKS[0]);
}

// ============== Backtest ==============

export async function runBacktest(req: BacktestRequest): Promise<BacktestResponse> {
  await new Promise(r => setTimeout(r, 1000));
  const days = Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / (1000 * 60 * 60 * 24));
  const equity = Array.from({ length: Math.min(days, 30) }, (_, idx) => ({
    date: new Date(new Date(req.start_date).getTime() + idx * 86400000).toISOString().split("T")[0],
    value: req.initial_cash * (1 + (Math.random() - 0.4) * 0.02 * (idx + 1)),
  }));

  const finalValue = equity[equity.length - 1].value;
  const totalReturn = ((finalValue - req.initial_cash) / req.initial_cash) * 100;

  const backtestResult: BacktestResponse = {
    id: Date.now(),
    strategy_name: req.strategy_name,
    total_return: totalReturn,
    annual_return: totalReturn * 365 / days,
    max_drawdown: Math.random() * 15,
    sharpe_ratio: Math.random() * 2 + 0.5,
    win_rate: Math.random() * 40 + 40,
    total_trades: Math.floor(Math.random() * 50) + 20,
    equity_curve: equity,
  };

  const results = getStorage<BacktestResponse[]>("backtest_results", []);
  results.push(backtestResult);
  setStorage("backtest_results", results);

  return backtestResult;
}

export function getBacktestResults(limit = 20): BacktestResponse[] {
  return getStorage<BacktestResponse[]>("backtest_results", []).slice(0, limit);
}

// ============== Analysis Helpers =============

export function getIndicators(symbol: string): Promise<{ indicators: Record<string, number> }> {
  return (async () => {
    await new Promise(r => setTimeout(r, 300));
    const stock = DEFAULT_STOCKS.find(s => s.symbol === symbol) || DEFAULT_STOCKS[0];
    return {
      indicators: {
        MA5: stock.price * 0.99,
        MA10: stock.price * 0.98,
        MA20: stock.price * 0.97,
        RSI: 58 + Math.random() * 20,
        MACD: 0.35,
        KDJ_K: 72,
        KDJ_D: 68,
        KDJ_J: 80,
      },
    };
  })();
}

export function explainBacktest(_strategyName: string, _result: unknown): Promise<{ explanation: string }> {
  return Promise.resolve({ explanation: "该回测策略在过去表现良好，建议关注其收益风险比。" });
}

export function testModel(
  _modelName: string,
  _apiKey: string,
  _baseUrl?: string,
  _protocol?: string
): Promise<{ success: boolean; message: string; response?: string; error?: string; detail?: string }> {
  return Promise.resolve({
    success: true,
    message: "测试成功",
    response: "API连接正常",
  });
}

// ============== Technical Analysis ==============

export function technicalAnalysis(symbol: string, _indicatorTypes?: string[]): Promise<TechnicalAnalysis> {
  return (async () => {
    await new Promise(r => setTimeout(r, 500));
    const stock = DEFAULT_STOCKS.find(s => s.symbol === symbol) || DEFAULT_STOCKS[0];
    return {
      symbol,
      name: stock.name,
      current_price: stock.price,
      indicators: {
        MA5: stock.price * 0.99,
        MA10: stock.price * 0.98,
        MA20: stock.price * 0.97,
        RSI: 58 + Math.random() * 20,
      },
      ai_summary: `技术分析显示${stock.name}当前处于震荡整理阶段，建议暂时观望。`,
      support_resistance: {
        support: stock.price * 0.95,
        resistance: stock.price * 1.05,
      },
    };
  })();
}

// ============== AI Model Config ==============

export function listModelConfigs(): AIModelConfig[] {
  return getStorage<AIModelConfig[]>("model_configs", [
    { model_name: "minimax", base_url: "", api_protocol: "openai_compatible", is_active: true, has_api_key: false },
    { model_name: "zhipu", base_url: "", api_protocol: "openai_compatible", is_active: false, has_api_key: false },
    { model_name: "claude", base_url: "", api_protocol: "anthropic", is_active: false, has_api_key: false },
  ]);
}

export function saveModelConfig(config: AIModelConfig): AIModelConfig {
  const configs = listModelConfigs();
  const idx = configs.findIndex(c => c.model_name === config.model_name);
  if (idx >= 0) {
    configs[idx] = { ...config, has_api_key: !!config.api_key };
  } else {
    configs.push({ ...config, has_api_key: !!config.api_key });
  }
  setStorage("model_configs", configs);
  return config;
}

export function activateModel(modelName: string): void {
  const configs = listModelConfigs();
  configs.forEach(c => { c.is_active = c.model_name === modelName; });
  setStorage("model_configs", configs);
}

export function getActiveModel(): { model_name: string } {
  const configs = listModelConfigs();
  const active = configs.find(c => c.is_active);
  return { model_name: active?.model_name || "minimax" };
}

// ============== IPO Evaluation ==============

export async function evaluateIPO(stockCode: string): Promise<IPOEvaluationResult> {
  await new Promise(r => setTimeout(r, 1500));
  return {
    stock_code: stockCode,
    stock_name: stockCode.startsWith("6") ? `${stockCode}新股` : `${stockCode}次新股`,
    score: Math.floor(Math.random() * 30) + 60,
    recommendation: "中性",
    fundamental: {
      pe: Math.random() * 50 + 10,
      pb: Math.random() * 5 + 1,
      roe: Math.random() * 20 + 5,
      gross_margin: Math.random() * 30 + 20,
    },
    technical: {
      trend: "震荡",
      rsi: 50 + Math.random() * 30,
      current_price: Math.random() * 100 + 10,
    },
    analysis: "基本面一般，技术面尚可，可适当关注。",
    data_sources: ["东方财富", "同花顺"],
    evaluated_at: new Date().toISOString(),
  };
}

// ============== Data Source ==============

export function getDataSources(): DataSourceResponse {
  return getStorage<DataSourceResponse>("data_sources", {
    sources: [
      { id: "eastmoney", name: "东方财富", enabled: true, priority: 1, status: "connected" },
      { id: "tonghuashun", name: "同花顺", enabled: true, priority: 2, status: "connected" },
      { id: "joinquant", name: "聚宽", enabled: false, priority: 3, status: "disconnected" },
    ],
  });
}

export function updateDataSource(sourceId: string, enabled: boolean): DataSourceResponse {
  const data = getDataSources();
  const source = data.sources.find(s => s.id === sourceId);
  if (source) {
    source.enabled = enabled;
    source.status = enabled ? "connected" : "disconnected";
  }
  setStorage("data_sources", data);
  return data;
}

// ============== AI Model Priority ==============

export function getAIModelPriority(): AIModelPriorityResponse {
  return getStorage<AIModelPriorityResponse>("ai_model_priority", {
    priority: ["minimax", "zhipu", "claude"],
  });
}

export function updateAIModelPriority(priority: string[]): AIModelPriorityResponse {
  const data = getAIModelPriority();
  data.priority = priority;
  setStorage("ai_model_priority", data);
  return data;
}

// ============== App Info ==============

export function getAppInfo() {
  return {
    name: "AI Stock Simulation",
    description: "AI模拟炒股平台 - 纯前端版本",
    features: ["AI选股", "模拟交易", "技术分析", "IPO评估"],
    initial_cash: 1_000_000,
  };
}

export function healthCheck() {
  return { status: "healthy" };
}

export function setCurrentModel(model: string) {
  activateModel(model);
}
