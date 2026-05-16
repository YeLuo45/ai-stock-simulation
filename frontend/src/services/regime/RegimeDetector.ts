/**
 * Regime Detector - Market state detection using technical indicators
 * 5-indicator scoring system: MA Trend / RSI / MACD / Volatility / Sentiment
 */
import type { Regime, RegimeDetectionResult, RegimeIndicatorScores, PositionData, OHLCVData } from './types';
import { getKline } from '../dataSource/DataSourceRegistry';
import { sma, calculateRSI, calculateMACD } from '../indicators';
import type { OHLCV } from '../indicators';

// Default index symbols to check
const DEFAULT_INDEX_SYMBOLS = ['000001', '399300']; // 上证指数, 沪深300

// Indicator weights for regime scoring
const INDICATOR_WEIGHTS = {
  maTrend: 0.25,
  rsi: 0.2,
  macd: 0.25,
  volatility: 0.15,
  sentiment: 0.15,
};

// Confidence threshold for auto-switch
const AUTO_SWITCH_THRESHOLD = 0.8;

export const RegimeDetector = {
  /**
   * Detect regime from index symbol
   */
  async detect(indexSymbol: string = '000001'): Promise<RegimeDetectionResult> {
    try {
      // Fetch daily K-line data (last 120 days for meaningful indicators)
      const klineData = await getKline(indexSymbol, 'daily');
      
      if (!klineData || klineData.length < 60) {
        return createUnknownResult('Insufficient data for regime detection');
      }

      // Convert to OHLCV format
      const history: OHLCV[] = klineData.map(k => ({
        date: k.date,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
      }));

      // Calculate indicator scores
      const scores = calculateIndicatorScores(history);
      
      // Weighted scoring
      const regimeScore = calculateRegimeScore(scores);
      
      // Determine regime
      const { regime, confidence } = determineRegime(regimeScore, scores);
      
      return {
        regime,
        confidence,
        indicators: {
          trend: scores.maTrend > 0.6 ? 'up' : scores.maTrend < 0.4 ? 'down' : 'sideways',
          volatility: scores.volatility > 0.6 ? 'high' : scores.volatility < 0.4 ? 'low' : 'normal',
          sentiment: scores.sentiment > 0.6 ? 'bullish' : scores.sentiment < 0.4 ? 'bearish' : 'neutral',
        },
        detectedAt: Date.now(),
      };
    } catch (error) {
      console.error('Regime detection failed:', error);
      return createUnknownResult(error instanceof Error ? error.message : 'Detection failed');
    }
  },

  /**
   * Detect regime from portfolio positions and history
   * Used when external data is unavailable
   */
  async detectFromPortfolio(
    positions: PositionData[],
    history: OHLCVData[]
  ): Promise<RegimeDetectionResult> {
    try {
      if (history.length < 60) {
        return createUnknownResult('Insufficient historical data');
      }

      // Convert to OHLCV format
      const ohlcv: OHLCV[] = history.map(h => ({
        date: h.date,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume,
      }));

      // Calculate indicator scores
      const scores = calculateIndicatorScores(ohlcv);
      
      // Check portfolio sentiment
      const portfolioSentiment = calculatePortfolioSentiment(positions);
      scores.sentiment = (scores.sentiment + portfolioSentiment) / 2;
      
      // Weighted scoring
      const regimeScore = calculateRegimeScore(scores);
      
      // Determine regime
      const { regime, confidence } = determineRegime(regimeScore, scores);
      
      return {
        regime,
        confidence,
        indicators: {
          trend: scores.maTrend > 0.6 ? 'up' : scores.maTrend < 0.4 ? 'down' : 'sideways',
          volatility: scores.volatility > 0.6 ? 'high' : scores.volatility < 0.4 ? 'low' : 'normal',
          sentiment: scores.sentiment > 0.6 ? 'bullish' : scores.sentiment < 0.4 ? 'bearish' : 'neutral',
        },
        detectedAt: Date.now(),
      };
    } catch (error) {
      console.error('Portfolio-based regime detection failed:', error);
      return createUnknownResult(error instanceof Error ? error.message : 'Detection failed');
    }
  },

  /**
   * Get auto-switch threshold
   */
  getAutoSwitchThreshold(): number {
    return AUTO_SWITCH_THRESHOLD;
  },
};

/**
 * Calculate all 5 indicator scores
 */
function calculateIndicatorScores(history: OHLCV[]): RegimeIndicatorScores {
  const closes = history.map(h => h.close);
  const highs = history.map(h => h.high);
  const lows = history.map(h => h.low);
  
  // 1. MA Trend: Compare MA5 vs MA20 vs MA60
  const ma5 = sma(closes, 5);
  const ma20 = sma(closes, 20);
  const ma60 = sma(closes, Math.min(60, closes.length));
  
  let maTrendScore = 0.5; // Neutral
  if (ma5 > ma20 && ma20 > ma60) {
    maTrendScore = 1.0; // Strong uptrend
  } else if (ma5 < ma20 && ma20 < ma60) {
    maTrendScore = 0.0; // Strong downtrend
  } else if (ma5 > ma60) {
    maTrendScore = 0.75; // Mild uptrend
  } else if (ma5 < ma60) {
    maTrendScore = 0.25; // Mild downtrend
  }
  
  // 2. RSI (14): Normalize to 0-1 (0 = oversold, 1 = overbought)
  const rsi = calculateRSI(closes, 14);
  const rsiScore = rsi / 100;
  
  // 3. MACD: Positive histogram = bullish, negative = bearish
  const macdData = calculateMACD(closes);
  const macdScore = macdData.hist > 0 ? 0.5 + Math.min(macdData.hist / (closes[closes.length - 1] * 0.02), 0.5) 
                                     : 0.5 - Math.min(Math.abs(macdData.hist) / (closes[closes.length - 1] * 0.02), 0.5);
  
  // 4. Volatility: ATR or standard deviation
  const atr = calculateATR(history, 14);
  const recentAtr = atr / closes[closes.length - 1]; // Normalize ATR
  const volatilityScore = Math.min(Math.max(recentAtr * 10, 0), 1); // Scale and clamp
  
  // 5. Sentiment: Based on recent price momentum
  const recentChange = (closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5];
  const sentimentScore = recentChange > 0.05 ? 0.8 : 
                         recentChange > 0.02 ? 0.6 :
                         recentChange > -0.02 ? 0.4 :
                         recentChange > -0.05 ? 0.2 : 0.1;
  
  return {
    maTrend: maTrendScore,
    rsi: rsiScore,
    macd: macdScore,
    volatility: volatilityScore,
    sentiment: sentimentScore,
  };
}

/**
 * Calculate ATR (Average True Range)
 */
function calculateATR(history: OHLCV[], period: number): number {
  if (history.length < period + 1) {
    return history[history.length - 1].high - history[history.length - 1].low;
  }
  
  let trSum = 0;
  for (let i = history.length - period; i < history.length; i++) {
    const tr = Math.max(
      history[i].high - history[i].low,
      Math.abs(history[i].high - history[i - 1].close),
      Math.abs(history[i].low - history[i - 1].close)
    );
    trSum += tr;
  }
  
  return trSum / period;
}

/**
 * Calculate portfolio sentiment from positions
 */
function calculatePortfolioSentiment(positions: PositionData[]): number {
  if (positions.length === 0) return 0.5; // Neutral
  
  let totalProfitLoss = 0;
  for (const pos of positions) {
    const pl = (pos.currentPrice - pos.avgCost) / pos.avgCost;
    totalProfitLoss += pl;
  }
  
  const avgPL = totalProfitLoss / positions.length;
  
  // Map to 0-1 scale
  if (avgPL > 0.1) return 0.9;
  if (avgPL > 0.05) return 0.7;
  if (avgPL > 0) return 0.55;
  if (avgPL > -0.05) return 0.45;
  if (avgPL > -0.1) return 0.3;
  return 0.1;
}

/**
 * Calculate weighted regime score (-1 to 1)
 * Positive = Bull, Negative = Bear
 */
function calculateRegimeScore(scores: RegimeIndicatorScores): number {
  let score = 0;
  
  // MA Trend (strong signal)
  score += (scores.maTrend - 0.5) * 2 * INDICATOR_WEIGHTS.maTrend;
  
  // RSI (inverted for bear/bull interpretation)
  // RSI > 60 = overbought = potentially bearish for mean reversion
  // But in strong trends, overbought can continue
  const rsiBearish = scores.rsi > 0.7 ? (scores.rsi - 0.7) * 2 : 0;
  const rsiBullish = scores.rsi < 0.3 ? (0.3 - scores.rsi) * 2 : 0;
  score += (scores.rsi - 0.5 + rsiBullish - rsiBearish) * INDICATOR_WEIGHTS.rsi;
  
  // MACD
  score += (scores.macd - 0.5) * 2 * INDICATOR_WEIGHTS.macd;
  
  // Volatility (low vol can indicate accumulation/distribution)
  const volSignal = scores.volatility < 0.3 ? 0.2 : scores.volatility > 0.7 ? -0.1 : 0;
  score += volSignal * INDICATOR_WEIGHTS.volatility;
  
  // Sentiment
  score += (scores.sentiment - 0.5) * 2 * INDICATOR_WEIGHTS.sentiment;
  
  return Math.max(-1, Math.min(1, score));
}

/**
 * Determine regime from score
 */
function determineRegime(
  regimeScore: number,
  scores: RegimeIndicatorScores
): { regime: Regime; confidence: number } {
  // High confidence thresholds
  const HIGH_SCORE = 0.6;
  const LOW_SCORE = -0.6;
  
  // Check for strong signals
  if (regimeScore > HIGH_SCORE && scores.maTrend > 0.7 && scores.macd > 0.6) {
    return { regime: 'BULL', confidence: Math.min(0.95, 0.7 + regimeScore * 0.3) };
  }
  
  if (regimeScore < LOW_SCORE && scores.maTrend < 0.3 && scores.macd < 0.4) {
    return { regime: 'BEAR', confidence: Math.min(0.95, 0.7 + Math.abs(regimeScore) * 0.3) };
  }
  
  // Check for range-bound (sideways)
  const isSideways = scores.maTrend > 0.35 && scores.maTrend < 0.65 &&
                    scores.rsi > 0.35 && scores.rsi < 0.65;
  
  if (isSideways && Math.abs(regimeScore) < 0.3) {
    return { regime: 'RANGEBOUND', confidence: 0.7 + (0.3 - Math.abs(regimeScore)) * 0.3 };
  }
  
  // Gradual transition detection
  if (regimeScore > 0.2 && regimeScore < HIGH_SCORE) {
    return { regime: 'BULL', confidence: 0.6 + regimeScore * 0.2 };
  }
  
  if (regimeScore < -0.2 && regimeScore > LOW_SCORE) {
    return { regime: 'BEAR', confidence: 0.6 + Math.abs(regimeScore) * 0.2 };
  }
  
  // Default to range-bound with moderate confidence
  return { regime: 'RANGEBOUND', confidence: 0.5 + (0.3 - Math.abs(regimeScore)) * 0.3 };
}

/**
 * Create UNKNOWN result with reason
 */
function createUnknownResult(reason: string): RegimeDetectionResult {
  return {
    regime: 'UNKNOWN',
    confidence: 0,
    indicators: {
      trend: 'sideways',
      volatility: 'normal',
      sentiment: 'neutral',
    },
    detectedAt: Date.now(),
  };
}