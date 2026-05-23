/**
 * Arbitrage Agent - Cross-Market Arbitrage Strategy
 * Monitors ETF/Futures/Spot price spreads for arbitrage opportunities
 */
import type { AgentDecision, MarketContext } from './types';

export class ArbitrageAgent {
  name = 'arbitrage';
  role = '套利策略';
  weight = 0.2;

  async decide(context: MarketContext): Promise<AgentDecision> {
    const { close, volume_ratio, change_pct, high, low } = context;
    
    let action: AgentDecision['action'] = 'pass';
    let reasoning = '';
    
    // Arbitrage opportunities typically involve:
    // 1. ETFNAV vs Market Price premium/discount
    // 2. Futures/Spot spread
    // 3. Volume spike with price divergence
    
    // Simplified detection: High volume + large spread in intraday
    if (volume_ratio !== undefined && volume_ratio > 2.0) {
      // Volume spike - potential breakdown or breakout
      const dayRange = high !== undefined && low !== undefined ? (high - low) / low : 0;
      if (dayRange > 0.03) {
        action = 'buy_spot_sell_future';
        reasoning = `成交量激增 ${volume_ratio.toFixed(2)}x + 日内波动 ${(dayRange * 100).toFixed(2)}% 套利机会`;
      }
    }
    
    // Default: pass with neutral confidence
    if (action === 'pass') {
      const spread = high !== undefined && low !== undefined 
        ? ((high - low) / close) 
        : Math.abs(change_pct) / 100;
      
      if (spread > 0.025) {
        action = change_pct > 0 ? 'buy_spot_sell_future' : 'buy_future_sell_spot';
        reasoning = `价差扩大 ${(spread * 100).toFixed(2)}%，跨市场套利`;
      } else {
        reasoning = '无明显套利机会';
      }
    }

    return {
      agent: this.name,
      action,
      confidence: 0.5,
      reasoning,
      timestamp: Date.now(),
      regime: context.regime,
    };
  }

  updateWeight(performance: number): void {
    const adjustment = (performance - 0.5) * 0.2;
    this.weight = Math.max(0.1, Math.min(0.4, this.weight + adjustment));
  }
}

export const arbitrageAgent = new ArbitrageAgent();