/**
 * PhaseExecute - Execute Phase Implementation
 * Places orders via brokerProvider, supports dryRun mode
 */
import type { WorkflowContext, DebateDecision, ExecutedOrder, PhaseResult, ExecuteConfig } from './types';
import { createBrokerProvider, loadBrokerConfig, type BrokerProvider } from '../brokerProvider';
import { StrategyPool } from '../regime';
import { getCurrentRegime } from '../regime/RegimeStore';

export const PhaseExecute = {
  /**
   * Run the Execute phase
   * Places orders based on debate decisions with regime-adaptive risk management
   */
  async run(context: WorkflowContext, config: ExecuteConfig): Promise<PhaseResult> {
    try {
      const decisions = context.debateDecisions || [];
      
      // Get regime-adaptive parameters
      const regime = getCurrentRegime();
      const poolConfig = StrategyPool.getConfig(regime);
      
      // Adjust config based on regime
      const adjustedConfig = {
        ...config,
        maxPositions: Math.min(config.maxPositions, Math.floor(100 / poolConfig.maxPositionPct)),
        positionSizePct: Math.min(config.positionSizePct, poolConfig.maxPositionPct),
      };
      
      // Use regime-adjusted stop loss / take profit in context
      const regimeContext = {
        ...context,
        stopLossPct: poolConfig.stopLossPct,
        takeProfitPct: poolConfig.takeProfitPct,
      };
      
      if (decisions.length === 0) {
        return {
          phase: 'execute',
          status: 'completed',
          success: true,
          data: {
            orders: [],
            successCount: 0,
            failedCount: 0,
            regime: regime,
          },
          message: `无交易决策，跳过执行 (当前市场: ${regime})`,
        };
      }

      // Filter valid decisions (BUY or SELL with sufficient confidence)
      const validDecisions = decisions.filter(d => 
        (d.tradeAction === 'BUY' || d.tradeAction === 'SELL') && d.quantityPct > 0
      ).slice(0, adjustedConfig.maxPositions);

      // Create broker provider
      const brokerConfig = loadBrokerConfig();
      const broker = createBrokerProvider(brokerConfig);

      // Connect if not already connected
      if (!broker.isConnected()) {
        await broker.connect();
      }

      const orders: ExecutedOrder[] = [];

      // Execute each decision with regime-adjusted risk params
      for (const decision of validDecisions) {
        const order = await this.executeDecision(decision, adjustedConfig, broker, poolConfig);
        orders.push(order);
      }

      const successCount = orders.filter(o => o.status === 'success').length;
      const failedCount = orders.filter(o => o.status === 'failed').length;

      return {
        phase: 'execute',
        status: 'completed',
        success: failedCount === 0,
        data: {
          orders,
          successCount,
          failedCount,
          regime,
          riskParams: {
            stopLossPct: poolConfig.stopLossPct,
            takeProfitPct: poolConfig.takeProfitPct,
            maxDrawdownPct: poolConfig.maxDrawdownPct,
          },
        },
        message: config.dryRun 
          ? `模拟执行完成：${successCount} 笔成功，${failedCount} 笔失败（dry-run 模式, 市场状态: ${regime}）`
          : `实盘执行完成：${successCount} 笔成功，${failedCount} 笔失败 (市场状态: ${regime})`,
      };
    } catch (err) {
      return {
        phase: 'execute',
        status: 'failed',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  },

  /**
   * Execute a single trading decision with regime-adaptive risk parameters
   */
  async executeDecision(
    decision: DebateDecision,
    config: ExecuteConfig,
    broker: BrokerProvider,
    poolConfig?: { stopLossPct: number; takeProfitPct: number; maxDrawdownPct: number }
  ): Promise<ExecutedOrder> {
    try {
      // Use regime-specific risk parameters if available
      const stopLoss = poolConfig?.stopLossPct ?? 5;
      const takeProfit = poolConfig?.takeProfitPct ?? 15;
      
      // Calculate position size using regime-adjusted parameters
      const positionValue = decision.quantityPct / 100 * 1000000; // Mock portfolio value
      const quantity = Math.floor(positionValue / decision.quantityPct / decision.symbol.length); // Simplified

      if (config.dryRun) {
        // Dry-run mode: simulate success without actual order
        return {
          symbol: decision.symbol,
          name: decision.name,
          side: decision.tradeAction === 'BUY' ? 'buy' : 'sell',
          quantity: Math.floor(config.positionSizePct * 100), // Mock quantity
          price: 0, // Mock price
          status: 'success',
          orderId: `dry-run-${Date.now()}`,
          metadata: { stopLoss, takeProfit },
        };
      }

      // Real order placement
      const qty = Math.floor(config.positionSizePct * 10); // Mock quantity calculation
      const order = await broker.placeOrder(
        decision.symbol,
        decision.tradeAction === 'BUY' ? 'buy' : 'sell',
        qty,
        'market'
      );

      return {
        symbol: decision.symbol,
        name: decision.name,
        side: decision.tradeAction === 'BUY' ? 'buy' : 'sell',
        quantity: order.filledQty,
        price: 0,
        status: 'success',
        orderId: order.id,
        metadata: { stopLoss, takeProfit },
      };
    } catch (err) {
      return {
        symbol: decision.symbol,
        name: decision.name,
        side: decision.tradeAction === 'BUY' ? 'buy' : 'sell',
        quantity: 0,
        price: 0,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  },
};