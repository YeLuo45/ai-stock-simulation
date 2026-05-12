/**
 * Risk Controller Agent
 * Risk checks using drawdownEngine and positionAnalytics
 * Supports MiniMax API LLM-driven decision when API key is available
 */

import type { AgentMessage, AgentName, RiskResultPayload, RiskReasonCode } from '../messages';
import { createAgentMessage } from '../messages';
import { computeDrawdown, type DrawdownResult } from '../../services/drawdownEngine';
import type { Position } from '../../types';
import { hasApiKey, callWithJSONPrompt, saveAgentLLMOutput, getAgentSession } from './MiniMaxAgentService';
import { buildContextSummary } from './AgentSession';
import { NotificationService } from '../services/NotificationService';

export interface RiskControllerPayload {
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  positions: Position[];
  portfolioCash: number;
  maxDrawdownThreshold?: number;
}

const RISK_REJECTION_CODES: Record<string, RiskReasonCode> = {
  DD_05: { code: 'DD_05', detail: 'Drawdown exceeds 5% threshold' },
  DD_10: { code: 'DD_10', detail: 'Drawdown exceeds 10% threshold' },
  INSUFFICIENT_CASH: { code: 'CASH_01', detail: 'Insufficient cash for buy order' },
  POSITION_LIMIT: { code: 'POS_01', detail: 'Position size exceeds limit' },
  CONCENTRATION: { code: 'CON_01', detail: 'Single position concentration too high' },
};

const RISK_SYSTEM_PROMPT = `你是一位风控官，基于当前持仓、回撤和现金状况评估候选股风险，决定是否批准交易。

请评估以下交易请求的风险，返回JSON格式：
{
  "approved": true/false,
  "reason": "风险评估理由",
  "positionValue": 持仓金额（仅买入时）
}

评估要点：
1. 当前账户回撤是否超过阈值
2. 现金余额是否充足
3. 持仓集中度是否过高（单只股票不超过30%）
4. 整体风险收益比是否合理

只返回JSON，不要有其他文字。`;

function checkRisk(payload: RiskControllerPayload): RiskResultPayload {
  const {
    action,
    quantity,
    price,
    positions,
    portfolioCash,
    maxDrawdownThreshold = -0.1,
  } = payload;

  const drawdownResult: DrawdownResult = computeDrawdown();

  if (drawdownResult.currentDrawdown < maxDrawdownThreshold) {
    const reasonCode = maxDrawdownThreshold <= -0.1 ? 'DD_10' : 'DD_05';
    return {
      approved: false,
      reasonCode: RISK_REJECTION_CODES[reasonCode],
      reason: `Current drawdown ${(drawdownResult.currentDrawdown * 100).toFixed(1)}% exceeds threshold`,
      drawdown: drawdownResult.currentDrawdown,
    };
  }

  if (action === 'buy') {
    const totalCost = quantity * price * 1.0003;
    if (portfolioCash < totalCost) {
      return {
        approved: false,
        reasonCode: RISK_REJECTION_CODES['INSUFFICIENT_CASH'],
        reason: `Insufficient cash: need ${totalCost.toFixed(2)}, have ${portfolioCash.toFixed(2)}`,
      };
    }

    const positionValue = quantity * price;
    const totalPortfolioValue = positions.reduce((sum, p) => sum + p.market_value, 0) + portfolioCash;
    const newWeight = positionValue / totalPortfolioValue;
    if (newWeight > 0.3) {
      return {
        approved: false,
        reasonCode: RISK_REJECTION_CODES['CONCENTRATION'],
        reason: `Position weight ${(newWeight * 100).toFixed(1)}% would exceed 30% limit`,
      };
    }
  }

  return {
    approved: true,
    reason: 'Risk checks passed',
    portfolioValue: positions.reduce((sum, p) => sum + p.market_value, 0) + portfolioCash,
    positionValue: action === 'buy' ? quantity * price : 0,
    drawdown: drawdownResult.currentDrawdown,
  };
}

export const RiskControllerAgent = {
  name: 'risk' as AgentName,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('risk', message.from as AgentName, 'error',
          { error: 'Risk controller expects request type' }, message.traceId);
      }

      const payload = message.payload as RiskControllerPayload;
      const sessionId = message.traceId || `risk-${Date.now()}`;
      let result: RiskResultPayload;

      if (hasApiKey()) {
        try {
          const session = getAgentSession(sessionId);
          const contextSummary = session ? buildContextSummary(session) : '无可用上下文';
          const totalPortfolioValue = payload.positions.reduce((sum, p) => sum + p.market_value, 0) + payload.portfolioCash;

          const userMessage = `交易请求:
- 股票代码: ${payload.symbol}
- 交易方向: ${payload.action}
- 数量: ${payload.quantity}
- 价格: ¥${payload.price.toFixed(2)}
- 预估金额: ¥${(payload.quantity * payload.price).toFixed(2)}

账户状态:
- 现金: ¥${payload.portfolioCash.toFixed(2)}
- 总市值: ¥${totalPortfolioValue.toFixed(2)}
- 当前持仓数: ${payload.positions.length}只
${contextSummary}

请评估这笔交易的风险。`;

          const llmResult = await callWithJSONPrompt<{
            approved: boolean;
            reason: string;
            positionValue?: number;
          }>(RISK_SYSTEM_PROMPT, userMessage, { sessionId, agentName: 'risk' });

          if (llmResult.success && llmResult.data) {
            const deterministicCheck = checkRisk(payload);
            result = {
              approved: llmResult.data.approved && deterministicCheck.approved,
              reason: llmResult.data.reason || deterministicCheck.reason,
              reasonCode: deterministicCheck.reasonCode,
              portfolioValue: deterministicCheck.portfolioValue,
              positionValue: llmResult.data.positionValue || deterministicCheck.positionValue,
              drawdown: deterministicCheck.drawdown,
            };

            saveAgentLLMOutput(sessionId, 'risk', {
              agentName: 'risk',
              sessionId,
              timestamp: Date.now(),
              llmResponse: JSON.stringify(llmResult.data),
              parsedOutput: llmResult.data as Record<string, unknown>,
              latency: Date.now() - startTime,
            });
          } else {
            result = checkRisk(payload);
          }
        } catch (llmErr) {
          result = checkRisk(payload);
        }
      } else {
        result = checkRisk(payload);
      }

      const responsePayload = {
        ...result,
        duration: Date.now() - startTime,
      };

      // Send notification if risk was rejected
      if (!result.approved) {
        NotificationService.sendAlert({
          level: 'critical',
          title: '风控拒绝交易',
          message: result.reason || '风险检查未通过，交易被拒绝',
          metadata: {
            symbol: payload.symbol,
            action: payload.action,
            reasonCode: result.reasonCode?.code,
          },
        });
      }

      return createAgentMessage('risk', 'supervisor', 'response', responsePayload, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('risk', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};
