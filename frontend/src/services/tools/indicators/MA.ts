/**
 * Moving Average Indicator Tool
 * Supports SMA and EMA calculations
 */

import type { TradingTool, ToolInput, ToolOutput, OHLCV, MAResult } from './types';

// SMA calculation
function sma(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// EMA calculation
function ema(prices: number[], period: number): number {
  if (prices.length < period) return sma(prices, prices.length);
  const k = 2 / (period + 1);
  let emaVal = sma(prices.slice(0, period), period);
  for (let i = period; i < prices.length; i++) {
    emaVal = prices[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

export class MATool implements TradingTool {
  id = 'indicator_ma';
  name = 'Moving Average';
  category = 'indicator' as const;
  description = 'Calculate SMA/EMA moving averages for price data';

  execute(input: ToolInput): Promise<ToolOutput> {
    const start = performance.now();
    try {
      const { prices, periods = [5, 10, 20, 60] } = input as {
        prices: number[];
        periods?: number[];
      };

      if (!prices || !Array.isArray(prices) || prices.length === 0) {
        return { success: false, error: 'Invalid prices array', executionTime: performance.now() - start };
      }

      const result: Record<string, number> = {};
      for (const period of periods) {
        result[`ma${period}`] = sma(prices, period);
        result[`ema${period}`] = ema(prices, period);
      }

      return {
        success: true,
        data: result,
        executionTime: performance.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: performance.now() - start,
      };
    }
  }

  getDefinition() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      parameters: {
        type: 'object',
        properties: {
          prices: { type: 'array', items: { type: 'number' }, description: 'Price array' },
          periods: { type: 'array', items: { type: 'number' }, description: 'MA periods [5, 10, 20, 60]' },
        },
        required: ['prices'],
      },
    };
  }
}

// Convenience function for calculating MA on OHLCV data
export function calculateMA(history: OHLCV[], periods: number[] = [5, 10, 20, 60]): MAResult {
  const closes = history.map(h => h.close);
  const result: MAResult = { ma5: 0, ma10: 0, ma20: 0, ma60: 0 };
  
  for (const period of periods) {
    const key = `ma${period}` as keyof MAResult;
    result[key] = sma(closes, period);
  }
  
  return result;
}

export const maTool = new MATool();