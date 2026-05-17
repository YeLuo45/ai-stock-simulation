/**
 * Regime Store - Zustand store for regime state management
 * Persists to localStorage for session continuity
 */
import { create } from 'zustand';
import type { Regime, RegimeDetectionResult, RegimeHistoryEntry } from './types';
import { StrategyPool } from './StrategyPool';

// Storage keys
const REGIME_STATE_KEY = 'regime_current_state';
const REGIME_HISTORY_KEY = 'regime_history';

// Load persisted state
function loadPersistedState(): {
  currentRegime: Regime;
  confidence: number;
  lastDetection: number;
} {
  try {
    const stored = localStorage.getItem(REGIME_STATE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  
  return {
    currentRegime: 'UNKNOWN',
    confidence: 0,
    lastDetection: 0,
  };
}

function persistState(state: {
  currentRegime: Regime;
  confidence: number;
  lastDetection: number;
}): void {
  try {
    localStorage.setItem(REGIME_STATE_KEY, JSON.stringify(state));
  } catch {}
}

function loadHistory(): RegimeHistoryEntry[] {
  try {
    const stored = localStorage.getItem(REGIME_HISTORY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return [];
}

function persistHistory(history: RegimeHistoryEntry[]): void {
  try {
    // Keep last 50 entries
    const trimmed = history.slice(-50);
    localStorage.setItem(REGIME_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
}

interface RegimeState {
  // Current regime
  currentRegime: Regime;
  confidence: number;
  lastDetection: number;
  indicators: RegimeDetectionResult['indicators'] | null;
  
  // Detection state
  isDetecting: boolean;
  detectionError: string | null;
  
  // History
  regimeHistory: RegimeHistoryEntry[];
  
  // Actions
  setRegime: (result: RegimeDetectionResult) => void;
  setDetecting: (detecting: boolean) => void;
  setError: (error: string | null) => void;
  clearHistory: () => void;
  getCurrentConfig: () => import('./types').RegimeConfig | null;
}

export const useRegimeStore = create<RegimeState>((set, get) => {
  const persisted = loadPersistedState();
  const history = loadHistory();
  
  return {
    // Initial state from persisted
    currentRegime: persisted.currentRegime,
    confidence: persisted.confidence,
    lastDetection: persisted.lastDetection,
    indicators: null,
    
    // Detection state
    isDetecting: false,
    detectionError: null,
    
    // History
    regimeHistory: history,
    
    setRegime: (result: RegimeDetectionResult) => {
      const state = {
        currentRegime: result.regime,
        confidence: result.confidence,
        lastDetection: result.detectedAt,
        indicators: result.indicators,
      };
      
      persistState(state);
      
      // Add to history
      const historyEntry: RegimeHistoryEntry = {
        regime: result.regime,
        confidence: result.confidence,
        timestamp: result.detectedAt,
        reason: `Trend: ${result.indicators.trend}, Vol: ${result.indicators.volatility}, Sent: ${result.indicators.sentiment}`,
      };
      
      const newHistory = [...get().regimeHistory, historyEntry];
      persistHistory(newHistory);
      
      set({
        ...state,
        regimeHistory: newHistory,
        detectionError: null,
      });
    },
    
    setDetecting: (isDetecting: boolean) => set({ isDetecting }),
    
    setError: (detectionError: string | null) => set({ detectionError }),
    
    clearHistory: () => {
      persistHistory([]);
      set({ regimeHistory: [] });
    },
    
    getCurrentConfig: () => {
      const { currentRegime } = get();
      return StrategyPool.getConfig(currentRegime);
    },
  };
});

// Export for direct access
export const getRegimeState = () => useRegimeStore.getState();
export const getCurrentRegime = () => useRegimeStore.getState().currentRegime;
export const getRegimeConfidence = () => useRegimeStore.getState().confidence;