/**
 * Debater Types - Bull, Bear, and Judge specializations
 */

export enum DebaterType {
  BULL = 'BULL',
  BEAR = 'BEAR',
  JUDGE = 'JUDGE',
}

export interface DebaterConfig {
  type: DebaterType;
  enabled: boolean;
  style?: 'aggressive' | 'moderate' | 'conservative';
}

export interface DebateArgument {
  point: string;
  weight: number; // 0-1
  evidence?: string;
}

export interface BullDebatePayload {
  stockCode: string;
  analysisSummary: string;
  priceTarget?: number;
  timeHorizon?: 'short' | 'medium' | 'long';
}

export interface BearDebatePayload {
  stockCode: string;
  analysisSummary: string;
  priceTarget?: number;
  timeHorizon?: 'short' | 'medium' | 'long';
}

export interface BullDebateResponse {
  type: DebaterType.BULL;
  stockCode: string;
  arguments: DebateArgument[];
  overallConfidence: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD';
  timestamp: number;
}

export interface BearDebateResponse {
  type: DebaterType.BEAR;
  stockCode: string;
  arguments: DebateArgument[];
  overallConfidence: number;
  recommendation: 'STRONG_SELL' | 'SELL' | 'HOLD';
  timestamp: number;
}

export interface JudgeVerdict {
  decision: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number; // 0-1
  bullScore: number;
  bearScore: number;
  reasoning: string;
}

export interface JudgeDebatePayload {
  stockCode: string;
  bullArguments: DebateArgument[];
  bearArguments: DebateArgument[];
  positions: {
    symbol: string;
    quantity: number;
    avg_cost: number;
    market_value: number;
  }[];
  portfolioCash: number;
}

export interface JudgeDebateResponse {
  type: DebaterType.JUDGE;
  stockCode: string;
  verdict: JudgeVerdict;
  timestamp: number;
}

export type DebaterResponse = BullDebateResponse | BearDebateResponse | JudgeDebateResponse;

export interface DebaterPayload {
  stockCode: string;
  type: DebaterType;
  payload: BullDebatePayload | BearDebatePayload | JudgeDebatePayload;
}