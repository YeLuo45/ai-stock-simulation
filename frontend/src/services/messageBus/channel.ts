/**
 * Channel Constants - Event channel names for MessageBus
 * Provides type-safe event channel identifiers
 */
export const Channel = {
  // Regime events
  REGIME_DETECTED: 'regime:detected',
  REGIME_CHANGED: 'regime:changed',
  
  // Data events
  DATA_UPDATE: 'data:update',
  DATA_READY: 'data:ready',
  DATA_ERROR: 'data:error',
  
  // Workflow events
  WORKFLOW_START: 'workflow:start',
  WORKFLOW_PHASE_START: 'workflow:phase:start',
  WORKFLOW_PHASE_COMPLETE: 'workflow:phase:complete',
  WORKFLOW_COMPLETE: 'workflow:complete',
  WORKFLOW_ERROR: 'workflow:error',
  
  // Strategy events
  STRATEGY_UPDATE: 'strategy:update',
  STRATEGY_REBALANCE: 'strategy:rebalance',
  
  // Trade events
  TRADE_SIGNAL: 'trade:signal',
  TRADE_EXECUTE: 'trade:execute',
  TRADE_COMPLETE: 'trade:complete',
  
  // Market events
  MARKET_TICK: 'market:tick',
  MARKET_ALERT: 'market:alert',
} as const;

export type ChannelName = typeof Channel[keyof typeof Channel];