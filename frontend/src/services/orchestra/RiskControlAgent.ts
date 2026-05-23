/**
 * Risk Control Agent - Risk Management & Emergency Brake
 * Monitors portfolio risk metrics and can veto trading decisions
 */
import type { AgentDecision, MarketContext } from './types';

export interface RiskMetrics {
  portfolioValue: number;
  cashRatio: number;
  maxDrawdownPct: number;
  dailyLossPct: number;
  openPositionCount: number;
  leverage: number;
}

export class RiskControlAgent {
  name = 'risk_control';
  role = '风控管理';
  weight = 0.2;
  
  private riskMetrics: RiskMetrics = {
    portfolioValue: 100000,
    cashRatio: 0.3,
    maxDrawdownPct: 0,
    dailyLossPct: 0,
    openPositionCount: 0,
    leverage: 1.0,
  };

  async decide(context: MarketContext): Promise<AgentDecision> {
    const { change_pct, volume_ratio } = context;
    
    let action: AgentDecision['action'] = 'pass';
    let reasoning = '风控检查通过';
    let confidence = 1.0;
    let riskLevel = 0;

    // Calculate risk level based on metrics
    const { cashRatio, maxDrawdownPct, dailyLossPct, openPositionCount, leverage } = this.riskMetrics;

    // 1. Check cash ratio (low cash = high risk)
    if (cashRatio < 0.1) {
      riskLevel = Math.max(riskLevel, 0.8);
      reasoning = '现金比例过低 (<10%)，限制开仓';
    } else if (cashRatio < 0.2) {
      riskLevel = Math.max(riskLevel, 0.4);
      reasoning = '现金比例偏低 (<20%)，谨慎操作';
    }

    // 2. Check max drawdown
    if (maxDrawdownPct > 0.15) {
      riskLevel = Math.max(riskLevel, 0.9);
      reasoning = '最大回撤超限 (>15%)，强制止损';
    } else if (maxDrawdownPct > 0.1) {
      riskLevel = Math.max(riskLevel, 0.5);
      reasoning = '回撤偏高 (>10%)，控制仓位';
    }

    // 3. Check daily loss
    if (dailyLossPct > 0.05) {
      riskLevel = Math.max(riskLevel, 0.85);
      reasoning = '日内亏损超限 (>5%)，禁止开仓';
    } else if (dailyLossPct > 0.03) {
      riskLevel = Math.max(riskLevel, 0.4);
      reasoning = '日内亏损较大 (>3%)，谨慎操作';
    }

    // 4. Check position count
    if (openPositionCount > 10) {
      riskLevel = Math.max(riskLevel, 0.5);
      reasoning = `持仓数量过多 (${openPositionCount})，暂缓开仓`;
    }

    // 5. Check leverage
    if (leverage > 2.0) {
      riskLevel = Math.max(riskLevel, 0.8);
      reasoning = '杠杆过高 (>2x)，降杠杆';
    } else if (leverage > 1.5) {
      riskLevel = Math.max(riskLevel, 0.3);
      reasoning = '杠杆偏高 (>1.5x)，注意风险';
    }

    // 6. Market volatility check
    if (volume_ratio !== undefined && volume_ratio > 3.0) {
      riskLevel = Math.max(riskLevel, 0.3);
      reasoning = '成交量异常放大，注意风险';
    }

    // High risk = veto all buy decisions
    if (riskLevel > 0.7) {
      action = 'hold';
      confidence = riskLevel;
    } else if (riskLevel > 0.5) {
      action = 'pass'; // Allow but with caution
      confidence = 1 - riskLevel;
    }

    return {
      agent: this.name,
      action,
      confidence: Math.max(0.1, confidence),
      reasoning: riskLevel > 0.2 ? `${reasoning} | 风险等级: ${(riskLevel * 100).toFixed(0)}%` : reasoning,
      timestamp: Date.now(),
      regime: context.regime,
    };
  }

  updateRiskMetrics(metrics: Partial<RiskMetrics>): void {
    this.riskMetrics = { ...this.riskMetrics, ...metrics };
  }

  updateWeight(performance: number): void {
    // Risk control weight is inversely related to performance
    // Good performance = reduce risk control weight
    const adjustment = (0.5 - performance) * 0.1;
    this.weight = Math.max(0.1, Math.min(0.3, this.weight + adjustment));
  }
}

export const riskControlAgent = new RiskControlAgent();