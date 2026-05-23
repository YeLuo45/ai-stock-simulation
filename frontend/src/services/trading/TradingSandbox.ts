/**
 * Trading Sandbox - 隔离执行交易 API 调用
 * 提供安全的交易模拟和执行环境
 */

import type { BrokerProvider, BrokerOrder, BrokerPosition } from '../brokerProvider';
import type { OrderRequest } from './TradingMcpClient';

// ============ Types ============

export interface TradeArgs {
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  orderType: 'market' | 'limit';
  limitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  strategy?: string;
  regime?: string;
  reasoning?: string;
}

export interface TradeResult {
  success: boolean;
  order?: BrokerOrder;
  error?: string;
  executionTime?: number;
}

export interface SimulationResult {
  success: boolean;
  simulation?: {
    projectedPnL: number;
    riskMetrics: {
      maxDrawdown: number;
      sharpeRatio: number;
      winRate: number;
    };
    signals: string[];
  };
  riskRejection?: string;
}

// ============ TradingSandbox ============

export class TradingSandbox {
  private allowedDomains: Set<string>;
  private executionLog: Array<{
    timestamp: number;
    action: string;
    args: TradeArgs;
    result: TradeResult | SimulationResult;
  }>;

  constructor() {
    this.allowedDomains = new Set(['alpaca.markets', 'interactive-brokers.com', 'simulate']);
    this.executionLog = [];
  }

  /**
   * 隔离执行交易
   */
  async executeTrade(provider: BrokerProvider, args: TradeArgs): Promise<TradeResult> {
    const startTime = Date.now();

    try {
      // 1. Web Safety 域验证
      if (!this.validateBrokerAccess(provider.config.provider)) {
        return {
          success: false,
          error: `Broker access denied for domain: ${provider.config.provider}`,
        };
      }

      // 2. 执行交易
      const order = await provider.placeOrder(
        args.ticker,
        args.side,
        args.quantity,
        args.orderType,
        args.limitPrice
      );

      const executionTime = Date.now() - startTime;

      const result: TradeResult = {
        success: true,
        order,
        executionTime,
      };

      // 3. 记录执行日志
      this.logExecution(args, result);

      return result;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      this.logExecution(args, { success: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 模拟交易（不影响真实账户）
   */
  async simulateTrade(order: OrderRequest): Promise<SimulationResult> {
    try {
      // 基本模拟逻辑
      const basePrice = order.limitPrice || 100;
      const projectedPnL = order.side === 'buy'
        ? this.simulateBuyProjection(order.quantity, basePrice)
        : this.simulateSellProjection(order.quantity, basePrice);

      // 计算风险指标
      const maxDrawdown = Math.abs(projectedPnL) * 0.1;
      const sharpeRatio = projectedPnL > 0 ? 1.5 : 0.8;
      const winRate = 0.55;

      return {
        success: true,
        simulation: {
          projectedPnL,
          riskMetrics: {
            maxDrawdown,
            sharpeRatio,
            winRate,
          },
          signals: [
            `Simulated ${order.side} ${order.quantity} shares of ${order.ticker}`,
            `Entry: ${basePrice}`,
            `Stop Loss: ${order.stopLoss || 'Not set'}`,
            `Take Profit: ${order.takeProfit || 'Not set'}`,
          ],
        },
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Simulation failed';
      return { success: false, simulation: undefined, riskRejection: errorMsg };
    }
  }

  /**
   * Web Safety 域验证
   */
  private validateBrokerAccess(brokerId: string): boolean {
    return this.allowedDomains.has(brokerId) || brokerId === 'simulate';
  }

  /**
   * 记录执行日志
   */
  private logExecution(
    args: TradeArgs,
    result: TradeResult | SimulationResult
  ): void {
    this.executionLog.push({
      timestamp: Date.now(),
      action: 'execute_trade',
      args,
      result,
    });

    // 保持日志在合理大小
    if (this.executionLog.length > 1000) {
      this.executionLog = this.executionLog.slice(-500);
    }
  }

  /**
   * 获取执行日志
   */
  getExecutionLog(): ReadonlyArray<{
    timestamp: number;
    action: string;
    args: TradeArgs;
    result: TradeResult | SimulationResult;
  }> {
    return [...this.executionLog];
  }

  /**
   * 清空执行日志
   */
  clearLog(): void {
    this.executionLog = [];
  }

  /**
   * 添加允许的域
   */
  addAllowedDomain(domain: string): void {
    this.allowedDomains.add(domain);
  }

  /**
   * 移除允许的域
   */
  removeAllowedDomain(domain: string): void {
    this.allowedDomains.delete(domain);
  }

  // ============ Private Helper Methods ============

  private simulateBuyProjection(quantity: number, price: number): number {
    // 简化的买入收益模拟
    const priceChange = (Math.random() - 0.5) * 0.1 * price;
    return quantity * priceChange;
  }

  private simulateSellProjection(quantity: number, price: number): number {
    // 简化的卖出收益模拟
    const priceChange = (Math.random() - 0.5) * 0.1 * price;
    return quantity * priceChange;
  }
}