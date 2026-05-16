/**
 * DreamWorker - 后台压缩合并 worker
 * 定时触发（setInterval）
 * 调用 LLMProvider 生成总结
 */
import type { WakeMemory, DreamMemory, MemoryConfig } from './types';
import { DEFAULT_MEMORY_CONFIG } from './types';
import { getWakeMemories, addWakeMemory } from './WakeMemory';
import { consolidate } from './DreamMemory';
import { createLLMProvider } from '../debate/LLMProvider';
import type { ChatMessage } from '../debate/LLMProvider';
import { useStore } from '../../store';

const SUMMARIZE_SYSTEM_PROMPT = `你是一个记忆压缩助手，负责将多条相关记忆合并为一条简洁的总结。
请用中文总结以下记忆的核心内容，提取关键信息，去除冗余，保留最重要的见解。
总结应该清晰、简洁，通常不超过100字。`;

let consolidationTimer: ReturnType<typeof setInterval> | null = null;
let isConsolidating = false;

/**
 * Call LLM to generate a summary for a group of memories
 */
async function summarizeWithLLM(memories: WakeMemory[]): Promise<string> {
  const { llmConfig } = useStore.getState();
  
  if (!llmConfig.enabled || !llmConfig.apiKey) {
    // Fallback to simple concatenation
    return memories.slice(0, 3).map(m => m.content.slice(0, 60)).join('; ');
  }

  try {
    const provider = createLLMProvider(llmConfig.provider);
    const memoryTexts = memories.map((m, i) => 
      `[${i + 1}] [${m.type}] ${m.content}`
    ).join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT },
      { role: 'user', content: `请总结以下记忆：\n${memoryTexts}\n\n请用一句话总结核心内容：` }
    ];

    const response = await provider.chat(messages, {
      temperature: 0.3,
      max_tokens: 200,
    });

    if (response.error) {
      console.warn('LLM summarize failed:', response.error);
      return memories.slice(0, 3).map(m => m.content.slice(0, 60)).join('; ');
    }

    return response.content || memories.slice(0, 3).map(m => m.content.slice(0, 60)).join('; ');
  } catch (err) {
    console.warn('LLM summarize error:', err);
    return memories.slice(0, 3).map(m => m.content.slice(0, 60)).join('; ');
  }
}

/**
 * Run consolidation manually
 */
export async function runConsolidation(
  config: MemoryConfig = DEFAULT_MEMORY_CONFIG
): Promise<DreamMemory[]> {
  if (isConsolidating) {
    console.log('Consolidation already in progress, skipping...');
    return [];
  }

  isConsolidating = true;

  try {
    const wakeMemories = getWakeMemories();
    
    if (wakeMemories.length === 0) {
      return [];
    }

    // Perform consolidation
    const dreamMemories = consolidate(wakeMemories, config);

    console.log(`Consolidation complete: ${wakeMemories.length} wake -> ${dreamMemories.length} dream memories`);
    return dreamMemories;
  } finally {
    isConsolidating = false;
  }
}

/**
 * Start automatic consolidation timer
 */
export function startDreamWorker(config: MemoryConfig = DEFAULT_MEMORY_CONFIG): void {
  if (consolidationTimer) {
    clearInterval(consolidationTimer);
  }

  if (!config.autoDreamEnabled) {
    console.log('Auto dream consolidation disabled');
    return;
  }

  console.log(`Dream worker started, interval: ${config.consolidateIntervalMs}ms`);

  consolidationTimer = setInterval(async () => {
    if (!isConsolidating) {
      try {
        await runConsolidation(config);
      } catch (err) {
        console.error('Dream worker error:', err);
      }
    }
  }, config.consolidateIntervalMs);
}

/**
 * Stop automatic consolidation timer
 */
export function stopDreamWorker(): void {
  if (consolidationTimer) {
    clearInterval(consolidationTimer);
    consolidationTimer = null;
    console.log('Dream worker stopped');
  }
}

/**
 * Check if consolidation is currently running
 */
export function isWorkerRunning(): boolean {
  return consolidationTimer !== null;
}

/**
 * Check if consolidation is in progress
 */
export function isConsolidatingMemories(): boolean {
  return isConsolidating;
}

/**
 * Get time until next scheduled consolidation
 */
export function getNextConsolidationTime(): number | null {
  // This is a simplified version - actual implementation would track timer state
  return consolidationTimer ? Date.now() + 60000 : null; // Approximate
}