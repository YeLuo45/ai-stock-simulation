/**
 * Selector Agent
 * Candidate stock screening using multi-factor scoring
 */

import { screenFactors } from '../services/factorEngine';
import type { AgentMessage, AgentName, SelectedSignal } from './messages';
import { createAgentMessage } from './messages';
import type { FactorWeight, FactorScreenerResult } from '../types';

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

export const SelectorAgent = {
  name: 'selector' as AgentName,

  process(message: AgentMessage): AgentMessage {
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

      // Use factorEngine's screenFactors for multi-factor scoring
      const results = screenFactors({
        symbols: candidates,
        factors,
        limit,
        sort_by: 'composite_score',
        sort_desc: true,
      });

      const topSignal = selectTopCandidate(results);

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
