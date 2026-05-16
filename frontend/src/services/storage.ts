/**
 * localStorage persistence layer for pure frontend mode
 * Replaces backend SQLite storage
 */
import type { Portfolio, Trade, BacktestResponse, AIModelConfig, DataSourceResponse, AIModelPriorityResponse, StockInfo, MemoryEntry, MemoryType, FactorPortfolio } from "../types";

// ============== LLM Config Storage ==============

export interface LLMConfig {
  enabled: boolean;
  provider: 'minimax' | 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  enabled: false,
  provider: 'minimax',
  apiKey: '',
  temperature: 0.7,
  maxTokens: 2048,
};

export const LLM_CONFIG_KEY = 'ai-stock-llm-config';

function encodeApiKey(key: string): string {
  return btoa(key.split('').map((c, i) => 
    String.fromCharCode(c.charCodeAt(0) ^ (i % 256))
  ).join(''));
}

function decodeApiKey(encoded: string): string {
  return atob(encoded).split('').map((c, i) => 
    String.fromCharCode(c.charCodeAt(0) ^ (i % 256))
  ).join('');
}

export function saveLLMConfig(config: LLMConfig): void {
  const toSave = { ...config };
  if (config.apiKey) {
    toSave.apiKey = encodeApiKey(config.apiKey);
  }
  localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(toSave));
}

export function loadLLMConfig(): LLMConfig {
  try {
    const stored = localStorage.getItem(LLM_CONFIG_KEY);
    if (!stored) return DEFAULT_LLM_CONFIG;
    const parsed = JSON.parse(stored);
    if (parsed.apiKey) {
      parsed.apiKey = decodeApiKey(parsed.apiKey);
    }
    return { ...DEFAULT_LLM_CONFIG, ...parsed };
  } catch {
    return DEFAULT_LLM_CONFIG;
  }
}

export function clearLLMConfig(): void {
  localStorage.removeItem(LLM_CONFIG_KEY);
}

// Storage keys
const KEYS = {
  PORTFOLIO: (accountId: number) => `ai-stock-portfolio-${accountId}`,
  TRADES: (accountId: number) => `ai-stock-trades-${accountId}`,
  BACKTEST_RESULTS: "ai-stock-backtest-results",
  MODEL_CONFIGS: "ai-stock-model-configs",
  MODEL_PRIORITY: "ai-stock-model-priority",
  DATA_SOURCES: "ai-stock-data-sources",
  CURRENT_MODEL: "ai-stock-current-model",
  ACCOUNTS: "ai-stock-accounts",
  CURRENT_ACCOUNT_ID: "ai-stock-current-account-id",
} as const;

// Default stock list
export const DEFAULT_STOCKS: StockInfo[] = [
  { symbol: "000001", name: "平安银行", market: "深圳", price: 12.35, change_pct: 1.23, volume: 45678900, pe: 8.5, pb: 0.92, roe: 10.8, market_cap: 238000000000 },
  { symbol: "600519", name: "贵州茅台", market: "上海", price: 1688.00, change_pct: -0.45, volume: 2345678, pe: 32.1, pb: 11.2, roe: 35.2, market_cap: 2120000000000 },
  { symbol: "000002", name: "万科A", market: "深圳", price: 8.92, change_pct: 2.34, volume: 34567890, pe: 7.2, pb: 0.85, roe: 11.5, market_cap: 104000000000 },
  { symbol: "600036", name: "招商银行", market: "上海", price: 35.67, change_pct: 0.89, volume: 12345678, pe: 9.8, pb: 1.23, roe: 12.5, market_cap: 896000000000 },
  { symbol: "000858", name: "五粮液", market: "深圳", price: 145.23, change_pct: -1.12, volume: 5678901, pe: 22.5, pb: 5.8, roe: 25.8, market_cap: 563000000000 },
  { symbol: "688001", name: "华兴源创", market: "科创板", price: 28.45, change_pct: 3.45, volume: 1234567, pe: 45.2, pb: 3.2, roe: 8.5, market_cap: 128000000000 },
  { symbol: "300750", name: "宁德时代", market: "创业板", price: 189.50, change_pct: 1.78, volume: 9876543, pe: 28.5, pb: 6.8, roe: 24.2, market_cap: 4420000000000 },
  { symbol: "688981", name: "中芯国际", market: "科创板", price: 48.60, change_pct: 2.15, volume: 23456789, pe: 35.2, pb: 3.8, roe: 9.5, market_cap: 385000000000 },
  { symbol: "002594", name: "比亚迪", market: "深圳", price: 198.30, change_pct: -0.88, volume: 8765432, pe: 25.6, pb: 5.2, roe: 18.3, market_cap: 577000000000 },
  { symbol: "301378", name: "贝泰妮", market: "创业板", price: 82.50, change_pct: 1.55, volume: 2345678, pe: 38.5, pb: 4.8, roe: 14.2, market_cap: 348000000000 },
];

const DEFAULT_MODEL_CONFIGS: AIModelConfig[] = [
  { model_name: "minimax", base_url: "https://api.minimax.chat", api_protocol: "openai_compatible", is_active: true, has_api_key: true },
  { model_name: "zhipu", base_url: "https://open.bigmodel.cn", api_protocol: "openai_compatible", is_active: false, has_api_key: false },
  { model_name: "claude", base_url: "https://api.anthropic.com", api_protocol: "anthropic", is_active: false, has_api_key: false },
  { model_name: "gemini", base_url: "https://generativelanguage.googleapis.com", api_protocol: "google", is_active: false, has_api_key: false },
];

const DEFAULT_DATA_SOURCES: DataSourceResponse = {
  sources: [
    { id: "eastmoney", name: "东方财富", enabled: true, priority: 1, status: "available" },
    { id: "tonghuashun", name: "同花顺", enabled: true, priority: 2, status: "available" },
    { id: "joinquant", name: "聚宽", enabled: false, priority: 3, status: "disabled" },
  ],
};

const DEFAULT_AI_PRIORITY: AIModelPriorityResponse = {
  priority: ["minimax", "zhipu", "claude", "gemini"],
};

function createDefaultPortfolio(accountId?: number): Portfolio {
  return {
    id: accountId || 1,
    name: "我的模拟账户",
    cash: 1000000,
    total_market_value: 0,
    total_assets: 1000000,
    total_profit_loss: 0,
    total_profit_loss_pct: 0,
    positions: [],
  };
}

// ============== Generic helpers ==============

export function load<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ============== Portfolio ==============

export function getPortfolio(accountId: number = 1): Portfolio {
  return load<Portfolio>(KEYS.PORTFOLIO(accountId), createDefaultPortfolio(accountId));
}

export function savePortfolio(portfolio: Portfolio, accountId: number): void {
  save(KEYS.PORTFOLIO(accountId), portfolio);
}

export function recalcPortfolio(accountId: number = 1): Portfolio {
  const portfolio = getPortfolio(accountId);
  portfolio.total_market_value = portfolio.positions.reduce((sum, p) => sum + p.market_value, 0);
  portfolio.total_assets = portfolio.cash + portfolio.total_market_value;
  portfolio.total_profit_loss = portfolio.total_assets - 1000000;
  portfolio.total_profit_loss_pct = (portfolio.total_profit_loss / 1000000) * 100;
  portfolio.positions.forEach(p => {
    p.market_value = p.quantity * p.current_price;
    p.profit_loss = (p.current_price - p.avg_cost) * p.quantity;
    p.profit_loss_pct = ((p.current_price - p.avg_cost) / p.avg_cost) * 100;
  });
  savePortfolio(portfolio, accountId);
  return portfolio;
}

// ============== Trades ==============

export function getTrades(accountId: number = 1): Trade[] {
  return load<Trade[]>(KEYS.TRADES(accountId), []);
}

export function addTrade(trade: Trade, accountId: number): void {
  const trades = getTrades(accountId);
  trades.unshift(trade);
  save(KEYS.TRADES(accountId), trades);
}

// ============== Backtest Results ==============

export function getBacktestResults(): BacktestResponse[] {
  return load<BacktestResponse[]>(KEYS.BACKTEST_RESULTS, []);
}

export function addBacktestResult(result: BacktestResponse): void {
  const results = getBacktestResults();
  results.unshift(result);
  save(KEYS.BACKTEST_RESULTS, results);
}

// ============== Model Configs ==============

export function getModelConfigs(): AIModelConfig[] {
  return load<AIModelConfig[]>(KEYS.MODEL_CONFIGS, [...DEFAULT_MODEL_CONFIGS]);
}

export function saveModelConfigs(configs: AIModelConfig[]): void {
  save(KEYS.MODEL_CONFIGS, configs);
}

export function getCurrentModel(): string {
  return load<string>(KEYS.CURRENT_MODEL, "minimax");
}

export function setCurrentModel(model: string): void {
  save(KEYS.CURRENT_MODEL, model);
}

// ============== Data Sources ==============

export function getDataSources(): DataSourceResponse {
  return load<DataSourceResponse>(KEYS.DATA_SOURCES, { ...DEFAULT_DATA_SOURCES });
}

export function saveDataSources(ds: DataSourceResponse): void {
  save(KEYS.DATA_SOURCES, ds);
}

// ============== AI Model Priority ==============

export function getAIModelPriority(): AIModelPriorityResponse {
  return load<AIModelPriorityResponse>(KEYS.MODEL_PRIORITY, { ...DEFAULT_AI_PRIORITY });
}

export function saveAIModelPriority(priority: string[]): void {
  save(KEYS.MODEL_PRIORITY, { priority });
}

// ============== Reset ==============

export function resetAll(accountId: number = 1): void {
  localStorage.removeItem(KEYS.PORTFOLIO(accountId));
  localStorage.removeItem(KEYS.TRADES(accountId));
  localStorage.removeItem(KEYS.BACKTEST_RESULTS);
  // Keep model configs, data sources, priority
}

// ============== Initial setup check ==============

export function initStorage(accountId: number = 1): void {
  // Ensure portfolio exists
  if (!localStorage.getItem(KEYS.PORTFOLIO(accountId))) {
    savePortfolio(createDefaultPortfolio(accountId), accountId);
  }
}

// ============== Account Management ==============

export function getAccounts(): { id: number; name: string; created_at: string }[] {
  return load(KEYS.ACCOUNTS, [{ id: 1, name: '默认账户', created_at: new Date().toISOString() }]);
}

export function saveAccounts(accounts: { id: number; name: string; created_at: string }[]): void {
  save(KEYS.ACCOUNTS, accounts);
}

export function getCurrentAccountId(): number {
  return load(KEYS.CURRENT_ACCOUNT_ID, 1);
}

export function setCurrentAccountId(id: number): void {
  save(KEYS.CURRENT_ACCOUNT_ID, id);
}

// ============== Memory / Notes ==============

const KEY_MEMORY = "ai-stock-memory";

const DEFAULT_MEMORY_TAGS: Record<MemoryType, { label: string; color: string }> = {
  insight: { label: "💡 灵感", color: "#f59e0b" },
  note: { label: "📝 笔记", color: "#3b82f6" },
  trade_log: { label: "📋 交易记录", color: "#10b981" },
  analysis: { label: "📊 分析", color: "#8b5cf6" },
  idea: { label: "💭 想法", color: "#ec4899" },
  trade_decision: { label: "📈 交易决策", color: "#14b8a6" },
};

export const MEMORY_TYPE_META = DEFAULT_MEMORY_TAGS;

function getDefaultMemory(): MemoryEntry[] {
  const now = new Date().toISOString();
  return [
    {
      id: "mem-demo-1",
      type: "insight",
      title: "平安银行低估值观察",
      content: "PB仅0.92，低于行业平均，安全边际较高。可考虑在10元以下分批建仓。",
      tags: ["低估", "银行", "价值投资"],
      symbol: "000001",
      created_at: now,
      updated_at: now,
      is_pinned: true,
    },
    {
      id: "mem-demo-2",
      type: "analysis",
      title: "贵州茅台技术面分析",
      content: "当前处于震荡区间，MA60形成支撑。MACD出现金叉信号，短期偏多。",
      tags: ["技术分析", "MACD", "白酒"],
      symbol: "600519",
      created_at: now,
      updated_at: now,
      is_favorite: true,
    },
    {
      id: "mem-demo-3",
      type: "trade_log",
      title: "买入宁德时代",
      content: "以185.5元买入500股，仓位占比约9%。止损设在170元，止盈目标220元。",
      tags: ["买入", "宁德时代", "新能源"],
      symbol: "300750",
      created_at: now,
      updated_at: now,
    },
    {
      id: "mem-demo-4",
      type: "idea",
      title: "科创板半导体机会",
      content: "中芯国际调整较为充分，国产替代逻辑持续，可关注48-50元区间机会。",
      tags: ["科创板", "半导体", "中芯国际"],
      symbol: "688981",
      created_at: now,
      updated_at: now,
    },
  ];
}

export function getMemoryEntries(): MemoryEntry[] {
  return load<MemoryEntry[]>(KEY_MEMORY, getDefaultMemory());
}

export function saveMemoryEntries(entries: MemoryEntry[]): void {
  save(KEY_MEMORY, entries);
}

export function addMemoryEntry(entry: MemoryEntry): void {
  const entries = getMemoryEntries();
  entries.unshift(entry);
  save(KEY_MEMORY, entries);
}

export function updateMemoryEntry(id: string, updates: Partial<MemoryEntry>): void {
  const entries = getMemoryEntries();
  const idx = entries.findIndex(e => e.id === id);
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], ...updates, updated_at: new Date().toISOString() };
    save(KEY_MEMORY, entries);
  }
}

export function deleteMemoryEntry(id: string): void {
  const entries = getMemoryEntries().filter(e => e.id !== id);
  save(KEY_MEMORY, entries);
}

export function getMemoryEntriesBySymbol(symbol: string): MemoryEntry[] {
  return getMemoryEntries().filter(e => e.symbol === symbol);
}

export function getMemoryStats() {
  const entries = getMemoryEntries();
  const types: MemoryType[] = ["insight", "note", "trade_log", "analysis", "idea"];
  const byType = {} as Record<MemoryType, number>;
  types.forEach(t => { byType[t] = 0; });
  entries.forEach(e => { byType[e.type] = (byType[e.type] || 0) + 1; });
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    total: entries.length,
    byType,
    recentCount: entries.filter(e => e.created_at >= sevenDaysAgo).length,
    favoriteCount: entries.filter(e => e.is_favorite).length,
  };
}

// ============== Factor Portfolios ==============

const KEY_FACTOR_PORTFOLIOS = "factor_portfolios";

export function loadFactorPortfolios(): FactorPortfolio[] {
  try {
    return JSON.parse(localStorage.getItem(KEY_FACTOR_PORTFOLIOS) || "[]");
  } catch {
    return [];
  }
}

export function saveFactorPortfolios(portfolios: FactorPortfolio[]): void {
  localStorage.setItem(KEY_FACTOR_PORTFOLIOS, JSON.stringify(portfolios));
}

// ============== Drawdown Engine Storage ==============

const KEY_EQUITY_SNAPSHOTS = "equity_curve_snapshots";
const KEY_ALERT_RULES = "alert_rules";

export interface EquitySnapshot {
  timestamp: string;
  value: number;
  drawdown: number;
  maxDrawdown: number;
}

export interface AlertRule {
  id: string;
  name: string;
  threshold: number;
  severity: "info" | "warning" | "critical";
  enabled: boolean;
  actions: ("browser" | "notification" | "email")[];
  triggered: boolean;
  triggeredAt?: string;
  recoveredAt?: string;
}

export function getEquitySnapshots(): EquitySnapshot[] {
  return load<EquitySnapshot[]>(KEY_EQUITY_SNAPSHOTS, []);
}

export function saveEquitySnapshots(snapshots: EquitySnapshot[]): void {
  const trimmed = snapshots.slice(-1000);
  save(KEY_EQUITY_SNAPSHOTS, trimmed);
}

export function getAlertRules(): AlertRule[] {
  return load<AlertRule[]>(KEY_ALERT_RULES, []);
}

export function saveAlertRules(rules: AlertRule[]): void {
  save(KEY_ALERT_RULES, rules);
}
