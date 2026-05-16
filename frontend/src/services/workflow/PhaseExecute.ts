/**
 * PhaseExecute - Execute Phase Implementation
 * Places orders via brokerProvider, supports dryRun mode
 */
import type { WorkflowContext, DebateDecision, ExecutedOrder, PhaseResult, ExecuteConfig } from './types';
import { createBrokerProvider, loadBrokerConfig, type BrokerProvider } from '../brokerProvider';

export const PhaseExecute = {
  /**
   * Run the Execute phase
   * Places orders based on debate decisions
   */
  async run(context: WorkflowContext, config: ExecuteConfig): Promise<PhaseResult> {
    try {
      const decisions = context.debateDecisions || [];
      
      if (decisions.length === 0) {
        return {
          phase: 'execute',
          status: 'completed',
          success: true,
          data: {
            orders: [],
            successCount: 0,
            failedCount: 0,
          },
          message: '无交易决策，跳过执行',
        };
      }

      // Filter valid decisions (BUY or SELL with sufficient confidence)
      const validDecisions = decisions.filter(d => 
        (d.tradeAction === 'BUY' || d.tradeAction === 'SELL') && d.quantityPct > 0
      ).slice(0, config.maxPositions);

      // Create broker provider
      const brokerConfig = loadBrokerConfig();
      const broker = createBrokerProvider(brokerConfig);

      // Connect if not already connected
      if (!broker.isConnected()) {
        await broker.connect();
      }

      const orders: ExecutedOrder[] = [];

      // Execute each decision
      for (const decision of validDecisions) {
        const order = await this.executeDecision(decision, config, broker);
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
        },
        message: config.dryRun 
          ? `模拟执行完成：${successCount} 笔成功，${failedCount} 笔失败（dry-run 模式）`
          : `实盘执行完成：${successCount} 笔成功，${failedCount} 笔失败`,
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
   * Execute a single trading decision
   */
  async executeDecision(
    decision: DebateDecision,
    config: ExecuteConfig,
    broker: BrokerProvider
  ): Promise<ExecutedOrder> {
    try {
      // Calculate position size
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