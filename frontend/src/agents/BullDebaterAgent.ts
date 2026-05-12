/**
 * BullDebaterAgent
 *多方辩手：列举买入/持有股票的多方论点（上涨理由、利好催化、技术突破、基本面改善）
 */

import { callWithJSONPrompt, hasApiKey } from './MiniMaxAgentService';
import type { Argument } from './messages';
import type { AgentName } from './messages';
import { createAgentMessage } from './messages';
import type { AgentMessage } from './messages';

export interface BullDebaterPayload {
  stockCode: string;
  analysisSummary: string;
}

const BULL_DEBATER_SYSTEM_PROMPT = `你是一位专业的基本面+技术面分析师，负责从多方角度为指定股票构建买入/持有论点。

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

export const BullDebaterAgent = {
  name: 'bull_debater' as AgentName,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('bull_debater', message.from as AgentName, 'error',
          { error: 'BullDebater expects request type' }, message.traceId);
      }

      const payload = message.payload as BullDebaterPayload;
      const { stockCode, analysisSummary } = payload;

      if (!stockCode) {
        return createAgentMessage('bull_debater', 'supervisor', 'response',
          { error: 'No stock code provided' }, message.traceId);
      }

      // If no API key, generate fallback arguments
      if (!hasApiKey()) {
        const fallbackArguments: Argument[] = [
          { point: '技术面显示上升趋势形成', weight: 0.7, evidence: 'MA多头排列' },
          { point: '成交量配合放大', weight: 0.6, evidence: '量价齐升' },
          { point: '基本面有望改善', weight: 0.5, evidence: '行业政策利好' },
        ];
        return createAgentMessage('bull_debater', 'supervisor', 'response', {
          arguments: fallbackArguments,
          duration: Date.now() - startTime,
        }, message.traceId);
      }

      const sessionId = message.traceId || `bull-${Date.now()}`;
      const userMessage = `股票代码: ${stockCode}

分析摘要:
${analysisSummary || '无可用分析摘要，请基于股票代码自行分析'}

请生成多方论点（买入/持有理由）：`;

      const result = await callWithJSONPrompt<{
        arguments: Argument[];
      }>(BULL_DEBATER_SYSTEM_PROMPT, userMessage, { sessionId, agentName: 'bull_debater' });

      if (result.success && result.data?.arguments) {
        return createAgentMessage('bull_debater', 'supervisor', 'response', {
          arguments: result.data.arguments,
          duration: Date.now() - startTime,
        }, message.traceId);
      }

      // Fallback on failure
      const fallbackArguments: Argument[] = [
        { point: '技术面显示上升趋势', weight: 0.6, evidence: '基于可用数据分析' },
        { point: '市场情绪偏多', weight: 0.5, evidence: '资金流入迹象' },
        { point: '基本面支撑股价', weight: 0.5, evidence: '估值合理' },
      ];
      return createAgentMessage('bull_debater', 'supervisor', 'response', {
        arguments: fallbackArguments,
        duration: Date.now() - startTime,
      }, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('bull_debater', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};
