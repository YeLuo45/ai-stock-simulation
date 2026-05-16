/**
 * Tushare Data Provider
 * REST API: http://api.tushare.pro
 */
import type { DataSource, KLineData, RealtimeQuote, Symbol } from './types';
import { getCached, setCache, invalidate } from './cache';

const TUSHARE_API = 'http://api.tushare.pro';
const TUSHARE_TOKEN_KEY = 'tushare_token';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getToken(): string {
  return localStorage.getItem(TUSHARE_TOKEN_KEY) || '';
}

async function tushareRequest<T>(apiName: string, params: Record<string, any> = {}): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error('Tushare token not configured');
  }

  const response = await fetch(TUSHARE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_name: apiName,
      token,
      params,
      fields: '',
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json() as { code: number; msg: string; data: any };

  if (result.code !== 0) {
    throw new Error(result.msg || `API error ${result.code}`);
  }

  return result.data as T;
}

export const TushareProvider: DataSource = {
  name: 'tushare',
  priority: 1,

  async isAvailable(): Promise<boolean> {
    const token = getToken();
    if (!token) return false;
    try {
      // Test with a simple API call
      await tushareRequest('trade_cal', { exchange: 'SSE', start_date: '20260101', end_date: '20260101' });
      return true;
    } catch {
      return false;
    }
  },

  async getKline(symbol: string, period: string): Promise<KLineData[]> {
    const cacheKey = `tushare_kline_${symbol}_${period}`;
    const cached = getCached<KLineData[]>(cacheKey, CACHE_TTL);
    if (cached) return cached;

    // Map period to Tushare api_name
    let apiName = 'daily';
    if (period === '1wk' || period === 'weekly') apiName = 'weekly';
    else if (period === '1mo' || period === 'monthly') apiName = 'monthly';
    else if (period.startsWith('1') && period.includes('m')) apiName = 'min30';

    // Get recent 120 trading days
    const endDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const startDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, '');

    const data = await tushareRequest<{ fields: string[]; items: any[][] }>('daily', {
      ts_code: symbol,
      start_date: startDate,
      end_date: endDate,
    });

    const klines: KLineData[] = (data.items || []).map((item) => {
      const [tsCode, tradeDate, open, high, low, close, vol] = item;
      return {
        date: String(tradeDate),
        open: Number(open) || 0,
        high: Number(high) || 0,
        low: Number(low) || 0,
        close: Number(close) || 0,
        volume: Number(vol) || 0,
      };
    });

    setCache(cacheKey, klines);
    return klines;
  },

  async getRealtime(symbol: string): Promise<RealtimeQuote> {
    const cacheKey = `tushare_realtime_${symbol}`;
    const cached = getCached<RealtimeQuote>(cacheKey, 60000); // 1 min cache
    if (cached) return cached;

    // Use Tushare realtime_quote API
    const data = await tushareRequest<{ fields: string[]; items: any[][] }>('realtime_quote', {
      ts_code: symbol,
    });

    const item = data.items?.[0];
    if (!item) throw new Error('No data');

    const [tsCode, open, close, high, low, price, vol] = item;

    const quote: RealtimeQuote = {
      symbol: String(tsCode),
      price: Number(price) || 0,
      change: (Number(price) || 0) - (Number(close) || 0),
      changePct: ((Number(price) - Number(close)) / Number(close) * 100) || 0,
      volume: Number(vol) || 0,
      open: Number(open) || 0,
      close: Number(close) || 0,
      high: Number(high) || 0,
      low: Number(low) || 0,
      timestamp: Date.now(),
    };

    setCache(cacheKey, quote);
    return quote;
  },

  async searchSymbols(keyword: string): Promise<Symbol[]> {
    const cacheKey = `tushare_search_${keyword}`;
    const cached = getCached<Symbol[]>(cacheKey, CACHE_TTL);
    if (cached) return cached;

    // Search stocks via stock_basic API
    const data = await tushareRequest<{ fields: string[]; items: any[][] }>('stock_basic', {
      ts_code: '',
      name: keyword,
      list_status: 'L',
    });

    const symbols: Symbol[] = (data.items || []).map((item) => {
      const [tsCode, name, area, market] = item;
      return {
        code: String(tsCode),
        name: String(name),
        market: String(market || area),
      };
    });

    setCache(cacheKey, symbols);
    return symbols;
  },

  async getIndexConstituents(index: string): Promise<string[]> {
    const cacheKey = `tushare_index_${index}`;
    const cached = getCached<string[]>(cacheKey, CACHE_TTL);
    if (cached) return cached;

    const data = await tushareRequest<{ fields: string[]; items: any[][] }>('index_weight', {
      index_code: index,
    });

    const constituents: string[] = (data.items || []).map((item) => String(item[0]));
    setCache(cacheKey, constituents);
    return constituents;
  },
};

/** Test Tushare connection */
export async function testTushareConnection(token: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(TUSHARE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_name: 'trade_cal',
        token,
        params: { exchange: 'SSE', start_date: '20260101', end_date: '20260101' },
        fields: '',
      }),
    });

    const result = await response.json() as { code: number; msg: string };
    if (result.code === 0) {
      return { success: true, message: '连接成功' };
    }
    return { success: false, message: result.msg || 'Token无效' };
  } catch (e) {
    return { success: false, message: String(e) };
  }
}