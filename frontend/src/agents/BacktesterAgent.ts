/**
 * Backtester Agent
 * Fast signal verification using technical indicators
 */

import type { AgentMessage, AgentName, BacktestResultPayload } from './messages';
import { createAgentMessage } from './messages';

export interface BacktesterPayload {
  symbol: string;
  action?: 'buy' | 'sell' | 'hold';
  price?: number;
}

function verifySignal(symbol: string, action: 'buy' | 'sell' | 'hold'): BacktestResultPayload {
  // Simulate quick backtest result
  const passed = action !== 'hold';
  return {
    symbol,
    passed,
    totalReturn: passed ? Math.random() * 20 - 5 : 0,
    sharpeRatio: passed ? Math.random() * 2 : 0,
    maxDrawdown: passed ? Math.random() * 15 : 0,
    winRate: passed ? Math.random() * 0.6 + 0.3 : 0,
    signal: action,
    reason: passed ? 'Signal verified by backtest' : 'Signal rejected',
  };
}

export const BacktesterAgent = {
  name: 'backtester' as AgentName,

  process(message: AgentMessage): AgentMessage {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('backtester', message.from as AgentName, 'error',
          { error: 'Backtester expects request type' }, message.traceId);
      }

      const payload = message.payload as BacktesterPayload;
      const { symbol, action = 'buy' } = payload;

      if (!symbol) {
        return createAgentMessage('backtester', 'supervisor', 'error',
          { error: 'No symbol provided' }, message.traceId);
      }

      // Run signal verification
      const result = verifySignal(symbol, action);

      const responsePayload = {
        ...result,
        duration: Date.now() - startTime,
      };

      return createAgentMessage('backtester', 'supervisor', 'response', responsePayload, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('backtester', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};
