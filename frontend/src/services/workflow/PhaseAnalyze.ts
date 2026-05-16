/**
 * PhaseAnalyze - Analyze Phase Implementation
 * Multi-factor scoring using factorComposer approach
 */
import type { WorkflowContext, WorkflowCandidate, PhaseResult, AnalyzeConfig } from './types';
import { StrategyPool } from '../regime';
import { getCurrentRegime } from '../regime/RegimeStore';

// Factor weights for multi-factor model (fallback defaults)
const DEFAULT_FACTOR_WEIGHTS: Record<string, number> = {
  pe: 0.2,
  pb: 0.15,
  roe: 0.25,
  volume: 0.2,
  change: 0.1,
  market_cap: 0.1,
};

export const PhaseAnalyze = {
  /**
   * Run the Analyze phase
   * Applies multi-factor scoring, takes topN, filters by icThreshold
   */
  async run(context: WorkflowContext, config: AnalyzeConfig): Promise<PhaseResult> {
    try {
      const candidates = context.candidates || [];
      
      if (candidates.length === 0) {
        return {
          phase: 'analyze',
          status: 'failed',
          success: false,
          error: 'No candidates from Scan phase',
          timestamp: Date.now(),
        };
      }

      // Score each candidate using multi-factor model
      const scoredCandidates = this.scoreCandidates(candidates, config.factors);
      
      // Sort by score descending
      scoredCandidates.sort((a, b) => (b.score || 0) - (a.score || 0));

      // Filter by IC threshold (mock - calculate correlation with returns)
      const icScores = this.calculateICS(scoredCandidates, config.factors);
      const filteredByIC = scoredCandidates.filter(c => 
        (icScores[c.symbol] || 0) >= config.icThreshold
      );

      // Take top N
      const topCandidates = filteredByIC.slice(0, config.topN);

      // Apply minScore filter if set
      const finalCandidates = config.minScore
        ? topCandidates.filter(c => (c.score || 0) >= config.minScore)
        : topCandidates;

      return {
        phase: 'analyze',
        status: 'completed',
        success: true,
        data: {
          scoredCandidates: filteredByIC,
          topCandidates: finalCandidates,
          icScores,
        },
        message: `分析完成：${scoredCandidates.length} 只股票经过 IC 过滤，选取前 ${finalCandidates.length} 只`,
      };
    } catch (err) {
      return {
        phase: 'analyze',
        status: 'failed',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  },

  /**
   * Score candidates using multi-factor model with regime-adaptive weights
   */
  scoreCandidates(candidates: WorkflowCandidate[], factors: string[]): WorkflowCandidate[] {
    // Get regime-adaptive factor weights
    const regime = getCurrentRegime();
    const poolConfig = StrategyPool.getConfig(regime);
    const regimeWeights = poolConfig.factorWeights;
    
    return candidates.map(candidate => {
      let totalScore = 0;
      let weightSum = 0;

      for (const factor of factors) {
        // Use regime-specific weight if available, otherwise use default
        const weight = regimeWeights[factor] ?? DEFAULT_FACTOR_WEIGHTS[factor] ?? 0.1;
        const factorValue = this.getFactorValue(candidate, factor);
        const normalizedValue = this.normalizeFactor(factor, factorValue, candidates);
        
        totalScore += normalizedValue * weight;
        weightSum += weight;
      }

      // Normalize score to 0-1 range
      const score = weightSum > 0 ? totalScore / weightSum : 0;

      return {
        ...candidate,
        score,
      };
    });
  },

  /**
   * Get factor value from candidate
   */
  getFactorValue(candidate: WorkflowCandidate, factor: string): number {
    switch (factor) {
      case 'pe':
        return candidate.pe ?? 10; // Default PE
      case 'pb':
        return candidate.pb ?? 1; // Default PB
      case 'roe':
        return candidate.roe ?? 5; // Default ROE
      case 'volume':
        return candidate.volume ?? 0;
      case 'change':
        return candidate.change_pct ?? 0;
      case 'market_cap':
        return candidate.market_cap ?? 0;
      default:
        return 0;
    }
  },

  /**
   * Normalize factor value to 0-1 range using min-max scaling
   */
  normalizeFactor(factor: string, value: number, candidates: WorkflowCandidate[]): number {
    const values = candidates.map(c => this.getFactorValue(c, factor));
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (max === min) return 0.5; // Avoid division by zero

    // For some factors, lower is better (pe, pb)
    if (factor === 'pe' || factor === 'pb') {
      return 1 - (value - min) / (max - min);
    }

    return (value - min) / (max - min);
  },

  /**
   * Calculate IC (Information Coefficient) scores
   * Mock implementation - in real would calculate correlation with forward returns
   */
  calculateICS(candidates: WorkflowCandidate[], factors: string[]): Record<string, number> {
    const icScores: Record<string, number> = {};

    for (const candidate of candidates) {
      // Mock IC calculation - random between 0 and 0.1
      // In real implementation, would calculate correlation with forward returns
      icScores[candidate.symbol] = Math.random() * 0.15;
    }

    return icScores;
  },
};