/**
 * API service for AI Stock Simulation
 * In demo mode (VITE_DEMO_MODE=true), returns mock data for GitHub Pages deployment
 */
/// <reference types="vite/client" />
import axios from "axios";
import type {
  StockSelectionRequest, StockSelectionResponse,
  Portfolio, TradeRequest, Trade,
  BacktestRequest, BacktestResponse,
  TechnicalAnalysis, AIModelConfig,
  IPOEvaluationResult, DataSourceResponse,
  AIModelPriorityResponse
} from "../types";

// Demo mode check
const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

// Import mock data
import {
  mockStocks,
  mockPortfolio,
  mockTrades,
  mockBacktestResults,
  mockTechnicalAnalysis,
  mockModelConfigs,
  mockIPOResult,
  mockDataSources,
  mockAIModelPriority,
  mockStockSelection,
} from "./mockData";

// ============== Real API ==============
const API_BASE = "http://127.0.0.1:8000/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

let currentModel = "minimax";
export const setCurrentModel = (model: string) => { currentModel = model; };

// ============== Demo Mode Mock Wrappers ==============

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const mockGetPortfolio = async (): Promise<Portfolio> => {
  await delay(300);
  return { ...mockPortfolio };
};

const mockGetTrades = async (limit = 50): Promise<Trade[]> => {
  await delay(200);
  return mockTrades.slice(0, limit);
};

const mockRunBacktest = async (req: BacktestRequest): Promise<BacktestResponse> => {
  await delay(1200);
  return {
    ...mockBacktestResults[0],
    strategy_name: req.strategy_name,
    equity_curve: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      value: req.initial_cash * (1 + (i * 0.01) + Math.sin(i * 0.5) * 0.02),
    })),
  };
};

const mockGetBacktestResults = async (limit = 20) => {
  await delay(300);
  return mockBacktestResults.slice(0, limit);
};

const mockTechnicalAnalysisFn = async (symbol: string): Promise<TechnicalAnalysis> => {
  await delay(600);
  return { ...mockTechnicalAnalysis, symbol, name: mockStocks.find(s => s.symbol === symbol)?.name || symbol };
};

const mockSearchStocks = async (keyword: string) => {
  await delay(400);
  return mockStocks.filter(s => s.name.includes(keyword) || s.symbol.includes(keyword));
};

const mockGetStockQuote = async (symbol: string) => {
  await delay(200);
  const stock = mockStocks.find(s => s.symbol === symbol);
  return stock || mockStocks[0];
};

const mockGetMultipleQuotes = async (symbols: string[]) => {
  await delay(300);
  return symbols.map(sym => mockStocks.find(s => s.symbol === sym) || mockStocks[0]);
};

const mockExecuteTrade = async (req: TradeRequest): Promise<Trade> => {
  await delay(500);
  const trade: Trade = {
    id: Date.now(),
    symbol: req.symbol,
    name: req.name,
    trade_type: req.trade_type,
    price: req.price || mockStocks.find(s => s.symbol === req.symbol)?.price || 10,
    quantity: req.quantity,
    commission: req.quantity * (req.price || 10) * 0.0003,
    total_cost: req.trade_type === "buy"
      ? req.quantity * (req.price || 10) * 1.0003
      : -req.quantity * (req.price || 10) * 0.9997,
    timestamp: new Date().toISOString(),
  };
  return trade;
};

const mockResetPortfolio = async () => {
  await delay(300);
  return { message: "Portfolio reset successfully" };
};

const mockListModelConfigs = async (): Promise<AIModelConfig[]> => {
  await delay(200);
  return [...mockModelConfigs];
};

const mockSaveModelConfig = async (config: {
  model_name: string;
  api_key: string;
  base_url?: string;
  api_protocol?: string;
  is_active: boolean;
}) => {
  await delay(300);
  return { message: "Config saved", ...config, has_api_key: !!config.api_key };
};

const mockActivateModel = async (modelName: string) => {
  await delay(200);
  currentModel = modelName;
  return { message: `Model ${modelName} activated` };
};

const mockGetActiveModel = async () => {
  await delay(100);
  return { model_name: currentModel };
};

const mockTestModel = async (modelName: string) => {
  await delay(800);
  return { success: true, message: `${modelName} connection successful` };
};

const mockGetAppInfo = async () => {
  await delay(100);
  return { name: "AlphaTrader", version: "1.0.0", description: "AI Stock Simulation" };
};

const mockHealthCheck = async () => {
  await delay(100);
  return { status: "ok" };
};

const mockEvaluateIPO = async (stockCode: string): Promise<IPOEvaluationResult> => {
  await delay(1500);
  return { ...mockIPOResult, stock_code: stockCode };
};

const mockGetDataSources = async (): Promise<DataSourceResponse> => {
  await delay(200);
  return { ...mockDataSources };
};

const mockUpdateDataSource = async (sourceId: string, enabled: boolean) => {
  await delay(300);
  return { message: `Data source ${sourceId} ${enabled ? "enabled" : "disabled"}` };
};

const mockGetAIModelPriority = async (): Promise<AIModelPriorityResponse> => {
  await delay(200);
  return { ...mockAIModelPriority };
};

const mockUpdateAIModelPriority = async (priority: string[]): Promise<{ message: string; priority: string[] }> => {
  await delay(300);
  return { message: "Priority updated", priority };
};

// ============== Stock Selection ==============

export const searchStocks = async (keyword: string) => {
  if (isDemoMode) return mockSearchStocks(keyword);
  const res = await api.get("/stocks/search", { params: { keyword } });
  return res.data;
};

export const aiStockSelection = async (req: StockSelectionRequest): Promise<StockSelectionResponse> => {
  if (isDemoMode) return mockStockSelection(req.query);
  const res = await api.post("/stocks/selection", req, { params: { model_name: currentModel } });
  return res.data;
};

export const getStockQuote = async (symbol: string) => {
  if (isDemoMode) return mockGetStockQuote(symbol);
  const res = await api.get(`/stocks/quote/${symbol}`);
  return res.data;
};

export const getMultipleQuotes = async (symbols: string[]) => {
  if (isDemoMode) return mockGetMultipleQuotes(symbols);
  const res = await api.get("/stocks/quotes", { params: { symbols: symbols.join(",") } });
  return res.data;
};

// ============== Trading ==============

export const getPortfolio = async (): Promise<Portfolio> => {
  if (isDemoMode) return mockGetPortfolio();
  const res = await api.get("/trading/portfolio");
  return res.data;
};

export const executeTrade = async (req: TradeRequest): Promise<Trade> => {
  if (isDemoMode) return mockExecuteTrade(req);
  const res = await api.post("/trading/trade", req);
  return res.data;
};

export const getTrades = async (limit = 50): Promise<Trade[]> => {
  if (isDemoMode) return mockGetTrades(limit);
  const res = await api.get("/trading/trades", { params: { limit } });
  return res.data;
};

export const resetPortfolio = async () => {
  if (isDemoMode) return mockResetPortfolio();
  const res = await api.post("/trading/reset");
  return res.data;
};

// ============== Backtest ==============

export const runBacktest = async (req: BacktestRequest): Promise<BacktestResponse> => {
  if (isDemoMode) return mockRunBacktest(req);
  const res = await api.post("/backtest/run", req, { params: { model_name: currentModel } });
  return res.data;
};

export const getBacktestResults = async (limit = 20) => {
  if (isDemoMode) return mockGetBacktestResults(limit);
  const res = await api.get("/backtest/results", { params: { limit } });
  return res.data;
};

export const explainBacktest = async (strategyName: string, results: object) => {
  if (isDemoMode) {
    await delay(800);
    return { explanation: `策略"${strategyName}"表现良好，总收益28.5%，年化收益14.2%，夏普比率1.35，风险调整后收益表现优异。` };
  }
  const res = await api.post("/backtest/explain", null, {
    params: { strategy_name: strategyName, results_json: JSON.stringify(results), model_name: currentModel },
  });
  return res.data;
};

// ============== Technical Analysis ==============

export const technicalAnalysis = async (symbol: string, indicatorTypes: string[]): Promise<TechnicalAnalysis> => {
  if (isDemoMode) return mockTechnicalAnalysisFn(symbol);
  const res = await api.post("/analysis/technical", { symbol, indicator_types: indicatorTypes }, {
    params: { model_name: currentModel },
  });
  return res.data;
};

export const getIndicators = async (symbol: string) => {
  if (isDemoMode) return mockTechnicalAnalysisFn(symbol);
  const res = await api.get(`/analysis/indicators/${symbol}`);
  return res.data;
};

// ============== AI Model Config ==============

export const listModelConfigs = async (): Promise<AIModelConfig[]> => {
  if (isDemoMode) return mockListModelConfigs();
  const res = await api.get("/models/configs");
  return res.data;
};

export const saveModelConfig = async (config: {
  model_name: string;
  api_key: string;
  base_url?: string;
  api_protocol?: string;
  is_active: boolean;
}) => {
  if (isDemoMode) return mockSaveModelConfig(config);
  const res = await api.post("/models/configs", config);
  return res.data;
};

export const activateModel = async (modelName: string) => {
  if (isDemoMode) return mockActivateModel(modelName);
  const res = await api.post(`/models/configs/${modelName}/activate`);
  return res.data;
};

export const getActiveModel = async () => {
  if (isDemoMode) return mockGetActiveModel();
  const res = await api.get("/models/configs/active");
  return res.data;
};

export const testModel = async (modelName: string, apiKey?: string, baseUrl?: string, apiProtocol?: string) => {
  if (isDemoMode) return mockTestModel(modelName);
  const res = await api.post("/models/test", null, {
    params: { model_name: modelName, api_key: apiKey, base_url: baseUrl, api_protocol: apiProtocol },
  });
  return res.data;
};

// ============== App Info ==============

export const getAppInfo = async () => {
  if (isDemoMode) return mockGetAppInfo();
  const res = await api.get("/info");
  return res.data;
};

export const healthCheck = async () => {
  if (isDemoMode) return mockHealthCheck();
  const res = await api.get("/health");
  return res.data;
};

// ============== IPO Evaluation ==============

export const evaluateIPO = async (stockCode: string, modelName?: string): Promise<IPOEvaluationResult> => {
  if (isDemoMode) return mockEvaluateIPO(stockCode);
  const res = await api.post("/ipo/evaluate", { stock_code: stockCode }, {
    params: { model_name: modelName || currentModel },
  });
  return res.data;
};

// ============== Data Source Management ==============

export const getDataSources = async (): Promise<DataSourceResponse> => {
  if (isDemoMode) return mockGetDataSources();
  const res = await api.get("/data-sources");
  return res.data;
};

export const updateDataSource = async (sourceId: string, enabled: boolean) => {
  if (isDemoMode) return mockUpdateDataSource(sourceId, enabled);
  const res = await api.put(`/data-sources/${sourceId}`, { enabled });
  return res.data;
};

// ============== AI Model Priority ==============

export const getAIModelPriority = async (): Promise<AIModelPriorityResponse> => {
  if (isDemoMode) return mockGetAIModelPriority();
  const res = await api.get("/ai-model-priority");
  return res.data;
};

export const updateAIModelPriority = async (priority: string[]): Promise<{ message: string; priority: string[] }> => {
  if (isDemoMode) return mockUpdateAIModelPriority(priority);
  const res = await api.put("/ai-model-priority", { priority });
  return res.data;
};
