/**
 * Agent Session Management
 * Stores agent LLM outputs and shared context during pipeline execution
 * Uses sessionStorage for pipeline lifecycle, localStorage for persistence
 */

import type { SelectedSignal, BacktestResultPayload, RiskResultPayload, ExecutionResultPayload } from './messages';
import type { Position } from '../types';

export interface SharedContext {
  marketSnapshot?: {
    symbols: string[];
    prices: Record<string, number>;
    changes: Record<string, number>;
    volumes: Record<string, number>;
  };
  accountState?: {
    cash: number;
    positions: Position[];
    totalValue: number;
    totalProfitLoss: number;
    totalProfitLossPct: number;
  };
}

export interface AgentLLMOutput {
  agentName: string;
  sessionId: string;
  timestamp: number;
  llmResponse?: string;
  parsedOutput?: Record<string, unknown>;
  latency?: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: string;
}

export interface AgentSessionData {
  sessionId: string;
  createdAt: number;
  selectorOutput?: AgentLLMOutput;
  backtesterOutput?: AgentLLMOutput;
  riskOutput?: AgentLLMOutput;
  executorOutput?: AgentLLMOutput;
  shared: SharedContext;
}

const SESSION_STORAGE_PREFIX = 'agent_session_';

export function getAgentSession(sessionId: string): AgentSessionData | null {
  try {
    const key = `${SESSION_STORAGE_PREFIX}${sessionId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as AgentSessionData;
  } catch {
    return null;
  }
}

export function saveAgentSession(sessionId: string, data: Partial<AgentSessionData>): void {
  try {
    const key = `${SESSION_STORAGE_PREFIX}${sessionId}`;
    const existing = getAgentSession(sessionId) || {
      sessionId,
      createdAt: Date.now(),
      shared: {},
    };
    const updated: AgentSessionData = {
      ...existing,
      ...data,
      sessionId,
    };
    sessionStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save agent session:', err);
  }
}

export function updateSharedContext(sessionId: string, context: Partial<SharedContext>): void {
  const session = getAgentSession(sessionId);
  if (session) {
    session.shared = { ...session.shared, ...context };
    saveAgentSession(sessionId, { shared: session.shared });
  } else {
    saveAgentSession(sessionId, { shared: context });
  }
}

export function saveAgentLLMOutput(
  sessionId: string,
  agentName: 'selector' | 'backtester' | 'risk' | 'executor',
  output: AgentLLMOutput
): void {
  const keyMap = {
    selector: 'selectorOutput',
    backtester: 'backtesterOutput',
    risk: 'riskOutput',
    executor: 'executorOutput',
  } as const;
  saveAgentSession(sessionId, { [keyMap[agentName]]: output });
}

export function clearAgentSession(sessionId: string): void {
  const key = `${SESSION_STORAGE_PREFIX}${sessionId}`;
  sessionStorage.removeItem(key);
}

export function clearAllAgentSessions(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(SESSION_STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

export function buildContextSummary(session: AgentSessionData): string {
  const parts: string[] = [];

  if (session.shared.marketSnapshot) {
    const ms = session.shared.marketSnapshot;
    const priceList = ms.symbols
      .map(s => `${s}: ¥${ms.prices[s]?.toFixed(2) || 'N/A'} (${ms.changes[s] >= 0 ? '+' : ''}${(ms.changes[s] || 0).toFixed(2)}%)`)
      .join(', ');
    parts.push(`市场行情: ${priceList}`);
  }

  if (session.shared.accountState) {
    const as = session.shared.accountState;
    const posList = as.positions.length > 0
      ? as.positions.map(p => `${p.symbol}: ${p.quantity}股 @ ¥${p.avg_cost.toFixed(2)}`).join(', ')
      : '无持仓';
    parts.push(`账户状态: 现金 ¥${as.cash.toFixed(2)}, 总市值 ¥${as.totalValue.toFixed(2)}, 盈亏 ${(as.totalProfitLossPct * 100).toFixed(2)}%`);
    parts.push(`持仓: ${posList}`);
  }

  return parts.join('\n');
}
