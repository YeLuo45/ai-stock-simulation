/**
 * StrategySelector - Adaptive strategy selection based on market regime and historical patterns
 */

import type { DebateStrategy, MarketRegime } from './types';
import type { DebatePattern } from '../memory/PatternLearner';
import { getStrategyForRegime } from './strategies';

/**
 * Selection result with strategy and adjustment metadata
 */
export interface StrategySelectionResult {
  strategy: DebateStrategy;
  adjustedWeights: Record<string, number>;
  expectedConfidenceBoost: number;
  patternHint?: string;
}

export class StrategySelector {
  /**
   * Select the best strategy for the given market regime, adjusting weights
   * based on historical pattern performance
   */
  select(regime: MarketRegime, patterns: DebatePattern[] = []): StrategySelectionResult {
    // Get base strategy for regime
    const baseStrategy = getStrategyForRegime(regime);

    // Adjust weights based on pattern performance
    const adjustedWeights = this.adjustWeightsFromPatterns(baseStrategy.weights, patterns, regime);

    // Calculate expected confidence boost from patterns
    const expectedBoost = this.calculateConfidenceBoost(patterns, regime);

    // Get hint from best matching pattern
    const bestPattern = this.findBestPattern(patterns, regime);
    const patternHint = bestPattern?.hint;

    return {
      strategy: {
        ...baseStrategy,
        weights: adjustedWeights,
      },
      adjustedWeights,
      expectedConfidenceBoost: expectedBoost,
      patternHint,
    };
  }

  /**
   * Adjust agent weights based on historical pattern win rates
   * Agents that performed well in similar regimes get higher weights
   */
  private adjustWeightsFromPatterns(
    baseWeights: Record<string, number>,
    patterns: DebatePattern[],
    regime: string
  ): Record<string, number> {
    if (patterns.length === 0) {
      return { ...baseWeights };
    }

    // Find patterns matching this regime
    const matchingPatterns = patterns.filter(p => p.regime === regime);
    if (matchingPatterns.length === 0) {
      return { ...baseWeights };
    }

    const adjusted = { ...baseWeights };

    // Boost agents based on pattern win rates
    // High win rate patterns suggest favoring certain agent types
    const avgWinRate = matchingPatterns.reduce((sum, p) => sum + p.winRate, 0) / matchingPatterns.length;

    // If patterns show consistently high win rates, slightly increase confidence in all agents
    if (avgWinRate > 0.7) {
      for (const key of Object.keys(adjusted)) {
        adjusted[key] *= 1.05; // 5% boost for good historical performance
      }
    }

    // Look at specific indicators in patterns to determine which agents to favor
    for (const pattern of matchingPatterns) {
      // RSI-based indicators favor TechnicalAnalyst
      const hasRSI = pattern.indicators.some(i => i.startsWith('RSI'));
      if (hasRSI && adjusted.TechnicalAnalyst !== undefined) {
        adjusted.TechnicalAnalyst = Math.min(adjusted.TechnicalAnalyst * 1.1, 2.0);
      }

      // Volume indicators favor SentimentAnalyst
      const hasVolume = pattern.indicators.some(i => i.includes('volume'));
      if (hasVolume && adjusted.SentimentAnalyst !== undefined) {
        adjusted.SentimentAnalyst = Math.min(adjusted.SentimentAnalyst * 1.05, 2.0);
      }

      // MA cross indicators favor TechnicalAnalyst
      const hasMACross = pattern.indicators.some(i => i.includes('MA_cross'));
      if (hasMACross && adjusted.TechnicalAnalyst !== undefined) {
        adjusted.TechnicalAnalyst = Math.min(adjusted.TechnicalAnalyst * 1.08, 2.0);
      }

      // Trend indicators favor MarketAnalyst
      const hasTrend = pattern.indicators.some(i => i.includes('trend'));
      if (hasTrend && adjusted.MarketAnalyst !== undefined) {
        adjusted.MarketAnalyst = Math.min(adjusted.MarketAnalyst * 1.05, 2.0);
      }
    }

    return adjusted;
  }

  /**
   * Calculate expected confidence boost from historical patterns
   */
  private calculateConfidenceBoost(patterns: DebatePattern[], regime: string): number {
    if (patterns.length === 0) return 0;

    const matchingPatterns = patterns.filter(p => p.regime === regime);
    if (matchingPatterns.length === 0) return 0;

    // Higher average win rate and sample count = more confidence boost
    const avgWinRate = matchingPatterns.reduce((sum, p) => sum + p.winRate, 0) / matchingPatterns.length;
    const totalSamples = matchingPatterns.reduce((sum, p) => sum + p.sampleCount, 0);

    // More samples = more reliable = higher boost cap
    const sampleFactor = Math.min(totalSamples / 20, 1);

    // Win rate above 0.5 contributes to boost
    const winRateContribution = Math.max(0, avgWinRate - 0.5);

    return Math.min(winRateContribution * sampleFactor * 0.15, 0.15);
  }

  /**
   * Find the best matching pattern for the regime
   */
  private findBestPattern(patterns: DebatePattern[], regime: string): DebatePattern | undefined {
    const matching = patterns.filter(p => p.regime === regime);
    if (matching.length === 0) return undefined;

    // Sort by winRate descending, then by sampleCount descending
    return matching.sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.sampleCount - a.sampleCount;
    })[0];
  }

  /**
   * Get a summary of available strategies
   */
  getAvailableStrategies(): string[] {
    return ['bull_market', 'bear_market', 'sideways', 'volatile'];
  }
}

// Export singleton
export const strategySelector = new StrategySelector();
