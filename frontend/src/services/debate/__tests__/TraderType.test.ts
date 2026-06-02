/**
 * Tests for TraderType definitions
 */

import { describe, it, expect } from 'vitest';
import { TraderType, type TradingPayload, type TradeOrder } from '../types/TraderType';

describe('TraderType', () => {
  it('should have TRADE type', () => {
    expect(TraderType.TRADE).toBe('TRADE');
  });
});

describe('TradingPayload', () => {
  it('should accept minimal payload', () => {
    const payload: TradingPayload = {
      stockCode: 'AAPL',
      action: 'BUY',
      quantityType: 'percentage',
      quantity: 10,
      priceType: 'market',
      dryRun: true,
    };
    expect(payload.stockCode).toBe('AAPL');
    expect(payload.action).toBe('BUY');
    expect(payload.dryRun).toBe(true);
  });

  it('should accept payload with limit price', () => {
    const payload: TradingPayload = {
      stockCode: 'TSLA',
      action: 'BUY',
      quantityType: 'fixed',
      quantity: 50,
      priceType: 'limit',
      limitPrice: 250,
      dryRun: false,
    };
    expect(payload.priceType).toBe('limit');
    expect(payload.limitPrice).toBe(250);
    expect(payload.quantityType).toBe('fixed');
  });

  it('should accept SELL action', () => {
    const payload: TradingPayload = {
      stockCode: 'GOOGL',
      action: 'SELL',
      quantityType: 'percentage',
      quantity: 50,
      priceType: 'market',
      dryRun: true,
    };
    expect(payload.action).toBe('SELL');
  });
});

describe('TradeOrder', () => {
  it('should accept valid trade order', () => {
    const order: TradeOrder = {
      id: 'order-1',
      symbol: 'AAPL',
      action: 'BUY',
      quantityType: 'percentage',
      quantity: 10,
      priceType: 'market',
      timestamp: Date.now(),
      traceId: 'trace-1',
    };
    expect(order.symbol).toBe('AAPL');
    expect(order.id).toBe('order-1');
  });

  it('should accept order with stop price', () => {
    const order: TradeOrder = {
      id: 'order-2',
      symbol: 'NVDA',
      action: 'SELL',
      quantityType: 'fixed',
      quantity: 100,
      priceType: 'limit',
      limitPrice: 900,
      stopPrice: 850,
      timestamp: Date.now(),
    };
    expect(order.stopPrice).toBe(850);
  });
});