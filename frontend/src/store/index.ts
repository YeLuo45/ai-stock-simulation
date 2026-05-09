/**
 * Global state store using Zustand
 */
import { create } from "zustand";
import type { Page, Portfolio, Trade, StockInfo, BacktestResponse, AIModelConfig, IPOEvaluationResult, StockPool, AppliedStrategy, StrategyParams, StrategySignal, FollowTrade, QTable, RLTrainingProgress, RLTrainingResult } from "../types";

export interface PriceAlert {
  id: string;
  symbol: string;
  name: string;
  targetPrice: number;
  condition: 'above' | 'below';  // above=涨到，below=跌到
  triggered: boolean;
  createdAt: string;
}

// ============== Strategy Market ==============

export interface SubscribedStrategy {
  id: string;
  strategy_id: string;
  name: string;
  category: import("../types").StrategyCategory;
  subscribed_at: string;
  status: 'active' | 'cancelled';
  config_snapshot?: {
    entry_conditions: string[];
    exit_conditions: string[];
    position_size: number;
    stop_loss: number;
    take_profit: number;
  };
}

interface AppState {
  // Navigation
  currentPage: Page;
  setPage: (page: Page) => void;

  // Portfolio
  portfolio: Portfolio | null;
  setPortfolio: (p: Portfolio) => void;

  // Multi-account
  accounts: import("../types").Account[];
  currentAccountId: number | null;
  setAccounts: (accounts: import("../types").Account[]) => void;
  setCurrentAccountId: (id: number | null) => void;
  addAccount: (account: import("../types").Account) => void;
  deleteAccount: (id: number) => void;
  renameAccount: (id: number, name: string) => void;

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
  exportSelectedStocks: () => void;
  importSelectedStocks: (json: string) => { success: boolean; count?: number; error?: string };
  aiReasoning: string;
  setAiReasoning: (reasoning: string) => void;

  // Backtest results
  backtestResults: BacktestResponse[];
  setBacktestResults: (results: BacktestResponse[]) => void;

  // IPO Evaluation
  ipoResult: IPOEvaluationResult | null;
  setIpoResult: (result: IPOEvaluationResult | null) => void;

  // Stock Pools
  stockPools: StockPool[];
  setStockPools: (pools: StockPool[]) => void;
  addStockPool: (pool: StockPool) => void;
  updateStockPool: (id: string, pool: Partial<StockPool>) => void;
  deleteStockPool: (id: string) => void;
  activePoolId: string | null;
  setActivePoolId: (id: string | null) => void;

  // Price Alerts
  priceAlerts: PriceAlert[];
  addPriceAlert: (alert: PriceAlert) => void;
  removePriceAlert: (id: string) => void;
  triggerAlert: (id: string) => void;

  // Strategy Market
  subscribedStrategies: SubscribedStrategy[];
  addSubscribedStrategy: (strategy: SubscribedStrategy) => void;
  removeSubscribedStrategy: (id: string) => void;
  updateSubscribedStrategy: (id: string, update: Partial<SubscribedStrategy>) => void;

  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Notification
  notification: { type: "success" | "error" | "info"; message: string } | null;
  showNotification: (type: "success" | "error" | "info", message: string) => void;
  clearNotification: () => void;

  // Strategy from Evolution
  appliedStrategy: AppliedStrategy | null;
  strategyParams: StrategyParams | null;
  strategyHistory: AppliedStrategy[];
  applyStrategy: (strategy: AppliedStrategy) => void;
  clearStrategy: () => void;

  // Strategy Market - Follow Trading signals
  strategySignals: StrategySignal[];
  addStrategySignal: (signal: StrategySignal) => void;
  expireSignal: (id: string) => void;
  executeSignal: (id: string) => void;
  clearExpiredSignals: () => void;
  followTrades: FollowTrade[];
  addFollowTrade: (trade: FollowTrade) => void;
  updateFollowTrade: (id: string, update: Partial<FollowTrade>) => void;

  // RL Training State
  qTable: QTable;
  policyWeights: number[];
  trainingProgress: RLTrainingProgress;
  trainingHistory: RLTrainingResult[];
  selectedSymbol: string;
  setQTable: (qTable: QTable) => void;
  setPolicyWeights: (weights: number[]) => void;
  setTrainingProgress: (progress: Partial<RLTrainingProgress>) => void;
  addTrainingResult: (result: RLTrainingResult) => void;
  clearTrainingHistory: () => void;
  setSelectedSymbol: (symbol: string) => void;
  resetRLState: () => void;
}

export const useStore = create<AppState>((set) => ({
  currentPage: "home",
  setPage: (page) => set({ currentPage: page }),

  portfolio: null,
  setPortfolio: (portfolio) => set({ portfolio }),

  accounts: (() => {
    try {
      const saved = localStorage.getItem('ai-stock-accounts');
      return saved ? JSON.parse(saved) : [{ id: 1, name: '默认账户', created_at: new Date().toISOString() }];
    } catch {
      return [{ id: 1, name: '默认账户', created_at: new Date().toISOString() }];
    }
  })(),
  currentAccountId: (() => {
    try {
      const saved = localStorage.getItem('ai-stock-current-account-id');
      return saved ? JSON.parse(saved) : 1;
    } catch {
      return 1;
    }
  })(),
  setAccounts: (accounts) => {
    try { localStorage.setItem('ai-stock-accounts', JSON.stringify(accounts)); } catch {}
    set({ accounts });
  },
  setCurrentAccountId: (currentAccountId) => {
    try { localStorage.setItem('ai-stock-current-account-id', JSON.stringify(currentAccountId)); } catch {}
    set({ currentAccountId });
  },
  addAccount: (account) => set((state) => {
    const newAccounts = [...state.accounts, account];
    try { localStorage.setItem('ai-stock-accounts', JSON.stringify(newAccounts)); } catch {}
    return { accounts: newAccounts };
  }),
  deleteAccount: (id) => set((state) => {
    const newAccounts = state.accounts.filter(a => a.id !== id);
    const newCurrentId = state.currentAccountId === id ? (newAccounts[0]?.id || null) : state.currentAccountId;
    try {
      localStorage.setItem('ai-stock-accounts', JSON.stringify(newAccounts));
      localStorage.setItem('ai-stock-current-account-id', JSON.stringify(newCurrentId));
      localStorage.removeItem(`ai-stock-portfolio-${id}`);
      localStorage.removeItem(`ai-stock-trades-${id}`);
    } catch {}
    return { accounts: newAccounts, currentAccountId: newCurrentId };
  }),
  renameAccount: (id, name) => set((state) => {
    const newAccounts = state.accounts.map(a => a.id === id ? { ...a, name } : a);
    try { localStorage.setItem('ai-stock-accounts', JSON.stringify(newAccounts)); } catch {}
    return { accounts: newAccounts };
  }),

  trades: [],
  setTrades: (trades) => set({ trades }),
  addTrade: (trade) => set((state) => ({ trades: [trade, ...state.trades] })),

  activeModel: "minimax",
  setActiveModel: (activeModel) => set({ activeModel }),
  modelConfigs: [],
  setModelConfigs: (modelConfigs) => set({ modelConfigs }),

  selectedStocks: (() => {
    try {
      const saved = localStorage.getItem('selectedStocks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),
  setSelectedStocks: (selectedStocks) => {
    try {
      localStorage.setItem('selectedStocks', JSON.stringify(selectedStocks));
    } catch {
      // localStorage may be full or unavailable
    }
    set({ selectedStocks });
  },
  exportSelectedStocks: () => {
    const stocks = (useStore.getState() as any).selectedStocks;
    const json = JSON.stringify(stocks, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `自选股_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  importSelectedStocks: (json: string) => {
    try {
      const stocks = JSON.parse(json);
      if (Array.isArray(stocks)) {
        localStorage.setItem('selectedStocks', JSON.stringify(stocks));
        set({ selectedStocks: stocks });
        return { success: true, count: stocks.length };
      }
      return { success: false, error: 'Invalid format' };
    } catch {
      return { success: false, error: 'Parse error' };
    }
  },
  aiReasoning: "",
  setAiReasoning: (aiReasoning) => set({ aiReasoning }),

  backtestResults: [],
  setBacktestResults: (backtestResults) => set({ backtestResults }),

  ipoResult: null,
  setIpoResult: (ipoResult) => set({ ipoResult }),

  stockPools: [],
  setStockPools: (stockPools) => set({ stockPools }),
  addStockPool: (pool) => set((state) => ({ stockPools: [...state.stockPools, pool] })),
  updateStockPool: (id, pool) => set((state) => ({
    stockPools: state.stockPools.map((p) => p.id === id ? { ...p, ...pool } : p),
  })),
  deleteStockPool: (id) => set((state) => ({
    stockPools: state.stockPools.filter((p) => p.id !== id),
  })),
  activePoolId: null,
  setActivePoolId: (activePoolId) => set({ activePoolId }),

  priceAlerts: [],
  addPriceAlert: (alert) => set((state) => ({
    priceAlerts: [...state.priceAlerts, alert],
  })),
  removePriceAlert: (id) => set((state) => ({
    priceAlerts: state.priceAlerts.filter(a => a.id !== id),
  })),
  triggerAlert: (id) => set((state) => ({
    priceAlerts: state.priceAlerts.map(a => a.id === id ? { ...a, triggered: true } : a),
  })),

  subscribedStrategies: (() => {
    try {
      const saved = localStorage.getItem('strategy-subscriptions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),
  addSubscribedStrategy: (strategy) => set((state) => {
    const newList = [...state.subscribedStrategies, strategy];
    try { localStorage.setItem('strategy-subscriptions', JSON.stringify(newList)); } catch {}
    return { subscribedStrategies: newList };
  }),
  removeSubscribedStrategy: (id) => set((state) => {
    const newList = state.subscribedStrategies.filter(s => s.id !== id);
    try { localStorage.setItem('strategy-subscriptions', JSON.stringify(newList)); } catch {}
    return { subscribedStrategies: newList };
  }),
  updateSubscribedStrategy: (id, update) => set((state) => {
    const newList = state.subscribedStrategies.map(s => s.id === id ? { ...s, ...update } : s);
    try { localStorage.setItem('strategy-subscriptions', JSON.stringify(newList)); } catch {}
    return { subscribedStrategies: newList };
  }),

  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),

  notification: null,
  showNotification: (type, message) => {
    set({ notification: { type, message } });
    setTimeout(() => set({ notification: null }), 4000);
  },
  clearNotification: () => set({ notification: null }),

  // Strategy from Evolution
  appliedStrategy: (() => {
    try {
      const saved = localStorage.getItem('appliedStrategy');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })(),
  strategyParams: (() => {
    try {
      const saved = localStorage.getItem('strategyParams');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })(),
  strategyHistory: (() => {
    try {
      const saved = localStorage.getItem('strategyHistory');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),
  applyStrategy: (strategy) => set((state) => {
    const newHistory = [strategy, ...state.strategyHistory].slice(0, 50); // Keep last 50
    try {
      localStorage.setItem('appliedStrategy', JSON.stringify(strategy));
      localStorage.setItem('strategyParams', JSON.stringify(strategy.params));
      localStorage.setItem('strategyHistory', JSON.stringify(newHistory));
    } catch {}
    return {
      appliedStrategy: strategy,
      strategyParams: strategy.params,
      strategyHistory: newHistory,
    };
  }),
  clearStrategy: () => set(() => {
    try {
      localStorage.removeItem('appliedStrategy');
      localStorage.removeItem('strategyParams');
    } catch {}
    return {
      appliedStrategy: null,
      strategyParams: null,
    };
  }),

  // Follow Trading signals
  strategySignals: (() => {
    try {
      const saved = localStorage.getItem('strategy-signals');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })(),
  addStrategySignal: (signal) => set((state) => {
    const newList = [signal, ...state.strategySignals].slice(0, 200);
    try { localStorage.setItem('strategy-signals', JSON.stringify(newList)); } catch {}
    return { strategySignals: newList };
  }),
  expireSignal: (id) => set((state) => {
    const newList = state.strategySignals.map(s => s.id === id ? { ...s, expired: true } : s);
    try { localStorage.setItem('strategy-signals', JSON.stringify(newList)); } catch {}
    return { strategySignals: newList };
  }),
  executeSignal: (id) => set((state) => {
    const newList = state.strategySignals.map(s => s.id === id ? { ...s, executed: true } : s);
    try { localStorage.setItem('strategy-signals', JSON.stringify(newList)); } catch {}
    return { strategySignals: newList };
  }),
  clearExpiredSignals: () => set((state) => {
    const newList = state.strategySignals.filter(s => !s.expired);
    try { localStorage.setItem('strategy-signals', JSON.stringify(newList)); } catch {}
    return { strategySignals: newList };
  }),
  followTrades: (() => {
    try {
      const saved = localStorage.getItem('follow-trades');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })(),
  addFollowTrade: (trade) => set((state) => {
    const newList = [trade, ...state.followTrades].slice(0, 500);
    try { localStorage.setItem('follow-trades', JSON.stringify(newList)); } catch {}
    return { followTrades: newList };
  }),
  updateFollowTrade: (id, update) => set((state) => {
    const newList = state.followTrades.map(t => t.id === id ? { ...t, ...update } : t);
    try { localStorage.setItem('follow-trades', JSON.stringify(newList)); } catch {}
    return { followTrades: newList };
  }),

  // RL Training State
  qTable: {},
  policyWeights: [],
  trainingProgress: {
    currentEpisode: 0,
    totalEpisodes: 500,
    currentReward: 0,
    epsilon: 0.1,
    isRunning: false,
    isPaused: false,
  },
  trainingHistory: [],
  selectedSymbol: 'AAPL',
  setQTable: (qTable) => set({ qTable }),
  setPolicyWeights: (policyWeights) => set({ policyWeights }),
  setTrainingProgress: (progress) => set((state) => ({
    trainingProgress: { ...state.trainingProgress, ...progress },
  })),
  addTrainingResult: (result) => set((state) => ({
    trainingHistory: [...state.trainingHistory, result],
  })),
  clearTrainingHistory: () => set({ trainingHistory: [] }),
  setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),
  resetRLState: () => set({
    qTable: {},
    policyWeights: [],
    trainingProgress: {
      currentEpisode: 0,
      totalEpisodes: 500,
      currentReward: 0,
      epsilon: 0.1,
      isRunning: false,
      isPaused: false,
    },
    trainingHistory: [],
  }),
}));
