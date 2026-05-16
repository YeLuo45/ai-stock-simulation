/**
 * PhaseDebate - Debate Phase Implementation
 * Reuses DebateSupervisor for LLM-driven Bull/Bear/Judge debate
 */
import type { WorkflowContext, WorkflowCandidate, DebateDecision, PhaseResult, DebateConfig } from './types';
import { DebateSupervisor, type DebateSupervisorPayload } from '../debate/DebateSupervisor';

export const PhaseDebate = {
  /**
   * Run the Debate phase for each candidate
   * Uses DebateSupervisor.run() for each symbol
   */
  async run(context: WorkflowContext, config: DebateConfig): Promise<PhaseResult> {
    try {
      const candidates = context.scoredCandidates || context.candidates || [];
      
      if (candidates.length === 0) {
        return {
          phase: 'debate',
          status: 'failed',
          success: false,
          error: 'No candidates from Analyze phase',
          timestamp: Date.now(),
        };
      }

      const decisions: DebateDecision[] = [];
      let totalConfidence = 0;

      // Run debate for each candidate (limit to maxRounds)
      const symbolsToDebate = candidates.slice(0, config.maxRounds * 3 || candidates.length);

      for (const candidate of symbolsToDebate) {
        const result = await this.runDebateForSymbol(candidate, context);
        
        if (result) {
          decisions.push(result);
          totalConfidence += result.confidence;
        }
      }

      // Filter by confidence threshold
      const qualifiedDecisions = decisions.filter(d => 
        d.confidence >= config.confidenceThreshold && d.tradeAction !== 'SKIP'
      );

      const avgConfidence = decisions.length > 0 
        ? totalConfidence / decisions.length 
        : 0;

      return {
        phase: 'debate',
        status: 'completed',
        success: true,
        data: {
          decisions: qualifiedDecisions,
          avgConfidence,
        },
        message: `辩论完成：${decisions.length} 只股票参与辩论，平均置信度 ${(avgConfidence * 100).toFixed(0)}%`,
      };
    } catch (err) {
      return {
        phase: 'debate',
        status: 'failed',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  },

  /**
   * Run debate for a single symbol using DebateSupervisor
   */
  async runDebateForSymbol(
    candidate: WorkflowCandidate,
    context: WorkflowContext
  ): Promise<DebateDecision | null> {
    try {
      // Build analysis summary for the debate
      const analysisSummary = this.buildAnalysisSummary(candidate);

      const payload: DebateSupervisorPayload = {
        stockCode: candidate.symbol,
        analysisSummary,
        positions: context.positions,
        portfolioCash: context.portfolioCash,
      };

      const result = await DebateSupervisor.run(payload);

      if (result.success && result.result) {
        const debateResult = result.result;
        return {
          symbol: candidate.symbol,
          name: candidate.name,
          decision: debateResult.decision,
          confidence: debateResult.confidence,
          bullScore: debateResult.bullScore,
          bearScore: debateResult.bearScore,
          reasoning: debateResult.reasoning,
          tradeAction: debateResult.tradeAction || 'SKIP',
          quantityPct: debateResult.tradeQuantityPct || 0,
        };
      }

      // If debate failed, return a HOLD decision with low confidence
      return {
        symbol: candidate.symbol,
        name: candidate.name,
        decision: 'HOLD',
        confidence: 0.2,
        bullScore: 0,
        bearScore: 0,
        reasoning: result.error || '辩论失败',
        tradeAction: 'SKIP',
        quantityPct: 0,
      };
    } catch (err) {
      console.error(`Debate failed for ${candidate.symbol}:`, err);
      return null;
    }
  },

  /**
   * Build analysis summary string for debate
   */
  buildAnalysisSummary(candidate: WorkflowCandidate): string {
    const parts: string[] = [];

    if (candidate.score !== undefined) {
      parts.push(`多因子评分: ${(candidate.score * 100).toFixed(1)}分`);
    }

    if (candidate.pe !== undefined) {
      parts.push(`市盈率(PE): ${candidate.pe.toFixed(2)}`);
    }

    if (candidate.roe !== undefined) {
      parts.push(`净资产收益率(ROE): ${candidate.roe.toFixed(2)}%`);
    }

    if (candidate.change_pct !== undefined) {
      parts.push(`今日涨跌: ${candidate.change_pct > 0 ? '+' : ''}${candidate.change_pct.toFixed(2)}%`);
    }

    if (candidate.volume !== undefined) {
      parts.push(`成交量: ${(candidate.volume / 10000).toFixed(0)}万`);
    }

    return parts.join(' | ');
  },
};