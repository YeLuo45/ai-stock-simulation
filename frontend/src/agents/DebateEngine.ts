/**
 * DebateEngine
 * 辩论引擎：协调多方辩手、空方辩手和裁判Agent的辩论流程
 */

import { BullDebaterAgent } from './BullDebaterAgent';
import { BearDebaterAgent } from './BearDebaterAgent';
import { JudgeAgent } from './JudgeAgent';
import { appendDebateHistory } from './AgentMemory';
import { createAgentMessage } from './messages';
import type { Argument, DebateRound, JudgeVerdict } from './messages';
import type { Position } from '../types';
import type { AgentMessage } from './messages';

// Confidence thresholds for trade sizing
const CONFIDENCE_THRESHOLD_HIGH = 0.7;  // >= 0.7: full position
const CONFIDENCE_THRESHOLD_MED = 0.4;   // >= 0.4: 50% position
const CONFIDENCE_THRESHOLD_LOW = 0.4;   // < 0.4: skip

export interface DebateResult {
  debateRound: DebateRound;
  tradeAction: 'BUY' | 'SELL' | 'HOLD' | 'SKIP';
  tradeQuantityPct: number; // 0-100, percentage of recommended position size
  confidence: number;
}

export interface DebateEnginePayload {
  stockCode: string;
  analysisSummary: string;
  positions: Position[];
  portfolioCash: number;
  traceId?: string;
}

export class DebateEngine {
  /**
   * Run a full debate cycle for a stock
   * 1. Parallel: BullDebater + BearDebater
   * 2. JudgeAgent evaluates both sides
   * 3. Returns DebateRound with trade recommendation
   */
  static async runDebate(payload: DebateEnginePayload): Promise<DebateResult> {
    const { stockCode, analysisSummary, positions, portfolioCash, traceId } = payload;
    const sessionId = traceId || `debate-${Date.now()}`;
    const round = 1;

    // Step 1: Parallel debate by bull and bear agents
    const [bullResponse, bearResponse] = await Promise.all([
      BullDebaterAgent.process(createAgentMessage(
        'bull_debater',
        'supervisor',
        'request',
        { stockCode, analysisSummary },
        sessionId
      )),
      BearDebaterAgent.process(createAgentMessage(
        'bear_debater',
        'supervisor',
        'request',
        { stockCode, analysisSummary },
        sessionId
      )),
    ]);

    // Extract arguments from responses
    const bullPayload = bullResponse.payload as { arguments?: Argument[] };
    const bearPayload = bearResponse.payload as { arguments?: Argument[] };
    const bullArguments: Argument[] = bullPayload?.arguments || [];
    const bearArguments: Argument[] = bearPayload?.arguments || [];

    // Step 2: Judge evaluates both sides
    const judgeResponse = await JudgeAgent.process(createAgentMessage(
      'judge',
      'supervisor',
      'request',
      {
        stockCode,
        bullArguments,
        bearArguments,
        positions,
        portfolioCash,
      },
      sessionId
    ));

    const judgePayload = judgeResponse.payload as { verdict?: JudgeVerdict };
    const judgeVerdict: JudgeVerdict = judgePayload?.verdict || {
      decision: 'HOLD',
      confidence: 0,
      bullScore: 0,
      bearScore: 0,
      reasoning: 'Judge evaluation failed',
    };

    // Step 3: Build debate round
    const debateRound: DebateRound = {
      stockCode,
      round,
      bullArguments,
      bearArguments,
      judgeVerdict,
      timestamp: Date.now(),
    };

    // Step 4: Determine trade action based on confidence
    const { decision, confidence } = judgeVerdict;
    let tradeAction: DebateResult['tradeAction'];
    let tradeQuantityPct: number;

    if (confidence < CONFIDENCE_THRESHOLD_LOW) {
      tradeAction = 'SKIP';
      tradeQuantityPct = 0;
    } else if (confidence >= CONFIDENCE_THRESHOLD_HIGH) {
      tradeAction = decision;
      tradeQuantityPct = 100;
    } else {
      // Medium confidence: 50% position
      tradeAction = decision === 'HOLD' ? 'SKIP' : decision;
      tradeQuantityPct = 50;
    }

    // Step 5: Store debate in AgentMemory
    try {
      appendDebateHistory(debateRound);
    } catch (err) {
      console.warn('Failed to store debate in memory:', err);
    }

    return {
      debateRound,
      tradeAction,
      tradeQuantityPct,
      confidence,
    };
  }

  /**
   * Calculate position size based on confidence
   */
  static calculatePositionSize(
    confidence: number,
    baseAmount: number
  ): { amount: number; pct: number } {
    if (confidence >= CONFIDENCE_THRESHOLD_HIGH) {
      return { amount: baseAmount, pct: 100 };
    } else if (confidence >= CONFIDENCE_THRESHOLD_MED) {
      return { amount: baseAmount * 0.5, pct: 50 };
    }
    return { amount: 0, pct: 0 };
  }
}
