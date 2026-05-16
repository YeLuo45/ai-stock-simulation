/**
 * BearAgent - 空方辩手
 * Analyzes stock charts and factors, outputs sell/avoid arguments with confidence score
 */

import { callWithJSONPrompt, hasApiKey } from '../../agents/MiniMaxAgentService';
import type { DebateArgument } from './types';
import { createAgentMessage } from '../../agents/messages';
import type { AgentMessage } from '../../agents/messages';

export interface BearAgentPayload {
  stockCode: string;
  analysisSummary: string;
}

const BEAR_AGENT_PROMPT = `你是一位专业的基本面+技术面分析师，负责从空方角度为指定股票构建卖出/回避论点。

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

export const BearAgent = {
  name: 'bear' as const,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('bear', message.from as any, 'error',
          { error: 'BearAgent expects request type' }, message.traceId);
      }

      const payload = message.payload as BearAgentPayload;
      const { stockCode, analysisSummary } = payload;

      if (!stockCode) {
        return createAgentMessage('bear', 'supervisor', 'response',
          { error: 'No stock code provided' }, message.traceId);
      }

      // If no API key, generate fallback arguments
      if (!hasApiKey()) {
        const fallbackArguments: DebateArgument[] = [
          { point: '技术面显示下降趋势形成', weight: 0.7, evidence: 'MA空头排列' },
          { point: '成交量萎缩', weight: 0.6, evidence: '量价背离' },
          { point: '基本面存在不确定性', weight: 0.5, evidence: '行业政策风险' },
        ];
        return createAgentMessage('bear', 'supervisor', 'response', {
          arguments: fallbackArguments,
          confidence: 0.6,
          duration: Date.now() - startTime,
        }, message.traceId);
      }

      const sessionId = message.traceId || `bear-${Date.now()}`;
      const userMessage = `股票代码: ${stockCode}

分析摘要:
${analysisSummary || '无可用分析摘要，请基于股票代码自行分析'}

请生成空方论点（卖出/回避理由）：`;

      const result = await callWithJSONPrompt<{
        arguments: DebateArgument[];
      }>(BEAR_AGENT_PROMPT, userMessage, { sessionId, agentName: 'bear' });

      if (result.success && result.data?.arguments) {
        // Calculate average confidence from weights
        const avgConfidence = result.data.arguments.reduce((sum, a) => sum + a.weight, 0) / result.data.arguments.length;
        return createAgentMessage('bear', 'supervisor', 'response', {
          arguments: result.data.arguments,
          confidence: avgConfidence,
          duration: Date.now() - startTime,
        }, message.traceId);
      }

      // Fallback on failure
      const fallbackArguments: DebateArgument[] = [
        { point: '技术面显示下降趋势', weight: 0.6, evidence: '基于可用数据分析' },
        { point: '市场情绪偏空', weight: 0.5, evidence: '资金流出迹象' },
        { point: '基本面存在压力', weight: 0.5, evidence: '估值偏高' },
      ];
      return createAgentMessage('bear', 'supervisor', 'response', {
        arguments: fallbackArguments,
        confidence: 0.55,
        duration: Date.now() - startTime,
      }, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('bear', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};