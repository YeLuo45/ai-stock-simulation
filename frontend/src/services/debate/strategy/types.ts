/**
 * DebateStrategy Types - Strategy selection type definitions
 */

export type MarketRegime = 'bull_market' | 'bear_market' | 'sideways' | 'volatile';

export interface DebateStrategy {
  name: string;
  regime: MarketRegime;
  weights: Record<string, number>;  // AgentId -> weight multiplier
  minConfidence: number;            // minimum confidence threshold (0-1)
  phases: string[];                 // ordered debate phases
}

/**
 * Market data for regime detection
 */
export interface MarketData {
  prices: number[];      // historical prices
  volumes: number[];    // historical volumes
  volatility: number;    // 0-1 normalized volatility
  rsi?: number;          // optional RSI value
}

/**
 * Regime detection result with confidence scores
 */
export interface RegimeDetectionResult {
  regime: MarketRegime;
  confidence: number;    // 0-1 detection confidence
  signals: RegimeSignal[];
}

export interface RegimeSignal {
  type: 'trend' | 'volatility' | 'momentum' | 'volume';
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number;       // 0-1
  description: string;
}
