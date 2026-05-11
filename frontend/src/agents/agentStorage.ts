/**
 * Agent Storage Layer
 * localStorage persistence for agent state and pipeline logs
 */

import type { AgentMetadata, PipelineLogEntry, PipelineState } from './messages';

const STORAGE_PREFIX = 'ai_stock:agent:';

function getKey(name: string, suffix: string): string {
  return `${STORAGE_PREFIX}${name}:${suffix}`;
}

export function getAgentMetadata(name: string): AgentMetadata | null {
  const raw = localStorage.getItem(getKey(name, 'metadata'));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AgentMetadata;
  } catch {
    return null;
  }
}

export function saveAgentMetadata(metadata: AgentMetadata): void {
  localStorage.setItem(getKey(metadata.name, 'metadata'), JSON.stringify(metadata));
}

export function updateAgentRun(
  name: string,
  status: AgentMetadata['status'],
  duration: number,
  error?: string
): AgentMetadata {
  const existing = getAgentMetadata(name);
  const metadata: AgentMetadata = {
    name: name as AgentMetadata['name'],
    status,
    lastRun: Date.now(),
    lastDuration: duration,
    lastError: error,
  };
  if (existing) {
    metadata.name = existing.name;
  }
  saveAgentMetadata(metadata);
  return metadata;
}

const PIPELINE_LOGS_KEY = `${STORAGE_PREFIX}pipeline:logs`;
const MAX_LOG_ENTRIES = 100;

export function getPipelineLogs(): PipelineLogEntry[] {
  const raw = localStorage.getItem(PIPELINE_LOGS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PipelineLogEntry[];
  } catch {
    return [];
  }
}

export function addPipelineLog(entry: PipelineLogEntry): void {
  const logs = getPipelineLogs();
  logs.push(entry);
  const trimmed = logs.slice(-MAX_LOG_ENTRIES);
  localStorage.setItem(PIPELINE_LOGS_KEY, JSON.stringify(trimmed));
}

export function clearPipelineLogs(): void {
  localStorage.removeItem(PIPELINE_LOGS_KEY);
}

export function getLastPipelineState(): PipelineState | null {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}pipeline:last_state`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PipelineState;
  } catch {
    return null;
  }
}

export function savePipelineState(state: PipelineState): void {
  localStorage.setItem(`${STORAGE_PREFIX}pipeline:last_state`, JSON.stringify(state));
}

export function clearAgentStorage(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}
