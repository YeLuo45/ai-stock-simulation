/**
 * Tests for TradingTrader agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradingTrader } from '../agents/TradingTrader';
import { createAgentMessage } from '../../../agents/messages';

describe('TradingTrader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name', () => {
    expect(TradingTrader.name).toBe('trading_trader');
  });

  it('should return error for non-request messages', async () => {
    const message = createAgentMessage('supervisor', 'trading_trader', 'response', {}, 'trace-1');
    const response = await TradingTrader.process(message);
    expect(response.type).toBe('error');
  });

  it('should return error for missing stock code', async () => {
    const message = createAgentMessage('supervisor', 'trading_trader', 'request', {
      action: 'BUY',
      quantityType: 'percentage',
      quantity: 10,
      priceType: 'market',
      dryRun: true,
    }, 'trace-1');
    const response = await TradingTrader.process(message);
    expect((response.payload as any).error).toBe('No stock code provided');
  });

  it('should execute BUY order in dry run mode', async () => {
    const message = createAgentMessage('supervisor', 'trading_trader', 'request', {
      stockCode: 'AAPL',
      action: 'BUY',
      quantityType: 'percentage',
      quantity: 10,
      priceType: 'market',
      dryRun: true,
    }, 'trace-1');
    const response = await TradingTrader.process(message);
    expect(response.type).toBe('response');
    expect(response.payload).toHaveProperty('execution');
    expect((response.payload as any).dryRun).toBe(true);
  });

  it('should execute SELL order', async () => {
    const message = createAgentMessage('supervisor', 'trading_trader', 'request', {
      stockCode: 'TSLA',
      action: 'SELL',
      quantityType: 'fixed',
      quantity: 50,
      priceType: 'market',
      dryRun: true,
    }, 'trace-1');
    const response = await TradingTrader.process(message);
    const execution = (response.payload as any).execution;
    expect(execution.success).toBe(true);
    expect(execution.action).toBe('SELL');
  });

  it('should include slippage in execution result', async () => {
    const message = createAgentMessage('supervisor', 'trading_trader', 'request', {
      stockCode: 'GOOGL',
      action: 'BUY',
      quantityType: 'percentage',
      quantity: 5,
      priceType: 'market',
      dryRun: true,
    }, 'trace-1');
    const response = await TradingTrader.process(message);
    const execution = (response.payload as any).execution;
    expect(execution).toHaveProperty('slippage');
    expect(typeof execution.slippage).toBe('number');
  });

  it('should include commission in execution result', async () => {
    const message = createAgentMessage('supervisor', 'trading_trader', 'request', {
      stockCode: 'NVDA',
      action: 'BUY',
      quantityType: 'percentage',
      quantity: 20,
      priceType: 'market',
      dryRun: true,
    }, 'trace-1');
    const response = await TradingTrader.process(message);
    const execution = (response.payload as any).execution;
    expect(execution).toHaveProperty('commission');
  });
});