/**
 * Trading MCP Client - 安全执行层
 * 连接交易 API（券商接口、市场数据）并通过 Sandbox 隔离执行
 */

import type { BrokerConfig, BrokerProvider, BrokerOrder, BrokerPosition, BrokerAccount } from '../brokerProvider';
import { createBrokerProvider } from '../brokerProvider';
import { RiskGuardrails, type ValidationResult, type PortfolioValidation } from './RiskGuardrails';
import { TradingSandbox, type TradeResult, type SimulationResult, type TradeArgs } from './TradingSandbox';
import { tradingMemoryManager, type TradingDecision, type TradeOutcome } from '../memory/TradingMemoryManager';

export { RiskGuardrails, type ValidationResult, type PortfolioValidation } from './RiskGuardrails';
export { TradingSandbox, type TradeResult, type SimulationResult, type TradeArgs } from './TradingSandbox';

// ============ Types ============

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';

export interface OrderRequest {
  ticker: string;
  side: OrderSide;
  quantity: number;
  orderType: OrderType;
  limitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  strategy?: string;
  regime?: string;
  reasoning?: string;
}

export interface OrderResult {
  success: boolean;
  order?: BrokerOrder;
  error?: string;
  riskRejection?: string;
}

export interface MarketData {
  ticker: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
}

export interface TradingTool {
  name: string;
  execute(args: TradeArgs): Promise<TradeResult>;
}

// ============ TradingMcpClient ============

export class TradingMcpClient {
  private provider: BrokerProvider | null = null;
  private sandbox: TradingSandbox;
  private riskGuardrails: RiskGuardrails;
  private _connected = false;
  private sessionId: string = '';

  constructor(riskConfig?: ConstructorParameters<typeof RiskGuardrails>[0]) {
    this.sandbox = new TradingSandbox();
    this.riskGuardrails = new RiskGuardrails(riskConfig || {});
  }

  get connected(): boolean {
    return this._connected;
  }

  get brokerProvider(): BrokerProvider | null {
    return this.provider;
  }

  get guardrails(): RiskGuardrails {
    return this.riskGuardrails;
  }

  /**
   * 连接 Broker
   */
  async connectBroker(config: BrokerConfig): Promise<{ success: boolean; message: string }> {
    try {
      this.provider = createBrokerProvider(config);
      await this.provider.connect();
      this._connected = true;
      this.sessionId = `session-${Date.now()}`;
      return { success: true, message: 'Broker 连接成功' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : '连接失败';
      return { success: false, message: msg };
    }
  }

  /**
   * 断开 Broker 连接
   */
  async disconnectBroker(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
      this._connected = false;
      this.provider = null;
    }
  }

  /**
   * 获取账户信息
   */
  async getAccount(): Promise<BrokerAccount | null> {
    if (!this.provider) return null;
    return this.provider.getAccount();
  }

  /**
   * 获取持仓
   */
  async getPositions(): Promise<BrokerPosition[]> {
    if (!this.provider) return [];
    return this.provider.getPositions();
  }

  /**
   * 获取市场数据（模拟实现）
   */
  async getMarketData(ticker: string): Promise<MarketData | null> {
    // 模拟市场数据
    return {
      ticker,
      price: 100 + Math.random() * 50,
      bid: 99.5 + Math.random() * 50,
      ask: 100.5 + Math.random() * 50,
      volume: Math.floor(Math.random() * 10000000),
      timestamp: Date.now(),
    };
  }

  /**
   * 下单 - 完整的交易闭环
   * 1. Risk Guardrails 校验
   * 2. 通过 Sandbox 执行
   * 3. 结果存入记忆
   */
  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    if (!this.provider || !this._connected) {
      return { success: false, error: 'Broker 未连接' };
    }

    // 1. Risk Guardrails 单笔校验
    const validation = this.riskGuardrails.validateOrder(order);
    if (!validation.approved) {
      return {
        success: false,
        error: 'Risk Guardrails 拦截',
        riskRejection: validation.reason,
      };
    }

    // 2. 构建交易参数
    const tradeArgs: TradeArgs = {
      ticker: order.ticker,
      side: order.side,
      quantity: order.quantity,
      orderType: order.orderType,
      limitPrice: order.limitPrice,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      strategy: order.strategy,
      regime: order.regime,
      reasoning: order.reasoning,
    };

    // 3. 通过 Sandbox 执行交易
    const result = await this.sandbox.executeTrade(this.provider, tradeArgs);

    // 4. 交易结果存入记忆
    await this.recordTradeToMemory(order, result);

    return result;
  }

  /**
   * 模拟交易（不影响真实账户）
   */
  async simulateTrade(order: OrderRequest): Promise<SimulationResult> {
    // 先校验
    const validation = this.riskGuardrails.validateOrder(order);
    if (!validation.approved) {
      return {
        success: false,
        simulation: null,
        riskRejection: validation.reason,
      };
    }

    // 执行模拟
    return this.sandbox.simulateTrade(order);
  }

  /**
   * 组合风险校验
   */
  async validatePortfolio(positions: BrokerPosition[]): Promise<PortfolioValidation> {
    return this.riskGuardrails.validatePortfolio(positions);
  }

  /**
   * 紧急熔断
   */
  emergencyStop(reason: string): void {
    this.riskGuardrails.emergencyStop(reason);
    console.warn(`[TradingMcpClient] Emergency Stop triggered: ${reason}`);
  }

  /**
   * 更新 Risk Guardrails 配置
   */
  updateRiskConfig(config: ConstructorParameters<typeof RiskGuardrails>[0]): void {
    this.riskGuardrails = new RiskGuardrails(config);
  }

  /**
   * 获取当前 session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  // ============ Private Methods ============

  /**
   * 将交易结果记录到记忆系统
   */
  private async recordTradeToMemory(
    order: OrderRequest,
    result: OrderResult
  ): Promise<void> {
    try {
      if (!result.success || !result.order) return;

      // 构建交易决策
      const decision: TradingDecision = {
        id: `dec-${Date.now()}`,
        ticker: order.ticker,
        regime: order.regime || 'unknown',
        strategy: order.strategy || 'default',
        action: order.side,
        entryPrice: order.limitPrice || result.order.filledQty || 0,
        stopLoss: order.stopLoss || 0,
        takeProfit: order.takeProfit || 0,
        reasoning: order.reasoning || '',
        timestamp: Date.now(),
      };

      // 构建交易结果
      const outcome: TradeOutcome = {
        tradeId: result.order.id,
        action: order.side,
        entryPrice: order.limitPrice || result.order.filledQty || 0,
        realized: result.order.status === 'filled',
        timestamp: Date.now(),
      };

      // 存入记忆
      await tradingMemoryManager.rememberTrade({
        sessionId: this.sessionId,
        ticker: order.ticker,
        regime: order.regime || 'unknown',
        inputs: { order },
        decision,
        createdAt: Date.now(),
      });

      // 结晶化策略
      await tradingMemoryManager.crystallizeDecision(decision, outcome);
    } catch (e) {
      console.error('[TradingMcpClient] Failed to record trade to memory:', e);
    }
  }
}

// ============ Singleton ============

let tradingMcpClientInstance: TradingMcpClient | null = null;

export function getTradingMcpClient(riskConfig?: ConstructorParameters<typeof RiskGuardrails>[0]): TradingMcpClient {
  if (!tradingMcpClientInstance) {
    tradingMcpClientInstance = new TradingMcpClient(riskConfig);
  }
  return tradingMcpClientInstance;
}

export function resetTradingMcpClient(): void {
  tradingMcpClientInstance = null;
}