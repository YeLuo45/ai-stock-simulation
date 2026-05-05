/**
 * API service for AI Stock Simulation - Pure Frontend Version
 * All data persisted in localStorage, no backend required
 */
/// <reference types="vite/client" />
import type {
  StockSelectionRequest, StockSelectionResponse,
  Portfolio, TradeRequest, Trade,
  BacktestRequest, BacktestResponse,
  TechnicalAnalysis, AIModelConfig,
  IPOEvaluationResult, DataSourceResponse,
  AIModelPriorityResponse, APIProtocol,
  BatchBacktestResponse,
} from "../types";
import {
  getPortfolio as s_getPortfolio,
  recalcPortfolio as s_recalcPortfolio,
  getTrades as s_getTrades,
  addTrade as s_addTrade,
  getBacktestResults as s_getBacktestResults,
  addBacktestResult as s_addBacktestResult,
  getModelConfigs as s_getModelConfigs,
  saveModelConfigs as s_saveModelConfigs,
  setCurrentModel as s_setCurrentModel,
  getCurrentModel as s_getCurrentModel,
  getDataSources as s_getDataSources,
  saveDataSources as s_saveDataSources,
  getAIModelPriority as s_getAIModelPriority,
  saveAIModelPriority as s_saveAIModelPriority,
  resetAll as s_resetAll,
  initStorage as s_initStorage,
  DEFAULT_STOCKS,
} from "./storage";
import {
  generatePriceHistory,
  calculateAllIndicators,
  meanReversionBacktest,
  trendFollowingBacktest,
  rsiBacktest,
  valueInvestingBacktest,
  quantStockSelection,
} from "./indicators";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

if (isDemoMode) {
  s_initStorage();
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function findStock(symbol: string) {
  return DEFAULT_STOCKS.find(s => s.symbol === symbol) || DEFAULT_STOCKS[0];
}

// Export setCurrentModel for SettingsPage
export const setCurrentModel = (model: string) => {
  if (isDemoMode) {
    s_setCurrentModel(model);
  }
};

// ============== Stock Search ==============

export const searchStocks = async (keyword: string) => {
  if (!isDemoMode) {
    const res = await fetch(`/api/stocks/search?keyword=${encodeURIComponent(keyword)}`);
    return res.json();
  }
  await delay(300);
  return DEFAULT_STOCKS.filter(s =>
    s.name.includes(keyword) || s.symbol.includes(keyword)
  );
};

export const aiStockSelection = async (req: StockSelectionRequest): Promise<StockSelectionResponse> => {
  if (!isDemoMode) {
    const res = await fetch(`/api/stocks/selection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return res.json();
  }
  await delay(800);

  const query = req.query.toLowerCase();
  let minPe = 0, maxPe = 100, minRoe = 0, minPb = 0;

  if (query.includes("低估") || query.includes("价值") || query.includes("低估值")) {
    maxPe = 25; minRoe = 10;
  }
  if (query.includes("成长") || query.includes("高增长") || query.includes("创业板")) {
    minRoe = 15; maxPe = 40;
  }
  if (query.includes("银行") || query.includes("金融")) { maxPe = 15; }
  if (query.includes("白酒") || query.includes("消费")) { maxPe = 50; minRoe = 20; }
  if (query.includes("科技") || query.includes("半导体") || query.includes("芯片")) { minPb = 3; }

  const results = quantStockSelection(DEFAULT_STOCKS, { min_pe: minPe, max_pe: maxPe, min_roe: minRoe, min_pb: minPb });
  const stocks = results.slice(0, 5).map(r => {
    const stock = findStock(r.symbol);
    return { ...stock, score: r.score };
  });

  let ai_reasoning = `根据"${req.query}"的分析，筛选出以下符合条件的股票：${stocks.map(s => s.name).join("、")}。`;
  if (query.includes("低估") || query.includes("价值")) {
    ai_reasoning = `根据"${req.query}"的条件，筛选出估值偏低的优质股票：${results.map(r => r.name).join("、")}。这些股票当前市盈率低于行业平均，具有一定的估值修复空间。`;
  } else if (query.includes("成长") || query.includes("高增长")) {
    ai_reasoning = `根据"${req.query}"的条件，筛选出高成长性股票：${results.map(r => r.name).join("、")}。这些股票ROE较高，业绩增速较快，适合追求高收益的投资者。`;
  }

  return { stocks, ai_reasoning };
};

export const getStockQuote = async (symbol: string) => {
  if (!isDemoMode) {
    const res = await fetch(`/api/stocks/quote/${encodeURIComponent(symbol)}`);
    return res.json();
  }
  await delay(200);
  return findStock(symbol);
};

export const getMultipleQuotes = async (symbols: string[]) => {
  if (!isDemoMode) {
    const res = await fetch(`/api/stocks/quotes?symbols=${symbols.join(",")}`);
    return res.json();
  }
  await delay(300);
  return symbols.map(findStock);
};

// ============== Trading ==============

export const getPortfolio = async (): Promise<Portfolio> => {
  if (!isDemoMode) {
    const res = await fetch(`/api/trading/account`);
    return res.json();
  }
  await delay(200);
  return s_recalcPortfolio();
};

export const executeTrade = async (req: TradeRequest): Promise<Trade> => {
  if (!isDemoMode) {
    const res = await fetch(`/api/trading/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return res.json();
  }
  await delay(500);

  const portfolio = s_getPortfolio();
  const stock = findStock(req.symbol);
  const price = req.price || stock.price;
  const commission = req.quantity * price * 0.0003;
  const tradeType = req.trade_type;

  if (tradeType === "buy") {
    const totalCost = req.quantity * price * 1.0003;
    if (portfolio.cash < totalCost) {
      throw new Error("资金不足");
    }
    const existingPos = portfolio.positions.find((p: { symbol: string }) => p.symbol === req.symbol);
    if (existingPos) {
      const totalShares = existingPos.quantity + req.quantity;
      existingPos.avg_cost = (existingPos.avg_cost * existingPos.quantity + price * req.quantity) / totalShares;
      existingPos.quantity = totalShares;
      existingPos.current_price = price;
      existingPos.market_value = totalShares * price;
    } else {
      portfolio.positions.push({
        id: Date.now(),
        symbol: req.symbol,
        name: req.name || stock.name,
        quantity: req.quantity,
        avg_cost: price,
        current_price: price,
        market_value: req.quantity * price,
        profit_loss: 0,
        profit_loss_pct: 0,
      });
    }
    portfolio.cash -= totalCost;
  } else {
    const pos = portfolio.positions.find((p: { symbol: string }) => p.symbol === req.symbol);
    if (!pos || pos.quantity < req.quantity) {
      throw new Error("持仓不足");
    }
    const netProceed = req.quantity * price * 0.9997;
    portfolio.cash += netProceed;
    pos.quantity -= req.quantity;
    if (pos.quantity === 0) {
      portfolio.positions = portfolio.positions.filter((p: { symbol: string }) => p.symbol !== req.symbol);
    }
  }

  s_recalcPortfolio();

  const trade: Trade = {
    id: Date.now(),
    symbol: req.symbol,
    name: req.name || stock.name,
    trade_type: tradeType,
    price,
    quantity: req.quantity,
    commission,
    total_cost: tradeType === "buy" ? req.quantity * price * 1.0003 : -req.quantity * price * 0.9997,
    timestamp: new Date().toISOString(),
  };
  s_addTrade(trade);
  return trade;
};

export const getTrades = async (limit = 50): Promise<Trade[]> => {
  if (!isDemoMode) {
    const res = await fetch(`/api/trading/trades?limit=${limit}`);
    return res.json();
  }
  await delay(200);
  return s_getTrades().slice(0, limit);
};

export const resetPortfolio = async () => {
  if (!isDemoMode) {
    const res = await fetch(`/api/trading/reset`, { method: "POST" });
    return res.json();
  }
  await delay(300);
  s_resetAll();
  return { message: "Portfolio reset successfully" };
};

// ============== Backtest ==============

const STRATEGY_MAP: Record<string, (history: Parameters<typeof meanReversionBacktest>[0], cash: number, params: Parameters<typeof meanReversionBacktest>[2]) => ReturnType<typeof meanReversionBacktest>> = {
  "均线回归策略": meanReversionBacktest as any,
  "趋势追踪策略": trendFollowingBacktest as any,
  "RSI反转策略": rsiBacktest as any,
  "价值投资策略": valueInvestingBacktest as any,
};

export const runBacktest = async (req: BacktestRequest): Promise<BacktestResponse> => {
  if (!isDemoMode) {
    const res = await fetch(`/api/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return res.json();
  }
  await delay(1200);

  const symbols = req.symbols && req.symbols.length > 0 ? req.symbols : [DEFAULT_STOCKS[0].symbol];
  const basePrice = findStock(symbols[0]).price;
  const history = generatePriceHistory(basePrice, 252);

  const strategyName = req.strategy_name || "均线回归策略";
  const strategyFn = STRATEGY_MAP[strategyName] || meanReversionBacktest;

  const result = strategyFn(history, req.initial_cash || 1000000, req.params || {});

  const resultWithId: BacktestResponse = {
    ...result,
    id: Date.now(),
    strategy_name: strategyName,
  };

  s_addBacktestResult(resultWithId);
  return resultWithId;
};

export const getBacktestResults = async (limit = 20) => {
  if (!isDemoMode) {
    const res = await fetch(`/api/backtest/results?limit=${limit}`);
    return res.json();
  }
  await delay(300);
  return s_getBacktestResults().slice(0, limit);
};

export interface RunBatchBacktestOptions {
  symbols: string[];
  start_date?: string;
  end_date?: string;
  initial_cash?: number;
  onProgress?: (progress: number) => void;
}

export const runBatchBacktest = async (opts: RunBatchBacktestOptions): Promise<BatchBacktestResponse> => {
  const { symbols, start_date = "2023-01-01", end_date = "2026-04-01", initial_cash = 1_000_000, onProgress } = opts;

  if (!isDemoMode) {
    const res = await fetch(`/api/backtest/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols, start_date, end_date, initial_cash }),
    });
    return res.json();
  }

  // Demo mode: simulate progress
  const results: BatchBacktestResponse = {
    results: [],
    failed: [],
    progress: 0,
  };

  for (let i = 0; i < symbols.length; i++) {
    await delay(300);
    const sym = symbols[i];
    const stock = findStock(sym);
    const basePrice = stock.price;
    const history = generatePriceHistory(basePrice, 252);
    const result = meanReversionBacktest(history, initial_cash, {});

    results.results.push({
      symbol: sym,
      name: stock.name,
      total_return: result.total_return,
      sharpe_ratio: result.sharpe_ratio,
      max_drawdown: result.max_drawdown,
      win_rate: (result.win_rate || 0) * 100,
      trade_count: result.total_trades,
    });
    results.progress = (i + 1) / symbols.length;
    onProgress?.(results.progress);
  }

  return results;
};

export const explainBacktest = async (strategyName: string, results: object) => {
  if (!isDemoMode) {
    const res = await fetch(`/api/backtest/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy_name: strategyName, results }),
    });
    return res.json();
  }
  await delay(800);
  const r = results as BacktestResponse;
  return {
    explanation: `策略"${strategyName}"总收益${r.total_return?.toFixed(1)}%，年化${r.annual_return?.toFixed(1)}%，最大回撤${r.max_drawdown?.toFixed(1)}%，夏普比率${r.sharpe_ratio?.toFixed(2)}，胜率${((r.win_rate || 0) * 100).toFixed(0)}%。${r.total_return > 0 ? "整体表现良好，正收益说明策略有效。" : "收益为负，建议优化策略参数或更换标的。"}`,
  };
};

// ============== Technical Analysis ==============

export const technicalAnalysis = async (symbol: string, indicatorTypes: string[]): Promise<TechnicalAnalysis> => {
  if (!isDemoMode) {
    const res = await fetch(`/api/analysis/technical`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, indicator_types: indicatorTypes }),
    });
    return res.json();
  }
  await delay(600);

  const stock = findStock(symbol);
  const history = generatePriceHistory(stock.price, 120);
  const indicators = calculateAllIndicators(history);

  return {
    symbol,
    name: stock.name,
    current_price: stock.price,
    indicators,
    ai_summary: indicators.ai_summary,
    support_resistance: indicators.support_resistance,
  };
};

export const getIndicators = async (symbol: string) => {
  if (!isDemoMode) {
    const res = await fetch(`/api/analysis/indicators/${encodeURIComponent(symbol)}`);
    return res.json();
  }
  await delay(300);
  const stock = findStock(symbol);
  const history = generatePriceHistory(stock.price, 120);
  return calculateAllIndicators(history);
};

// ============== AI Model Config ==============

export const listModelConfigs = async (): Promise<AIModelConfig[]> => {
  if (!isDemoMode) {
    const res = await fetch(`/api/models/configs`);
    return res.json();
  }
  await delay(200);
  return s_getModelConfigs();
};

export const saveModelConfig = async (config: {
  model_name: string;
  api_key: string;
  base_url?: string;
  api_protocol?: APIProtocol;
  is_active: boolean;
}) => {
  if (!isDemoMode) {
    const res = await fetch(`/api/models/configs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    return res.json();
  }
  await delay(300);
  const configs = s_getModelConfigs();
  const idx = configs.findIndex(c => c.model_name === config.model_name);
  const updatedConfig: AIModelConfig = {
    model_name: config.model_name,
    base_url: config.base_url,
    api_protocol: config.api_protocol,
    is_active: config.is_active,
    has_api_key: !!config.api_key,
  };
  if (idx >= 0) {
    configs[idx] = { ...configs[idx], ...updatedConfig };
  } else {
    configs.push(updatedConfig);
  }
  s_saveModelConfigs(configs);
  return { message: "Config saved", ...updatedConfig };
};

export const activateModel = async (modelName: string) => {
  if (!isDemoMode) {
    const res = await fetch(`/api/models/configs/${modelName}/activate`, { method: "POST" });
    return res.json();
  }
  await delay(200);
  s_setCurrentModel(modelName);
  const configs = s_getModelConfigs();
  configs.forEach(c => { c.is_active = c.model_name === modelName; });
  s_saveModelConfigs(configs);
  return { message: `Model ${modelName} activated` };
};

export const getActiveModel = async () => {
  if (!isDemoMode) {
    const res = await fetch(`/api/models/configs/active`);
    return res.json();
  }
  await delay(100);
  return { model_name: s_getCurrentModel() };
};

export const testModel = async (modelName: string, _apiKey?: string, _baseUrl?: string, _apiProtocol?: string) => {
  if (!isDemoMode) {
    const res = await fetch(`/api/models/test?model_name=${modelName}`, { method: "POST" });
    return res.json();
  }
  await delay(800);
  return { success: true, message: `${modelName} connection successful (Demo Mode)` };
};

// ============== App Info ==============

export const getAppInfo = async () => {
  if (!isDemoMode) {
    const res = await fetch(`/api/info`);
    return res.json();
  }
  await delay(100);
  return {
    name: "AlphaTrader",
    version: "1.0.0-pure",
    description: "AI Stock Simulation (Pure Frontend)",
    mode: "demo",
    features: ["股票搜索", "AI选股", "模拟交易", "策略回测", "技术分析", "IPO评估"],
  };
};

export const healthCheck = async () => {
  if (!isDemoMode) {
    const res = await fetch(`/api/health`);
    return res.json();
  }
  await delay(100);
  return { status: "ok", mode: "demo" };
};

// ============== IPO Evaluation ==============

const IPO_STOCKS: Record<string, Omit<IPOEvaluationResult, "score" | "recommendation" | "analysis" | "evaluated_at">> = {
  "688001": { stock_code: "688001", stock_name: "华兴源创", fundamental: { pe: 45.2, pb: 3.2, roe: 8.5, gross_margin: 45.2, revenue_growth: 15.3, net_profit_growth: 12.8, issue_price: 24.25, current_price: 28.45, listing_days: 156 }, technical: { trend: "上涨", rsi: 62.5, macd_signal: "金叉", support_level: 25.50, resistance_level: 30.20, ma5: 27.80, ma20: 26.50, current_price: 28.45, change_pct: 3.45 }, data_sources: ["东方财富", "同花顺"] },
  "301378": { stock_code: "301378", stock_name: "贝泰妮", fundamental: { pe: 38.5, pb: 4.8, roe: 14.2, gross_margin: 72.5, revenue_growth: 28.3, net_profit_growth: 25.6, issue_price: 55.00, current_price: 82.50, listing_days: 89 }, technical: { trend: "上涨", rsi: 58.3, macd_signal: "金叉", support_level: 75.00, resistance_level: 90.00, ma5: 80.20, ma20: 76.50, current_price: 82.50, change_pct: 1.55 }, data_sources: ["东方财富", "同花顺"] },
  "688981": { stock_code: "688981", stock_name: "中芯国际", fundamental: { pe: 35.2, pb: 3.8, roe: 9.5, gross_margin: 28.5, revenue_growth: 18.7, net_profit_growth: 15.2, issue_price: 27.46, current_price: 48.60, listing_days: 203 }, technical: { trend: "震荡", rsi: 52.1, macd_signal: "金叉", support_level: 45.00, resistance_level: 55.00, ma5: 47.80, ma20: 46.20, current_price: 48.60, change_pct: 2.15 }, data_sources: ["东方财富", "同花顺"] },
};

export const evaluateIPO = async (stockCode: string): Promise<IPOEvaluationResult> => {
  if (!isDemoMode) {
    const res = await fetch(`/api/ipo/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock_code: stockCode }),
    });
    return res.json();
  }
  await delay(1500);

  const ipoBase = IPO_STOCKS[stockCode] || {
    stock_code: stockCode,
    stock_name: `股票${stockCode}`,
    fundamental: { pe: 30 + Math.random() * 20, pb: 3 + Math.random() * 3, roe: 8 + Math.random() * 10, gross_margin: 30 + Math.random() * 30, revenue_growth: 10 + Math.random() * 20, net_profit_growth: 8 + Math.random() * 15, issue_price: 20 + Math.random() * 30, current_price: 22 + Math.random() * 35, listing_days: Math.floor(Math.random() * 200) },
    technical: { trend: (["上涨", "震荡", "下跌"] as const)[Math.floor(Math.random() * 3)], rsi: 30 + Math.random() * 40, macd_signal: Math.random() > 0.5 ? "金叉" : "死叉", support_level: 20, resistance_level: 35, ma5: 28, ma20: 27, current_price: 25, change_pct: (Math.random() - 0.5) * 10 },
    data_sources: ["模拟数据"],
  };

  const { pe = 30, roe = 10, revenue_growth = 10, gross_margin = 30 } = ipoBase.fundamental;
  let score = 50;
  if (pe < 40) score += 10;
  if (roe > 15) score += 15;
  if (roe > 25) score += 10;
  if (revenue_growth > 20) score += 10;
  if (gross_margin > 50) score += 5;
  score = Math.min(100, score);

  const recommendation: IPOEvaluationResult["recommendation"] = score >= 80 ? "强烈推荐" : score >= 65 ? "推荐" : score >= 50 ? "中性" : score >= 35 ? "回避" : "强烈回避";

  const analysis = `${ipoBase.stock_name}（${stockCode}）${recommendation}。基本面：PE=${pe.toFixed(1)}，ROE=${roe.toFixed(1)}%，营收增长${revenue_growth.toFixed(1)}%。${recommendation.includes("推荐") ? "建议积极参与。" : recommendation.includes("中性") ? "建议观望。" : "建议谨慎参与。"}`;

  return {
    ...ipoBase,
    score,
    recommendation,
    analysis,
    evaluated_at: new Date().toISOString(),
  };
};

// ============== Data Source Management ==============

export const getDataSources = async (): Promise<DataSourceResponse> => {
  if (!isDemoMode) {
    const res = await fetch(`/api/data-sources`);
    return res.json();
  }
  await delay(200);
  return s_getDataSources();
};

export const updateDataSource = async (sourceId: string, enabled: boolean) => {
  if (!isDemoMode) {
    const res = await fetch(`/api/data-sources/${sourceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    return res.json();
  }
  await delay(300);
  const ds = s_getDataSources();
  const src = ds.sources.find((s: { id: string }) => s.id === sourceId);
  if (src) {
    src.enabled = enabled;
    src.status = enabled ? "available" : "disabled";
  }
  s_saveDataSources(ds);
  return { message: `Data source ${sourceId} ${enabled ? "enabled" : "disabled"}` };
};

// ============== AI Model Priority ==============

export const getAIModelPriority = async (): Promise<AIModelPriorityResponse> => {
  if (!isDemoMode) {
    const res = await fetch(`/api/ai-model-priority`);
    return res.json();
  }
  await delay(200);
  return s_getAIModelPriority();
};

export const updateAIModelPriority = async (priority: string[]): Promise<{ message: string; priority: string[] }> => {
  if (!isDemoMode) {
    const res = await fetch(`/api/ai-model-priority`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    return res.json();
  }
  await delay(300);
  s_saveAIModelPriority(priority);
  return { message: "Priority updated", priority };
};
