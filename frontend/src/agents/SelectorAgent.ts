/**
 * Selector Agent
 * Candidate stock screening using multi-factor scoring
 * Supports MiniMax API LLM-driven decision when API key is available
 */

import { screenFactors } from '../services/factorEngine';
import type { AgentMessage, AgentName, SelectedSignal } from './messages';
import { createAgentMessage } from './messages';
import type { FactorWeight, FactorScreenerResult } from '../types';
import { hasApiKey, callWithJSONPrompt, saveAgentLLMOutput, getAgentSession } from './MiniMaxAgentService';
import { buildContextSummary } from './AgentSession';

export interface SelectorPayload {
  candidates: string[];
  factors: FactorWeight[];
  limit?: number;
}

function selectTopCandidate(results: FactorScreenerResult[]): SelectedSignal | undefined {
  if (results.length === 0) return undefined;
  const top = results[0];
  return {
    symbol: top.symbol,
    score: top.composite_score,
    reason: `综合评分 ${top.composite_score.toFixed(3)}，排名第 ${top.rank}`,
    timestamp: Date.now(),
  };
}

const SELECTOR_SYSTEM_PROMPT = `你是一位多因子选股专家，基于账户余额、持仓和市场快照，从候选股中选择最优1~3只，给出选股理由。

请从以下候选股票中选择最优的1-3只，返回JSON格式：
{
  "selections": [
    {"symbol": "股票代码", "score": 0.85, "reason": "选股理由"}
  ]
}

评分范围0-1，考虑因素：
1. 账户现金余额是否充足
2. 当前持仓分布和集中度
3. 市场行情趋势
4. 股票的流动性和基本面

只返回JSON，不要有其他文字。`;

function selectWithFactors(
  candidates: string[],
  factors: FactorWeight[],
  limit: number
): { candidates: FactorScreenerResult[]; topSignal: SelectedSignal | undefined } {
  const results = screenFactors({
    symbols: candidates,
    factors,
    limit,
    sort_by: 'composite_score',
    sort_desc: true,
  });
  const topSignal = selectTopCandidate(results);
  return { candidates: results, topSignal };
}

export const SelectorAgent = {
  name: 'selector' as AgentName,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('selector', message.from as AgentName, 'error',
          { error: 'Selector expects request type' }, message.traceId);
      }

      const payload = message.payload as SelectorPayload;
      const { candidates, factors, limit = 5 } = payload;

      if (!candidates || candidates.length === 0) {
        return createAgentMessage('selector', 'supervisor', 'response',
          { error: 'No candidates provided' }, message.traceId);
      }

      if (!factors || factors.length === 0) {
        return createAgentMessage('selector', 'supervisor', 'error',
          { error: 'No factors provided' }, message.traceId);
      }

      const sessionId = message.traceId || `selector-${Date.now()}`;
      let results: FactorScreenerResult[] = [];
      let topSignal: SelectedSignal | undefined;

      if (hasApiKey()) {
        try {
          const session = getAgentSession(sessionId);
          const contextSummary = session ? buildContextSummary(session) : '无可用上下文';

          const userMessage = `候选股票列表: ${candidates.join(', ')}

${contextSummary}

请选择最优1-3只股票进行投资。`;

          const llmResult = await callWithJSONPrompt<{
            selections: Array<{ symbol: string; score: number; reason: string }>;
          }>(SELECTOR_SYSTEM_PROMPT, userMessage, { sessionId, agentName: 'selector' });

          if (llmResult.success && llmResult.data?.selections) {
            const selections = llmResult.data.selections;
            const selectedSymbols = selections.map(s => s.symbol);
            results = screenFactors({
              symbols: selectedSymbols,
              factors,
              limit: selections.length,
              sort_by: 'composite_score',
              sort_desc: true,
            });

            if (selections.length > 0) {
              const topSelection = selections[0];
              const topResult = results.find(r => r.symbol === topSelection.symbol) || results[0];
              topSignal = {
                symbol: topSelection.symbol,
                score: topSelection.score || topResult?.composite_score || 0,
                reason: topSelection.reason || `综合评分 ${topResult?.composite_score.toFixed(3)}`,
                timestamp: Date.now(),
              };
            }

            saveAgentLLMOutput(sessionId, 'selector', {
              agentName: 'selector',
              sessionId,
              timestamp: Date.now(),
              llmResponse: JSON.stringify(llmResult.data),
              parsedOutput: llmResult.data as Record<string, unknown>,
              latency: Date.now() - startTime,
            });
          } else {
            const fallback = selectWithFactors(candidates, factors, limit);
            results = fallback.candidates;
            topSignal = fallback.topSignal;
          }
        } catch (llmErr) {
          const fallback = selectWithFactors(candidates, factors, limit);
          results = fallback.candidates;
          topSignal = fallback.topSignal;
        }
      } else {
        const fallback = selectWithFactors(candidates, factors, limit);
        results = fallback.candidates;
        topSignal = fallback.topSignal;
      }

      const responsePayload = {
        candidates: results,
        topSignal,
        duration: Date.now() - startTime,
      };

      return createAgentMessage('selector', 'supervisor', 'response', responsePayload, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('selector', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};
