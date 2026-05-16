/**
 * DebateSupervisor - 辩论编排器
 * Orchestrates the 3-round debate flow: Bull + Bear parallel → Judge summary
 */

import { BullAgent } from './BullAgent';
import { BearAgent } from './BearAgent';
import { JudgeAgent, type JudgeAgentPayload } from './JudgeAgent';
import type { DebateResult, DebateArgument } from './types';
import { appendDebateHistory, debateRoundToResult } from './DebateMemory';
import { createAgentMessage } from '../../agents/messages';
import type { Position } from '../../types';

// Confidence thresholds for trade sizing
const CONFIDENCE_THRESHOLD_HIGH = 0.7;   // >= 0.7: full position
const CONFIDENCE_THRESHOLD_MED = 0.4;    // >= 0.4: 50% position
const CONFIDENCE_THRESHOLD_LOW = 0.4;   // < 0.4: skip

export interface DebateSupervisorPayload {
  stockCode: string;
  analysisSummary: string;
  positions: Position[];
  portfolioCash: number;
}

export interface DebateSupervisorResult {
  success: boolean;
  result?: DebateResult;
  error?: string;
}

export const DebateSupervisor = {
  name: 'debate_supervisor' as const,

  /**
   * Run a full debate cycle for a stock
   * 1. Bull + Bear in parallel
   * 2. Judge evaluates both sides
   * 3. Returns DebateResult with trade recommendation
   */
  async run(payload: DebateSupervisorPayload): Promise<DebateSupervisorResult> {
    const { stockCode, analysisSummary, positions, portfolioCash } = payload;
    const sessionId = `debate-${Date.now()}`;

    try {
      // Step 1: Parallel debate by bull and bear agents
      const [bullResponse, bearResponse] = await Promise.all([
        BullAgent.process(createAgentMessage(
          'bull',
          'debate_supervisor',
          'request',
          { stockCode, analysisSummary },
          sessionId
        )),
        BearAgent.process(createAgentMessage(
          'bear',
          'debate_supervisor',
          'request',
          { stockCode, analysisSummary },
          sessionId
        )),
      ]);

      // Extract arguments from responses
      const bullPayload = bullResponse.payload as { arguments?: DebateArgument[]; confidence?: number };
      const bearPayload = bearResponse.payload as { arguments?: DebateArgument[]; confidence?: number };
      const bullArguments: DebateArgument[] = bullPayload?.arguments || [];
      const bearArguments: DebateArgument[] = bearPayload?.arguments || [];

      // Step 2: Judge evaluates both sides
      const judgePayload: JudgeAgentPayload = {
        stockCode,
        bullArguments,
        bearArguments,
        positions,
        portfolioCash,
      };

      const judgeResponse = await JudgeAgent.process(createAgentMessage(
        'judge',
        'debate_supervisor',
        'request',
        judgePayload,
        sessionId
      ));

      const judgeData = judgeResponse.payload as {
        decision: DebateResult['decision'];
        confidence: number;
        bullScore: number;
        bearScore: number;
        reasoning: string;
      };

      // Step 3: Determine trade action based on confidence
      const { decision, confidence } = judgeData;
      let tradeAction: DebateResult['tradeAction'];
      let tradeQuantityPct: number;

      if (confidence < CONFIDENCE_THRESHOLD_LOW) {
        tradeAction = 'SKIP';
        tradeQuantityPct = 0;
      } else if (confidence >= CONFIDENCE_THRESHOLD_HIGH) {
        tradeAction = decision === 'STRONG_BUY' || decision === 'BUY' ? 'BUY' :
                       decision === 'STRONG_SELL' || decision === 'SELL' ? 'SELL' : 'HOLD';
        tradeQuantityPct = 100;
      } else {
        // Medium confidence: 50% position
        tradeAction = (decision === 'HOLD' || decision === 'STRONG_SELL' || decision === 'SELL')
          ? 'SKIP'
          : decision === 'STRONG_BUY' || decision === 'BUY' ? 'BUY' : 'HOLD';
        tradeQuantityPct = 50;
      }

      // Build debate result
      const result: DebateResult = {
        symbol: stockCode,
        decision,
        confidence,
        bullScore: judgeData.bullScore || 0,
        bearScore: judgeData.bearScore || 0,
        bullArguments,
        bearArguments,
        reasoning: judgeData.reasoning || '无推理过程',
        timestamp: Date.now(),
        tradeAction,
        tradeQuantityPct,
      };

      // Step 4: Store debate in memory
      try {
        appendDebateHistory(result);
      } catch (err) {
        console.warn('Failed to store debate in memory:', err);
      }

      return { success: true, result };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Run debates for multiple symbols
   */
  async runMultiple(symbols: string[], getAnalysisSummary: (symbol: string) => string): Promise<DebateSupervisorResult[]> {
    const results: DebateSupervisorResult[] = [];
    for (const symbol of symbols) {
      const summary = getAnalysisSummary(symbol);
      const result = await this.run({
        stockCode: symbol,
        analysisSummary: summary,
        positions: [],
        portfolioCash: 1000000,
      });
      results.push(result);
    }
    return results;
  },
};