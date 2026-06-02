/**
 * Tests for NewsResearcher agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsResearcher } from '../agents/NewsResearcher';
import { createAgentMessage } from '../../../agents/messages';

describe('NewsResearcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name', () => {
    expect(NewsResearcher.name).toBe('news_researcher');
  });

  it('should return error for non-request messages', async () => {
    const message = createAgentMessage('supervisor', 'news_researcher', 'response', {}, 'trace-1');
    const response = await NewsResearcher.process(message);
    expect(response.type).toBe('error');
  });

  it('should return error for missing stock code', async () => {
    const message = createAgentMessage('supervisor', 'news_researcher', 'request', {}, 'trace-1');
    const response = await NewsResearcher.process(message);
    expect((response.payload as any).error).toBe('No stock code provided');
  });

  it('should process request and return news articles', async () => {
    const message = createAgentMessage('supervisor', 'news_researcher', 'request', {
      stockCode: 'TSLA',
      query: { symbol: 'TSLA', maxResults: 10 },
    }, 'trace-1');
    const response = await NewsResearcher.process(message);
    expect(response.type).toBe('response');
    expect(response.payload).toHaveProperty('articles');
    expect((response.payload as any).articles).toBeInstanceOf(Array);
  });

  it('should return sentiment analysis with articles', async () => {
    const message = createAgentMessage('supervisor', 'news_researcher', 'request', {
      stockCode: 'NVDA',
      query: { symbol: 'NVDA', maxResults: 5 },
    }, 'trace-1');
    const response = await NewsResearcher.process(message);
    expect(response.payload).toHaveProperty('sentiment');
    const sentiment = (response.payload as any).sentiment;
    expect(sentiment).toHaveProperty('overall');
    expect(sentiment).toHaveProperty('positive');
    expect(sentiment).toHaveProperty('negative');
  });

  it('should include key themes', async () => {
    const message = createAgentMessage('supervisor', 'news_researcher', 'request', {
      stockCode: 'GOOGL',
      query: { symbol: 'GOOGL', maxResults: 10 },
    }, 'trace-1');
    const response = await NewsResearcher.process(message);
    expect(response.payload).toHaveProperty('keyThemes');
    expect((response.payload as any).keyThemes).toBeInstanceOf(Array);
  });
});