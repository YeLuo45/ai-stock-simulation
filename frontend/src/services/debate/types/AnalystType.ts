/**
 * Analyst Types - Four analyst specializations for market analysis
 */

export enum AnalystType {
  FUNDAMENTAL = 'FUNDAMENTAL',
  TECHNICAL = 'TECHNICAL',
  MARKET = 'MARKET',
  SENTIMENT = 'SENTIMENT',
}

export interface AnalystConfig {
  type: AnalystType;
  weight: number;
  enabled: boolean;
  focusAreas: string[];
}

export interface FundamentalAnalysis {
  type: AnalystType.FUNDAMENTAL;
  companyMetrics: {
    peRatio?: number;
    pbRatio?: number;
    roe?: number;
    debtToEquity?: number;
    revenueGrowth?: number;
    profitMargin?: number;
  };
  valuation: {
    fairValue?: number;
    discount?: number;
    premium?: number;
  };
  financialHealth: 'strong' | 'moderate' | 'weak';
  outlook: 'positive' | 'neutral' | 'negative';
  reasoning: string[];
}

export interface TechnicalAnalysis {
  type: AnalystType.TECHNICAL;
  patterns: {
    trend: 'bullish' | 'bearish' | 'neutral';
    patternType?: string;
    confidence: number;
  };
  indicators: {
    ma20: number;
    ma60: number;
    rsi: number;
    macd: {
      value: number;
      signal: number;
      histogram: number;
    };
  };
  support: number;
  resistance: number;
  outlook: 'positive' | 'neutral' | 'negative';
  reasoning: string[];
}

export interface MarketAnalysis {
  type: AnalystType.MARKET;
  regime: 'BULL' | 'BEAR' | 'RANGEBOUND' | 'HIGH_VOL' | 'LOW_VOL' | 'UNKNOWN';
  marketBreadth: {
    advancing: number;
    declining: number;
    ratio: number;
  };
  sectorRotation: {
    sector: string;
    momentum: number;
  }[];
  correlations: {
    index: string;
    correlation: number;
  }[];
  outlook: 'positive' | 'neutral' | 'negative';
  reasoning: string[];
}

export interface SentimentAnalysis {
  type: AnalystType.SENTIMENT;
  overall: {
    score: number; // -1 to 1
    label: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
  };
  sources: {
    news: number;
    social: number;
    analyst: number;
    institutional: number;
  };
  keyThemes: string[];
  momentum: 'improving' | 'stable' | 'deteriorating';
  outlook: 'positive' | 'neutral' | 'negative';
  reasoning: string[];
}

export type AnalysisResult = FundamentalAnalysis | TechnicalAnalysis | MarketAnalysis | SentimentAnalysis;

export interface AnalystPayload {
  stockCode: string;
  marketData?: {
    close: number;
    high: number;
    low: number;
    volume: number;
    open?: number;
  }[];
  fundamentalData?: Record<string, unknown>;
  sentimentData?: Record<string, unknown>;
}

export interface AnalystResponse {
  type: AnalystType;
  stockCode: string;
  analysis: AnalysisResult;
  confidence: number;
  timestamp: number;
}