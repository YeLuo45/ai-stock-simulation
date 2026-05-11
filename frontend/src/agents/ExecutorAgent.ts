/**
 * Executor Agent
 * Order execution using the api.ts executeTrade function
 * Implements retry with exponential backoff (2 retries)
 * Supports MiniMax API LLM-driven decision when API key is available
 */

import type { AgentMessage, AgentName, ExecutionResultPayload } from './messages';
import { createAgentMessage } from './messages';
import { executeTrade } from '../services/api';
import type { TradeRequest } from '../types';
import { hasApiKey, callWithJSONPrompt, saveAgentLLMOutput, getAgentSession } from './MiniMaxAgentService';
import { buildContextSummary } from './AgentSession';

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

const EXECUTOR_SYSTEM_PROMPT = `你是一位交易执行师，基于风控结果和实时行情制定最优买卖计划。

请根据以下交易请求，制定执行计划，返回JSON格式：
{
  "executionPlan": {
    "action": "buy/sell",
    "symbol": "股票代码",
    "quantity": 数量,
    "price": 执行价格,
    "strategy": "市价/限价/分批",
    "urgency": "高/中/低",
    "notes": "执行说明"
  }
}

执行策略考虑：
1. 行情波动性 - 高波动时考虑分批执行
2. 流动性 - 大额订单需要分批避免冲击成本
3. 时机 - 根据市场状况选择市价或限价

只返回JSON，不要有其他文字。`;

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

      const sessionId = message.traceId || `executor-${Date.now()}`;

      if (hasApiKey()) {
        try {
          const session = getAgentSession(sessionId);
          const contextSummary = session ? buildContextSummary(session) : '无可用上下文';

          const userMessage = `交易请求:
- 股票代码: ${symbol}
- 交易方向: ${action}
- 数量: ${quantity}
- 价格: ¥${price.toFixed(2)}
- 预估金额: ¥${(quantity * price).toFixed(2)}

${contextSummary}

请制定最优的执行计划。`;

          const llmResult = await callWithJSONPrompt<{
            executionPlan: {
              action: string;
              symbol: string;
              quantity: number;
              price: number;
              strategy: string;
              urgency: string;
              notes: string;
            };
          }>(EXECUTOR_SYSTEM_PROMPT, userMessage, { sessionId });

          if (llmResult.success && llmResult.data) {
            const plan = llmResult.data.executionPlan;
            saveAgentLLMOutput(sessionId, 'executor', {
              agentName: 'executor',
              sessionId,
              timestamp: Date.now(),
              llmResponse: JSON.stringify(llmResult.data),
              parsedOutput: llmResult.data as Record<string, unknown>,
              latency: Date.now() - startTime,
            });

            // Use LLM plan info if available, but still execute via executeTrade
            const executionNote = `LLM Plan: ${plan.strategy} - ${plan.notes}`;
            console.log(executionNote);
          }
        } catch (llmErr) {
          console.warn('Executor LLM planning failed, using standard execution:', llmErr);
        }
      }

      // Actual order execution always goes through executeTrade
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
