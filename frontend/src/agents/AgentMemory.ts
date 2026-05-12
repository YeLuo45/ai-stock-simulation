/**
 * Agent Memory System
 * Cross-session LLM decision memory using localStorage
 */

import type { AgentName } from './messages';

export interface ConversationTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokens?: { input: number; output: number };
}

export interface AgentMemory {
  id: string;
  sessionId: string;
  timestamp: number;
  agents: {
    selector?: {
      symbol: string;
      score: number;
      reason: string;
      llmResponse: string;
      tokens?: { input: number; output: number };
      conversation?: ConversationTurn[];
    };
    backtester?: {
      passed: boolean;
      reason: string;
      llmResponse: string;
      metrics?: { totalReturn: number; sharpeRatio: number; winRate: number };
      conversation?: ConversationTurn[];
    };
    risk?: {
      approved: boolean;
      reason: string;
      llmResponse: string;
      conversation?: ConversationTurn[];
    };
    executor?: {
      success: boolean;
      executedQuantity: number;
      executedPrice: number;
      llmResponse: string;
      conversation?: ConversationTurn[];
    };
  };
  marketContext?: {
    indexLevel?: number;
    topGainers?: string[];
    topLosers?: string[];
  };
  tags: string[];
  outcome?: {
    tracked: boolean;
    entryPrice: number;
    latestPrice?: number;
    latestDate?: number;
    pnlPercent?: number;
    pnlAbsolute?: number;
    maxPrice?: number;
    minPrice?: number;
    exitPrice?: number;
    exitDate?: number;
    status: 'open' | 'closed';
  };
}

interface QueryConfig {
  symbols?: string[];
  agentTypes?: ('selector' | 'backtester' | 'risk' | 'executor')[];
  startDate?: number;
  endDate?: number;
  tags?: string[];
  limit?: number;
  withOutcome?: boolean;
}

interface MemoryStats {
  totalMemories: number;
  avgProfitBySelector: number;
  topSymbols: Array<{ symbol: string; count: number }>;
  recentTrend: 'improving' | 'declining' | 'stable';
}

const STORAGE_KEY = 'agent_memories';
const MAX_MEMORIES = 500;
const OUTCOME_QUEUE_KEY = 'agent_outcome_queue';

export interface OutcomeQueueItem {
  memoryId: string;
  symbol: string;
  entryPrice: number;
  entryDate: number;
}

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function autoTag(memory: AgentMemory): string[] {
  const tags: string[] = [];
  if (memory.agents.executor?.success) tags.push('executed');
  if (!memory.agents.risk?.approved) tags.push('risk-rejected');
  if (memory.agents.executor?.success && memory.agents.backtester?.passed) tags.push('full-pipeline');
  if (memory.agents.backtester?.passed) tags.push('backtest-passed');
  if (memory.agents.backtester && !memory.agents.backtester.passed) tags.push('backtest-failed');
  if (memory.outcome?.status === 'closed' && (memory.outcome.pnlPercent ?? 0) > 0) tags.push('profit');
  if (memory.outcome?.status === 'closed' && (memory.outcome.pnlPercent ?? 0) < 0) tags.push('loss');
  return tags;
}

export function getAllMemories(): AgentMemory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const memories = JSON.parse(raw) as AgentMemory[];
    return Array.isArray(memories) ? memories : [];
  } catch {
    return [];
  }
}

function saveAllMemories(memories: AgentMemory[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

export function saveAgentMemory(memory: Omit<AgentMemory, 'id'>): string {
  const memories = getAllMemories();

  const newMemory: AgentMemory = {
    ...memory,
    id: generateId(),
    tags: autoTag({ ...memory, id: '' } as AgentMemory),
  };

  memories.unshift(newMemory);

  // Enforce max limit - remove oldest entries
  const trimmed = memories.slice(0, MAX_MEMORIES);
  saveAllMemories(trimmed);
  return newMemory.id;
}

export function queryMemory(config: QueryConfig): AgentMemory[] {
  const memories = getAllMemories();

  return memories.filter(memory => {
    // Symbol filter
    if (config.symbols && config.symbols.length > 0) {
      const symbol = memory.agents.selector?.symbol;
      if (!symbol || !config.symbols.includes(symbol)) return false;
    }

    // Agent types filter
    if (config.agentTypes && config.agentTypes.length > 0) {
      const hasMatchingAgent = config.agentTypes.some(type => {
        switch (type) {
          case 'selector': return !!memory.agents.selector;
          case 'backtester': return !!memory.agents.backtester;
          case 'risk': return !!memory.agents.risk;
          case 'executor': return !!memory.agents.executor;
          default: return false;
        }
      });
      if (!hasMatchingAgent) return false;
    }

    // Date range filter
    if (config.startDate && memory.timestamp < config.startDate) return false;
    if (config.endDate && memory.timestamp > config.endDate) return false;

    // Tags filter
    if (config.tags && config.tags.length > 0) {
      const hasAllTags = config.tags.every(tag => memory.tags.includes(tag));
      if (!hasAllTags) return false;
    }

    return true;
  }).slice(0, config.limit ?? 100);
}

export function getMemoryStats(): MemoryStats {
  const memories = getAllMemories();
  const totalMemories = memories.length;

  if (totalMemories === 0) {
    return {
      totalMemories: 0,
      avgProfitBySelector: 0,
      topSymbols: [],
      recentTrend: 'stable',
    };
  }

  // Calculate average score by selector
  const selectorMemories = memories.filter(m => m.agents.selector);
  const avgProfitBySelector = selectorMemories.length > 0
    ? selectorMemories.reduce((sum, m) => sum + (m.agents.selector?.score || 0), 0) / selectorMemories.length
    : 0;

  // Top symbols
  const symbolCounts: Record<string, number> = {};
  for (const mem of memories) {
    const symbol = mem.agents.selector?.symbol;
    if (symbol) {
      symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
    }
  }
  const topSymbols = Object.entries(symbolCounts)
    .map(([symbol, count]) => ({ symbol, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Recent trend (last 20 memories)
  const recentMemories = memories.slice(0, Math.min(20, totalMemories));
  const olderMemories = memories.slice(Math.min(20, totalMemories), Math.min(40, totalMemories));

  const calcSuccessRate = (mems: AgentMemory[]) => {
    const executed = mems.filter(m => m.agents.executor?.success);
    return mems.length > 0 ? executed.length / mems.length : 0;
  };

  const recentRate = calcSuccessRate(recentMemories);
  const olderRate = calcSuccessRate(olderMemories);

  let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentRate > olderRate + 0.1) recentTrend = 'improving';
  else if (recentRate < olderRate - 0.1) recentTrend = 'declining';

  return {
    totalMemories,
    avgProfitBySelector,
    topSymbols,
    recentTrend,
  };
}

// Outcome Queue Functions
export function addToOutcomeQueue(item: OutcomeQueueItem): void {
  const queue = getOutcomeQueue();
  // Avoid duplicates
  const existing = queue.findIndex(q => q.memoryId === item.memoryId);
  if (existing >= 0) {
    queue[existing] = item;
  } else {
    queue.push(item);
  }
  localStorage.setItem(OUTCOME_QUEUE_KEY, JSON.stringify(queue));
}

export function getOutcomeQueue(): OutcomeQueueItem[] {
  try {
    const raw = localStorage.getItem(OUTCOME_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OutcomeQueueItem[];
  } catch {
    return [];
  }
}

export function removeFromOutcomeQueue(memoryId: string): void {
  const queue = getOutcomeQueue().filter(q => q.memoryId !== memoryId);
  localStorage.setItem(OUTCOME_QUEUE_KEY, JSON.stringify(queue));
}

export function updateMemoryOutcome(memoryId: string, updates: Partial<AgentMemory['outcome']>): void {
  const memories = getAllMemories();
  const idx = memories.findIndex(m => m.id === memoryId);
  if (idx < 0) return;

  if (!memories[idx].outcome) {
    memories[idx].outcome = {
      tracked: false,
      entryPrice: 0,
      status: 'open',
    };
  }
  memories[idx].outcome = { ...memories[idx].outcome!, ...updates };
  // Re-tag after outcome update
  memories[idx].tags = autoTag(memories[idx]);
  saveAllMemories(memories);
}

export async function processOutcomeQueue(): Promise<void> {
  const { getRealtimeQuote } = await import('../services/yahooFinance');
  const memories = getAllMemories();
  const queue = getOutcomeQueue();
  const now = Date.now();
  const STALE_DAYS = 30;
  const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

  let changed = false;

  // First, sync queue items to memory outcomes
  for (const item of queue) {
    const memIdx = memories.findIndex(m => m.id === item.memoryId);
    if (memIdx >= 0) {
      const mem = memories[memIdx];
      if (!mem.outcome || !mem.outcome.tracked) {
        // Initialize outcome from queue item
        updateMemoryOutcome(item.memoryId, {
          tracked: true,
          entryPrice: item.entryPrice,
          status: 'open',
        });
        changed = true;
      }
    } else {
      // Memory doesn't exist, remove from queue
      removeFromOutcomeQueue(item.memoryId);
      changed = true;
    }
  }

  // Re-fetch after potential updates
  const updatedMemories = getAllMemories();

  for (const memory of updatedMemories) {
    // Only process open outcomes
    if (memory.outcome?.status !== 'open') continue;

    const symbol = memory.agents.selector?.symbol;
    if (!symbol) continue;

    try {
      const quote = await getRealtimeQuote(symbol);
      const latestPrice = quote.price;

      // Stale detection: no price change or too old
      const isStale = latestPrice === memory.outcome.entryPrice ||
        (now - memory.timestamp) > STALE_MS;

      const pnlAbsolute = latestPrice - memory.outcome.entryPrice;
      const pnlPercent = (pnlAbsolute / memory.outcome.entryPrice) * 100;

      const updates: Partial<AgentMemory['outcome']> = {
        latestPrice,
        latestDate: now,
        pnlPercent,
        pnlAbsolute,
        maxPrice: memory.outcome.maxPrice
          ? Math.max(memory.outcome.maxPrice, latestPrice)
          : latestPrice,
        minPrice: memory.outcome.minPrice
          ? Math.min(memory.outcome.minPrice, latestPrice)
          : latestPrice,
      };

      if (isStale || latestPrice === 0) {
        updates.status = 'closed';
        updates.exitPrice = latestPrice;
        updates.exitDate = now;
        removeFromOutcomeQueue(memory.id);
      }

      updateMemoryOutcome(memory.id, updates);
      changed = true;
    } catch {
      // If quote fails, mark as stale closed
      if (memory.outcome?.tracked) {
        updateMemoryOutcome(memory.id, {
          status: 'closed',
          exitPrice: memory.outcome.latestPrice || memory.outcome.entryPrice,
          exitDate: now,
        });
        removeFromOutcomeQueue(memory.id);
        changed = true;
      }
    }
  }

  // If any changed, trigger a storage event for UI refresh
  if (changed) {
    window.dispatchEvent(new Event('storage'));
  }
}

export function buildMemoryContext(query: string, memories: AgentMemory[], withOutcome = false): string {
  if (memories.length === 0) {
    return 'No relevant memories found.';
  }

  const lines: string[] = [];
  lines.push(`=== Relevant Agent Memories (${memories.length} found) ===\n`);

  for (let i = 0; i < Math.min(memories.length, 5); i++) {
    const mem = memories[i];
    const date = new Date(mem.timestamp).toLocaleString();

    lines.push(`--- Memory ${i + 1} [${date}] ---`);

    if (mem.agents.selector) {
      lines.push(`SELECTOR: ${mem.agents.selector.symbol} (score: ${mem.agents.selector.score.toFixed(3)})`);
      lines.push(`  Reason: ${mem.agents.selector.reason.slice(0, 200)}`);
      if (mem.agents.selector.tokens) {
        lines.push(`  Tokens: in=${mem.agents.selector.tokens.input}, out=${mem.agents.selector.tokens.output}`);
      }
    }

    if (mem.agents.backtester) {
      lines.push(`BACKTESTER: ${mem.agents.backtester.passed ? 'PASSED' : 'FAILED'}`);
      lines.push(`  ${mem.agents.backtester.reason.slice(0, 150)}`);
      if (mem.agents.backtester.metrics) {
        const { totalReturn, sharpeRatio, winRate } = mem.agents.backtester.metrics;
        lines.push(`  Metrics: return=${totalReturn.toFixed(2)}%, sharpe=${sharpeRatio.toFixed(2)}, winRate=${winRate.toFixed(2)}`);
      }
    }

    if (mem.agents.risk) {
      lines.push(`RISK: ${mem.agents.risk.approved ? 'APPROVED' : 'REJECTED'}`);
      lines.push(`  ${mem.agents.risk.reason.slice(0, 150)}`);
    }

    if (mem.agents.executor) {
      lines.push(`EXECUTOR: ${mem.agents.executor.success ? 'SUCCESS' : 'FAILED'}`);
      if (mem.agents.executor.success) {
        lines.push(`  Qty: ${mem.agents.executor.executedQuantity} @ ¥${mem.agents.executor.executedPrice.toFixed(2)}`);
      }
    }

    if (withOutcome && mem.outcome?.tracked) {
      const { entryPrice, latestPrice, pnlPercent, pnlAbsolute, status } = mem.outcome;
      lines.push(`OUTCOME: ${status.toUpperCase()}`);
      if (latestPrice !== undefined) {
        lines.push(`  买入价 ¥${entryPrice.toFixed(2)}，最新价 ¥${latestPrice.toFixed(2)}，盈亏 ${pnlPercent !== undefined ? pnlPercent.toFixed(2) : 'N/A'}% (${pnlAbsolute !== undefined ? (pnlAbsolute > 0 ? '+' : '') + pnlAbsolute.toFixed(2) : 'N/A'})`);
      }
    }

    if (mem.tags.length > 0) {
      lines.push(`Tags: ${mem.tags.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

export function clearAllMemories(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportMemories(): AgentMemory[] {
  return getAllMemories();
}

export function importMemories(memories: AgentMemory[]): void {
  const valid = memories.filter(m => m.id && m.sessionId && m.timestamp && m.agents);
  saveAllMemories(valid.slice(0, MAX_MEMORIES));
}
