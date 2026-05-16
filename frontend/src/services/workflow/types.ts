/**
 * Phase Workflow Types
 * Defines interfaces for the four-phase workflow engine: Scan → Analyze → Debate → Execute
 */

// ============ Phase Configuration ============

export type DataSourceType = 'tushare' | 'akshare' | 'eastmoney' | 'mock';

export interface ScanFilters {
  excludeSt: boolean;
  excludeSuspended: boolean;
  excludeDelisted: boolean;
  minVolume: number;      // 日均成交额下限（万元）
  minPrice?: number;      // 最低股价
  maxPrice?: number;     // 最高股价
}

export interface ScanConfig {
  enabled: boolean;
  dataSource: DataSourceType;
  filters: ScanFilters;
  minCandidates: number;   // 最少候选股数量，达不到则终止流程
}

export interface AnalyzeConfig {
  enabled: boolean;
  topN: number;           // 取评分前N名
  factors: string[];       // 使用的因子列表
  icThreshold: number;    // IC阈值过滤（IC值低于此则过滤）
  humanReview: boolean;   // 是否需要人工确认
  minScore?: number;      // 最低评分门槛
}

export interface DebateConfig {
  enabled: boolean;
  confidenceThreshold: number;  // 置信度阈值（低于此值则跳过）
  maxRounds: number;            // 最大辩论轮数
  humanConfirm: boolean;        // 是否需要人工确认后才执行
}

export interface ExecuteConfig {
  dryRun: boolean;       // 是否仅模拟（不真实下单）
  maxPositions: number;  // 最大持仓数
  positionSizePct: number; // 每次下单仓位百分比（%）
  orderTimeoutSec: number;  // 订单超时时间（秒）
}

export interface PhaseConfig {
  scan: ScanConfig;
  analyze: AnalyzeConfig;
  debate: DebateConfig;
  execute: ExecuteConfig;
}

// ============ Phase Result ============

export type PhaseStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed' | 'terminated';

export interface ScanResultData {
  candidates: WorkflowCandidate[];
  totalScanned: number;
  filteredOut: number;
}

export interface AnalyzeResultData {
  scoredCandidates: WorkflowCandidate[];
  topCandidates: WorkflowCandidate[];
  icScores: Record<string, number>;
}

export interface DebateResultData {
  decisions: DebateDecision[];
  avgConfidence: number;
}

export interface ExecuteResultData {
  orders: ExecutedOrder[];
  successCount: number;
  failedCount: number;
}

export interface PhaseResult {
  phase: 'scan' | 'analyze' | 'debate' | 'execute';
  status: PhaseStatus;
  success: boolean;
  data?: ScanResultData | AnalyzeResultData | DebateResultData | ExecuteResultData;
  error?: string;
  duration?: number;    // 耗时（毫秒）
  timestamp: number;
  message?: string;
}

// ============ Workflow Context ============

export interface WorkflowCandidate {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  volume: number;
  pe?: number;
  pb?: number;
  roe?: number;
  market_cap?: number;
  score?: number;        // 多因子评分
  confidence?: number;   // 辩论置信度
  decision?: DebateDecision['decision'];
  tradeAction?: 'BUY' | 'SELL' | 'HOLD' | 'SKIP';
  quantityPct?: number;  // 建议仓位比例
}

export interface DebateDecision {
  symbol: string;
  name: string;
  decision: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  bullScore: number;
  bearScore: number;
  reasoning: string;
  tradeAction: 'BUY' | 'SELL' | 'HOLD' | 'SKIP';
  quantityPct: number;
}

export interface ExecutedOrder {
  symbol: string;
  name: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'success' | 'failed' | 'pending';
  orderId?: string;
  error?: string;
}

export interface WorkflowContext {
  symbols?: string[];              // 可选，指定分析哪些股票；空则全市场扫描
  positions: import('../../types').Position[];
  portfolioCash: number;
  candidates?: WorkflowCandidate[]; // Scan阶段产出
  scoredCandidates?: WorkflowCandidate[]; // Analyze阶段产出
  debateDecisions?: DebateDecision[]; // Debate阶段产出
}

// ============ Default Config ============

export const DEFAULT_PHASE_CONFIG: PhaseConfig = {
  scan: {
    enabled: true,
    dataSource: 'mock',
    filters: {
      excludeSt: true,
      excludeSuspended: true,
      excludeDelisted: true,
      minVolume: 1000, // 1000万
    },
    minCandidates: 5,
  },
  analyze: {
    enabled: true,
    topN: 10,
    factors: ['pe', 'roe', 'volume', 'change'],
    icThreshold: 0.02,
    humanReview: false,
    minScore: 0.3,
  },
  debate: {
    enabled: true,
    confidenceThreshold: 0.4,
    maxRounds: 1,
    humanConfirm: false,
  },
  execute: {
    dryRun: true,
    maxPositions: 5,
    positionSizePct: 20,
    orderTimeoutSec: 30,
  },
};