/**
 * RSI (Relative Strength Index) Indicator Tool
 * Momentum oscillator measuring speed and change of price movements
 */

import type { TradingTool, ToolInput, ToolOutput, OHLCV, RSIResult } from './types';

function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export class RSITool implements TradingTool {
  id = 'indicator_rsi';
  name = 'RSI';
  category = 'indicator' as const;
  description = 'Calculate RSI (Relative Strength Index) - momentum oscillator for overbought/oversold';

  execute(input: ToolInput): Promise<ToolOutput> {
    const start = performance.now();
    try {
      const { prices, period = 14 } = input as {
        prices: number[];
        period?: number;
      };

      if (!prices || !Array.isArray(prices) || prices.length === 0) {
        return { success: false, error: 'Invalid prices array', executionTime: performance.now() - start };
      }

      const rsi = calculateRSI(prices, period);
      
      let status: RSIResult['status'];
      if (rsi >= 70) status = 'overbought';
      else if (rsi <= 30) status = 'oversold';
      else status = 'neutral';

      return {
        success: true,
        data: { value: rsi, status } as RSIResult,
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
          period: { type: 'number', description: 'RSI period (default: 14)' },
        },
        required: ['prices'],
      },
    };
  }
}

// Convenience function for calculating RSI on OHLCV data
export function calculateRSIOnHistory(history: OHLCV[], period = 14): RSIResult {
  const closes = history.map(h => h.close);
  const rsi = calculateRSI(closes, period);
  
  let status: RSIResult['status'];
  if (rsi >= 70) status = 'overbought';
  else if (rsi <= 30) status = 'oversold';
  else status = 'neutral';
  
  return { value: rsi, status };
}

export const rsiTool = new RSITool();