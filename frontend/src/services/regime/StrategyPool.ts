/**
 * Strategy Pool - Strategy configuration management for each regime
 * Provides adaptive parameter switching based on market state
 */
import type { Regime, RegimeConfig, StrategyPoolConfig } from './types';
import { messageBus, Channel } from '../messageBus';

// Storage key for localStorage persistence
const STRATEGY_POOL_KEY = 'regime_strategy_pool';

// Default strategy pool configuration
export const DEFAULT_POOL: StrategyPoolConfig = {
  BULL: {
    factorWeights: { momentum: 0.5, value: 0.2, quality: 0.3 },
    maxPositionPct: 20,
    stopLossPct: 8,
    takeProfitPct: 25,
    maxDrawdownPct: 15,
  },
  BEAR: {
    factorWeights: { value: 0.4, dividend: 0.3, lowVol: 0.3 },
    maxPositionPct: 10,
    stopLossPct: 5,
    takeProfitPct: 15,
    maxDrawdownPct: 8,
  },
  RANGEBOUND: {
    factorWeights: { meanReversion: 0.4, momentum: 0.3, value: 0.3 },
    maxPositionPct: 15,
    stopLossPct: 6,
    takeProfitPct: 18,
    maxDrawdownPct: 12,
  },
  UNKNOWN: {
    factorWeights: { momentum: 0.3, value: 0.3, quality: 0.2, meanReversion: 0.2 },
    maxPositionPct: 10,
    stopLossPct: 5,
    takeProfitPct: 15,
    maxDrawdownPct: 10,
  },
};

// Current pool state (can be modified at runtime)
let currentPool: StrategyPoolConfig = loadFromStorage();

// Track current regime for change detection
let currentRegime: Regime | null = null;

// Subscribe to regime:detected events for event-driven strategy switching
function setupRegimeSubscription(): void {
  messageBus.on<{ regime: Regime; confidence: number }>(Channel.REGIME_DETECTED, ({ regime, confidence }) => {
    if (regime !== currentRegime) {
      const oldRegime = currentRegime;
      currentRegime = regime;
      console.log(`[StrategyPool] Regime changed: ${oldRegime ?? 'none'} -> ${regime} (confidence: ${confidence.toFixed(2)})`);
      
      // Emit strategy:update event for downstream subscribers
      messageBus.emit(Channel.STRATEGY_UPDATE, {
        previousRegime: oldRegime,
        currentRegime: regime,
        config: StrategyPool.getConfig(regime),
        confidence,
      });
    }
  });
}

// Initialize subscription
setupRegimeSubscription();

function loadFromStorage(): StrategyPoolConfig {
  try {
    const stored = localStorage.getItem(STRATEGY_POOL_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all regimes have configs
      return { ...DEFAULT_POOL, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_POOL };
}

function saveToStorage(pool: StrategyPoolConfig): void {
  try {
    localStorage.setItem(STRATEGY_POOL_KEY, JSON.stringify(pool));
  } catch {}
}

export const StrategyPool = {
  /**
   * Get configuration for a specific regime
   */
  getConfig(regime: Regime): RegimeConfig {
    const config = currentPool[regime];
    if (config) return config;
    
    // Fallback to UNKNOWN or default
    return currentPool['UNKNOWN'] || DEFAULT_POOL['UNKNOWN']!;
  },

  /**
   * Get the entire strategy pool
   */
  getPool(): StrategyPoolConfig {
    return { ...currentPool };
  },

  /**
   * Update configuration for a specific regime
   */
  updateConfig(regime: Regime, config: Partial<RegimeConfig>): void {
    currentPool = {
      ...currentPool,
      [regime]: {
        ...(currentPool[regime] || DEFAULT_POOL[regime] || DEFAULT_POOL['UNKNOWN']!),
        ...config,
      },
    };
    saveToStorage(currentPool);
  },

  /**
   * Reset to default pool
   */
  reset(): void {
    currentPool = { ...DEFAULT_POOL };
    saveToStorage(currentPool);
  },

  /**
   * Get factor weight for a specific regime and factor
   */
  getFactorWeight(regime: Regime, factor: string): number {
    const config = this.getConfig(regime);
    return config.factorWeights[factor] || 0.25; // Default 0.25 if not specified
  },

  /**
   * Get all factor weights for a regime
   */
  getFactorWeights(regime: Regime): Record<string, number> {
    return this.getConfig(regime).factorWeights;
  },
};