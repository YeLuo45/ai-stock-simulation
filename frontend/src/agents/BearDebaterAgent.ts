/**
 * BearDebaterAgent
 * 空方辩手：列举卖出/回避股票的空方论点（下跌风险、利空、基本面恶化、技术破位）
 */

import { callWithJSONPrompt, hasApiKey } from './MiniMaxAgentService';
import type { Argument } from './messages';
import type { AgentName } from './messages';
import { createAgentMessage } from './messages';
import type { AgentMessage } from './messages';

export interface BearDebaterPayload {
  stockCode: string;
  analysisSummary: string;
}

const BEAR_DEBATER_SYSTEM_PROMPT = `你是一位专业的基本面+技术面分析师，负责从空方角度为指定股票构建卖出/回避论点。

你的任务是分析股票的下跌风险、利空因素、基本面恶化信号和技术破位风险。

请以JSON格式返回3-5条空方论点：
{
  "arguments": [
    {
      "point": "论点描述（简洁有力）",
      "weight": 0.0-1.0之间的权重值,
      "evidence": "支撑该论点的具体证据或数据"
    }
  ]
}

权重说明：
- 0.8-1.0: 核心风险因素（最强空论）
- 0.6-0.8: 重要风险因素
- 0.4-0.6: 次要风险
- 0.0-0.4: 边缘风险

只返回JSON，不要有其他文字。`;

export const BearDebaterAgent = {
  name: 'bear_debater' as AgentName,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('bear_debater', message.from as AgentName, 'error',
          { error: 'BearDebater expects request type' }, message.traceId);
      }

      const payload = message.payload as BearDebaterPayload;
      const { stockCode, analysisSummary } = payload;

      if (!stockCode) {
        return createAgentMessage('bear_debater', 'supervisor', 'response',
          { error: 'No stock code provided' }, message.traceId);
      }

      // If no API key, generate fallback arguments
      if (!hasApiKey()) {
        const fallbackArguments: Argument[] = [
          { point: '技术面显示下降趋势形成', weight: 0.7, evidence: 'MA空头排列' },
          { point: '成交量萎缩', weight: 0.6, evidence: '量价背离' },
          { point: '基本面存在不确定性', weight: 0.5, evidence: '行业政策风险' },
        ];
        return createAgentMessage('bear_debater', 'supervisor', 'response', {
          arguments: fallbackArguments,
          duration: Date.now() - startTime,
        }, message.traceId);
      }

      const sessionId = message.traceId || `bear-${Date.now()}`;
      const userMessage = `股票代码: ${stockCode}

分析摘要:
${analysisSummary || '无可用分析摘要，请基于股票代码自行分析'}

请生成空方论点（卖出/回避理由）：`;

      const result = await callWithJSONPrompt<{
        arguments: Argument[];
      }>(BEAR_DEBATER_SYSTEM_PROMPT, userMessage, { sessionId, agentName: 'bear_debater' });

      if (result.success && result.data?.arguments) {
        return createAgentMessage('bear_debater', 'supervisor', 'response', {
          arguments: result.data.arguments,
          duration: Date.now() - startTime,
        }, message.traceId);
      }

      // Fallback on failure
      const fallbackArguments: Argument[] = [
        { point: '技术面显示下降趋势', weight: 0.6, evidence: '基于可用数据分析' },
        { point: '市场情绪偏空', weight: 0.5, evidence: '资金流出迹象' },
        { point: '基本面存在压力', weight: 0.5, evidence: '估值偏高' },
      ];
      return createAgentMessage('bear_debater', 'supervisor', 'response', {
        arguments: fallbackArguments,
        duration: Date.now() - startTime,
      }, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('bear_debater', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};
