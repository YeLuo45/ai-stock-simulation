/**
 * Regime Module - Market state detection and strategy pool management
 */
export * from './types';
export { RegimeDetector } from './RegimeDetector';
export { StrategyPool, DEFAULT_POOL } from './StrategyPool';
export { useRegimeStore, getRegimeState, getCurrentRegime, getRegimeConfidence } from './RegimeStore';