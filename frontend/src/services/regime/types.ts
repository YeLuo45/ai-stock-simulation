/**
 * Regime Detection Types
 * Market state detection and strategy pool configuration
 */

// Market regime states
export type Regime = 'BULL' | 'BEAR' | 'RANGEBOUND' | 'UNKNOWN';

// Detection result with confidence and indicators
export interface RegimeDetectionResult {
  regime: Regime;
  confidence: number; // 0-1 confidence score
  indicators: {
    trend: 'up' | 'down' | 'sideways';
    volatility: 'high' | 'normal' | 'low';
    sentiment: 'bullish' | 'bearish' | 'neutral';
  };
  detectedAt: number;
}

// Individual indicator scores (0-1 normalized)
export interface RegimeIndicatorScores {
  maTrend: number;      // 0 = bearish, 1 = bullish
  rsi: number;         // 0 = oversold, 1 = overbought (normalized differently)
  macd: number;        // 0 = bearish, 1 = bullish
  volatility: number;  // 0 = low, 1 = high
  sentiment: number;   // 0 = bearish, 1 = bullish
}

// Strategy pool config for each regime
export interface RegimeConfig {
  factorWeights: Record<string, number>;
  maxPositionPct: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxDrawdownPct: number;
}

export type StrategyPoolConfig = {
  [K in Regime]?: RegimeConfig;
};

// Regime history entry
export interface RegimeHistoryEntry {
  regime: Regime;
  confidence: number;
  timestamp: number;
  reason?: string;
}

// Position type for detectFromPortfolio
export interface PositionData {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
}

// OHLCV for historical data
export interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}