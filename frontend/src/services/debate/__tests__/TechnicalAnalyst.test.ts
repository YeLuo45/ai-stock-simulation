/**
 * Tests for TechnicalAnalyst agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TechnicalAnalyst } from '../agents/TechnicalAnalyst';
import { createAgentMessage } from '../../../agents/messages';

describe('TechnicalAnalyst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name', () => {
    expect(TechnicalAnalyst.name).toBe('technical_analyst');
  });

  it('should return error for non-request messages', async () => {
    const message = createAgentMessage('supervisor', 'technical_analyst', 'response', {}, 'trace-1');
    const response = await TechnicalAnalyst.process(message);
    expect(response.type).toBe('error');
  });

  it('should return error for missing stock code', async () => {
    const message = createAgentMessage('supervisor', 'technical_analyst', 'request', {}, 'trace-1');
    const response = await TechnicalAnalyst.process(message);
    expect((response.payload as any).error).toBe('No stock code provided');
  });

  it('should process with bullish market data', async () => {
    const message = createAgentMessage('supervisor', 'technical_analyst', 'request', {
      stockCode: 'AAPL',
      marketData: [
        { close: 100, high: 105, low: 95, volume: 1000000, open: 98 },
        { close: 102, high: 107, low: 96, volume: 1100000, open: 100 },
        { close: 104, high: 109, low: 97, volume: 1200000, open: 102 },
      ],
    }, 'trace-1');
    const response = await TechnicalAnalyst.process(message);
    expect(response.type).toBe('response');
    const analysis = (response.payload as any).analysis;
    expect(analysis.patterns.trend).toBe('bullish');
  });

  it('should process with bearish market data', async () => {
    const message = createAgentMessage('supervisor', 'technical_analyst', 'request', {
      stockCode: 'GOOGL',
      marketData: [
        { close: 100, high: 105, low: 95, volume: 1000000, open: 98 },
        { close: 98, high: 100, low: 93, volume: 1100000, open: 100 },
        { close: 96, high: 98, low: 90, volume: 1200000, open: 98 },
      ],
    }, 'trace-1');
    const response = await TechnicalAnalyst.process(message);
    const analysis = (response.payload as any).analysis;
    expect(analysis.patterns.trend).toBe('bearish');
  });
});