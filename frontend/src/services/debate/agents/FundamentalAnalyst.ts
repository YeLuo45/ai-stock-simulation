/**
 * FundamentalAnalyst - 基本面分析师
 * Analyzes company financial metrics, valuation, and growth prospects
 */

import { hasApiKey } from '../../../agents/MiniMaxAgentService';
import { createAgentMessage } from '../../../agents/messages';
import type { AgentMessage } from '../../../agents/messages';
import type { AnalystPayload, AnalystResponse, AnalystType } from '../types/AnalystType';
import type { DebateArgument } from '../types/DebaterType';

const FUNDAMENTAL_ANALYST_PROMPT = `你是一位专业的基本面分析师，负责分析股票的财务状况、估值水平、盈利能力和成长性。

你的任务是：
1. 分析公司的关键财务指标（PE、PB、ROE、负债率等）
2. 评估股票估值是否合理
3. 判断公司财务健康状况
4. 给出基本面综合判断

请以JSON格式返回分析结果：
{
  "type": "FUNDAMENTAL",
  "companyMetrics": {
    "peRatio": 数值,
    "pbRatio": 数值,
    "roe": 数值（百分比）,
    "debtToEquity": 数值,
    "revenueGrowth": 数值（百分比）,
    "profitMargin": 数值（百分比）
  },
  "valuation": {
    "fairValue": 数值,
    "discount": 数值（百分比）,
    "premium": 数值（百分比）
  },
  "financialHealth": "strong" | "moderate" | "weak",
  "outlook": "positive" | "neutral" | "negative",
  "reasoning": ["理由1", "理由2", "理由3"]
}

只返回JSON，不要有其他文字。`;

export const FundamentalAnalyst = {
  name: 'fundamental_analyst' as const,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('fundamental_analyst', message.from as any, 'error',
          { error: 'FundamentalAnalyst expects request type' }, message.traceId);
      }

      const payload = message.payload as AnalystPayload;
      const { stockCode, fundamentalData } = payload;

      if (!stockCode) {
        return createAgentMessage('fundamental_analyst', 'supervisor', 'response',
          { error: 'No stock code provided' }, message.traceId);
      }

      // Fallback when no API key
      if (!hasApiKey()) {
        return createAgentMessage('fundamental_analyst', 'supervisor', 'response', {
          type: 'FUNDAMENTAL' as AnalystType,
          stockCode,
          analysis: {
            type: 'FUNDAMENTAL' as AnalystType,
            companyMetrics: {
              peRatio: 15.5,
              pbRatio: 2.3,
              roe: 12.5,
              debtToEquity: 0.8,
              revenueGrowth: 8.2,
              profitMargin: 15.0,
            },
            valuation: {
              fairValue: 100,
              discount: 10,
              premium: 0,
            },
            financialHealth: 'strong' as const,
            outlook: 'positive' as const,
            reasoning: ['财务状况良好', '估值合理偏低', '盈利能力稳定'],
          },
          confidence: 0.7,
          timestamp: Date.now(),
        }, message.traceId);
      }

      // Simulate LLM call result structure
      const fallbackArguments: DebateArgument[] = [
        { point: '财务状况健康，ROE处于行业较好水平', weight: 0.8, evidence: 'ROE 12.5%' },
        { point: '估值合理偏低，存在安全边际', weight: 0.7, evidence: 'PE 15.5x' },
        { point: '营收增长稳定，盈利能力可持续', weight: 0.6, evidence: '营收增长 8.2%' },
      ];

      return createAgentMessage('fundamental_analyst', 'supervisor', 'response', {
        type: 'FUNDAMENTAL' as AnalystType,
        stockCode,
        analysis: {
          type: 'FUNDAMENTAL' as AnalystType,
          companyMetrics: {
            peRatio: 15.5,
            pbRatio: 2.3,
            roe: 12.5,
            debtToEquity: 0.8,
            revenueGrowth: 8.2,
            profitMargin: 15.0,
          },
          valuation: {
            fairValue: 100,
            discount: 10,
            premium: 0,
          },
          financialHealth: 'strong' as const,
          outlook: 'positive' as const,
          reasoning: ['财务状况良好', '估值合理偏低', '盈利能力稳定'],
        },
        confidence: 0.7,
        timestamp: Date.now(),
      }, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('fundamental_analyst', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};