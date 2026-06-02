/**
 * Tests for StrategySelector - Adaptive strategy selection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrategySelector, strategySelector } from '../strategy/StrategySelector';
import type { DebatePattern } from '../strategy/StrategySelector';
import type { DebatePattern as PatternLearnerPattern } from '../memory/PatternLearner';

describe('StrategySelector', () => {
  let selector: StrategySelector;

  beforeEach(() => {
    selector = new StrategySelector();
  });

  describe('select()', () => {
    it('should select bull_market_aggressive for bull_market regime', () => {
      const result = selector.select('bull_market', []);
      expect(result.strategy.name).toBe('bull_market_aggressive');
      expect(result.strategy.regime).toBe('bull_market');
      expect(result.strategy.weights.TechnicalAnalyst).toBeGreaterThan(1);
    });

    it('should select bear_market_defensive for bear_market regime', () => {
      const result = selector.select('bear_market', []);
      expect(result.strategy.name).toBe('bear_market_defensive');
      expect(result.strategy.regime).toBe('bear_market');
      expect(result.strategy.weights.RiskAnalyst).toBeGreaterThan(1);
    });

    it('should select sideways_range_bound for sideways regime', () => {
      const result = selector.select('sideways', []);
      expect(result.strategy.name).toBe('sideways_range_bound');
      expect(result.strategy.regime).toBe('sideways');
    });

    it('should select volatile_protective for volatile regime', () => {
      const result = selector.select('volatile', []);
      expect(result.strategy.name).toBe('volatile_protective');
      expect(result.strategy.regime).toBe('volatile');
      expect(result.strategy.weights.RiskAnalyst).toBe(1.4);
    });

    it('should adjust weights from patterns when provided', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bull',
          regime: 'bull_market',
          indicators: ['RSI<30', 'MA_cross_up'],
          winRate: 0.85,
          sampleCount: 10,
          hint: 'Test hint',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.adjustedWeights).toBeDefined();
      expect(result.strategy.weights).toBeDefined();
    });

    it('should return expectedConfidenceBoost when patterns provided', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bull',
          regime: 'bull_market',
          indicators: ['RSI<30'],
          winRate: 0.8,
          sampleCount: 5,
          hint: 'Test hint',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.expectedConfidenceBoost).toBeGreaterThanOrEqual(0);
    });

    it('should include patternHint from best matching pattern', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bull',
          regime: 'bull_market',
          indicators: ['RSI<30'],
          winRate: 0.8,
          sampleCount: 10,
          hint: 'Oversold bounce signal',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.patternHint).toBe('Oversold bounce signal');
    });

    it('should handle empty patterns array', () => {
      const result = selector.select('bull_market', []);
      expect(result.expectedConfidenceBoost).toBe(0);
      expect(result.patternHint).toBeUndefined();
    });

    it('should return correct phases in strategy', () => {
      const result = selector.select('bull_market', []);
      expect(result.strategy.phases).toBeInstanceOf(Array);
      expect(result.strategy.phases.length).toBeGreaterThan(0);
    });

    it('should return correct minConfidence in strategy', () => {
      const bullResult = selector.select('bull_market', []);
      const bearResult = selector.select('bear_market', []);
      expect(bullResult.strategy.minConfidence).toBe(0.65);
      expect(bearResult.strategy.minConfidence).toBe(0.70);
    });
  });

  describe('weight adjustment from patterns', () => {
    it('should boost TechnicalAnalyst for RSI-based patterns', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bull',
          regime: 'bull_market',
          indicators: ['RSI<30', 'RSI>70'],
          winRate: 0.7,
          sampleCount: 5,
          hint: 'Test',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.adjustedWeights.TechnicalAnalyst).toBeGreaterThan(1.2);
    });

    it('should boost SentimentAnalyst for volume-based patterns', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bull',
          regime: 'bull_market',
          indicators: ['volume_spike', 'volume_normal'],
          winRate: 0.7,
          sampleCount: 5,
          hint: 'Test',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.adjustedWeights.SentimentAnalyst).toBeGreaterThan(1.1);
    });

    it('should boost TechnicalAnalyst for MA_cross patterns', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bull',
          regime: 'bull_market',
          indicators: ['MA_cross_up', 'MA_cross_down'],
          winRate: 0.75,
          sampleCount: 5,
          hint: 'Test',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.adjustedWeights.TechnicalAnalyst).toBeGreaterThan(1.2);
    });

    it('should boost MarketAnalyst for trend-based patterns', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bull',
          regime: 'bull_market',
          indicators: ['trend_up', 'trend_down'],
          winRate: 0.7,
          sampleCount: 5,
          hint: 'Test',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.adjustedWeights.MarketAnalyst).toBeGreaterThan(1.0);
    });

    it('should cap weights at 2.0 maximum', () => {
      const patterns: PatternLearnerPattern[] = [
        { id: 'p1', type: 'bull', regime: 'bull_market', indicators: ['RSI<30'], winRate: 0.9, sampleCount: 10, hint: 'Test' },
        { id: 'p2', type: 'bull', regime: 'bull_market', indicators: ['RSI<30'], winRate: 0.9, sampleCount: 10, hint: 'Test' },
        { id: 'p3', type: 'bull', regime: 'bull_market', indicators: ['RSI<30'], winRate: 0.9, sampleCount: 10, hint: 'Test' },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.adjustedWeights.TechnicalAnalyst).toBeLessThanOrEqual(2.0);
    });

    it('should still apply indicator boost even with low win rate', () => {
      // Indicator-based boosts apply regardless of win rate
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'neutral',
          regime: 'bull_market',
          indicators: ['RSI<30'],
          winRate: 0.4,
          sampleCount: 5,
          hint: 'Test',
        },
      ];
      const result = selector.select('bull_market', patterns);
      // Base is 1.2, indicator boost 1.1 => 1.32 (capped at 2.0)
      expect(result.adjustedWeights.TechnicalAnalyst).toBeGreaterThan(1.2);
      expect(result.adjustedWeights.TechnicalAnalyst).toBeLessThanOrEqual(2.0);
    });
  });

  describe('confidence boost calculation', () => {
    it('should return 0 boost for empty patterns', () => {
      const result = selector.select('bull_market', []);
      expect(result.expectedConfidenceBoost).toBe(0);
    });

    it('should return 0 boost when no patterns match regime', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bear',
          regime: 'bear_market',
          indicators: ['RSI>70'],
          winRate: 0.7,
          sampleCount: 5,
          hint: 'Test',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.expectedConfidenceBoost).toBe(0);
    });

    it('should calculate positive boost for high win rate patterns', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bull',
          regime: 'bull_market',
          indicators: ['RSI<30'],
          winRate: 0.85,
          sampleCount: 10,
          hint: 'Test',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.expectedConfidenceBoost).toBeGreaterThan(0);
    });

    it('should cap confidence boost at 0.15', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bull',
          regime: 'bull_market',
          indicators: ['RSI<30'],
          winRate: 1.0,
          sampleCount: 100,
          hint: 'Test',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.expectedConfidenceBoost).toBeLessThanOrEqual(0.15);
    });
  });

  describe('getAvailableStrategies()', () => {
    it('should return all available regime names', () => {
      const strategies = selector.getAvailableStrategies();
      expect(strategies).toContain('bull_market');
      expect(strategies).toContain('bear_market');
      expect(strategies).toContain('sideways');
      expect(strategies).toContain('volatile');
      expect(strategies).toHaveLength(4);
    });
  });

  describe('singleton instance', () => {
    it('should export strategySelector singleton', () => {
      expect(strategySelector).toBeInstanceOf(StrategySelector);
    });

    it('singleton should have same behavior as new instance', () => {
      const result1 = strategySelector.select('bull_market', []);
      const result2 = new StrategySelector().select('bull_market', []);
      expect(result1.strategy.name).toBe(result2.strategy.name);
    });
  });

  describe('edge cases', () => {
    it('should handle patterns with no matching indicators', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'neutral',
          regime: 'bull_market',
          indicators: [],
          winRate: 0.6,
          sampleCount: 3,
          hint: 'Test',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.strategy).toBeDefined();
      expect(result.adjustedWeights).toBeDefined();
    });

    it('should handle patterns with unknown indicator names', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bull',
          regime: 'bull_market',
          indicators: ['unknown_indicator', 'another_unknown'],
          winRate: 0.7,
          sampleCount: 5,
          hint: 'Test',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.strategy).toBeDefined();
    });

    it('should handle patterns with zero winRate', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bear',
          regime: 'bull_market',
          indicators: ['RSI<30'],
          winRate: 0,
          sampleCount: 5,
          hint: 'Test',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.expectedConfidenceBoost).toBe(0);
    });

    it('should handle patterns with very low sample count', () => {
      const patterns: PatternLearnerPattern[] = [
        {
          id: 'p1',
          type: 'bull',
          regime: 'bull_market',
          indicators: ['RSI<30'],
          winRate: 0.9,
          sampleCount: 1,
          hint: 'Test',
        },
      ];
      const result = selector.select('bull_market', patterns);
      expect(result.expectedConfidenceBoost).toBeLessThan(0.1);
    });
  });
});
