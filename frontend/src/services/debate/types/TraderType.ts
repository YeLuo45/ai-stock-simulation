/**
 * Trader Types - Trading execution specialization
 */

export enum TraderType {
  TRADE = 'TRADE',
}

export interface TraderConfig {
  type: TraderType;
  enabled: boolean;
  maxSlippage: number;
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

export type TradeAction = 'BUY' | 'SELL' | 'HOLD';
export type TradeQuantityType = 'percentage' | 'fixed' | 'all';

export interface TradeOrder {
  id: string;
  symbol: string;
  action: TradeAction;
  quantityType: TradeQuantityType;
  quantity: number; // percentage (0-100) or fixed shares
  priceType: 'market' | 'limit';
  limitPrice?: number;
  stopPrice?: number;
  timestamp: number;
  traceId?: string;
}

export interface TradeExecution {
  success: boolean;
  orderId: string;
  symbol: string;
  action: TradeAction;
  executedShares: number;
  executedPrice: number;
  totalAmount: number;
  commission?: number;
  slippage?: number;
  timestamp: number;
  error?: string;
}

export interface TradingPayload {
  stockCode: string;
  action: TradeAction;
  quantityType: TradeQuantityType;
  quantity: number;
  priceType: 'market' | 'limit';
  limitPrice?: number;
  stopPrice?: number;
  dryRun: boolean;
}

export interface TradingResponse {
  type: TraderType.TRADE;
  stockCode: string;
  execution?: TradeExecution;
  dryRun: boolean;
  timestamp: number;
}

export interface Position {
  symbol: string;
  name: string;
  shares: number;
  avg_cost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

export interface Portfolio {
  positions: Position[];
  cash: number;
  totalValue: number;
  dailyPnL: number;
  dailyPnLPct: number;
}