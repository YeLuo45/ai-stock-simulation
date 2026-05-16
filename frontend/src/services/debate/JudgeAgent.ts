/**
 * JudgeAgent - 裁判
 * Aggregates bull/bear arguments, outputs final decision with Chinese reasoning
 */

import { callWithJSONPrompt, hasApiKey } from '../../agents/MiniMaxAgentService';
import type { DebateArgument, DebateResult } from './types';
import { createAgentMessage } from '../../agents/messages';
import type { AgentMessage } from '../../agents/messages';
import type { Position } from '../../types';

export interface JudgeAgentPayload {
  stockCode: string;
  bullArguments: DebateArgument[];
  bearArguments: DebateArgument[];
  positions: Position[];
  portfolioCash: number;
}

const JUDGE_AGENT_PROMPT = `你是一位资深的投资决策裁判，负责综合多方和空方论点，进行加权评分并给出最终决策。

你的任务是：
1. 评估每条多方论点的质量和权重
2. 评估每条空方论点的质量和权重
3. 计算加权总分（多方总分和空方总分）
4. 结合当前持仓状态和市场环境，给出最终决策

决策类型：
- STRONG_BUY: 强烈看多，建议全仓买入
- BUY: 看多，建议买入
- HOLD: 不确定性高，建议观望
- SELL: 看空，建议卖出
- STRONG_SELL: 强烈看空，建议清仓

请以JSON格式返回评分结果：
{
  "decision": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "confidence": 0.0-1.0之间的置信度值,
  "bullScore": 多方加权总分 (0-100),
  "bearScore": 空方加权总分 (0-100),
  "reasoning": "详细的裁判推理过程（中文）"
}

评分标准：
- 多方论点权重 * 论点强度 = 加权贡献
- 空方论点权重 * 论点强度 = 空方贡献
- confidence = |bullScore - bearScore| / 100，反映分歧程度
- decision基于总分对比和当前持仓综合判断

只返回JSON，不要有其他文字。`;

function computeFallbackVerdict(
  bullArguments: DebateArgument[],
  bearArguments: DebateArgument[],
  positions: Position[],
  portfolioCash: number
): Partial<DebateResult> {
  const bullScore = bullArguments.reduce((sum, a) => sum + a.weight * 100, 0) / Math.max(bullArguments.length, 1);
  const bearScore = bearArguments.reduce((sum, a) => sum + a.weight * 100, 0) / Math.max(bearArguments.length, 1);
  const diff = bullScore - bearScore;
  const confidence = Math.min(Math.abs(diff) / 100, 1);

  let decision: DebateResult['decision'];
  if (diff > 25) decision = 'STRONG_BUY';
  else if (diff > 10) decision = 'BUY';
  else if (diff < -25) decision = 'STRONG_SELL';
  else if (diff < -10) decision = 'SELL';
  else decision = 'HOLD';

  // Check if already has position
  const hasPosition = positions.some(p => p.symbol === positions[0]?.symbol);

  return {
    decision,
    confidence,
    bullScore,
    bearScore,
    reasoning: `基于 ${bullArguments.length} 条多方论点和 ${bearArguments.length} 条空方论点的综合评分。多方均分 ${bullScore.toFixed(1)}，空方均分 ${bearScore.toFixed(1)}，差值 ${diff.toFixed(1)}。${hasPosition ? '当前持有该标的。' : '当前未持有该标的。'}`,
  };
}

export const JudgeAgent = {
  name: 'judge' as const,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('judge', message.from as any, 'error',
          { error: 'JudgeAgent expects request type' }, message.traceId);
      }

      const payload = message.payload as JudgeAgentPayload;
      const { stockCode, bullArguments, bearArguments, positions, portfolioCash } = payload;

      if (!stockCode) {
        return createAgentMessage('judge', message.from as any, 'response',
          { error: 'No stock code provided' }, message.traceId);
      }

      // Build position summary
      const positionSummary = positions && positions.length > 0
        ? positions.map(p => `${p.symbol}: ${p.quantity}股，成本¥${p.avg_cost.toFixed(2)}`).join('; ')
        : '无持仓';
      const positionValue = positions
        ? positions.reduce((sum, p) => sum + p.market_value, 0)
        : 0;

      // If no API key, compute fallback verdict
      if (!hasApiKey()) {
        const fallback = computeFallbackVerdict(bullArguments, bearArguments, positions, portfolioCash);
        return createAgentMessage('judge', 'supervisor', 'response', {
          ...fallback,
          duration: Date.now() - startTime,
        }, message.traceId);
      }

      const sessionId = message.traceId || `judge-${Date.now()}`;
      const userMessage = `股票代码: ${stockCode}

当前持仓状态：
- 持仓市值: ¥${positionValue.toFixed(2)}
- 可用资金: ¥${portfolioCash.toFixed(2)}
- 持仓详情: ${positionSummary}

多方论点 (${bullArguments.length}条):
${bullArguments.map((a, i) => `${i + 1}. [权重${(a.weight * 100).toFixed(0)}%] ${a.point}${a.evidence ? ` - 证据: ${a.evidence}` : ''}`).join('\n')}

空方论点 (${bearArguments.length}条):
${bearArguments.map((a, i) => `${i + 1}. [权重${(a.weight * 100).toFixed(0)}%] ${a.point}${a.evidence ? ` - 证据: ${a.evidence}` : ''}`).join('\n')}

请进行裁判评分（请用中文输出reasoning）：`;

      const result = await callWithJSONPrompt<{
        decision: DebateResult['decision'];
        confidence: number;
        bullScore: number;
        bearScore: number;
        reasoning: string;
      }>(JUDGE_AGENT_PROMPT, userMessage, { sessionId, agentName: 'judge' });

      if (result.success && result.data) {
        return createAgentMessage('judge', 'supervisor', 'response', {
          decision: result.data.decision || 'HOLD',
          confidence: Math.max(0, Math.min(1, result.data.confidence || 0)),
          bullScore: result.data.bullScore || 0,
          bearScore: result.data.bearScore || 0,
          reasoning: result.data.reasoning || '无推理过程',
          duration: Date.now() - startTime,
        }, message.traceId);
      }

      // Fallback on failure
      const fallback = computeFallbackVerdict(bullArguments, bearArguments, positions, portfolioCash);
      return createAgentMessage('judge', 'supervisor', 'response', {
        ...fallback,
        duration: Date.now() - startTime,
      }, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('judge', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};