/**
 * Bollinger Bands Indicator Tool
 * Volatility bands placed above and below a moving average
 */

import type { TradingTool, ToolInput, ToolOutput, OHLCV, BollingerBandsResult } from './types';

// SMA calculation
function sma(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export class BollingerBandsTool implements TradingTool {
  id = 'indicator_bollinger';
  name = 'Bollinger Bands';
  category = 'indicator' as const;
  description = 'Calculate Bollinger Bands - volatility bands around a moving average';

  execute(input: ToolInput): Promise<ToolOutput> {
    const start = performance.now();
    try {
      const { prices, period = 20, stdDev = 2 } = input as {
        prices: number[];
        period?: number;
        stdDev?: number;
      };

      if (!prices || !Array.isArray(prices) || prices.length === 0) {
        return { success: false, error: 'Invalid prices array', executionTime: performance.now() - start };
      }

      if (prices.length < period) {
        return {
          success: false,
          error: `Insufficient data: need at least ${period} prices for Bollinger Bands`,
          executionTime: performance.now() - start,
        };
      }

      const recent = prices.slice(-period);
      const mid = sma(recent, period);
      const variance = recent.reduce((sum, p) => sum + Math.pow(p - mid, 2), 0) / period;
      const std = Math.sqrt(variance);
      
      const upper = mid + stdDev * std;
      const lower = mid - stdDev * std;
      const bandwidth = ((upper - lower) / mid) * 100;
      
      // %B = (price - lower) / (upper - lower)
      const currentPrice = prices[prices.length - 1];
      const position = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;

      return {
        success: true,
        data: { mid, upper, lower, bandwidth, position } as BollingerBandsResult,
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
          period: { type: 'number', description: 'Moving average period (default: 20)' },
          stdDev: { type: 'number', description: 'Standard deviations (default: 2)' },
        },
        required: ['prices'],
      },
    };
  }
}

// Convenience function for calculating Bollinger Bands on OHLCV data
export function calculateBollingerBandsOnHistory(
  history: OHLCV[], 
  period = 20, 
  stdDev = 2
): BollingerBandsResult {
  const closes = history.map(h => h.close);
  const recent = closes.slice(-period);
  const mid = sma(recent, period);
  const variance = recent.reduce((sum, p) => sum + Math.pow(p - mid, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  const upper = mid + stdDev * std;
  const lower = mid - stdDev * std;
  const bandwidth = ((upper - lower) / mid) * 100;
  
  const currentPrice = closes[closes.length - 1];
  const position = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;

  return { mid, upper, lower, bandwidth, position };
}

export const bollingerBandsTool = new BollingerBandsTool();