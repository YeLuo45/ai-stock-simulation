/**
 * Mean Reversion Agent - Mean Reversion Strategy
 * Uses RSI to identify overbought/oversold conditions for buy low/sell high
 */
import type { AgentDecision, MarketContext } from './types';
import { calculateRSI } from '../indicators';

export class MeanReversionAgent {
  name = 'mean_reversion';
  role = '均值回归';
  weight = 0.3;

  async decide(context: MarketContext): Promise<AgentDecision> {
    const { close, rsi, change_pct, volume_ratio } = context;
    
    // Calculate RSI if not provided
    let currentRSI = rsi;
    if (currentRSI === undefined) {
      // Would need historical data - skip for now
      currentRSI = 50;
    }

    let action: AgentDecision['action'] = 'hold';
    let reasoning = '';
    
    // RSI-based signals
    if (currentRSI > 70) {
      action = 'sell';
      reasoning = `RSI ${currentRSI.toFixed(2)} 超买区域 (>70)，建议卖出`;
    } else if (currentRSI < 30) {
      action = 'buy';
      reasoning = `RSI ${currentRSI.toFixed(2)} 超卖区域 (<30)，建议买入`;
    } else if (currentRSI > 60) {
      action = 'sell';
      reasoning = `RSI ${currentRSI.toFixed(2)} 偏高位，建议谨慎`;
    } else if (currentRSI < 40) {
      action = 'buy';
      reasoning = `RSI ${currentRSI.toFixed(2)} 偏低位，可考虑买入`;
    } else {
      action = 'pass';
      reasoning = `RSI ${currentRSI.toFixed(2)} 中性区域，观望`;
    }

    // Confidence: how far from neutral (50)
    const confidence = Math.min(0.95, Math.abs(currentRSI - 50) / 50);

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
    const adjustment = (performance - 0.5) * 0.2;
    this.weight = Math.max(0.1, Math.min(0.5, this.weight + adjustment));
  }
}

export const meanReversionAgent = new MeanReversionAgent();