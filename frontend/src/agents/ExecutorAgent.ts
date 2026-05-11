/**
 * Executor Agent
 * Order execution using the api.ts executeTrade function
 * Implements retry with exponential backoff (2 retries)
 */

import type { AgentMessage, AgentName, ExecutionResultPayload } from './messages';
import { createAgentMessage } from './messages';
import { executeTrade } from '../services/api';
import type { TradeRequest } from '../types';

export interface ExecutorPayload {
  symbol: string;
  name?: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  accountId?: number;
}

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 100;

async function executeWithRetry(
  request: TradeRequest,
  accountId: number
): Promise<ExecutionResultPayload> {
  let lastError: string = '';
  let retryCount = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const trade = await executeTrade(request, accountId);
      return {
        success: true,
        tradeId: trade.id,
        symbol: request.symbol,
        action: request.trade_type,
        quantity: request.quantity,
        price: request.price,
        retryCount: attempt,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      retryCount = attempt + 1;
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 100ms, 200ms, 400ms...
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return {
    success: false,
    symbol: request.symbol,
    action: request.trade_type,
    quantity: request.quantity,
    price: request.price,
    retryCount,
    error: lastError,
  };
}

export const ExecutorAgent = {
  name: 'executor' as AgentName,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('executor', message.from as AgentName, 'error',
          { error: 'Executor expects request type' }, message.traceId);
      }

      const payload = message.payload as ExecutorPayload;
      const { symbol, name, action, quantity, price, accountId = 1 } = payload;

      if (!symbol || !quantity || quantity <= 0) {
        return createAgentMessage('executor', 'supervisor', 'error',
          { error: 'Invalid execution parameters' }, message.traceId);
      }

      const request: TradeRequest = {
        symbol,
        name: name || symbol,
        trade_type: action,
        quantity,
        price,
      };

      const result = await executeWithRetry(request, accountId);

      const responsePayload = {
        ...result,
        duration: Date.now() - startTime,
      };

      return createAgentMessage('executor', 'supervisor', 'response', responsePayload, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('executor', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};
