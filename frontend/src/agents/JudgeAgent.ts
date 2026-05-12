/**
 * JudgeAgent
 * 裁判Agent：根据多方和空方论点进行加权评分，输出最终决策（BUY/SELL/HOLD）
 */

import { callWithJSONPrompt, hasApiKey } from './MiniMaxAgentService';
import type { Argument, JudgeVerdict } from './messages';
import type { AgentName } from './messages';
import { createAgentMessage } from './messages';
import type { AgentMessage } from './messages';
import type { Position } from '../types';

export interface JudgePayload {
  stockCode: string;
  bullArguments: Argument[];
  bearArguments: Argument[];
  positions: Position[];
  portfolioCash: number;
}

const JUDGE_SYSTEM_PROMPT = `你是一位资深的投资决策裁判，负责综合多方和空方论点，进行加权评分并给出最终决策。

你的任务是：
1. 评估每条多方论点的质量和权重
2. 评估每条空方论点的质量和权重
3. 计算加权总分（多方总分和空方总分）
4. 结合当前持仓状态和市场环境，给出最终决策

决策类型：
- BUY: 强烈看多，建议买入
- SELL: 强烈看空，建议卖出
- HOLD: 不确定性高，建议观望

请以JSON格式返回评分结果：
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0-1.0之间的置信度值,
  "bullScore": 多方加权总分 (0-100),
  "bearScore": 空方加权总分 (0-100),
  "reasoning": "详细的裁判推理过程"
}

评分标准：
- 多方论点权重 * 论点强度 = 加权贡献
- 空方论点权重 * 论点强度 = 空方贡献
- confidence = |bullScore - bearScore| / 100，反映分歧程度
- decision基于总分对比和当前持仓综合判断

只返回JSON，不要有其他文字。`;

export const JudgeAgent = {
  name: 'judge' as AgentName,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('judge', message.from as AgentName, 'error',
          { error: 'JudgeAgent expects request type' }, message.traceId);
      }

      const payload = message.payload as JudgePayload;
      const { stockCode, bullArguments, bearArguments, positions, portfolioCash } = payload;

      if (!stockCode) {
        return createAgentMessage('judge', 'supervisor', 'response',
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
        const bullScore = bullArguments.reduce((sum, a) => sum + a.weight * 100, 0) / Math.max(bullArguments.length, 1);
        const bearScore = bearArguments.reduce((sum, a) => sum + a.weight * 100, 0) / Math.max(bearArguments.length, 1);
        const diff = bullScore - bearScore;
        const confidence = Math.min(Math.abs(diff) / 100, 1);
        let decision: 'BUY' | 'SELL' | 'HOLD';
        if (diff > 15) decision = 'BUY';
        else if (diff < -15) decision = 'SELL';
        else decision = 'HOLD';

        const fallbackVerdict: JudgeVerdict = {
          decision,
          confidence,
          bullScore,
          bearScore,
          reasoning: `基于 ${bullArguments.length} 条多方论点和 ${bearArguments.length} 条空方论点的综合评分。多方均分 ${bullScore.toFixed(1)}，空方均分 ${bearScore.toFixed(1)}，差值 ${diff.toFixed(1)}。`,
        };
        return createAgentMessage('judge', 'supervisor', 'response', {
          verdict: fallbackVerdict,
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

请进行裁判评分：`;

      const result = await callWithJSONPrompt<JudgeVerdict>(JUDGE_SYSTEM_PROMPT, userMessage, { sessionId, agentName: 'judge' });

      if (result.success && result.data) {
        const verdict: JudgeVerdict = {
          decision: result.data.decision || 'HOLD',
          confidence: Math.max(0, Math.min(1, result.data.confidence || 0)),
          bullScore: result.data.bullScore || 0,
          bearScore: result.data.bearScore || 0,
          reasoning: result.data.reasoning || '无推理过程',
        };
        return createAgentMessage('judge', 'supervisor', 'response', {
          verdict,
          duration: Date.now() - startTime,
        }, message.traceId);
      }

      // Fallback on failure
      const bullScore = bullArguments.reduce((sum, a) => sum + a.weight * 100, 0) / Math.max(bullArguments.length, 1);
      const bearScore = bearArguments.reduce((sum, a) => sum + a.weight * 100, 0) / Math.max(bearArguments.length, 1);
      const diff = bullScore - bearScore;
      const confidence = Math.min(Math.abs(diff) / 100, 1);
      let decision: 'BUY' | 'SELL' | 'HOLD';
      if (diff > 15) decision = 'BUY';
      else if (diff < -15) decision = 'SELL';
      else decision = 'HOLD';

      const fallbackVerdict: JudgeVerdict = {
        decision,
        confidence,
        bullScore,
        bearScore,
        reasoning: `Fallback: 多方均分 ${bullScore.toFixed(1)}，空方均分 ${bearScore.toFixed(1)}。`,
      };
      return createAgentMessage('judge', 'supervisor', 'response', {
        verdict: fallbackVerdict,
        duration: Date.now() - startTime,
      }, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('judge', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};
