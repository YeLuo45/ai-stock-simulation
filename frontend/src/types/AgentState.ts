/**
 * AgentState and Phase Types
 * Defines the state machine for agent pipeline phases
 */

import type { AgentMessage } from './AgentMessage';

export enum Phase {
  IDLE = 'IDLE',
  DATA_RESEARCH = 'DATA_RESEARCH',
  ANALYSIS = 'ANALYSIS',
  DEBATE = 'DEBATE',
  JUDGMENT = 'JUDGMENT',
  EXECUTION = 'EXECUTION',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface AgentState {
  conversationId: string;
  currentPhase: Phase;
  previousPhase: Phase | null;
  agentsInvolved: string[];
  messages: AgentMessage[];
  results: Record<string, unknown>;
  startedAt: number;
  updatedAt: number;
  error?: string;
}

export const PHASE_ORDER: Phase[] = [
  Phase.IDLE,
  Phase.DATA_RESEARCH,
  Phase.ANALYSIS,
  Phase.DEBATE,
  Phase.JUDGMENT,
  Phase.EXECUTION,
  Phase.COMPLETED,
];

export const PHASE_LABELS: Record<Phase, string> = {
  [Phase.IDLE]: '空闲',
  [Phase.DATA_RESEARCH]: '数据研究',
  [Phase.ANALYSIS]: '分析',
  [Phase.DEBATE]: '辩论',
  [Phase.JUDGMENT]: '裁判',
  [Phase.EXECUTION]: '执行',
  [Phase.COMPLETED]: '完成',
  [Phase.FAILED]: '失败',
};

export const PHASE_COLORS: Record<Phase, string> = {
  [Phase.IDLE]: 'text-gray-400',
  [Phase.DATA_RESEARCH]: 'text-blue-400',
  [Phase.ANALYSIS]: 'text-green-400',
  [Phase.DEBATE]: 'text-yellow-400',
  [Phase.JUDGMENT]: 'text-cyan-400',
  [Phase.EXECUTION]: 'text-purple-400',
  [Phase.COMPLETED]: 'text-accent-success',
  [Phase.FAILED]: 'text-accent-danger',
};

export const VALID_PHASE_TRANSITIONS: Record<Phase, Phase[]> = {
  [Phase.IDLE]: [Phase.DATA_RESEARCH, Phase.FAILED],
  [Phase.DATA_RESEARCH]: [Phase.ANALYSIS, Phase.FAILED],
  [Phase.ANALYSIS]: [Phase.DEBATE, Phase.EXECUTION, Phase.FAILED],
  [Phase.DEBATE]: [Phase.JUDGMENT, Phase.FAILED],
  [Phase.JUDGMENT]: [Phase.EXECUTION, Phase.ANALYSIS, Phase.FAILED],
  [Phase.EXECUTION]: [Phase.COMPLETED, Phase.FAILED],
  [Phase.COMPLETED]: [],
  [Phase.FAILED]: [Phase.IDLE],
};
