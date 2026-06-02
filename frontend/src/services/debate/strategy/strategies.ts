/**
 * Built-in Debate Strategies - Pre-configured strategies for each market regime
 */

import type { DebateStrategy } from './types';

/**
 * Bull market strategy - Aggressive growth focus
 * Emphasizes Technical and Sentiment analysts, rides upward momentum
 */
export const BULL_STRATEGY: DebateStrategy = {
  name: 'bull_market_aggressive',
  regime: 'bull_market',
  weights: {
    TechnicalAnalyst: 1.2,
    SentimentAnalyst: 1.1,
    FundamentalAnalyst: 0.9,
    MarketAnalyst: 1.0,
  },
  minConfidence: 0.65,
  phases: ['fundamental', 'technical', 'sentiment', 'synthesis', 'decision'],
};

/**
 * Bear market strategy - Defensive risk management
 * Emphasizes Technical and Risk analysts, protects capital
 */
export const BEAR_STRATEGY: DebateStrategy = {
  name: 'bear_market_defensive',
  regime: 'bear_market',
  weights: {
    TechnicalAnalyst: 1.3,
    RiskAnalyst: 1.2,
    SentimentAnalyst: 0.8,
    FundamentalAnalyst: 0.7,
  },
  minConfidence: 0.70,
  phases: ['technical', 'risk', 'sentiment', 'synthesis', 'decision'],
};

/**
 * Sideways/range-bound market strategy
 * Balanced approach, plays support/resistance bounces
 */
export const SIDEWAYS_STRATEGY: DebateStrategy = {
  name: 'sideways_range_bound',
  regime: 'sideways',
  weights: {
    TechnicalAnalyst: 1.0,
    SentimentAnalyst: 1.0,
    MarketAnalyst: 0.9,
    FundamentalAnalyst: 0.8,
  },
  minConfidence: 0.60,
  phases: ['technical', 'sentiment', 'synthesis', 'decision'],
};

/**
 * Volatile market strategy - Capital protection priority
 * Heavy risk management, reduced position sizes, wider stops
 */
export const VOLATILE_STRATEGY: DebateStrategy = {
  name: 'volatile_protective',
  regime: 'volatile',
  weights: {
    RiskAnalyst: 1.4,
    TechnicalAnalyst: 1.0,
    SentimentAnalyst: 0.7,
    MarketAnalyst: 0.8,
  },
  minConfidence: 0.75,
  phases: ['risk', 'technical', 'sentiment', 'synthesis', 'decision'],
};

/**
 * All built-in strategies mapped by regime
 */
export const STRATEGIES_BY_REGIME: Record<string, DebateStrategy> = {
  bull_market: BULL_STRATEGY,
  bear_market: BEAR_STRATEGY,
  sideways: SIDEWAYS_STRATEGY,
  volatile: VOLATILE_STRATEGY,
};

/**
 * Get strategy for a given regime
 */
export function getStrategyForRegime(regime: string): DebateStrategy {
  return STRATEGIES_BY_REGIME[regime] ?? SIDEWAYS_STRATEGY;
}

/**
 * Get all built-in strategies
 */
export function getAllStrategies(): DebateStrategy[] {
  return [BULL_STRATEGY, BEAR_STRATEGY, SIDEWAYS_STRATEGY, VOLATILE_STRATEGY];
}
