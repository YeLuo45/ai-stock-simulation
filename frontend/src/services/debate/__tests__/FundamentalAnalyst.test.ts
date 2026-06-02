/**
 * Tests for FundamentalAnalyst agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FundamentalAnalyst } from '../agents/FundamentalAnalyst';
import { createAgentMessage } from '../../../agents/messages';

describe('FundamentalAnalyst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name', () => {
    expect(FundamentalAnalyst.name).toBe('fundamental_analyst');
  });

  it('should return error for non-request messages', async () => {
    const message = createAgentMessage('supervisor', 'fundamental_analyst', 'response', {}, 'trace-1');
    const response = await FundamentalAnalyst.process(message);
    expect(response.type).toBe('error');
    expect(response.payload).toHaveProperty('error');
  });

  it('should return error for missing stock code', async () => {
    const message = createAgentMessage('supervisor', 'fundamental_analyst', 'request', {}, 'trace-1');
    const response = await FundamentalAnalyst.process(message);
    expect(response.type).toBe('response');
    expect((response.payload as any).error).toBe('No stock code provided');
  });

  it('should process request with stock code', async () => {
    const message = createAgentMessage('supervisor', 'fundamental_analyst', 'request', { stockCode: 'AAPL' }, 'trace-1');
    const response = await FundamentalAnalyst.process(message);
    expect(response.type).toBe('response');
    expect(response.payload).toHaveProperty('type');
    expect(response.payload).toHaveProperty('stockCode');
    expect((response.payload as any).stockCode).toBe('AAPL');
  });

  it('should return analysis with expected structure', async () => {
    const message = createAgentMessage('supervisor', 'fundamental_analyst', 'request', { stockCode: 'TSLA' }, 'trace-1');
    const response = await FundamentalAnalyst.process(message);
    expect(response.payload).toHaveProperty('analysis');
    const analysis = (response.payload as any).analysis;
    expect(analysis).toHaveProperty('type');
    expect(analysis).toHaveProperty('companyMetrics');
    expect(analysis).toHaveProperty('valuation');
    expect(analysis).toHaveProperty('financialHealth');
  });
});