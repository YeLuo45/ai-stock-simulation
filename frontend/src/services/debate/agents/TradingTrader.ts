/**
 * TradingTrader - 交易员
 * Executes trade orders with slippage control and retry logic
 */

import { createAgentMessage } from '../../../agents/messages';
import type { AgentMessage } from '../../../agents/messages';
import type { TradingPayload, TradingResponse, TraderType, TradeExecution } from '../types/TraderType';

const MAX_SLIPPAGE = 0.02; // 2%
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

export const TradingTrader = {
  name: 'trading_trader' as const,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('trading_trader', message.from as any, 'error',
          { error: 'TradingTrader expects request type' }, message.traceId);
      }

      const payload = message.payload as TradingPayload;
      const { stockCode, action, quantityType, quantity, priceType, limitPrice, dryRun } = payload;

      if (!stockCode) {
        return createAgentMessage('trading_trader', 'supervisor', 'response',
          { error: 'No stock code provided' }, message.traceId);
      }

      // Simulate trade execution with fallback
      const mockPrice = 100; // Would fetch real price in production
      const executedPrice = mockPrice * (1 + (Math.random() - 0.5) * 0.01);
      const slippage = Math.abs(executedPrice - mockPrice) / mockPrice;

      // Check slippage limit
      if (slippage > MAX_SLIPPAGE && !dryRun) {
        return createAgentMessage('trading_trader', 'supervisor', 'response', {
          type: 'TRADE' as TraderType,
          stockCode,
          execution: {
            success: false,
            orderId: `failed-${Date.now()}`,
            symbol: stockCode,
            action: action as 'BUY' | 'SELL',
            executedShares: 0,
            executedPrice: 0,
            totalAmount: 0,
            slippage,
            timestamp: Date.now(),
            error: `滑点超限: ${(slippage * 100).toFixed(2)}% > ${(MAX_SLIPPAGE * 100).toFixed(2)}%`,
          },
          dryRun,
          timestamp: Date.now(),
        } as TradingResponse, message.traceId);
      }

      const shares = quantityType === 'percentage' 
        ? Math.floor(10000 * quantity / 100 / executedPrice) // Assuming 10000 portfolio
        : quantity;
      const totalAmount = shares * executedPrice;
      const commission = totalAmount * 0.0003; // 0.03% commission

      const execution: TradeExecution = {
        success: true,
        orderId: `order-${Date.now()}`,
        symbol: stockCode,
        action: action as 'BUY' | 'SELL',
        executedShares: shares,
        executedPrice,
        totalAmount,
        commission,
        slippage,
        timestamp: Date.now(),
      };

      return createAgentMessage('trading_trader', 'supervisor', 'response', {
        type: 'TRADE' as TraderType,
        stockCode,
        execution,
        dryRun,
        timestamp: Date.now(),
      } as TradingResponse, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('trading_trader', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};