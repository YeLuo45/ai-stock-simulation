/**
 * Risk Guardrails - 实时交易风险控制
 * 基于 Bull/Bear/Judge 三元组风险控制模型
 */

import type { BrokerPosition } from '../brokerProvider';
import type { OrderRequest } from './TradingMcpClient';

// ============ Types ============

export interface RiskConfig {
  maxPositionSize?: number;      // 单笔最大仓位金额
  maxDailyLoss?: number;         // 日内最大亏损
  maxLeverage?: number;          // 最大杠杆
  maxTotalPosition?: number;     // 最大总仓位
  allowedTickers?: string[];     // 允许交易的股票
  requireStopLoss?: boolean;     // 必须设置止损
  minStopLossPct?: number;      // 最小止损百分比
  maxStopLossPct?: number;       // 最大止损百分比
  maxOrdersPerDay?: number;      // 每日最大下单数
  coolingPeriodMs?: number;       // 冷却期（毫秒）
}

export interface ValidationResult {
  approved: boolean;
  reason?: string;
  warnings?: string[];
  riskScore?: number;
}

export interface PortfolioValidation {
  approved: boolean;
  reason?: string;
  warnings?: string[];
  totalExposure: number;
  totalLeverage: number;
  largestPosition: number;
}

// ============ RiskGuardrails ============

export class RiskGuardrails {
  private config: Required<RiskConfig>;
  private dailyLoss = 0;
  private orderCount = 0;
  private lastOrderTime = 0;
  private emergencyTriggered = false;
  private emergencyReason = '';

  constructor(config: RiskConfig = {}) {
    this.config = {
      maxPositionSize: config.maxPositionSize ?? 100000,
      maxDailyLoss: config.maxDailyLoss ?? 50000,
      maxLeverage: config.maxLeverage ?? 3,
      maxTotalPosition: config.maxTotalPosition ?? 500000,
      allowedTickers: config.allowedTickers ?? [],
      requireStopLoss: config.requireStopLoss ?? true,
      minStopLossPct: config.minStopLossPct ?? 1,
      maxStopLossPct: config.maxStopLossPct ?? 15,
      maxOrdersPerDay: config.maxOrdersPerDay ?? 50,
      coolingPeriodMs: config.coolingPeriodMs ?? 1000,
    };
  }

  /**
   * 校验单笔订单
   */
  validateOrder(order: OrderRequest): ValidationResult {
    const warnings: string[] = [];
    let riskScore = 0;

    // 紧急熔断检查
    if (this.emergencyTriggered) {
      return {
        approved: false,
        reason: `Emergency stop active: ${this.emergencyReason}`,
        riskScore: 100,
      };
    }

    // 1. 允许名单检查
    if (this.config.allowedTickers.length > 0) {
      if (!this.config.allowedTickers.includes(order.ticker)) {
        return {
          approved: false,
          reason: `Ticker ${order.ticker} not in allowed list`,
          riskScore: 100,
        };
      }
    }

    // 2. 仓位大小检查
    const orderValue = order.quantity * (order.limitPrice || 0);
    if (orderValue > this.config.maxPositionSize) {
      return {
        approved: false,
        reason: `Order value ${orderValue} exceeds max position size ${this.config.maxPositionSize}`,
        riskScore: 100,
      };
    }

    // 3. 日内亏损检查
    if (this.dailyLoss >= this.config.maxDailyLoss) {
      return {
        approved: false,
        reason: `Daily loss limit reached: ${this.dailyLoss}`,
        riskScore: 100,
      };
    }

    // 4. 止损设置检查
    if (this.config.requireStopLoss && !order.stopLoss) {
      warnings.push('Stop loss not set - recommended for risk management');
      riskScore += 20;
    }

    // 5. 止损范围检查
    if (order.stopLoss && order.limitPrice) {
      const stopLossPct = Math.abs((order.limitPrice - order.stopLoss) / order.limitPrice) * 100;
      if (stopLossPct < this.config.minStopLossPct) {
        return {
          approved: false,
          reason: `Stop loss ${stopLossPct.toFixed(2)}% too tight (min: ${this.config.minStopLossPct}%)`,
          riskScore: 100,
        };
      }
      if (stopLossPct > this.config.maxStopLossPct) {
        warnings.push(`Stop loss ${stopLossPct.toFixed(2)}% is wide (max: ${this.config.maxStopLossPct}%)`);
        riskScore += 15;
      }
    }

    // 6. 冷却期检查
    const now = Date.now();
    if (now - this.lastOrderTime < this.config.coolingPeriodMs) {
      return {
        approved: false,
        reason: `Cooling period active: ${this.config.coolingPeriodMs}ms between orders`,
        riskScore: 80,
      };
    }

    // 7. 每日下单数检查
    if (this.orderCount >= this.config.maxOrdersPerDay) {
      return {
        approved: false,
        reason: `Daily order limit reached: ${this.config.maxOrdersPerDay}`,
        riskScore: 100,
      };
    }

    // 8. 卖空检查（如果不允许）
    if (order.side === 'sell' && order.quantity > 0) {
      // 卖空逻辑可扩展
      riskScore += 5;
    }

    // 高风险标记
    if (riskScore >= 50) {
      warnings.push(`High risk order: score ${riskScore}`);
    }

    return {
      approved: riskScore < 100,
      warnings: warnings.length > 0 ? warnings : undefined,
      riskScore,
    };
  }

  /**
   * 校验组合
   */
  validatePortfolio(positions: BrokerPosition[]): PortfolioValidation {
    const warnings: string[] = [];

    // 计算总暴露
    const totalExposure = positions.reduce((sum, p) => sum + p.marketValue, 0);

    // 计算总杠杆
    const totalLeverage = totalExposure / (positions.reduce((sum, p) => sum + p.avgCost * p.quantity, 0) || 1);

    // 最大单笔仓位
    const largestPosition = positions.reduce(
      (max, p) => Math.max(max, p.marketValue),
      0
    );

    // 暴露检查
    if (totalExposure > this.config.maxTotalPosition) {
      return {
        approved: false,
        reason: `Total exposure ${totalExposure} exceeds max ${this.config.maxTotalPosition}`,
        warnings,
        totalExposure,
        totalLeverage,
        largestPosition,
      };
    }

    // 杠杆检查
    if (totalLeverage > this.config.maxLeverage) {
      return {
        approved: false,
        reason: `Total leverage ${totalLeverage.toFixed(2)}x exceeds max ${this.config.maxLeverage}x`,
        warnings,
        totalExposure,
        totalLeverage,
        largestPosition,
      };
    }

    // 大仓位警告
    if (largestPosition > this.config.maxPositionSize) {
      warnings.push(`Largest position ${largestPosition} exceeds recommended max`);
    }

    return {
      approved: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      totalExposure,
      totalLeverage,
      largestPosition,
    };
  }

  /**
   * 紧急熔断
   */
  emergencyStop(reason: string): void {
    this.emergencyTriggered = true;
    this.emergencyReason = reason;
    console.warn(`[RiskGuardrails] Emergency stop triggered: ${reason}`);
  }

  /**
   * 重置熔断
   */
  resetEmergency(): void {
    this.emergencyTriggered = false;
    this.emergencyReason = '';
  }

  /**
   * 更新日内亏损
   */
  updateDailyLoss(loss: number): void {
    this.dailyLoss += loss;
  }

  /**
   * 重置日内计数
   */
  resetDaily(): void {
    this.dailyLoss = 0;
    this.orderCount = 0;
  }

  /**
   * 记录下单
   */
  recordOrder(): void {
    this.orderCount++;
    this.lastOrderTime = Date.now();
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<RiskConfig>> {
    return { ...this.config };
  }

  /**
   * 是否处于紧急状态
   */
  isEmergencyActive(): boolean {
    return this.emergencyTriggered;
  }

  /**
   * 获取当前风险指标
   */
  getRiskMetrics(): {
    dailyLoss: number;
    orderCount: number;
    isEmergency: boolean;
  } {
    return {
      dailyLoss: this.dailyLoss,
      orderCount: this.orderCount,
      isEmergency: this.emergencyTriggered,
    };
  }
}