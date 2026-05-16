/**
 * BullAgent - 多方辩手
 * Analyzes stock charts and factors, outputs buy arguments with confidence score
 */

import { callWithJSONPrompt, hasApiKey } from '../../agents/MiniMaxAgentService';
import type { DebateArgument } from './types';
import { createAgentMessage } from '../../agents/messages';
import type { AgentMessage } from '../../agents/messages';

export interface BullAgentPayload {
  stockCode: string;
  analysisSummary: string;
}

const BULL_AGENT_PROMPT = `你是一位专业的基本面+技术面分析师，负责从多方角度为指定股票构建买入/持有论点。

你的任务是分析股票的上涨理由、利好催化因素、技术突破信号和基本面改善证据。

请以JSON格式返回3-5条多方论点：
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
- 0.8-1.0: 核心驱动因素（最强论点）
- 0.6-0.8: 重要支撑因素
- 0.4-0.6: 次要因素
- 0.0-0.4: 边缘因素

只返回JSON，不要有其他文字。`;

export const BullAgent = {
  name: 'bull' as const,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('bull', message.from as any, 'error',
          { error: 'BullAgent expects request type' }, message.traceId);
      }

      const payload = message.payload as BullAgentPayload;
      const { stockCode, analysisSummary } = payload;

      if (!stockCode) {
        return createAgentMessage('bull', 'supervisor', 'response',
          { error: 'No stock code provided' }, message.traceId);
      }

      // If no API key, generate fallback arguments
      if (!hasApiKey()) {
        const fallbackArguments: DebateArgument[] = [
          { point: '技术面显示上升趋势形成', weight: 0.7, evidence: 'MA多头排列' },
          { point: '成交量配合放大', weight: 0.6, evidence: '量价齐升' },
          { point: '基本面有望改善', weight: 0.5, evidence: '行业政策利好' },
        ];
        return createAgentMessage('bull', 'supervisor', 'response', {
          arguments: fallbackArguments,
          confidence: 0.65,
          duration: Date.now() - startTime,
        }, message.traceId);
      }

      const sessionId = message.traceId || `bull-${Date.now()}`;
      const userMessage = `股票代码: ${stockCode}

分析摘要:
${analysisSummary || '无可用分析摘要，请基于股票代码自行分析'}

请生成多方论点（买入/持有理由）：`;

      const result = await callWithJSONPrompt<{
        arguments: DebateArgument[];
      }>(BULL_AGENT_PROMPT, userMessage, { sessionId, agentName: 'bull' });

      if (result.success && result.data?.arguments) {
        // Calculate average confidence from weights
        const avgConfidence = result.data.arguments.reduce((sum, a) => sum + a.weight, 0) / result.data.arguments.length;
        return createAgentMessage('bull', 'supervisor', 'response', {
          arguments: result.data.arguments,
          confidence: avgConfidence,
          duration: Date.now() - startTime,
        }, message.traceId);
      }

      // Fallback on failure
      const fallbackArguments: DebateArgument[] = [
        { point: '技术面显示上升趋势', weight: 0.6, evidence: '基于可用数据分析' },
        { point: '市场情绪偏多', weight: 0.5, evidence: '资金流入迹象' },
        { point: '基本面支撑股价', weight: 0.5, evidence: '估值合理' },
      ];
      return createAgentMessage('bull', 'supervisor', 'response', {
        arguments: fallbackArguments,
        confidence: 0.55,
        duration: Date.now() - startTime,
      }, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('bull', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};