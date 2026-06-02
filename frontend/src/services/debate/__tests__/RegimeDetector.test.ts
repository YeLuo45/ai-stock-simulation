/**
 * Tests for RegimeDetector - Market regime detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RegimeDetector, regimeDetector } from '../strategy/RegimeDetector';
import type { MarketData } from '../strategy/types';

describe('RegimeDetector', () => {
  let detector: RegimeDetector;

  beforeEach(() => {
    detector = new RegimeDetector();
  });

  describe('detect()', () => {
    it('should detect bull_market from rising prices with high RSI', () => {
      const data: MarketData = {
        prices: [100, 102, 104, 107, 110, 113, 116, 119, 122, 125],
        volumes: [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
        volatility: 0.3,
        rsi: 75,
      };
      const regime = detector.detect(data);
      expect(regime).toBe('bull_market');
    });

    it('should detect bear_market from falling prices with low RSI', () => {
      const data: MarketData = {
        prices: [125, 122, 119, 116, 113, 110, 107, 104, 102, 100],
        volumes: [1900, 1800, 1700, 1600, 1500, 1400, 1300, 1200, 1100, 1000],
        volatility: 0.4,
        rsi: 25,
      };
      const regime = detector.detect(data);
      expect(regime).toBe('bear_market');
    });

    it('should detect sideways when prices are flat', () => {
      const data: MarketData = {
        prices: [100, 101, 99, 100, 101, 100, 99, 101, 100, 100],
        volumes: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
        volatility: 0.25,
        rsi: 50,
      };
      const regime = detector.detect(data);
      expect(regime).toBe('sideways');
    });

    it('should detect volatile regime when volatility is high', () => {
      const data: MarketData = {
        prices: [100, 120, 90, 115, 85, 110, 95, 105, 100, 100],
        volumes: [1000, 2000, 1500, 1800, 1200, 1600, 1400, 1100, 1300, 1000],
        volatility: 0.85,
        rsi: 55,
      };
      const regime = detector.detect(data);
      expect(regime).toBe('volatile');
    });

    it('should handle empty prices array', () => {
      const data: MarketData = {
        prices: [],
        volumes: [],
        volatility: 0.5,
        rsi: 50,
      };
      const regime = detector.detect(data);
      expect(['sideways', 'volatile', 'bull_market', 'bear_market']).toContain(regime);
    });

    it('should handle single price point', () => {
      const data: MarketData = {
        prices: [100],
        volumes: [1000],
        volatility: 0.3,
        rsi: 50,
      };
      const regime = detector.detect(data);
      expect(['sideways', 'volatile', 'bull_market', 'bear_market']).toContain(regime);
    });

    it('should handle undefined RSI gracefully', () => {
      const data: MarketData = {
        prices: [100, 105, 110, 115, 120],
        volumes: [1000, 1100, 1200, 1300, 1400],
        volatility: 0.3,
      };
      const regime = detector.detect(data);
      expect(['sideways', 'volatile', 'bull_market', 'bear_market']).toContain(regime);
    });

    it('should detect bull_market with strong volume confirmation', () => {
      const data: MarketData = {
        prices: [100, 103, 106, 109, 112, 115],
        volumes: [1000, 1500, 1800, 2000, 2100, 2200],
        volatility: 0.35,
        rsi: 68,
      };
      const regime = detector.detect(data);
      expect(regime).toBe('bull_market');
    });
  });

  describe('detectWithConfidence()', () => {
    it('should return regime detection result with signals', () => {
      const data: MarketData = {
        prices: [100, 105, 110, 115, 120, 125],
        volumes: [1000, 1100, 1200, 1300, 1400, 1500],
        volatility: 0.3,
        rsi: 72,
      };
      const result = detector.detectWithConfidence(data);
      expect(result.regime).toBe('bull_market');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.signals).toBeInstanceOf(Array);
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('should include trend signal', () => {
      const data: MarketData = {
        prices: [100, 102, 104, 107, 110, 113],
        volumes: [1000, 1000, 1000, 1000, 1000, 1000],
        volatility: 0.3,
        rsi: 55,
      };
      const result = detector.detectWithConfidence(data);
      const trendSignal = result.signals.find(s => s.type === 'trend');
      expect(trendSignal).toBeDefined();
      expect(trendSignal?.direction).toBe('bullish');
    });

    it('should include volatility signal', () => {
      const data: MarketData = {
        prices: [100, 105, 110, 115, 120],
        volumes: [1000, 1000, 1000, 1000, 1000],
        volatility: 0.8,
        rsi: 55,
      };
      const result = detector.detectWithConfidence(data);
      const volSignal = result.signals.find(s => s.type === 'volatility');
      expect(volSignal).toBeDefined();
      expect(volSignal?.strength).toBe(0.8);
    });

    it('should include momentum signal from RSI', () => {
      const data: MarketData = {
        prices: [100, 105, 110, 115, 120],
        volumes: [1000, 1000, 1000, 1000, 1000],
        volatility: 0.3,
        rsi: 28,
      };
      const result = detector.detectWithConfidence(data);
      const momentumSignal = result.signals.find(s => s.type === 'momentum');
      expect(momentumSignal).toBeDefined();
      expect(momentumSignal?.direction).toBe('bullish');
      expect(momentumSignal?.description).toContain('Oversold');
    });

    it('should include volume signal', () => {
      const data: MarketData = {
        prices: [100, 105, 110, 115, 120, 125],
        volumes: [1000, 1500, 2000, 2500, 3000, 3500],
        volatility: 0.3,
        rsi: 60,
      };
      const result = detector.detectWithConfidence(data);
      const volumeSignal = result.signals.find(s => s.type === 'volume');
      expect(volumeSignal).toBeDefined();
      expect(volumeSignal?.direction).toBe('bullish');
    });

    it('should return neutral momentum when RSI is undefined', () => {
      const data: MarketData = {
        prices: [100, 105, 110, 115, 120],
        volumes: [1000, 1000, 1000, 1000, 1000],
        volatility: 0.3,
      };
      const result = detector.detectWithConfidence(data);
      const momentumSignal = result.signals.find(s => s.type === 'momentum');
      expect(momentumSignal?.direction).toBe('neutral');
      expect(momentumSignal?.description).toContain('No RSI');
    });
  });

  describe('singleton instance', () => {
    it('should export regimeDetector singleton', () => {
      expect(regimeDetector).toBeInstanceOf(RegimeDetector);
    });
  });

  describe('edge cases', () => {
    it('should handle very low volatility', () => {
      const data: MarketData = {
        prices: [100, 100.5, 101, 100.5, 101, 100.5],
        volumes: [1000, 1000, 1000, 1000, 1000, 1000],
        volatility: 0.05,
        rsi: 50,
      };
      const regime = detector.detect(data);
      expect(['sideways', 'volatile', 'bull_market', 'bear_market']).toContain(regime);
    });

    it('should handle extreme RSI values', () => {
      const data: MarketData = {
        prices: [100, 105, 110, 115, 120],
        volumes: [1000, 1000, 1000, 1000, 1000],
        volatility: 0.3,
        rsi: 95,
      };
      const regime = detector.detect(data);
      expect(regime).toBe('bull_market');
    });

    it('should handle flat volume (no change)', () => {
      const data: MarketData = {
        prices: [100, 105, 110, 115, 120],
        volumes: [1000, 1000, 1000, 1000, 1000],
        volatility: 0.3,
        rsi: 60,
      };
      const result = detector.detectWithConfidence(data);
      const volumeSignal = result.signals.find(s => s.type === 'volume');
      expect(volumeSignal?.direction).toBe('neutral');
    });

    it('should detect declining volume as bearish with sufficient history', () => {
      // More than 5 data points so prior period has values
      const data: MarketData = {
        prices: [100, 105, 110, 115, 120, 125, 130, 135, 140, 145],
        volumes: [3000, 2800, 2600, 2400, 2200, 2000, 1800, 1600, 1400, 1200],
        volatility: 0.3,
        rsi: 60,
      };
      const result = detector.detectWithConfidence(data);
      const volumeSignal = result.signals.find(s => s.type === 'volume');
      expect(volumeSignal?.direction).toBe('bearish');
    });
  });
});
