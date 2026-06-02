/**
 * Tests for DataResearcher agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataResearcher } from '../agents/DataResearcher';
import { createAgentMessage } from '../../../agents/messages';

describe('DataResearcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name', () => {
    expect(DataResearcher.name).toBe('data_researcher');
  });

  it('should return error for non-request messages', async () => {
    const message = createAgentMessage('supervisor', 'data_researcher', 'response', {}, 'trace-1');
    const response = await DataResearcher.process(message);
    expect(response.type).toBe('error');
  });

  it('should return error for missing stock code', async () => {
    const message = createAgentMessage('supervisor', 'data_researcher', 'request', {}, 'trace-1');
    const response = await DataResearcher.process(message);
    expect((response.payload as any).error).toBe('No stock code provided');
  });

  it('should process request and return data results', async () => {
    const message = createAgentMessage('supervisor', 'data_researcher', 'request', {
      stockCode: 'AAPL',
      query: { symbol: 'AAPL', metrics: ['PE'], interval: '1d' },
    }, 'trace-1');
    const response = await DataResearcher.process(message);
    expect(response.type).toBe('response');
    expect(response.payload).toHaveProperty('type');
    expect(response.payload).toHaveProperty('results');
    expect((response.payload as any).results).toBeInstanceOf(Array);
  });

  it('should include quality information in results', async () => {
    const message = createAgentMessage('supervisor', 'data_researcher', 'request', {
      stockCode: 'MSFT',
      query: { symbol: 'MSFT', metrics: ['PB'], interval: '1wk' },
    }, 'trace-1');
    const response = await DataResearcher.process(message);
    const results = (response.payload as any).results as any[];
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('quality');
  });
});