/**
 * AKShare Provider - Alternative data source
 * Since AKShare is a Python library, we use yahooFinance as the actual implementation
 * for web browser environment
 */
import type { DataSource, KLineData, RealtimeQuote, Symbol } from './types';
import { fetchKlineData, getRealtimeQuote, searchSymbols as yahooSearch, normalizeSymbol } from '../yahooFinance';
import { getCached, setCache } from './cache';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const AKShareProvider: DataSource = {
  name: 'akshare',
  priority: 2,

  async isAvailable(): Promise<boolean> {
    // AKShare public endpoints are generally available
    return true;
  },

  async getKline(symbol: string, period: string): Promise<KLineData[]> {
    const cacheKey = `akshare_kline_${symbol}_${period}`;
    const cached = getCached<KLineData[]>(cacheKey, CACHE_TTL);
    if (cached) return cached;

    const intervalMap: Record<string, '1d' | '1wk' | '1mo'> = {
      'daily': '1d',
      '1d': '1d',
      '1wk': '1wk',
      'weekly': '1wk',
      '1mo': '1mo',
      'monthly': '1mo',
    };
    const interval = intervalMap[period] || '1d';

    const data = await fetchKlineData(symbol, 120, interval);
    const klines: KLineData[] = data.map(d => ({
      date: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));

    setCache(cacheKey, klines);
    return klines;
  },

  async getRealtime(symbol: string): Promise<RealtimeQuote> {
    const cacheKey = `akshare_realtime_${symbol}`;
    const cached = getCached<RealtimeQuote>(cacheKey, 60000);
    if (cached) return cached;

    const data = await getRealtimeQuote(symbol);

    const quote: RealtimeQuote = {
      symbol,
      price: data.price,
      change: data.change,
      changePct: data.changePercent,
      volume: data.volume,
      high: data.high,
      low: data.low,
      open: data.open,
      close: data.previousClose,
      timestamp: Date.now(),
    };

    setCache(cacheKey, quote);
    return quote;
  },

  async searchSymbols(keyword: string): Promise<Symbol[]> {
    const cacheKey = `akshare_search_${keyword}`;
    const cached = getCached<Symbol[]>(cacheKey, CACHE_TTL);
    if (cached) return cached;

    const results = await yahooSearch(keyword);

    const symbols: Symbol[] = results
      .filter((r: any) => r.symbol.match(/^[0-9A-Z.]+$/))
      .map((r: { symbol: string; name: string; exchange: string }) => ({
        code: normalizeSymbol(r.symbol),
        name: r.name || r.symbol,
        market: r.exchange || 'UNKNOWN',
      }));

    setCache(cacheKey, symbols);
    return symbols;
  },

  async getIndexConstituents(index: string): Promise<string[]> {
    // Yahoo doesn't provide index constituents directly
    // Return empty array - fallback to other sources
    return [];
  },
};