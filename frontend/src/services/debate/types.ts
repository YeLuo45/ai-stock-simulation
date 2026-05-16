/**
 * Debate Types - Core type definitions for the multi-agent debate system
 */

export interface DebateMessage {
  id: string;
  round: number;
  speaker: 'bull' | 'bear' | 'judge';
  content: DebateContent;
  timestamp: number;
}

export interface DebateContent {
  arguments: string[];      // Chinese arguments
  confidence: number;       // 0-1 confidence score
  verdict?: 'bullish' | 'bearish' | 'neutral'; // judge only
}

export interface DebateResult {
  symbol: string;
  decision: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  bullScore: number;
  bearScore: number;
  bullArguments: DebateArgument[];
  bearArguments: DebateArgument[];
  reasoning: string;        // Chinese reasoning
  timestamp: number;
  tradeAction: 'BUY' | 'SELL' | 'HOLD' | 'SKIP';
  tradeQuantityPct: number;
}

export interface DebateArgument {
  point: string;
  weight: number;       // 0-1
  evidence?: string;
}

export interface DebateConfig {
  enabled: boolean;
  schedule: string;         // cron expression, default: '0 15 * * 1-5'
  dryRun: boolean;          // default: true
  confidenceThreshold: number; // default: 0.6
  maxPositions: number;     // default: 5
  marketScan: 'all' | 'watchlist'; // default: 'watchlist'
}

export interface DebateRound {
  stockCode: string;
  round: number;
  bullArguments: DebateArgument[];
  bearArguments: DebateArgument[];
  judgeVerdict: JudgeVerdict;
  timestamp: number;
}

export interface JudgeVerdict {
  decision: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;       // 0-1
  bullScore: number;
  bearScore: number;
  reasoning: string;
}

// Default configuration
export const DEFAULT_DEBATE_CONFIG: DebateConfig = {
  enabled: false,
  schedule: '0 15 * * 1-5',
  dryRun: true,
  confidenceThreshold: 0.6,
  maxPositions: 5,
  marketScan: 'watchlist',
};

// Storage key for auto-run config
export const AUTO_RUN_CONFIG_KEY = 'ai-stock-auto-run-config';

// Decision display labels (Chinese)
export const DECISION_LABELS: Record<DebateResult['decision'], string> = {
  STRONG_BUY: '强烈买入',
  BUY: '买入',
  HOLD: '观望',
  SELL: '卖出',
  STRONG_SELL: '强烈卖出',
};

export const TRADE_ACTION_LABELS: Record<DebateResult['tradeAction'], string> = {
  BUY: '买入',
  SELL: '卖出',
  HOLD: '持有',
  SKIP: '跳过',
};