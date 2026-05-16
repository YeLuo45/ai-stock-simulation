/**
 * MemoryStore - Zustand store for Dream Two-Stage Memory
 * wakeMemories[], dreamMemories[]
 */
import { create } from 'zustand';
import type { WakeMemory, DreamMemory, MemoryConfig, MemoryQuery, MemoryStats } from './types';
import { DEFAULT_MEMORY_CONFIG } from './types';
import { addWakeMemory, getWakeMemories, getWakeMemoryCount } from './WakeMemory';
import { getDreamMemories, getDreamMemoryCount } from './DreamMemory';
import { runConsolidation, startDreamWorker, stopDreamWorker } from './DreamWorker';

const CONFIG_KEY = 'dream-memory-config';

function loadConfig(): MemoryConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    return stored ? { ...DEFAULT_MEMORY_CONFIG, ...JSON.parse(stored) } : DEFAULT_MEMORY_CONFIG;
  } catch {
    return DEFAULT_MEMORY_CONFIG;
  }
}

function saveConfig(config: MemoryConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

interface MemoryStore {
  // State
  wakeMemories: WakeMemory[];
  dreamMemories: DreamMemory[];
  config: MemoryConfig;
  isConsolidating: boolean;
  lastConsolidated: number | null;

  // Actions
  addMemory: (entry: Omit<WakeMemory, 'id' | 'timestamp'>) => WakeMemory;
  queryMemories: (query?: MemoryQuery) => (WakeMemory | DreamMemory)[];
  consolidate: () => Promise<DreamMemory[]>;
  getStats: () => MemoryStats;
  updateConfig: (updates: Partial<MemoryConfig>) => void;
  setConsolidating: (val: boolean) => void;
  setLastConsolidated: (time: number) => void;
  loadFromStorage: () => void;
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  wakeMemories: [],
  dreamMemories: [],
  config: loadConfig(),
  isConsolidating: false,
  lastConsolidated: null,

  addMemory: (entry) => {
    const config = get().config;
    const newMemory = addWakeMemory(entry, config);
    set(state => ({
      wakeMemories: [newMemory, ...state.wakeMemories].slice(0, config.maxWakeMemories),
    }));
    return newMemory;
  },

  queryMemories: (query) => {
    const wakeResults = getWakeMemories(query);
    // Mix with dream memories, sort by timestamp/importance
    const dreamResults = getDreamMemories().filter(d => {
      if (!query) return true;
      if (query.symbol && !d.tags.some(tag => tag.includes(query.symbol!))) return false;
      if (query.tags && query.tags.length > 0) {
        return query.tags.some(tag => d.tags.includes(tag));
      }
      return true;
    });
    
    // Combine and sort
    const combined: (WakeMemory | DreamMemory)[] = [...wakeResults, ...dreamResults];
    combined.sort((a, b) => {
      const aTime = 'timestamp' in a ? a.timestamp : a.lastConsolidated;
      const bTime = 'timestamp' in b ? b.timestamp : b.lastConsolidated;
      return bTime - aTime;
    });
    
    if (query?.limit) {
      return combined.slice(0, query.limit);
    }
    return combined;
  },

  consolidate: async () => {
    set({ isConsolidating: true });
    try {
      const config = get().config;
      const dreams = await runConsolidation(config);
      const now = Date.now();
      set(state => ({
        dreamMemories: dreams,
        lastConsolidated: now,
        isConsolidating: false,
      }));
      return dreams;
    } catch (err) {
      set({ isConsolidating: false });
      throw err;
    }
  },

  getStats: () => {
    const wakeCount = getWakeMemoryCount();
    const dreamCount = getDreamMemoryCount();
    const wakeMemories = getWakeMemories();
    const byType: Record<string, number> = {};
    
    for (const m of wakeMemories) {
      byType[m.type] = (byType[m.type] || 0) + 1;
    }

    return {
      wakeCount,
      dreamCount,
      totalWake: wakeCount,
      totalDream: dreamCount,
      byType,
    };
  },

  updateConfig: (updates) => {
    const newConfig = { ...get().config, ...updates };
    saveConfig(newConfig);
    set({ config: newConfig });

    // Restart worker if interval changed
    if (updates.autoDreamEnabled !== undefined || updates.consolidateIntervalMs !== undefined) {
      stopDreamWorker();
      if (newConfig.autoDreamEnabled) {
        startDreamWorker(newConfig);
      }
    }
  },

  setConsolidating: (val) => set({ isConsolidating: val }),
  setLastConsolidated: (time) => set({ lastConsolidated: time }),

  loadFromStorage: () => {
    const wakes = getWakeMemories();
    const dreams = getDreamMemories();
    const config = loadConfig();
    set({
      wakeMemories: wakes,
      dreamMemories: dreams,
      config,
    });

    // Start auto consolidation if enabled
    if (config.autoDreamEnabled) {
      startDreamWorker(config);
    }
  },
}));

// Initialize on module load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useMemoryStore.getState().loadFromStorage();
  }, 100);
}