/**
 * Agent Message Protocol
 * Defines the message contract between agents in the multi-agent pipeline
 */

export type AgentName = 'selector' | 'backtester' | 'risk' | 'executor';
export type AgentFrom = AgentName | 'supervisor';
export type MessageType = 'request' | 'response' | 'error';
export type MessageDestination = AgentName | 'supervisor' | 'broadcast';

export interface AgentMessage<T = unknown> {
  id: string;
  from: AgentFrom;
  to: MessageDestination;
  type: MessageType;
  payload: T;
  timestamp: number;
  traceId?: string;
}

export interface AgentMetadata {
  name: AgentName;
  status: 'idle' | 'running' | 'success' | 'error';
  lastRun?: number;
  lastDuration?: number;
  lastError?: string;
}

export interface PipelineState {
  traceId: string;
  candidates: string[];
  selectedSignal?: SelectedSignal;
  backtestResult?: BacktestResultPayload;
  riskResult?: RiskResultPayload;
  executionResult?: ExecutionResultPayload;
  errors: PipelineError[];
  startTime: number;
  endTime?: number;
}

export interface SelectedSignal {
  symbol: string;
  score: number;
  reason: string;
  timestamp: number;
}

export interface BacktestResultPayload {
  symbol: string;
  passed: boolean;
  totalReturn?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  signal?: 'buy' | 'sell' | 'hold';
  reason?: string;
}

export interface RiskResultPayload {
  approved: boolean;
  reasonCode?: RiskReasonCode;
  reason?: string;
  portfolioValue?: number;
  positionValue?: number;
  drawdown?: number;
}

export interface RiskReasonCode {
  code: string;
  detail: string;
}

export interface ExecutionResultPayload {
  success: boolean;
  tradeId?: number;
  symbol?: string;
  action?: 'buy' | 'sell';
  quantity?: number;
  price?: number;
  retryCount?: number;
  error?: string;
}

export interface PipelineError {
  agent: AgentName;
  message: string;
  code?: string;
  timestamp: number;
}

export interface PipelineLogEntry {
  id: string;
  traceId: string;
  agent: AgentName | 'supervisor';
  action: string;
  duration: number;
  timestamp: number;
  details?: string;
}

// Helper to create a message
export function createAgentMessage<T>(
  from: AgentFrom,
  to: MessageDestination,
  type: MessageType,
  payload: T,
  traceId?: string
): AgentMessage<T> {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    from,
    to,
    type,
    payload,
    timestamp: Date.now(),
    traceId,
  };
}

// Helper to create a trace ID
export function createTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Agent status helpers
export const AGENT_DISPLAY_NAMES: Record<AgentName, string> = {
  selector: '选股Agent',
  backtester: '回测Agent',
  risk: '风控Agent',
  executor: '执行Agent',
};

export const AGENT_COLORS: Record<AgentName, string> = {
  selector: 'text-blue-400',
  backtester: 'text-green-400',
  risk: 'text-yellow-400',
  executor: 'text-purple-400',
};

export const AGENT_BG_COLORS: Record<AgentName, string> = {
  selector: 'bg-blue-500',
  backtester: 'bg-green-500',
  risk: 'bg-yellow-500',
  executor: 'bg-purple-500',
};
