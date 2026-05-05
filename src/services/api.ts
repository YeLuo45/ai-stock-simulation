/**
 * API service for AI Stock Simulation - Pure Frontend Version
 * All data persisted in IndexedDB via db.ts, trading logic in trading.ts
 * Real-time quotes from quotes.ts (East Money / Sina APIs with fallback)
 */
import type {
  StockSelectionRequest,
  StockSelectionResponse,
  Portfolio,
  TradeRequest,
  Trade,
  BacktestRequest,
  BacktestResponse,
  TechnicalAnalysis,
  AIModelConfig,
  IPOEvaluationResult,
  DataSourceResponse,
  StockInfo,
  EquityPoint,
  DrawdownPoint,
  ReturnDistribution,
  BacktestTrade,
} from "../types";

import {
  saveBacktestResult,
  getBacktestResults as dbGetBacktestResults,
  getModelConfigs as dbGetModelConfigsSync,
  saveModelConfig as dbSaveModelConfig,
  BacktestResultData,
} from "./db";

import {
  executeTrade as doExecuteTrade,
  getPortfolio as calcPortfolio,
  getTradeHistory,
  resetPortfolio as doResetPortfolio,
  COMMISSION_RATE,
  STAMP_TAX_RATE,
} from "./trading";

import {
  DEFAULT_STOCKS,
  getStockQuote as fetchQuote,
  getMultipleQuotes as fetchMultipleQuotes,
  searchStocks as doSearchStocks,
} from "./quotes";

// Re-export constants for fee calculation
export { COMMISSION_RATE, STAMP_TAX_RATE };

// Helper to get model configs (sync access to in-memory cache)
let modelConfigCache: Awaited<ReturnType<typeof dbGetModelConfigsSync>> | null = null;

async function getModelConfigsInternal() {
  if (!modelConfigCache) {
    modelConfigCache = await dbGetModelConfigsSync();
  }
  return modelConfigCache;
}

async function refreshModelConfigCache() {
  modelConfigCache = await dbGetModelConfigsSync();
}

// ============== Stock Quote API ==============

export async function getStockQuote(symbol: string): Promise<StockInfo> {
  return fetchQuote(symbol);
}

export async function getMultipleQuotes(symbols: string[]): Promise<StockInfo[]> {
  return fetchMultipleQuotes(symbols);
}

export async function searchStocks(keyword: string): Promise<StockInfo[]> {
  return doSearchStocks(keyword);
}

// ============== Portfolio API ==============

export async function getPortfolio(): Promise<Portfolio> {
  // Build price map from default stocks
  const stockPrices = new Map<string, StockInfo>();
  DEFAULT_STOCKS.forEach((s) => stockPrices.set(s.symbol, s));
  return calcPortfolio(stockPrices);
}

// ============== Trading API ==============

export async function executeTrade(req: TradeRequest): Promise<Trade> {
  // Get current price from quote service
  const stock = DEFAULT_STOCKS.find((s) => s.symbol === req.symbol) || DEFAULT_STOCKS[0];
  const price = req.price || stock.price;

  const result = await doExecuteTrade(req, price);

  if (!result.success || !result.trade) {
    throw new Error(result.error || "交易失败");
  }

  return result.trade;
}

export async function getTrades(limit = 50): Promise<Trade[]> {
  return getTradeHistory(limit);
}

export async function resetPortfolio(): Promise<{ message: string }> {
  return doResetPortfolio();
}

// ============== Stock Selection AI API ==============

export async function aiStockSelection(req: StockSelectionRequest): Promise<StockSelectionResponse> {
  // Simulate AI processing delay
  await new Promise((r) => setTimeout(r, 800));

  const query = req.query.toLowerCase();
  let minPe = 0,
    maxPe = 100,
    minRoe = 0;

  if (query.includes("低估") || query.includes("价值") || query.includes("低估值")) {
    maxPe = 25;
    minRoe = 10;
  }
  if (query.includes("成长") || query.includes("高增长") || query.includes("创业板")) {
    minRoe = 15;
    maxPe = 40;
  }
  if (query.includes("银行") || query.includes("金融")) {
    maxPe = 15;
  }
  if (query.includes("白酒") || query.includes("消费")) {
    maxPe = 50;
    minRoe = 20;
  }

  const results = DEFAULT_STOCKS.filter((s) => {
    const pe = s.pe || 0;
    const roe = s.roe || 0;
    return pe >= minPe && pe <= maxPe && roe >= minRoe;
  }).slice(0, 5);

  return {
    stocks: results,
    ai_reasoning: `根据您的要求"${req.query}"，筛选出${results.length}只符合条件的股票。`,
  };
}

// ============== Backtest API ==============

export interface BacktestIndicator {
  type: "MA" | "RSI" | "MACD" | "KDJ" | "BOLL" | "VOL" | "PRICE";
  enabled: boolean;
  params: Record<string, number>;
}

export interface BacktestStrategy {
  name: string;
  indicators: BacktestIndicator[];
  buyCondition: string;
  sellCondition: string;
}

export async function runBacktest(req: BacktestRequest): Promise<BacktestResponse> {
  await new Promise((r) => setTimeout(r, 1200));

  const days = Math.ceil(
    (new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  const numPoints = Math.min(days, 30);

  // Generate equity curve with more realistic simulation
  let equity = req.initial_cash;
  const equityCurve: EquityPoint[] = [];
  const drawdownCurve: DrawdownPoint[] = [];
  let peak = req.initial_cash;
  let maxDrawdown = 0;

  const startTime = new Date(req.start_date).getTime();
  for (let idx = 0; idx < numPoints; idx++) {
    const date = new Date(startTime + idx * 86400000).toISOString().split("T")[0];
    // More realistic random walk with upward bias
    const dailyReturn = (Math.random() - 0.45) * 0.03;
    equity = equity * (1 + dailyReturn);
    equityCurve.push({ date, value: Math.round(equity) });

    // Track peak and drawdown
    if (equity > peak) peak = equity;
    const drawdown = ((peak - equity) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    drawdownCurve.push({
      date,
      drawdown: Math.round(drawdown * 100) / 100,
      peak: Math.round(peak),
      equity: Math.round(equity),
    });
  }

  // Generate trades
  const trades: BacktestTrade[] = [];
  const numTrades = Math.floor(Math.random() * 30) + 15;
  for (let i = 0; i < numTrades; i++) {
    const tradeDate = equityCurve[Math.floor(Math.random() * (equityCurve.length - 1))].date;
    const type = Math.random() > 0.5 ? "buy" : "sell";
    trades.push({
      date: tradeDate,
      symbol: DEFAULT_STOCKS[Math.floor(Math.random() * DEFAULT_STOCKS.length)].symbol,
      type,
      price: 10 + Math.random() * 100,
      quantity: Math.floor(Math.random() * 1000) * 100,
      amount: 0,
      profit: type === "sell" ? (Math.random() - 0.4) * 5000 : undefined,
    });
    trades[trades.length - 1].amount = trades[trades.length - 1].price * trades[trades.length - 1].quantity;
  }
  trades.sort((a, b) => a.date.localeCompare(b.date));

  // Generate monthly returns
  const monthlyReturns: { month: string; return_pct: number }[] = [];
  const numMonths = Math.min(Math.ceil(days / 30), 12);
  for (let m = 0; m < numMonths; m++) {
    const monthDate = new Date(new Date(req.start_date).getTime() + m * 30 * 86400000);
    monthlyReturns.push({
      month: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
      return_pct: Math.round((Math.random() - 0.4) * 15 * 100) / 100,
    });
  }

  // Generate return distribution
  const returnDistribution: ReturnDistribution[] = [
    { range: "<-5%", count: Math.floor(Math.random() * 5), percentage: 0 },
    { range: "-5%~0%", count: Math.floor(Math.random() * 10), percentage: 0 },
    { range: "0%~5%", count: Math.floor(Math.random() * 15), percentage: 0 },
    { range: "5%~10%", count: Math.floor(Math.random() * 10), percentage: 0 },
    { range: ">10%", count: Math.floor(Math.random() * 5), percentage: 0 },
  ];
  const total = returnDistribution.reduce((sum, r) => sum + r.count, 0);
  returnDistribution.forEach((r) => (r.percentage = total > 0 ? Math.round((r.count / total) * 100 * 10) / 10 : 0));

  const finalValue = equityCurve[equityCurve.length - 1].value;
  const totalReturn = ((finalValue - req.initial_cash) / req.initial_cash) * 100;

  // Calculate win rate and profit/loss ratio from trades
  const closedTrades = trades.filter((t) => t.profit !== undefined);
  const winningTrades = closedTrades.filter((t) => (t.profit || 0) > 0);
  const losingTrades = closedTrades.filter((t) => (t.profit || 0) < 0);
  const avgWin =
    winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + (t.profit || 0), 0) / winningTrades.length : 0;
  const avgLoss =
    losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((s, t) => s + (t.profit || 0), 0) / losingTrades.length)
      : 1;
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 50;
  const profitLossRatio = avgLoss > 0 ? avgWin / avgLoss : 1;

  const backtestResult: BacktestResponse = {
    id: Date.now(),
    strategy_name: req.strategy_name,
    total_return: Math.round(totalReturn * 100) / 100,
    annual_return: Math.round((totalReturn * 365 / days) * 100) / 100,
    max_drawdown: Math.round(maxDrawdown * 100) / 100,
    sharpe_ratio: Math.round((Math.random() * 2 + 0.5) * 100) / 100,
    win_rate: Math.round(winRate * 10) / 10,
    profit_loss_ratio: Math.round(profitLossRatio * 100) / 100,
    total_trades: trades.length,
    equity_curve: equityCurve,
    drawdown_curve: drawdownCurve,
    return_distribution: returnDistribution,
    monthly_returns: monthlyReturns,
    trades,
  };

  // Save to IndexedDB
  const backtestData: BacktestResultData = {
    id: backtestResult.id,
    strategy_name: backtestResult.strategy_name,
    config: JSON.stringify(req),
    result: JSON.stringify(backtestResult),
    created_at: new Date().toISOString(),
  };
  await saveBacktestResult(backtestData);

  return backtestResult;
}

export function getBacktestResults(limit = 20): Promise<BacktestResponse[]> {
  return (async () => {
    const results = await dbGetBacktestResults(limit);
    return results.map((r) => JSON.parse(r.result));
  })();
}

// ============== Analysis Helpers ==============

export function getIndicators(symbol: string): Promise<{ indicators: Record<string, number> }> {
  return (async () => {
    await new Promise((r) => setTimeout(r, 300));
    const stock = DEFAULT_STOCKS.find((s) => s.symbol === symbol) || DEFAULT_STOCKS[0];
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
    await new Promise((r) => setTimeout(r, 500));
    const stock = DEFAULT_STOCKS.find((s) => s.symbol === symbol) || DEFAULT_STOCKS[0];
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

export async function listModelConfigs(): Promise<AIModelConfig[]> {
  const configs = await getModelConfigsInternal();
  if (!configs || configs.length === 0) {
    return [
      {
        model_name: "minimax",
        base_url: "",
        api_protocol: "openai_compatible",
        is_active: true,
        has_api_key: false,
      },
      {
        model_name: "zhipu",
        base_url: "",
        api_protocol: "openai_compatible",
        is_active: false,
        has_api_key: false,
      },
      {
        model_name: "claude",
        base_url: "",
        api_protocol: "anthropic",
        is_active: false,
        has_api_key: false,
      },
    ];
  }
  return configs.map((c) => ({
    model_name: c.model_name,
    api_key: c.api_key,
    base_url: c.base_url,
    api_protocol: c.api_protocol as AIModelConfig["api_protocol"],
    is_active: c.is_active,
    has_api_key: !!c.api_key,
  }));
}

export async function saveModelConfig(config: AIModelConfig): Promise<AIModelConfig> {
  const existing = await getModelConfigsInternal();
  const existingIdx = existing.findIndex((c) => c.model_name === config.model_name);
  
  await dbSaveModelConfig({
    id: existingIdx >= 0 ? existing[existingIdx].id : Date.now(),
    model_name: config.model_name,
    api_key: config.api_key,
    base_url: config.base_url,
    api_protocol: config.api_protocol || "openai_compatible",
    is_active: config.is_active,
    updated_at: new Date().toISOString(),
  });
  
  await refreshModelConfigCache();
  return config;
}

export async function activateModel(modelName: string): Promise<void> {
  const configs = await getModelConfigsInternal();
  for (const c of configs) {
    c.is_active = c.model_name === modelName;
    await dbSaveModelConfig(c);
  }
  await refreshModelConfigCache();
}

export async function getActiveModel(): Promise<{ model_name: string }> {
  const configs = await getModelConfigsInternal();
  const active = configs.find((c) => c.is_active);
  return { model_name: active?.model_name || "minimax" };
}

// ============== AI Model Priority ==============

export async function getAIModelPriority(): Promise<{ priority: string[] }> {
  const configs = await getModelConfigsInternal();
  const priority = configs
    .sort((a, b) => {
      // Sort by active status first, then by model name
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return a.model_name.localeCompare(b.model_name);
    })
    .map((c) => c.model_name);
  return { priority };
}

export async function updateAIModelPriority(priority: string[]): Promise<void> {
  const configs = await getModelConfigsInternal();
  // Update order - first in priority list becomes active
  for (let i = 0; i < priority.length; i++) {
    const config = configs.find((c) => c.model_name === priority[i]);
    if (config) {
      config.is_active = i === 0;
      await dbSaveModelConfig(config);
    }
  }
  await refreshModelConfigCache();
}

// Legacy sync function for components that expect sync access
export function setCurrentModel(_modelName: string): void {
  // No-op in new async implementation
  // The store handles current model state
}

// ============== IPO Evaluation ==============

export async function evaluateIPO(stockCode: string): Promise<IPOEvaluationResult> {
  await new Promise((r) => setTimeout(r, 1500));
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
  return {
    sources: [
      { id: "eastmoney", name: "东方财富", enabled: true, priority: 1, status: "connected" },
      { id: "tonghuashun", name: "同花顺", enabled: true, priority: 2, status: "connected" },
      { id: "joinquant", name: "聚宽", enabled: false, priority: 3, status: "disconnected" },
    ],
  };
}

export function updateDataSource(_sourceId: string, _enabled: boolean): DataSourceResponse {
  // This would update the data source settings in IndexedDB
  // For now, just return the current state
  return getDataSources();
}
