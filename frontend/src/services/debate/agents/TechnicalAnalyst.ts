/**
 * TechnicalAnalyst - 技术分析师
 * Analyzes stock price patterns, indicators, and trading signals
 */

import { hasApiKey } from '../../../agents/MiniMaxAgentService';
import { createAgentMessage } from '../../../agents/messages';
import type { AgentMessage } from '../../../agents/messages';
import type { AnalystPayload, AnalystResponse, AnalystType } from '../types/AnalystType';
import type { DebateArgument } from '../types/DebaterType';

const TECHNICAL_ANALYST_PROMPT = `你是一位专业的技术分析师，负责分析股票的价格走势、技术指标和交易信号。

你的任务是：
1. 识别价格形态和趋势
2. 分析关键技术指标（MA、RSI、MACD等）
3. 找出支撑位和压力位
4. 给出技术面综合判断

请以JSON格式返回分析结果：
{
  "type": "TECHNICAL",
  "patterns": {
    "trend": "bullish" | "bearish" | "neutral",
    "patternType": "形态描述",
    "confidence": 0.0-1.0
  },
  "indicators": {
    "ma20": 数值,
    "ma60": 数值,
    "rsi": 数值,
    "macd": {
      "value": 数值,
      "signal": 数值,
      "histogram": 数值
    }
  },
  "support": 数值,
  "resistance": 数值,
  "outlook": "positive" | "neutral" | "negative",
  "reasoning": ["理由1", "理由2", "理由3"]
}

只返回JSON，不要有其他文字。`;

export const TechnicalAnalyst = {
  name: 'technical_analyst' as const,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('technical_analyst', message.from as any, 'error',
          { error: 'TechnicalAnalyst expects request type' }, message.traceId);
      }

      const payload = message.payload as AnalystPayload;
      const { stockCode, marketData } = payload;

      if (!stockCode) {
        return createAgentMessage('technical_analyst', 'supervisor', 'response',
          { error: 'No stock code provided' }, message.traceId);
      }

      // Calculate basic indicators from market data
      let ma20 = 0, ma60 = 0, rsi = 50;
      if (marketData && marketData.length > 0) {
        const closes = marketData.map(d => d.close);
        ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
        ma60 = closes.slice(-60).reduce((a, b) => a + b, 0) / Math.min(60, closes.length);
        // Simple RSI approximation
        const gains = closes.slice(-14).filter((v, i, arr) => i > 0 && v > arr[i - 1]);
        const losses = closes.slice(-14).filter((v, i, arr) => i > 0 && v < arr[i - 1]);
        const avgGain = gains.reduce((a, b) => a + b, 0) / 14;
        const avgLoss = losses.reduce((a, b) => a + b, 0) / 14;
        rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }

      const trend = ma20 > ma60 ? 'bullish' : ma20 < ma60 ? 'bearish' : 'neutral';
      const currentPrice = marketData?.[marketData.length - 1]?.close || 100;

      return createAgentMessage('technical_analyst', 'supervisor', 'response', {
        type: 'TECHNICAL' as AnalystType,
        stockCode,
        analysis: {
          type: 'TECHNICAL' as AnalystType,
          patterns: {
            trend: trend as 'bullish' | 'bearish' | 'neutral',
            patternType: trend === 'bullish' ? '上升趋势' : trend === 'bearish' ? '下降趋势' : '盘整',
            confidence: 0.7,
          },
          indicators: {
            ma20,
            ma60,
            rsi: Math.round(rsi * 100) / 100,
            macd: {
              value: ma20 - ma60,
              signal: 0,
              histogram: ma20 - ma60,
            },
          },
          support: currentPrice * 0.95,
          resistance: currentPrice * 1.05,
          outlook: trend === 'bullish' ? 'positive' : trend === 'bearish' ? 'negative' : 'neutral',
          reasoning: [
            `${trend === 'bullish' ? 'MA多头排列' : trend === 'bearish' ? 'MA空头排列' : 'MA纠缠'}，MA20=${ma20.toFixed(2)}，MA60=${ma60.toFixed(2)}`,
            `RSI=${rsi.toFixed(2)}，${rsi > 70 ? '超买区域' : rsi < 30 ? '超卖区域' : '正常区域'}`,
            `当前价格${currentPrice.toFixed(2)}处于${trend === 'bullish' ? '上升通道' : trend === 'bearish' ? '下降通道' : '震荡区间'}`,
          ],
        },
        confidence: 0.7,
        timestamp: Date.now(),
      }, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('technical_analyst', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};