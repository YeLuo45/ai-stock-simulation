/**
 * Dream Two-Stage Memory System Types
 */

/** WakeMemory - 清醒阶段：原子写入，实时可查询 */
export interface WakeMemory {
  id: string;
  timestamp: number;
  type: 'trade' | 'debate' | 'analysis' | 'market_event';
  content: string;
  importance: number;       // 0-1 重要程度
  tags: string[];
  symbol?: string;
  outcome?: 'profit' | 'loss' | 'neutral';
}

/** DreamMemory - 睡眠阶段：压缩合并后的总结记忆 */
export interface DreamMemory {
  id: string;
  summary: string;         // 压缩后的总结
  sourceIds: string[];     // 来源记忆 ID
  mergedCount: number;     // 合并了多少条
  lastConsolidated: number;// 上次合并时间
  importance: number;      // 0-1
  tags: string[];
}

/** 记忆配置 */
export interface MemoryConfig {
  maxWakeMemories: number;      // 默认 1000，超出后 FIFO 淘汰
  maxDreamMemories: number;     // 默认 200
  consolidateThreshold: number; // 默认 10 条同类触发压缩
  consolidateIntervalMs: number;// 默认 1 小时 (3600000)
  autoDreamEnabled: boolean;    // 是否自动压缩
}

/** 记忆查询条件 */
export interface MemoryQuery {
  symbol?: string;
  type?: string;
  tags?: string[];
  from?: number;
  to?: number;
  limit?: number;
}

/** 记忆统计 */
export interface MemoryStats {
  wakeCount: number;
  dreamCount: number;
  totalWake: number;
  totalDream: number;
  byType: Record<string, number>;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxWakeMemories: 1000,
  maxDreamMemories: 200,
  consolidateThreshold: 10,
  consolidateIntervalMs: 3600000, // 1 hour
  autoDreamEnabled: true,
};