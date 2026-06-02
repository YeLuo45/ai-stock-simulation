/**
 * DebatePhase - Enumeration of the 6 pipeline phases
 */

export enum DebatePhase {
  SCAN = 'scan',
  ANALYZE = 'analyze',
  RESEARCH = 'research',
  DEBATE = 'debate',
  EXECUTE = 'execute',
  REVIEW = 'review',
}

export interface PhaseResult {
  phase: DebatePhase;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  timestamp: number;
}

export interface PipelineContext {
  traceId: string;
  stockCode: string;
  candidates: string[];
  phaseResults: Map<DebatePhase, PhaseResult>;
  currentPhase: DebatePhase;
  startTime: number;
  endTime?: number;
  errors: string[];
}

export const PHASE_SEQUENCE: DebatePhase[] = [
  DebatePhase.SCAN,
  DebatePhase.ANALYZE,
  DebatePhase.RESEARCH,
  DebatePhase.DEBATE,
  DebatePhase.EXECUTE,
  DebatePhase.REVIEW,
];

export const PHASE_NAMES: Record<DebatePhase, string> = {
  [DebatePhase.SCAN]: '扫描阶段',
  [DebatePhase.ANALYZE]: '分析阶段',
  [DebatePhase.RESEARCH]: '研究阶段',
  [DebatePhase.DEBATE]: '辩论阶段',
  [DebatePhase.EXECUTE]: '执行阶段',
  [DebatePhase.REVIEW]: '复盘阶段',
};

export const PHASE_DESCRIPTIONS: Record<DebatePhase, string> = {
  [DebatePhase.SCAN]: '扫描市场数据，识别候选股票',
  [DebatePhase.ANALYZE]: '分析师群提供领域分析',
  [DebatePhase.RESEARCH]: '研究支持提供数据/新闻',
  [DebatePhase.DEBATE]: '多空辩论，裁判决策',
  [DebatePhase.EXECUTE]: '执行交易指令',
  [DebatePhase.REVIEW]: '复盘交易结果，更新记忆',
};