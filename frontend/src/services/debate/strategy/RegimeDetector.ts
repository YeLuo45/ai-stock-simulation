/**
 * RegimeDetector - Market environment detection using technical indicators
 * Detects: bull_market, bear_market, sideways, volatile
 */

import type { MarketData, MarketRegime, RegimeDetectionResult, RegimeSignal } from './types';

export { MarketRegime, MarketData, RegimeDetectionResult, RegimeSignal } from './types';

/**
 * Detect market regime from price/volume data using multiple indicators
 */
export class RegimeDetector {
  /**
   * Detect the current market regime based on price, volume, and volatility data
   * @param marketData - Historical price/volume data with optional RSI
   * @returns The detected market regime
   */
  detect(marketData: MarketData): MarketRegime {
    const result = this.detectWithConfidence(marketData);
    return result.regime;
  }

  /**
   * Detect the current market regime with detailed confidence and signals
   * @param marketData - Historical price/volume data with optional RSI
   * @returns Detailed regime detection result
   */
  detectWithConfidence(marketData: MarketData): RegimeDetectionResult {
    const { prices, volumes, volatility, rsi } = marketData;
    const signals: RegimeSignal[] = [];

    // Compute individual indicators
    const trendSignal = this.computeTrendSignal(prices);
    const volatilitySignal = this.computeVolatilitySignal(volatility);
    const momentumSignal = this.computeMomentumSignal(rsi);
    const volumeSignal = this.computeVolumeSignal(volumes);

    signals.push(trendSignal, volatilitySignal, momentumSignal, volumeSignal);

    // Score each regime
    const scores = this.scoreRegimes(signals, volatility, rsi);

    // Determine winning regime
    const regime = this.selectRegime(scores);
    const confidence = this.computeConfidence(scores, signals);

    return { regime, confidence, signals };
  }

  /**
   * Compute trend signal from price series using linear regression slope
   */
  private computeTrendSignal(prices: number[]): RegimeSignal {
    if (prices.length < 2) {
      return {
        type: 'trend',
        direction: 'neutral',
        strength: 0,
        description: 'Insufficient price data',
      };
    }

    // Linear regression to find slope
    const n = prices.length;
    const xMean = (n - 1) / 2;
    const yMean = prices.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (prices[i] - yMean);
      denominator += (i - xMean) * (i - xMean);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    // Normalize slope by average price to get relative trend strength
    const normalizedSlope = yMean !== 0 ? Math.abs(slope) / yMean : 0;

    // Determine direction and strength
    const isUptrend = slope > 0;
    const direction = normalizedSlope > 0.02 ? (isUptrend ? 'bullish' : 'bearish') : 'neutral';
    const strength = Math.min(normalizedSlope * 50, 1); // Scale to 0-1

    return {
      type: 'trend',
      direction,
      strength,
      description: isUptrend
        ? `Uptrend detected, slope: ${slope.toFixed(2)}`
        : slope < 0
          ? `Downtrend detected, slope: ${slope.toFixed(2)}`
          : 'No clear trend',
    };
  }

  /**
   * Compute volatility signal
   */
  private computeVolatilitySignal(volatility: number): RegimeSignal {
    const isHighVol = volatility > 0.7;
    const isLowVol = volatility < 0.3;

    let direction: 'bullish' | 'bearish' | 'neutral';
    let description: string;

    if (isHighVol) {
      direction = 'neutral';
      description = `High volatility (${(volatility * 100).toFixed(0)}%)`;
    } else if (isLowVol) {
      direction = 'neutral';
      description = `Low volatility (${(volatility * 100).toFixed(0)}%)`;
    } else {
      direction = 'neutral';
      description = `Moderate volatility (${(volatility * 100).toFixed(0)}%)`;
    }

    return {
      type: 'volatility',
      direction,
      strength: volatility,
      description,
    };
  }

  /**
   * Compute momentum signal from RSI
   */
  private computeMomentumSignal(rsi?: number): RegimeSignal {
    if (rsi === undefined) {
      return {
        type: 'momentum',
        direction: 'neutral',
        strength: 0,
        description: 'No RSI data',
      };
    }

    let direction: 'bullish' | 'bearish' | 'neutral';
    let description: string;

    if (rsi < 30) {
      direction = 'bullish';
      description = `Oversold (RSI: ${rsi.toFixed(1)})`;
    } else if (rsi > 70) {
      direction = 'bearish';
      description = `Overbought (RSI: ${rsi.toFixed(1)})`;
    } else if (rsi < 45) {
      direction = 'bearish';
      description = `Weak bullish (RSI: ${rsi.toFixed(1)})`;
    } else if (rsi > 55) {
      direction = 'bullish';
      description = `Strong bullish (RSI: ${rsi.toFixed(1)})`;
    } else {
      direction = 'neutral';
      description = `Neutral momentum (RSI: ${rsi.toFixed(1)})`;
    }

    // RSI distance from 50 as strength
    const distanceFromNeutral = Math.abs(rsi - 50) / 50;
    const strength = distanceFromNeutral;

    return { type: 'momentum', direction, strength, description };
  }

  /**
   * Compute volume signal from volume series
   */
  private computeVolumeSignal(volumes: number[]): RegimeSignal {
    if (volumes.length < 2) {
      return {
        type: 'volume',
        direction: 'neutral',
        strength: 0,
        description: 'Insufficient volume data',
      };
    }

    // Compare recent volume (last 5) to prior average
    const recent = volumes.slice(-5);
    const prior = volumes.slice(0, -5);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgPrior = prior.length > 0 ? prior.reduce((a, b) => a + b, 0) / prior.length : avgRecent;

    const ratio = avgPrior > 0 ? avgRecent / avgPrior : 1;
    const strength = Math.min(Math.abs(ratio - 1), 1);

    let direction: 'bullish' | 'bearish' | 'neutral';
    if (ratio > 1.2) {
      direction = 'bullish';
    } else if (ratio < 0.8) {
      direction = 'bearish';
    } else {
      direction = 'neutral';
    }

    return {
      type: 'volume',
      direction,
      strength,
      description: `Volume ratio: ${ratio.toFixed(2)}`,
    };
  }

  /**
   * Score each regime based on signals
   */
  private scoreRegimes(
    signals: RegimeSignal[],
    volatility: number,
    rsi?: number
  ): Record<MarketRegime, number> {
    const scores: Record<MarketRegime, number> = {
      bull_market: 0,
      bear_market: 0,
      sideways: 0,
      volatile: 0,
    };

    for (const signal of signals) {
      const weight = signal.strength;

      if (signal.type === 'trend') {
        if (signal.direction === 'bullish') {
          scores.bull_market += weight;
          scores.sideways -= weight * 0.5;
        } else if (signal.direction === 'bearish') {
          scores.bear_market += weight;
          scores.sideways -= weight * 0.5;
        } else {
          scores.sideways += weight * 0.3;
        }
      }

      if (signal.type === 'momentum') {
        if (signal.direction === 'bullish') {
          scores.bull_market += weight * 0.8;
        } else if (signal.direction === 'bearish') {
          scores.bear_market += weight * 0.8;
        } else {
          scores.sideways += weight * 0.3;
        }
      }

      if (signal.type === 'volume') {
        if (signal.direction === 'bullish') {
          scores.bull_market += weight * 0.5;
        } else if (signal.direction === 'bearish') {
          scores.bear_market += weight * 0.5;
        }
      }
    }

    // Volatility regime gets boosted by high volatility
    if (volatility > 0.65) {
      scores.volatile += volatility;
      // High volatility suppresses other regimes slightly
      scores.bull_market -= volatility * 0.2;
      scores.bear_market -= volatility * 0.2;
      scores.sideways -= volatility * 0.2;
    }

    // RSI-based adjustment
    if (rsi !== undefined) {
      if (rsi < 30 || rsi > 70) {
        scores.volatile += 0.2;
      }
      if (rsi >= 40 && rsi <= 60) {
        scores.sideways += 0.2;
      }
    }

    // Sideways: low trend + moderate volatility + neutral RSI
    if (volatility >= 0.2 && volatility <= 0.5) {
      const lowTrend = signals.find(s => s.type === 'trend' && s.direction === 'neutral');
      if (lowTrend && lowTrend.strength > 0.5) {
        scores.sideways += lowTrend.strength * 0.5;
      }
    }

    return scores;
  }

  /**
   * Select the winning regime from scores
   */
  private selectRegime(scores: Record<MarketRegime, number>): MarketRegime {
    let maxRegime: MarketRegime = 'sideways';
    let maxScore = -Infinity;

    for (const [regime, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxRegime = regime as MarketRegime;
      }
    }

    return maxRegime;
  }

  /**
   * Compute overall detection confidence
   */
  private computeConfidence(
    scores: Record<MarketRegime, number>,
    signals: RegimeSignal[]
  ): number {
    // Winning score relative to second place
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    const winner = sortedScores[0];
    const second = sortedScores[1] || 0;
    const margin = winner - second;

    // Average signal strength
    const avgStrength = signals.reduce((sum, s) => sum + s.strength, 0) / signals.length;

    // Confidence = combination of margin and signal strength
    const confidence = Math.min((margin * 0.4 + avgStrength * 0.6), 1);
    return Math.max(confidence, 0.3); // At least 30% confidence
  }
}

// Export singleton
export const regimeDetector = new RegimeDetector();
