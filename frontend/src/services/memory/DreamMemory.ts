/**
 * DreamMemory - 睡眠阶段压缩合并
 * 同标签 > threshold 条 → 生成总结
 * 30天前降采样、已平仓归档
 */
import type { WakeMemory, DreamMemory, MemoryConfig } from './types';
import { DEFAULT_MEMORY_CONFIG } from './types';

const DREAM_STORAGE_KEY = 'dream-memories';

function generateId(): string {
  return `dream-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadDreamMemories(): DreamMemory[] {
  try {
    const stored = localStorage.getItem(DREAM_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveDreamMemories(memories: DreamMemory[]): void {
  try {
    localStorage.setItem(DREAM_STORAGE_KEY, JSON.stringify(memories));
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Group memories by tag
 */
function groupByTag(memories: WakeMemory[]): Record<string, WakeMemory[]> {
  const groups: Record<string, WakeMemory[]> = {};
  for (const m of memories) {
    for (const tag of m.tags) {
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(m);
    }
  }
  return groups;
}

/**
 * Calculate average importance for a set of memories
 */
function avgImportance(memories: WakeMemory[]): number {
  if (memories.length === 0) return 0;
  return memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;
}

/**
 * Consolidate wake memories into dream memories
 * - 同标签 > threshold 条 → 生成总结
 * - 30天前降采样保留关键节点
 * - 已平仓交易归档
 */
export function consolidate(
  wakeMemories: WakeMemory[],
  config: MemoryConfig = DEFAULT_MEMORY_CONFIG
): DreamMemory[] {
  const dreams = loadDreamMemories();
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // 1. Archive closed trades (with outcome)
  const closedTrades = wakeMemories.filter(
    m => m.type === 'trade' && m.outcome !== undefined && m.outcome !== 'neutral'
  );
  for (const trade of closedTrades) {
    // Create a dream memory for each closed trade outcome
    const existing = dreams.find(
      d => d.sourceIds.includes(trade.id) && d.mergedCount === 1
    );
    if (!existing) {
      const summary = `交易${trade.symbol || ''}结果:${
        trade.outcome === 'profit' ? '盈利' : trade.outcome === 'loss' ? '亏损' : '中性'
      }。内容:${trade.content.slice(0, 100)}`;
      const dream: DreamMemory = {
        id: generateId(),
        summary,
        sourceIds: [trade.id],
        mergedCount: 1,
        lastConsolidated: now,
        importance: trade.importance,
        tags: trade.tags,
      };
      dreams.push(dream);
    }
  }

  // 2. Downsample old memories (30+ days old) - keep key nodes
  const oldMemories = wakeMemories.filter(m => m.timestamp < thirtyDaysAgo);
  const recentThreshold = now - 7 * 24 * 60 * 60 * 1000; // 7 days ago
  const keyOldMemories = oldMemories.filter(
    m => m.importance > 0.7 || m.timestamp > recentThreshold
  );
  for (const mem of keyOldMemories) {
    const existing = dreams.find(d => d.sourceIds.includes(mem.id));
    if (!existing) {
      const summary = mem.content.slice(0, 150) + (mem.content.length > 150 ? '...' : '');
      const dream: DreamMemory = {
        id: generateId(),
        summary,
        sourceIds: [mem.id],
        mergedCount: 1,
        lastConsolidated: now,
        importance: mem.importance,
        tags: mem.tags,
      };
      dreams.push(dream);
    }
  }

  // 3. Consolidate by tag groups exceeding threshold
  const tagGroups = groupByTag(wakeMemories);
  for (const [tag, group] of Object.entries(tagGroups)) {
    if (group.length > config.consolidateThreshold) {
      // Check if already consolidated recently
      const existingDream = dreams.find(
        d => d.tags.includes(tag) &&
          d.mergedCount === group.length &&
          (now - d.lastConsolidated) < 60 * 60 * 1000 // within 1 hour
      );
      if (!existingDream) {
        const summary = generateSummary(tag, group);
        const dream: DreamMemory = {
          id: generateId(),
          summary,
          sourceIds: group.map(m => m.id),
          mergedCount: group.length,
          lastConsolidated: now,
          importance: avgImportance(group),
          tags: [tag, ...getCommonTags(group)],
        };
        dreams.push(dream);
      }
    }
  }

  // 4. Remove duplicates and enforce max
  const uniqueDreams = dreams.filter((d, i, arr) =>
    arr.findIndex(x => x.id === d.id) === i
  );

  // Sort by importance and recency
  uniqueDreams.sort((a, b) => {
    const aScore = a.importance * 0.7 + a.lastConsolidated / Date.now() * 0.3;
    const bScore = b.importance * 0.7 + b.lastConsolidated / Date.now() * 0.3;
    return bScore - aScore;
  });

  // Enforce max dream memories
  if (uniqueDreams.length > config.maxDreamMemories) {
    uniqueDreams.splice(config.maxDreamMemories);
  }

  saveDreamMemories(uniqueDreams);
  return uniqueDreams;
}

/**
 * Generate a summary for a group of memories (placeholder - actual LLM call done in DreamWorker)
 */
function generateSummary(tag: string, memories: WakeMemory[]): string {
  // Simple concatenation summary - DreamWorker will call LLM to refine
  const contentSnippets = memories.slice(0, 5).map(m => m.content.slice(0, 50)).join('; ');
  return `[${tag}类记忆 ${memories.length}条] ${contentSnippets}${memories.length > 5 ? '...' : ''}`;
}

/**
 * Get common tags among memories
 */
function getCommonTags(memories: WakeMemory[]): string[] {
  if (memories.length === 0) return [];
  const tagCounts: Record<string, number> = {};
  for (const m of memories) {
    for (const tag of m.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  return Object.entries(tagCounts)
    .filter(([_, count]) => count >= memories.length * 0.5) // tag appears in 50%+ memories
    .map(([tag]) => tag);
}

/**
 * Get all dream memories
 */
export function getDreamMemories(): DreamMemory[] {
  return loadDreamMemories();
}

/**
 * Get dream memory by ID
 */
export function getDreamMemoryById(id: string): DreamMemory | undefined {
  return loadDreamMemories().find(d => d.id === id);
}

/**
 * Delete a dream memory by ID
 */
export function deleteDreamMemory(id: string): boolean {
  const dreams = loadDreamMemories();
  const idx = dreams.findIndex(d => d.id === id);
  if (idx === -1) return false;
  dreams.splice(idx, 1);
  saveDreamMemories(dreams);
  return true;
}

/**
 * Get count of dream memories
 */
export function getDreamMemoryCount(): number {
  return loadDreamMemories().length;
}