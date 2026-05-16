/**
 * Agent Message Protocol
 * Defines the message contract between agents in the multi-agent pipeline
 */

export type AgentName = 'selector' | 'backtester' | 'risk' | 'executor' | 'bull_debater' | 'bear_debater' | 'judge' | 'research' | 'bull' | 'bear' | 'news';
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
  // Parallel processing fields
  parallelCandidates?: SelectedSignal[];
  parallelBacktestResults?: BacktestResultPayload[];
  parallelRiskResults?: RiskResultPayload[];
  selectedForExecution?: SelectedSignal;
  // Debate fields
  debateResults?: DebateResultPayload[];
}

export interface DebateResultPayload {
  symbol: string;
  decision: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  bullScore: number;
  bearScore: number;
  tradeQuantityPct: number;
  reasoning: string;
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
export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  selector: '选股Agent',
  backtester: '回测Agent',
  risk: '风控Agent',
  executor: '执行Agent',
  bull_debater: '多方辩手',
  bear_debater: '空方辩手',
  judge: '裁判Agent',
  research: '研究Agent',
  bull: '多方辩手',
  bear: '空方辩手',
  news: '新闻Agent',
};

export const AGENT_COLORS: Record<string, string> = {
  selector: 'text-blue-400',
  backtester: 'text-green-400',
  risk: 'text-yellow-400',
  executor: 'text-purple-400',
  bull_debater: 'text-green-400',
  bear_debater: 'text-red-400',
  judge: 'text-cyan-400',
  research: 'text-blue-400',
  bull: 'text-green-400',
  bear: 'text-red-400',
  news: 'text-orange-400',
};

export const AGENT_BG_COLORS: Record<string, string> = {
  selector: 'bg-blue-500',
  backtester: 'bg-green-500',
  risk: 'bg-yellow-500',
  executor: 'bg-purple-500',
  bull_debater: 'bg-green-500',
  bear_debater: 'bg-red-500',
  judge: 'bg-cyan-500',
  research: 'bg-blue-500',
  bull: 'bg-green-500',
  bear: 'bg-red-500',
  news: 'bg-orange-500',
};

// Debate types
export interface Argument {
  point: string;        // 论点文本
  weight: number;       // 权重 0-1
  evidence?: string;    // 支撑证据
}

export interface DebateRound {
  stockCode: string;
  round: number;
  bullArguments: Argument[];
  bearArguments: Argument[];
  judgeVerdict: JudgeVerdict;
  timestamp: number;
}

export interface JudgeVerdict {
  decision: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;   // 0-1
  bullScore: number;
  bearScore: number;
  reasoning: string;
}

// Paper Trade types
export interface PaperTradeSnapshot {
  traceId: string;
  timestamp: number;
  balance: number;
  initialBalance: number;
  positions: PaperPosition[];
  orders: PaperOrder[];
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  totalPnLPct: number;
}

export interface PaperPosition {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

export interface PaperOrder {
  id: string;
  symbol: string;
  name: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalAmount: number;
  timestamp: number;
  traceId: string;
}
