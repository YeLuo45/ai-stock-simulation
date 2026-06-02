/**
 * Tests for ResearcherType definitions
 */

import { describe, it, expect } from 'vitest';
import { ResearcherType, type DataQuery, type NewsQuery, type ResearcherPayload } from '../types/ResearcherType';

describe('ResearcherType', () => {
  it('should have DATA and NEWS types', () => {
    expect(ResearcherType.DATA).toBe('DATA');
    expect(ResearcherType.NEWS).toBe('NEWS');
  });
});

describe('DataQuery', () => {
  it('should accept valid data query', () => {
    const query: DataQuery = {
      symbol: 'AAPL',
      metrics: ['PE', 'PB', 'ROE'],
      interval: '1d',
    };
    expect(query.symbol).toBe('AAPL');
    expect(query.metrics).toHaveLength(3);
    expect(query.interval).toBe('1d');
  });

  it('should accept query with date range', () => {
    const query: DataQuery = {
      symbol: 'GOOGL',
      metrics: ['Price'],
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      interval: '1mo',
    };
    expect(query.startDate).toBe('2024-01-01');
    expect(query.endDate).toBe('2024-12-31');
  });
});

describe('NewsQuery', () => {
  it('should accept valid news query', () => {
    const query: NewsQuery = {
      symbol: 'TSLA',
      maxResults: 10,
    };
    expect(query.symbol).toBe('TSLA');
    expect(query.maxResults).toBe(10);
  });

  it('should accept query with keywords and sources', () => {
    const query: NewsQuery = {
      symbol: 'NVDA',
      keywords: ['earnings', 'AI'],
      sources: ['Reuters', 'Bloomberg'],
      maxResults: 20,
    };
    expect(query.keywords).toContain('earnings');
    expect(query.sources).toHaveLength(2);
  });
});

describe('ResearcherPayload', () => {
  it('should accept payload with data query', () => {
    const payload: ResearcherPayload = {
      stockCode: 'AAPL',
      query: { symbol: 'AAPL', metrics: ['PE'], interval: '1d' },
    };
    expect(payload.stockCode).toBe('AAPL');
  });

  it('should accept payload with news query', () => {
    const payload: ResearcherPayload = {
      stockCode: 'MSFT',
      query: { symbol: 'MSFT', maxResults: 15 },
    };
    expect(payload.stockCode).toBe('MSFT');
  });
});