/**
 * AgentMessage Protocol Types
 * Defines the message contract between agents in the multi-agent pipeline
 */

export enum MessageType {
  ANALYSIS_REQUEST = 'ANALYSIS_REQUEST',
  ANALYSIS_RESPONSE = 'ANALYSIS_RESPONSE',
  DEBATE_REQUEST = 'DEBATE_REQUEST',
  DEBATE_RESPONSE = 'DEBATE_RESPONSE',
  TRADE_REQUEST = 'TRADE_REQUEST',
  TRADE_RESPONSE = 'TRADE_RESPONSE',
  ERROR = 'ERROR',
  HEARTBEAT = 'HEARTBEAT',
}

export interface AgentMessage {
  id: string;
  sender: string;
  receiver: string;
  type: MessageType;
  content: Record<string, unknown>;
  timestamp: number;
  conversationId: string;
  parentId?: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  retryCount: number;
}

export interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelayMs: number;
}

export const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelayMs: 1000,
};

export const ERROR_RETRY_MAP: Record<string, RetryConfig> = {
  'NETWORK_TIMEOUT': { maxRetries: 3, backoffMultiplier: 2, initialDelayMs: 1000 },
  'LLM_ERROR': { maxRetries: 2, backoffMultiplier: 1.5, initialDelayMs: 2000 },
  'RATE_LIMIT': { maxRetries: 5, backoffMultiplier: 3, initialDelayMs: 5000 },
};
