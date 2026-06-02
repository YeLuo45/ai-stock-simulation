/**
 * MACD (Moving Average Convergence Divergence) Indicator Tool
 * Trend-following momentum indicator showing relationship between two EMAs
 */

import type { TradingTool, ToolInput, ToolOutput, OHLCV, MACDResult } from './types';

// EMA calculation
function ema(prices: number[], period: number): number {
  if (prices.length < period) return prices.slice(0, prices.length).reduce((a, b) => a + b, 0) / prices.length;
  const k = 2 / (period + 1);
  let emaVal = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    emaVal = prices[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

function computeMACDLine(closes: number[], fast = 12, slow = 26): number[] {
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const emaFast = ema(closes.slice(0, i + 1), fast);
    const emaSlow = ema(closes.slice(0, i + 1), slow);
    macdLine.push(emaFast - emaSlow);
  }
  return macdLine;
}

function computeSignalLine(macdLine: number[], signalPeriod = 9): number[] {
  const signalLine: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (i < signalPeriod - 1) {
      signalLine.push(macdLine[i] * 0.9);
    } else {
      const k = 2 / (signalPeriod + 1);
      let sig = macdLine.slice(i - signalPeriod, i).reduce((a, b) => a + b, 0) / signalPeriod;
      sig = macdLine[i] * k + sig * (1 - k);
      signalLine.push(sig);
    }
  }
  return signalLine;
}

export class MACDTool implements TradingTool {
  id = 'indicator_macd';
  name = 'MACD';
  category = 'indicator' as const;
  description = 'Calculate MACD (Moving Average Convergence Divergence) - trend momentum indicator';

  execute(input: ToolInput): Promise<ToolOutput> {
    const start = performance.now();
    try {
      const { prices, fast = 12, slow = 26, signal = 9 } = input as {
        prices: number[];
        fast?: number;
        slow?: number;
        signal?: number;
      };

      if (!prices || !Array.isArray(prices) || prices.length === 0) {
        return { success: false, error: 'Invalid prices array', executionTime: performance.now() - start };
      }

      if (prices.length < slow + signal) {
        return { 
          success: false, 
          error: `Insufficient data: need at least ${slow + signal} prices for MACD calculation`,
          executionTime: performance.now() - start 
        };
      }

      const macdLine = computeMACDLine(prices, fast, slow);
      const signalLine = computeSignalLine(macdLine, signal);
      
      const macd = macdLine[macdLine.length - 1];
      const sig = signalLine[signalLine.length - 1];
      const hist = macd - sig;

      let status: MACDResult['status'];
      if (hist > 0 && hist > (macdLine[macdLine.length - 2] - signalLine[signalLine.length - 2])) {
        status = 'bullish';
      } else if (hist < 0 && hist < (macdLine[macdLine.length - 2] - signalLine[signalLine.length - 2])) {
        status = 'bearish';
      } else {
        status = 'neutral';
      }

      return {
        success: true,
        data: { macd, signal: sig, hist, status } as MACDResult,
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
          fast: { type: 'number', description: 'Fast EMA period (default: 12)' },
          slow: { type: 'number', description: 'Slow EMA period (default: 26)' },
          signal: { type: 'number', description: 'Signal line period (default: 9)' },
        },
        required: ['prices'],
      },
    };
  }
}

// Convenience function for calculating MACD on OHLCV data
export function calculateMACDOnHistory(
  history: OHLCV[], 
  fast = 12, 
  slow = 26, 
  signal = 9
): MACDResult {
  const closes = history.map(h => h.close);
  
  const macdLine = computeMACDLine(closes, fast, slow);
  const signalLine = computeSignalLine(macdLine, signal);
  
  const macd = macdLine[macdLine.length - 1];
  const sig = signalLine[signalLine.length - 1];
  const hist = macd - sig;

  let status: MACDResult['status'];
  if (hist > 0) status = 'bullish';
  else if (hist < 0) status = 'bearish';
  else status = 'neutral';

  return { macd, signal: sig, hist, status };
}

export const macdTool = new MACDTool();