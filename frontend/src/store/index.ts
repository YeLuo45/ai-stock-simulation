/**
 * Global state store using Zustand
 */
import { create } from "zustand";
import type { Page, Portfolio, Trade, StockInfo, BacktestResponse, AIModelConfig, IPOEvaluationResult } from "../types";

interface AppState {
  // Navigation
  currentPage: Page;
  setPage: (page: Page) => void;

  // Portfolio
  portfolio: Portfolio | null;
  setPortfolio: (p: Portfolio) => void;

  // Trade history
  trades: Trade[];
  setTrades: (trades: Trade[]) => void;
  addTrade: (trade: Trade) => void;

  // AI Model
  activeModel: string;
  setActiveModel: (model: string) => void;
  modelConfigs: AIModelConfig[];
  setModelConfigs: (configs: AIModelConfig[]) => void;

  // Stock selection results
  selectedStocks: StockInfo[];
  setSelectedStocks: (stocks: StockInfo[]) => void;
  aiReasoning: string;
  setAiReasoning: (reasoning: string) => void;

  // Backtest results
  backtestResults: BacktestResponse[];
  setBacktestResults: (results: BacktestResponse[]) => void;

  // IPO Evaluation
  ipoResult: IPOEvaluationResult | null;
  setIpoResult: (result: IPOEvaluationResult | null) => void;

  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Notification
  notification: { type: "success" | "error" | "info"; message: string } | null;
  showNotification: (type: "success" | "error" | "info", message: string) => void;
  clearNotification: () => void;
}

export const useStore = create<AppState>((set) => ({
  currentPage: "home",
  setPage: (page) => set({ currentPage: page }),

  portfolio: null,
  setPortfolio: (portfolio) => set({ portfolio }),

  trades: [],
  setTrades: (trades) => set({ trades }),
  addTrade: (trade) => set((state) => ({ trades: [trade, ...state.trades] })),

  activeModel: "minimax",
  setActiveModel: (activeModel) => set({ activeModel }),
  modelConfigs: [],
  setModelConfigs: (modelConfigs) => set({ modelConfigs }),

  selectedStocks: [],
  setSelectedStocks: (selectedStocks) => set({ selectedStocks }),
  aiReasoning: "",
  setAiReasoning: (aiReasoning) => set({ aiReasoning }),

  backtestResults: [],
  setBacktestResults: (backtestResults) => set({ backtestResults }),

  ipoResult: null,
  setIpoResult: (ipoResult) => set({ ipoResult }),

  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),

  notification: null,
  showNotification: (type, message) => {
    set({ notification: { type, message } });
    setTimeout(() => set({ notification: null }), 4000);
  },
  clearNotification: () => set({ notification: null }),
}));
