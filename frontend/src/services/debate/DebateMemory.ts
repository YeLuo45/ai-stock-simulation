/**
 * DebateMemory - 辩论历史持久化
 * Persists debate history using storage.ts
 */

import type { DebateResult, DebateRound } from './types';
import { load, save } from '../storage';

const DEBATE_HISTORY_KEY = 'ai-stock-debate-history';
const MAX_DEBATE_RECORDS = 100;

/**
 * Get all debate history records
 */
export function getDebateHistory(): DebateResult[] {
  return load<DebateResult[]>(DEBATE_HISTORY_KEY, []);
}

/**
 * Append a new debate result to history
 */
export function appendDebateHistory(result: DebateResult): void {
  const history = getDebateHistory();
  history.unshift(result);
  // Keep only last MAX_DEBATE_RECORDS
  const trimmed = history.slice(0, MAX_DEBATE_RECORDS);
  save(DEBATE_HISTORY_KEY, trimmed);
}

/**
 * Get debate history for a specific symbol
 */
export function getDebateHistoryBySymbol(symbol: string): DebateResult[] {
  const history = getDebateHistory();
  return history.filter(r => r.symbol === symbol);
}

/**
 * Get recent debate results (last N)
 */
export function getRecentDebates(limit: number = 10): DebateResult[] {
  const history = getDebateHistory();
  return history.slice(0, limit);
}

/**
 * Clear all debate history
 */
export function clearDebateHistory(): void {
  save(DEBATE_HISTORY_KEY, []);
}

/**
 * Get debate statistics
 */
export function getDebateStats(): {
  total: number;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  avgConfidence: number;
} {
  const history = getDebateHistory();
  if (history.length === 0) {
    return {
      total: 0,
      strongBuy: 0,
      buy: 0,
      hold: 0,
      sell: 0,
      strongSell: 0,
      avgConfidence: 0,
    };
  }

  const counts = {
    STRONG_BUY: 0,
    BUY: 0,
    HOLD: 0,
    SELL: 0,
    STRONG_SELL: 0,
  };

  let totalConfidence = 0;
  for (const r of history) {
    counts[r.decision]++;
    totalConfidence += r.confidence;
  }

  return {
    total: history.length,
    strongBuy: counts.STRONG_BUY,
    buy: counts.BUY,
    hold: counts.HOLD,
    sell: counts.SELL,
    strongSell: counts.STRONG_SELL,
    avgConfidence: totalConfidence / history.length,
  };
}

/**
 * Convert DebateRound (from existing agents) to DebateResult for memory storage
 */
export function debateRoundToResult(
  round: DebateRound,
  tradeAction: DebateResult['tradeAction'],
  tradeQuantityPct: number
): DebateResult {
  return {
    symbol: round.stockCode,
    decision: round.judgeVerdict.decision,
    confidence: round.judgeVerdict.confidence,
    bullScore: round.judgeVerdict.bullScore,
    bearScore: round.judgeVerdict.bearScore,
    bullArguments: round.bullArguments,
    bearArguments: round.bearArguments,
    reasoning: round.judgeVerdict.reasoning,
    timestamp: round.timestamp,
    tradeAction,
    tradeQuantityPct,
  };
}