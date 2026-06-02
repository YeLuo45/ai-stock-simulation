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
    // For bullish: last 20 avg (high ~135) > last 60 avg (low ~45)
    // Bar 1-60: up from 20 to 80 (60 bars, avg ≈ 50)
    // Bar 61-80: up from 85 to 140 (20 bars, avg ≈ 112)
    // MA20 ≈ 112, MA60 ≈ 60 → MA20 > MA60 (bullish) ✓
    const bullishData = [
      ...Array.from({ length: 60 }, (_, i) => ({ close: 20 + i, high: 20 + i + 2, low: 20 + i - 2, volume: 1000000, open: 20 + i })),
      ...Array.from({ length: 20 }, (_, i) => ({ close: 85 + i * 3, high: 88 + i * 3, low: 82 + i * 3, volume: 1000000, open: 85 + i * 3 })),
    ];
    const message = createAgentMessage('supervisor', 'technical_analyst', 'request', {
      stockCode: 'AAPL',
      marketData: bullishData,
    }, 'trace-1');
    const response = await TechnicalAnalyst.process(message);
    expect(response.type).toBe('response');
    const analysis = (response.payload as any).analysis;
    expect(analysis.patterns.trend).toBe('bullish');
  });

  it('should process with bearish market data', async () => {
    // For bearish: last 20 avg (low ~35) < last 60 avg (high ~110)
    // Bar 1-60: up from 80 to 140 (60 bars, avg ≈ 110)
    // Bar 61-80: down from 135 to 50 (20 bars, avg ≈ 92)
    // MA20 ≈ 92, MA60 ≈ 110 → MA20 < MA60 (bearish) ✓
    const bearishData = [
      ...Array.from({ length: 60 }, (_, i) => ({ close: 80 + i, high: 82 + i, low: 78 + i, volume: 1000000, open: 80 + i })),
      ...Array.from({ length: 20 }, (_, i) => ({ close: 135 - i * 4, high: 137 - i * 4, low: 133 - i * 4, volume: 1000000, open: 135 - i * 4 })),
    ];
    const message = createAgentMessage('supervisor', 'technical_analyst', 'request', {
      stockCode: 'GOOGL',
      marketData: bearishData,
    }, 'trace-1');
    const response = await TechnicalAnalyst.process(message);
    const analysis = (response.payload as any).analysis;
    expect(analysis.patterns.trend).toBe('bearish');
  });
});