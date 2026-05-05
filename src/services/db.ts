/**
 * IndexedDB data layer for AI Stock Simulation
 * Replaces localStorage for persistent storage of account, positions, and trades
 */
import { openDB, DBSchema } from "idb";
import type { IDBPDatabase } from "idb";

// ============== Types ==============

export interface AccountData {
  id: number;
  name: string;
  cash: number;
  total_assets: number;
  total_profit_loss: number;
  total_profit_loss_pct: number;
  updated_at: string;
}

export interface PositionData {
  id: number;
  account_id: number;
  symbol: string;
  name: string;
  quantity: number;
  avg_cost: number;
  created_at: string;
  updated_at: string;
}

export interface TradeData {
  id: number;
  account_id: number;
  symbol: string;
  name: string;
  trade_type: "buy" | "sell";
  price: number;
  quantity: number;
  commission: number;
  stamp_tax: number;
  total_cost: number;
  timestamp: string;
}

export interface BacktestResultData {
  id: number;
  strategy_name: string;
  config: string;
  result: string;
  created_at: string;
}

export interface ModelConfigData {
  id: number;
  model_name: string;
  api_key?: string;
  base_url?: string;
  api_protocol: string;
  is_active: boolean;
  updated_at: string;
}

// ============== Database Schema ==============

interface StockSimulationDB extends DBSchema {
  accounts: {
    key: number;
    value: AccountData;
    indexes: { "by-name": string };
  };
  positions: {
    key: number;
    value: PositionData;
    indexes: {
      "by-account": number;
      "by-symbol": [number, string];
    };
  };
  trades: {
    key: number;
    value: TradeData;
    indexes: {
      "by-account": number;
      "by-symbol": string;
      "by-timestamp": string;
    };
  };
  backtest_results: {
    key: number;
    value: BacktestResultData;
    indexes: { "by-created": string };
  };
  model_configs: {
    key: number;
    value: ModelConfigData;
    indexes: { "by-model": string };
  };
}

// ============== Database Instance ==============

const DB_NAME = "ai_stock_simulation";
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<StockSimulationDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<StockSimulationDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<StockSimulationDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Accounts store
      if (!db.objectStoreNames.contains("accounts")) {
        const accountStore = db.createObjectStore("accounts", { keyPath: "id" });
        accountStore.createIndex("by-name", "name");
      }

      // Positions store
      if (!db.objectStoreNames.contains("positions")) {
        const positionStore = db.createObjectStore("positions", { keyPath: "id" });
        positionStore.createIndex("by-account", "account_id");
        positionStore.createIndex("by-symbol", ["account_id", "symbol"]);
      }

      // Trades store
      if (!db.objectStoreNames.contains("trades")) {
        const tradeStore = db.createObjectStore("trades", { keyPath: "id" });
        tradeStore.createIndex("by-account", "account_id");
        tradeStore.createIndex("by-symbol", "symbol");
        tradeStore.createIndex("by-timestamp", "timestamp");
      }

      // Backtest results store
      if (!db.objectStoreNames.contains("backtest_results")) {
        const backtestStore = db.createObjectStore("backtest_results", { keyPath: "id" });
        backtestStore.createIndex("by-created", "created_at");
      }

      // Model configs store
      if (!db.objectStoreNames.contains("model_configs")) {
        const modelStore = db.createObjectStore("model_configs", { keyPath: "id" });
        modelStore.createIndex("by-model", "model_name");
      }
    },
  });

  return dbInstance;
}

// ============== Account Operations ==============

const DEFAULT_ACCOUNT_ID = 1;
const INITIAL_CASH = 1_000_000;

export async function getAccount(): Promise<AccountData> {
  const db = await getDB();
  let account = await db.get("accounts", DEFAULT_ACCOUNT_ID);

  if (!account) {
    account = {
      id: DEFAULT_ACCOUNT_ID,
      name: "默认模拟账户",
      cash: INITIAL_CASH,
      total_assets: INITIAL_CASH,
      total_profit_loss: 0,
      total_profit_loss_pct: 0,
      updated_at: new Date().toISOString(),
    };
    await db.put("accounts", account);
  }

  return account;
}

export async function saveAccount(account: AccountData): Promise<void> {
  const db = await getDB();
  account.updated_at = new Date().toISOString();
  await db.put("accounts", account);
}

// ============== Position Operations ==============

export async function getPositions(accountId: number = DEFAULT_ACCOUNT_ID): Promise<PositionData[]> {
  const db = await getDB();
  return db.getAllFromIndex("positions", "by-account", accountId);
}

export async function getPosition(accountId: number, symbol: string): Promise<PositionData | undefined> {
  const db = await getDB();
  const positions = await db.getAllFromIndex("positions", "by-symbol", [accountId, symbol]);
  return positions[0];
}

export async function savePosition(position: PositionData): Promise<void> {
  const db = await getDB();
  position.updated_at = new Date().toISOString();
  await db.put("positions", position);
}

export async function deletePosition(id: number): Promise<void> {
  const db = await getDB();
  await db.delete("positions", id);
}

// ============== Trade Operations ==============

export async function getTrades(accountId: number = DEFAULT_ACCOUNT_ID, limit: number = 50): Promise<TradeData[]> {
  const db = await getDB();
  const trades = await db.getAllFromIndex("trades", "by-account", accountId);
  // Sort by timestamp descending (newest first)
  return trades.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}

export async function addTrade(trade: TradeData): Promise<void> {
  const db = await getDB();
  await db.put("trades", trade);
}

// ============== Backtest Operations ==============

export async function getBacktestResults(limit: number = 20): Promise<BacktestResultData[]> {
  const db = await getDB();
  const results = await db.getAllFromIndex("backtest_results", "by-created");
  return results.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

export async function saveBacktestResult(result: BacktestResultData): Promise<void> {
  const db = await getDB();
  await db.put("backtest_results", result);
}

// ============== Model Config Operations ==============

export async function getModelConfigs(): Promise<ModelConfigData[]> {
  const db = await getDB();
  return db.getAll("model_configs");
}

export async function saveModelConfig(config: ModelConfigData): Promise<void> {
  const db = await getDB();
  config.updated_at = new Date().toISOString();
  await db.put("model_configs", config);
}

// ============== Reset Operations ==============

export async function resetAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["accounts", "positions", "trades"], "readwrite");
  
  await tx.objectStore("accounts").clear();
  await tx.objectStore("positions").clear();
  await tx.objectStore("trades").clear();
  
  await tx.done;

  // Reinitialize default account
  await getAccount();
}
