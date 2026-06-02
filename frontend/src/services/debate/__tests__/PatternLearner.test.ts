/**
 * Tests for PatternLearner - Pattern extraction from debate outcomes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PatternLearner, DebatePattern } from '../memory/PatternLearner';

describe('PatternLearner', () => {
  let learner: PatternLearner;

  beforeEach(() => {
    learner = new PatternLearner();
  });

  describe('learn()', () => {
    it('should create a pattern from a bullish debate outcome', () => {
      const pattern = learner.learn({
        stockCode: 'AAPL',
        regime: 'bull_market',
        phaseOutputs: [
          { rsi: 25, maCross: 'up', volumeSpike: true },
        ],
        finalDecision: 'BUY',
        confidence: 0.8,
      });

      expect(pattern.id).toMatch(/^pattern_/);
      expect(pattern.type).toBe('bull');
      expect(pattern.regime).toBe('bull_market');
      expect(pattern.indicators).toContain('RSI<30');
      expect(pattern.indicators).toContain('MA_cross_up');
      expect(pattern.indicators).toContain('volume_spike');
      expect(pattern.winRate).toBe(1); // 1 sample, 1 win
      expect(pattern.sampleCount).toBe(1);
      expect(pattern.hint).toContain('RSI');
    });

    it('should create a pattern from a bearish debate outcome', () => {
      const pattern = learner.learn({
        stockCode: 'GOOGL',
        regime: 'bear_market',
        phaseOutputs: [
          { rsi: 85, maCross: 'down', volumeSpike: true },
        ],
        finalDecision: 'SELL',
        confidence: 0.75,
      });

      expect(pattern.type).toBe('bear');
      expect(pattern.regime).toBe('bear_market');
      expect(pattern.indicators).toContain('RSI>70');
      expect(pattern.indicators).toContain('MA_cross_down');
      expect(pattern.hint).toContain('Overbought');
    });

    it('should create a neutral pattern for low confidence decisions', () => {
      const pattern = learner.learn({
        stockCode: 'MSFT',
        regime: 'sideways',
        phaseOutputs: [
          { rsi: 50, trend: 'sideways' },
        ],
        finalDecision: 'HOLD',
        confidence: 0.4,
      });

      expect(pattern.type).toBe('neutral');
      expect(pattern.hint).toContain('sideways');
    });

    it('should update existing pattern with new sample', () => {
      // First debate
      learner.learn({
        stockCode: 'AAPL',
        regime: 'bull_market',
        phaseOutputs: [{ rsi: 25, maCross: 'up' }],
        finalDecision: 'BUY',
        confidence: 0.8,
      });

      // Second debate with same pattern
      const pattern2 = learner.learn({
        stockCode: 'GOOGL',
        regime: 'bull_market',
        phaseOutputs: [{ rsi: 28, maCross: 'up' }],
        finalDecision: 'BUY',
        confidence: 0.75,
      });

      expect(pattern2.sampleCount).toBe(2);
      expect(pattern2.winRate).toBe(1); // Both wins
    });

    it('should calculate correct win rate for mixed outcomes', () => {
      // Win
      learner.learn({
        stockCode: 'AAPL',
        regime: 'bull_market',
        phaseOutputs: [{ rsi: 25 }],
        finalDecision: 'BUY',
        confidence: 0.8,
      });

      // Win
      learner.learn({
        stockCode: 'GOOGL',
        regime: 'bull_market',
        phaseOutputs: [{ rsi: 28 }],
        finalDecision: 'BUY',
        confidence: 0.75,
      });

      // Loss (HOLD in bull market)
      const pattern3 = learner.learn({
        stockCode: 'MSFT',
        regime: 'bull_market',
        phaseOutputs: [{ rsi: 30 }],
        finalDecision: 'HOLD',
        confidence: 0.5,
      });

      expect(pattern3.sampleCount).toBe(3);
      expect(pattern3.winRate).toBeCloseTo(2 / 3, 2);
    });

    it('should extract multiple indicators from phase outputs', () => {
      const pattern = learner.learn({
        stockCode: 'AAPL',
        regime: 'bull_market',
        phaseOutputs: [
          { rsi: 25 },
          { maCross: 'up', volumeSpike: true },
          { trend: 'up', macdSignal: 'BUY' },
        ],
        finalDecision: 'BUY',
        confidence: 0.85,
      });

      expect(pattern.indicators).toContain('RSI<30');
      expect(pattern.indicators).toContain('MA_cross_up');
      expect(pattern.indicators).toContain('volume_spike');
      expect(pattern.indicators).toContain('trend_up');
      expect(pattern.indicators).toContain('MACD_BUY');
    });

    it('should handle empty phase outputs', () => {
      const pattern = learner.learn({
        stockCode: 'AAPL',
        regime: 'sideways',
        phaseOutputs: [],
        finalDecision: 'HOLD',
        confidence: 0.5,
      });

      expect(pattern.indicators).toHaveLength(0);
      expect(pattern.type).toBe('neutral');
    });

    it('should handle null/undefined values in phase outputs gracefully', () => {
      const pattern = learner.learn({
        stockCode: 'AAPL',
        regime: 'bull_market',
        phaseOutputs: [
          null,
          undefined,
          { rsi: null, maCross: undefined },
          { rsi: 25 },
        ],
        finalDecision: 'BUY',
        confidence: 0.8,
      });

      expect(pattern.indicators).toContain('RSI<30');
      expect(pattern.indicators.filter(i => i === 'RSI<30')).toHaveLength(1);
    });
  });

  describe('findSimilar()', () => {
    beforeEach(() => {
      // Set up some patterns
      learner.learn({
        stockCode: 'AAPL',
        regime: 'bull_market',
        phaseOutputs: [{ rsi: 25, maCross: 'up' }],
        finalDecision: 'BUY',
        confidence: 0.8,
      });
      learner.learn({
        stockCode: 'GOOGL',
        regime: 'bear_market',
        phaseOutputs: [{ rsi: 80, maCross: 'down' }],
        finalDecision: 'SELL',
        confidence: 0.75,
      });
      learner.learn({
        stockCode: 'MSFT',
        regime: 'sideways',
        phaseOutputs: [{ rsi: 50, trend: 'sideways' }],
        finalDecision: 'HOLD',
        confidence: 0.5,
      });
    });

    it('should find patterns by type', () => {
      const bullPatterns = learner.findSimilar({ type: 'bull' });
      expect(bullPatterns).toHaveLength(1);
      expect(bullPatterns[0].type).toBe('bull');
      expect(bullPatterns[0].regime).toBe('bull_market');

      const bearPatterns = learner.findSimilar({ type: 'bear' });
      expect(bearPatterns).toHaveLength(1);
      expect(bearPatterns[0].type).toBe('bear');
    });

    it('should find patterns by regime', () => {
      const bullMarketPatterns = learner.findSimilar({ regime: 'bull_market' });
      expect(bullMarketPatterns).toHaveLength(1);
      expect(bullMarketPatterns[0].regime).toBe('bull_market');
    });

    it('should find patterns by indicator', () => {
      const rsiPatterns = learner.findSimilar({ indicators: ['RSI<30'] });
      expect(rsiPatterns).toHaveLength(1);
      expect(rsiPatterns[0].indicators).toContain('RSI<30');

      const crossDownPatterns = learner.findSimilar({ indicators: ['MA_cross_down'] });
      expect(crossDownPatterns).toHaveLength(1);
      expect(crossDownPatterns[0].indicators).toContain('MA_cross_down');
    });

    it('should find patterns by multiple criteria', () => {
      const patterns = learner.findSimilar({ type: 'bull', regime: 'bull_market' });
      expect(patterns).toHaveLength(1);
    });

    it('should return empty array for non-matching criteria', () => {
      const patterns = learner.findSimilar({ type: 'bear', regime: 'bull_market' });
      expect(patterns).toHaveLength(0);
    });

    it('should sort results by win rate descending', () => {
      // Add more patterns with different win rates
      learner.clearPatterns();

      // Pattern with 100% win rate
      learner.learn({
        stockCode: 'AAPL', regime: 'bull_market',
        phaseOutputs: [{ rsi: 20, maCross: 'up' }],
        finalDecision: 'BUY', confidence: 0.9,
      });
      learner.learn({
        stockCode: 'GOOGL', regime: 'bull_market',
        phaseOutputs: [{ rsi: 22, maCross: 'up' }],
        finalDecision: 'BUY', confidence: 0.85,
      });

      // Pattern with 50% win rate
      learner.learn({
        stockCode: 'MSFT', regime: 'bull_market',
        phaseOutputs: [{ rsi: 25 }],
        finalDecision: 'BUY', confidence: 0.8,
      });
      learner.learn({
        stockCode: 'TSLA', regime: 'bull_market',
        phaseOutputs: [{ rsi: 30 }],
        finalDecision: 'HOLD', confidence: 0.5,
      });

      const patterns = learner.findSimilar({ regime: 'bull_market' });
      expect(patterns[0].winRate).toBeGreaterThanOrEqual(patterns[1].winRate);
    });

    it('should return empty array when no patterns exist', () => {
      learner.clearPatterns();
      const patterns = learner.findSimilar({ type: 'bull' });
      expect(patterns).toHaveLength(0);
    });
  });

  describe('generateHint()', () => {
    it('should generate hint for bull_market regime', () => {
      const hint = learner.generateHint('bull_market', ['RSI<30', 'MA_cross_up']);
      expect(hint.toLowerCase()).toContain('bull');
      expect(hint).toContain('Oversold');
    });

    it('should generate hint for bear_market regime', () => {
      const hint = learner.generateHint('bear_market', ['RSI>70', 'MA_cross_down']);
      expect(hint).toContain('downtrend');
    });

    it('should generate hint for sideways regime', () => {
      const hint = learner.generateHint('sideways', []);
      expect(hint).toContain('Range-bound');
    });

    it('should generate high confidence hint for strong signals', () => {
      const hint = learner.generateHint('bull_market', ['RSI<30', 'MA_cross_up']);
      expect(hint).toContain('HIGH CONFIDENCE');
      expect(hint).toContain('strong buy');
    });

    it('should generate high confidence hint for strong bearish signals', () => {
      const hint = learner.generateHint('bear_market', ['RSI>70', 'MA_cross_down']);
      expect(hint).toContain('HIGH CONFIDENCE');
      expect(hint).toContain('strong sell');
    });

    it('should handle unknown regime gracefully', () => {
      const hint = learner.generateHint('unknown_regime', []);
      expect(hint).toContain('unknown_regime');
    });

    it('should include matching indicator hints', () => {
      const hint = learner.generateHint('bull_market', ['RSI<30', 'volume_spike', 'MACD_BUY']);
      expect(hint).toContain('Oversold');
      expect(hint).toContain('Volume surge');
      expect(hint).toContain('MACD');
    });
  });

  describe('clearPatterns()', () => {
    it('should clear all stored patterns', () => {
      learner.learn({
        stockCode: 'AAPL',
        regime: 'bull_market',
        phaseOutputs: [{ rsi: 25 }],
        finalDecision: 'BUY',
        confidence: 0.8,
      });

      expect(learner.getPatternCount()).toBe(1);
      learner.clearPatterns();
      expect(learner.getPatternCount()).toBe(0);
    });
  });

  describe('getPatternCount()', () => {
    it('should return 0 for new learner', () => {
      expect(learner.getPatternCount()).toBe(0);
    });

    it('should return correct count after learning', () => {
      learner.learn({
        stockCode: 'AAPL', regime: 'bull_market',
        phaseOutputs: [{ rsi: 25 }], finalDecision: 'BUY', confidence: 0.8,
      });
      learner.learn({
        stockCode: 'GOOGL', regime: 'bear_market',
        phaseOutputs: [{ rsi: 80 }], finalDecision: 'SELL', confidence: 0.75,
      });
      learner.learn({
        stockCode: 'MSFT', regime: 'sideways',
        phaseOutputs: [{ rsi: 50 }], finalDecision: 'HOLD', confidence: 0.5,
      });

      expect(learner.getPatternCount()).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle very low confidence BUY as neutral', () => {
      const pattern = learner.learn({
        stockCode: 'AAPL',
        regime: 'bull_market',
        phaseOutputs: [{ rsi: 30 }],
        finalDecision: 'BUY',
        confidence: 0.3,
      });

      expect(pattern.type).toBe('neutral');
    });

    it('should handle very low confidence SELL as neutral', () => {
      const pattern = learner.learn({
        stockCode: 'AAPL',
        regime: 'bear_market',
        phaseOutputs: [{ rsi: 70 }],
        finalDecision: 'SELL',
        confidence: 0.3,
      });

      expect(pattern.type).toBe('neutral');
    });

    it('should deduplicate indicators', () => {
      const pattern = learner.learn({
        stockCode: 'AAPL',
        regime: 'bull_market',
        phaseOutputs: [
          { rsi: 25 },
          { rsi: 25 },
          { rsi: 25 },
        ],
        finalDecision: 'BUY',
        confidence: 0.8,
      });

      const rsiCount = pattern.indicators.filter(i => i === 'RSI<30').length;
      expect(rsiCount).toBe(1);
    });
  });
});
