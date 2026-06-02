/**
 * Tests for SentimentAnalyst agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SentimentAnalyst } from '../agents/SentimentAnalyst';
import { createAgentMessage } from '../../../agents/messages';

describe('SentimentAnalyst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name', () => {
    expect(SentimentAnalyst.name).toBe('sentiment_analyst');
  });

  it('should return error for non-request messages', async () => {
    const message = createAgentMessage('supervisor', 'sentiment_analyst', 'response', {}, 'trace-1');
    const response = await SentimentAnalyst.process(message);
    expect(response.type).toBe('error');
  });

  it('should return error for missing stock code', async () => {
    const message = createAgentMessage('supervisor', 'sentiment_analyst', 'request', {}, 'trace-1');
    const response = await SentimentAnalyst.process(message);
    expect((response.payload as any).error).toBe('No stock code provided');
  });

  it('should process request and return sentiment analysis', async () => {
    const message = createAgentMessage('supervisor', 'sentiment_analyst', 'request', { stockCode: 'TSLA' }, 'trace-1');
    const response = await SentimentAnalyst.process(message);
    expect(response.type).toBe('response');
    const analysis = (response.payload as any).analysis;
    expect(analysis).toHaveProperty('overall');
    expect(analysis).toHaveProperty('sources');
    expect(analysis).toHaveProperty('keyThemes');
  });

  it('should return valid sentiment label', async () => {
    const message = createAgentMessage('supervisor', 'sentiment_analyst', 'request', { stockCode: 'NVDA' }, 'trace-1');
    const response = await SentimentAnalyst.process(message);
    const analysis = (response.payload as any).analysis;
    const validLabels = ['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish'];
    expect(validLabels).toContain(analysis.overall.label);
  });
});