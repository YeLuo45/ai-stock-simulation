/**
 * API service for AI Stock Simulation
 * Connects to the Python FastAPI backend
 */
import axios from "axios";
import type {
  StockSelectionRequest, StockSelectionResponse,
  Portfolio, TradeRequest, Trade,
  BacktestRequest, BacktestResponse,
  TechnicalAnalysis, AIModelConfig,
  IPOEvaluationResult, DataSourceResponse,
  AIModelPriorityResponse
} from "../types";

const API_BASE = "http://127.0.0.1:8000/api";

// Create axios instance with defaults
const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor for model selection
let currentModel = "minimax";
export const setCurrentModel = (model: string) => { currentModel = model; };

// ============== Stock Selection ==============

export const searchStocks = async (keyword: string) => {
  const res = await api.get("/stocks/search", { params: { keyword } });
  return res.data;
};

export const aiStockSelection = async (req: StockSelectionRequest): Promise<StockSelectionResponse> => {
  const res = await api.post("/stocks/selection", req, { params: { model_name: currentModel } });
  return res.data;
};

export const getStockQuote = async (symbol: string) => {
  const res = await api.get(`/stocks/quote/${symbol}`);
  return res.data;
};

export const getMultipleQuotes = async (symbols: string[]) => {
  const res = await api.get("/stocks/quotes", { params: { symbols: symbols.join(",") } });
  return res.data;
};

// ============== Trading ==============

export const getPortfolio = async (): Promise<Portfolio> => {
  const res = await api.get("/trading/portfolio");
  return res.data;
};

export const executeTrade = async (req: TradeRequest): Promise<Trade> => {
  const res = await api.post("/trading/trade", req);
  return res.data;
};

export const getTrades = async (limit = 50): Promise<Trade[]> => {
  const res = await api.get("/trading/trades", { params: { limit } });
  return res.data;
};

export const resetPortfolio = async () => {
  const res = await api.post("/trading/reset");
  return res.data;
};

// ============== Backtest ==============

export const runBacktest = async (req: BacktestRequest): Promise<BacktestResponse> => {
  const res = await api.post("/backtest/run", req, { params: { model_name: currentModel } });
  return res.data;
};

export const getBacktestResults = async (limit = 20) => {
  const res = await api.get("/backtest/results", { params: { limit } });
  return res.data;
};

export const explainBacktest = async (strategyName: string, results: object) => {
  const res = await api.post("/backtest/explain", null, {
    params: { strategy_name: strategyName, results_json: JSON.stringify(results), model_name: currentModel },
  });
  return res.data;
};

// ============== Technical Analysis ==============

export const technicalAnalysis = async (symbol: string, indicatorTypes: string[]): Promise<TechnicalAnalysis> => {
  const res = await api.post("/analysis/technical", { symbol, indicator_types: indicatorTypes }, {
    params: { model_name: currentModel },
  });
  return res.data;
};

export const getIndicators = async (symbol: string) => {
  const res = await api.get(`/analysis/indicators/${symbol}`);
  return res.data;
};

// ============== AI Model Config ==============

export const listModelConfigs = async (): Promise<AIModelConfig[]> => {
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
  const res = await api.post("/models/configs", config);
  return res.data;
};

export const activateModel = async (modelName: string) => {
  const res = await api.post(`/models/configs/${modelName}/activate`);
  return res.data;
};

export const getActiveModel = async () => {
  const res = await api.get("/models/configs/active");
  return res.data;
};

export const testModel = async (modelName: string, apiKey: string, baseUrl?: string, apiProtocol?: string) => {
  const res = await api.post("/models/test", null, {
    params: { model_name: modelName, api_key: apiKey, base_url: baseUrl, api_protocol: apiProtocol },
  });
  return res.data;
};

// ============== App Info ==============

export const getAppInfo = async () => {
  const res = await api.get("/info");
  return res.data;
};

export const healthCheck = async () => {
  const res = await api.get("/health");
  return res.data;
};

// ============== IPO Evaluation ==============

export const evaluateIPO = async (stockCode: string, modelName?: string): Promise<IPOEvaluationResult> => {
  const res = await api.post("/ipo/evaluate", { stock_code: stockCode }, {
    params: { model_name: modelName || currentModel },
  });
  return res.data;
};

// ============== Data Source Management ==============

export const getDataSources = async (): Promise<DataSourceResponse> => {
  const res = await api.get("/data-sources");
  return res.data;
};

export const updateDataSource = async (sourceId: string, enabled: boolean) => {
  const res = await api.put(`/data-sources/${sourceId}`, { enabled });
  return res.data;
};

// ============== AI Model Priority ==============

export const getAIModelPriority = async (): Promise<AIModelPriorityResponse> => {
  const res = await api.get("/ai-model-priority");
  return res.data;
};

export const updateAIModelPriority = async (priority: string[]): Promise<{ message: string; priority: string[] }> => {
  const res = await api.put("/ai-model-priority", { priority });
  return res.data;
};
