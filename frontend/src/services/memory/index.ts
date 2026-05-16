/**
 * Dream Two-Stage Memory System
 * Unified export for addMemory, queryMemories, consolidate, getStats
 */
import { useMemoryStore } from './MemoryStore';
import type { WakeMemory, DreamMemory, MemoryConfig, MemoryQuery, MemoryStats } from './types';

// Re-export types
export type { WakeMemory, DreamMemory, MemoryConfig, MemoryQuery, MemoryStats } from './types';

/**
 * MemoryService - Unified memory interface
 */
export const MemoryService = {
  /**
   * Add a new memory entry (goes to Wake layer)
   */
  addMemory: (entry: Omit<WakeMemory, 'id' | 'timestamp'>): WakeMemory => {
    return useMemoryStore.getState().addMemory(entry);
  },

  /**
   * Query memories from both Wake and Dream layers
   */
  queryMemories: (query?: MemoryQuery): (WakeMemory | DreamMemory)[] => {
    return useMemoryStore.getState().queryMemories(query);
  },

  /**
   * Trigger manual consolidation
   */
  consolidate: async (): Promise<DreamMemory[]> => {
    return useMemoryStore.getState().consolidate();
  },

  /**
   * Get memory statistics
   */
  getStats: (): MemoryStats => {
    return useMemoryStore.getState().getStats();
  },

  /**
   * Get current config
   */
  getConfig: (): MemoryConfig => {
    return useMemoryStore.getState().config;
  },

  /**
   * Update memory config
   */
  updateConfig: (updates: Partial<MemoryConfig>): void => {
    useMemoryStore.getState().updateConfig(updates);
  },

  /**
   * Get all wake memories
   */
  getWakeMemories: (query?: MemoryQuery): WakeMemory[] => {
    return useMemoryStore.getState().wakeMemories as WakeMemory[];
  },

  /**
   * Get all dream memories
   */
  getDreamMemories: (): DreamMemory[] => {
    return useMemoryStore.getState().dreamMemories;
  },

  /**
   * Check if consolidation is in progress
   */
  isConsolidating: (): boolean => {
    return useMemoryStore.getState().isConsolidating;
  },

  /**
   * Get last consolidation time
   */
  getLastConsolidated: (): number | null => {
    return useMemoryStore.getState().lastConsolidated;
  },
};

// Default export
export default MemoryService;