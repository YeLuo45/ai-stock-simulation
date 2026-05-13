// Data Source Types for Real-time Market Data

export interface StockQuote {
  code: string;
  name: string;
  price: number;         // 最新价
  change: number;         // 涨跌额
  changePercent: number;  // 涨跌幅
  volume: number;         // 成交量
  amount: number;         // 成交额
  high: number;           // 最高
  low: number;            // 最低
  open: number;           // 开盘
  close: number;          // 昨收
  timestamp: number;
}

export interface FinancialData {
  code: string;
  pe: number;             // 市盈率
  pb: number;             // 市净率
  marketCap: number;      // 总市值
  floatCap: number;       // 流通市值
  revenue: number;        // 营业收入
  netProfit: number;      // 净利润
  roe: number;            // 净资产收益率
  grossMargin: number;    // 毛利率
  timestamp: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  relatedCodes: string[];
}

export interface ResearchResult {
  stockCode: string;
  quote?: StockQuote;
  financial?: FinancialData;
  news: NewsItem[];
  dataQuality: { score: number; issues: string[] };
  fetchedAt: number;
}

export type DataType = 'quote' | 'financial' | 'news' | 'holder' | 'concept';

export interface DataSourceConfig {
  id: string;
  name: string;
  type: 'eastmoney' | 'akshare' | 'sina' | 'mock';
  enabled: boolean;
  priority: number;
  baseUrl?: string;
  apiKey?: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;  // Time to live in milliseconds
}

export interface DataSourceStatus {
  source: string;
  status: 'connected' | 'error' | 'stale' | 'disabled';
  lastFetch?: number;
  error?: string;
  latency?: number;
}
