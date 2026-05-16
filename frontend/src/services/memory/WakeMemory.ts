/**
 * WakeMemory - 清醒阶段写入
 * 原子写入，立即可查询，超出 maxWakeMemories 时 FIFO 淘汰最旧记录
 */
import type { WakeMemory, MemoryQuery, MemoryConfig } from './types';
import { DEFAULT_MEMORY_CONFIG } from './types';

const WAKE_STORAGE_KEY = 'dream-wake-memories';

function generateId(): string {
  return `wake-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadWakeMemories(): WakeMemory[] {
  try {
    const stored = localStorage.getItem(WAKE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveWakeMemories(memories: WakeMemory[]): void {
  try {
    localStorage.setItem(WAKE_STORAGE_KEY, JSON.stringify(memories));
  } catch {
    // Storage full or unavailable - ignore
  }
}

/**
 * Add a new wake memory
 * 原子写入，立即可查询
 */
export function addWakeMemory(
  entry: Omit<WakeMemory, 'id' | 'timestamp'>,
  config: MemoryConfig = DEFAULT_MEMORY_CONFIG
): WakeMemory {
  const memories = loadWakeMemories();

  const newMemory: WakeMemory = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
  };

  // Atomic write - add to front
  memories.unshift(newMemory);

  // FIFO eviction if exceeds max
  if (memories.length > config.maxWakeMemories) {
    // Remove oldest entries (at the end)
    memories.splice(config.maxWakeMemories);
  }

  saveWakeMemories(memories);
  return newMemory;
}

/**
 * Query wake memories with filters
 */
export function getWakeMemories(query?: MemoryQuery): WakeMemory[] {
  let memories = loadWakeMemories();

  if (query) {
    if (query.symbol) {
      memories = memories.filter(m => m.symbol === query.symbol);
    }
    if (query.type) {
      memories = memories.filter(m => m.type === query.type);
    }
    if (query.tags && query.tags.length > 0) {
      memories = memories.filter(m =>
        query.tags!.some(tag => m.tags.includes(tag))
      );
    }
    if (query.from !== undefined) {
      memories = memories.filter(m => m.timestamp >= query.from!);
    }
    if (query.to !== undefined) {
      memories = memories.filter(m => m.timestamp <= query.to!);
    }
    // Sort by timestamp descending
    memories.sort((a, b) => b.timestamp - a.timestamp);
    if (query.limit) {
      memories = memories.slice(0, query.limit);
    }
  }

  return memories;
}

/**
 * Get a single wake memory by ID
 */
export function getWakeMemoryById(id: string): WakeMemory | undefined {
  const memories = loadWakeMemories();
  return memories.find(m => m.id === id);
}

/**
 * Delete a wake memory by ID
 */
export function deleteWakeMemory(id: string): boolean {
  const memories = loadWakeMemories();
  const idx = memories.findIndex(m => m.id === id);
  if (idx === -1) return false;
  memories.splice(idx, 1);
  saveWakeMemories(memories);
  return true;
}

/**
 * Get count of wake memories
 */
export function getWakeMemoryCount(): number {
  return loadWakeMemories().length;
}