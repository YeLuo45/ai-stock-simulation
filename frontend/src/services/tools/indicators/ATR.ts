/**
 * ATR (Average True Range) Indicator Tool
 * Market volatility indicator
 */

import type { TradingTool, ToolInput, ToolOutput, OHLCV, ATRResult } from './types';

function calculateTrueRange(high: number, low: number, prevClose: number): number {
  const hl = high - low;
  const hc = Math.abs(high - prevClose);
  const lc = Math.abs(low - prevClose);
  return Math.max(hl, hc, lc);
}

export class ATRTool implements TradingTool {
  id = 'indicator_atr';
  name = 'ATR';
  category = 'indicator' as const;
  description = 'Calculate ATR (Average True Range) - market volatility indicator';

  execute(input: ToolInput): Promise<ToolOutput> {
    const start = performance.now();
    try {
      const { highs, lows, closes, period = 14 } = input as {
        highs: number[];
        lows: number[];
        closes: number[];
        period?: number;
      };

      if (!highs || !lows || !closes || !Array.isArray(closes) || closes.length === 0) {
        return { success: false, error: 'Invalid OHLC data', executionTime: performance.now() - start };
      }

      if (closes.length < period + 1) {
        return {
          success: false,
          error: `Insufficient data: need at least ${period + 1} bars for ATR calculation`,
          executionTime: performance.now() - start,
        };
      }

      // Calculate True Range for each bar
      const trueRanges: number[] = [];
      for (let i = 1; i < closes.length; i++) {
        trueRanges.push(calculateTrueRange(highs[i], lows[i], closes[i - 1]));
      }

      // Calculate smoothed ATR (using Wilder's smoothing method)
      // First ATR is simple average, subsequent use Wilder's formula
      let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
      
      // Continue with Wilder's smoothing
      for (let i = period; i < trueRanges.length; i++) {
        atr = (atr * (period - 1) + trueRanges[i]) / period;
      }

      return {
        success: true,
        data: { 
          value: trueRanges[trueRanges.length - 1], 
          smoothed: atr 
        } as ATRResult,
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
          highs: { type: 'array', items: { type: 'number' }, description: 'High prices' },
          lows: { type: 'array', items: { type: 'number' }, description: 'Low prices' },
          closes: { type: 'array', items: { type: 'number' }, description: 'Close prices' },
          period: { type: 'number', description: 'ATR period (default: 14)' },
        },
        required: ['highs', 'lows', 'closes'],
      },
    };
  }
}

// Convenience function for calculating ATR on OHLCV data
export function calculateATROnHistory(history: OHLCV[], period = 14): ATRResult {
  const highs = history.map(h => h.high);
  const lows = history.map(h => h.low);
  const closes = history.map(h => h.close);

  const trueRanges: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(hl, hc, lc));
  }

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return {
    value: trueRanges[trueRanges.length - 1],
    smoothed: atr,
  };
}

export const atrTool = new ATRTool();