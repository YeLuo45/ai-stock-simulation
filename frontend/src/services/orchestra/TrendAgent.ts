/**
 * Trend Agent - Trend Following Strategy
 * Uses moving average crossover to detect and follow trends
 */
import type { AgentDecision, MarketContext, MarketRegime } from './types';
import { sma } from '../indicators';

export class TrendAgent {
  name = 'trend';
  role = '趋势追踪';
  weight = 0.3;

  async decide(context: MarketContext): Promise<AgentDecision> {
    const { close, ma5, ma20, ma60, change_pct } = context;
    
    // Calculate signals if not provided
    let signal = 0;
    let reasoning = '';
    
    if (ma5 !== undefined && ma20 !== undefined && ma60 !== undefined) {
      // MA Crossover signal: 1 = bullish, -1 = bearish, 0 = neutral
      if (ma5 > ma20 && ma20 > ma60) {
        signal = 1; // Strong uptrend
        reasoning = `MA5(${ma5.toFixed(2)}) > MA20(${ma20.toFixed(2)}) > MA60(${ma60.toFixed(2)}) 强势上涨趋势`;
      } else if (ma5 < ma20 && ma20 < ma60) {
        signal = -1; // Strong downtrend
        reasoning = `MA5(${ma5.toFixed(2)}) < MA20(${ma20.toFixed(2)}) < MA60(${ma60.toFixed(2)}) 强势下跌趋势`;
      } else if (ma5 > ma60) {
        signal = 0.5; // Mild uptrend
        reasoning = `MA5(${ma5.toFixed(2)}) > MA60(${ma60.toFixed(2)}) 轻度上涨`;
      } else if (ma5 < ma60) {
        signal = -0.5; // Mild downtrend
        reasoning = `MA5(${ma5.toFixed(2)}) < MA60(${ma60.toFixed(2)}) 轻度下跌`;
      } else {
        signal = 0;
        reasoning = '均线纠缠，无明确趋势';
      }
    } else {
      // Fallback: use price change
      signal = change_pct > 2 ? 1 : change_pct < -2 ? -1 : 0;
      reasoning = `价格变动 ${change_pct.toFixed(2)}% 触发趋势信号`;
    }

    // Determine action
    let action: AgentDecision['action'] = 'hold';
    if (signal > 0.5) action = 'buy';
    else if (signal < -0.5) action = 'sell';
    
    // Confidence based on signal strength
    const confidence = Math.min(0.95, Math.abs(signal) + 0.3);
    
    return {
      agent: this.name,
      action,
      confidence,
      reasoning,
      timestamp: Date.now(),
      regime: context.regime,
    };
  }

  updateWeight(performance: number): void {
    // Weight adjustment based on recent performance
    // performance: 0-1 where 1 is best
    const adjustment = (performance - 0.5) * 0.2; // ±10% adjustment
    this.weight = Math.max(0.1, Math.min(0.5, this.weight + adjustment));
  }
}

export const trendAgent = new TrendAgent();