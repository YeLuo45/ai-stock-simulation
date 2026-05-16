/**
 * Mock Provider - Final fallback when all real data sources fail
 */
import type { DataSource, KLineData, RealtimeQuote, Symbol } from './types';
import { mockStocks } from '../mockData';

function generateMockKline(symbol: string): KLineData[] {
  const klines: KLineData[] = [];
  const basePrice = Math.random() * 100 + 50;
  let currentPrice = basePrice;

  for (let i = 120; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const change = (Math.random() - 0.5) * 10;
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;
    const volume = Math.floor(Math.random() * 100000000 + 10000000);

    klines.push({
      date: date.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
  }

  return klines;
}

function generateMockRealtime(symbol: string): RealtimeQuote {
  const price = Math.random() * 200 + 10;
  const change = (Math.random() - 0.5) * 20;

  return {
    symbol,
    price: Number(price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePct: Number((change / price * 100).toFixed(2)),
    volume: Math.floor(Math.random() * 100000000),
    timestamp: Date.now(),
  };
}

export const MockProvider: DataSource = {
  name: 'mock',
  priority: 99,

  async isAvailable(): Promise<boolean> {
    return true;
  },

  async getKline(symbol: string, _period: string): Promise<KLineData[]> {
    return generateMockKline(symbol);
  },

  async getRealtime(symbol: string): Promise<RealtimeQuote> {
    return generateMockRealtime(symbol);
  },

  async searchSymbols(keyword: string): Promise<Symbol[]> {
    const filtered = mockStocks.filter(
      s => s.name.includes(keyword) || s.symbol.includes(keyword)
    );

    if (filtered.length > 0) {
      return filtered.map(s => ({
        code: s.symbol,
        name: s.name,
        market: s.market || 'Unknown',
      }));
    }

    // Return some default symbols
    return mockStocks.slice(0, 5).map(s => ({
      code: s.symbol,
      name: s.name,
      market: s.market || 'Unknown',
    }));
  },

  async getIndexConstituents(_index: string): Promise<string[]> {
    return mockStocks.slice(0, 10).map(s => s.symbol);
  },
};