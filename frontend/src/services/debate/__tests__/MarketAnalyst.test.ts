/**
 * Tests for MarketAnalyst agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketAnalyst } from '../agents/MarketAnalyst';
import { createAgentMessage } from '../../../agents/messages';

describe('MarketAnalyst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name', () => {
    expect(MarketAnalyst.name).toBe('market_analyst');
  });

  it('should return error for non-request messages', async () => {
    const message = createAgentMessage('supervisor', 'market_analyst', 'response', {}, 'trace-1');
    const response = await MarketAnalyst.process(message);
    expect(response.type).toBe('error');
  });

  it('should return error for missing stock code', async () => {
    const message = createAgentMessage('supervisor', 'market_analyst', 'request', {}, 'trace-1');
    const response = await MarketAnalyst.process(message);
    expect((response.payload as any).error).toBe('No stock code provided');
  });

  it('should process request and return market analysis', async () => {
    const message = createAgentMessage('supervisor', 'market_analyst', 'request', { stockCode: 'SPY' }, 'trace-1');
    const response = await MarketAnalyst.process(message);
    expect(response.type).toBe('response');
    const analysis = (response.payload as any).analysis;
    expect(analysis).toHaveProperty('regime');
    expect(analysis).toHaveProperty('marketBreadth');
    expect(analysis).toHaveProperty('sectorRotation');
  });

  it('should return regime in expected values', async () => {
    const message = createAgentMessage('supervisor', 'market_analyst', 'request', { stockCode: 'QQQ' }, 'trace-1');
    const response = await MarketAnalyst.process(message);
    const analysis = (response.payload as any).analysis;
    const validRegimes = ['BULL', 'BEAR', 'RANGEBOUND', 'HIGH_VOL', 'LOW_VOL', 'UNKNOWN'];
    expect(validRegimes).toContain(analysis.regime);
  });
});