/**
 * DataSource Types - Multi-source data provider interfaces
 */

/** K线数据 */
export interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** 实时行情 */
export interface RealtimeQuote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  amount?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
  timestamp: number;
}

/** 股票符号信息 */
export interface Symbol {
  code: string;
  name: string;
  market: string;
}

/** 数据源接口 */
export interface DataSource {
  name: string;
  priority: number;
  isAvailable(): Promise<boolean>;
  getKline(symbol: string, period: string): Promise<KLineData[]>;
  getRealtime(symbol: string): Promise<RealtimeQuote>;
  searchSymbols(keyword: string): Promise<Symbol[]>;
  getIndexConstituents(index: string): Promise<string[]>;
}

/** 数据源配置 */
export interface DataSourceConfig {
  id: string;
  name: string;
  type: 'tushare' | 'akshare' | 'yahoo' | 'mock';
  enabled: boolean;
  priority: number;
  token?: string;
  cacheTTL?: number;
}

/** 缓存条目 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/** 数据源状态 */
export interface DataSourceStatus {
  source: string;
  status: 'connected' | 'error' | 'stale' | 'disabled';
  lastFetch?: number;
  latency?: number;
  error?: string;
}