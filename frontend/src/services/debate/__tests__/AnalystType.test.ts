/**
 * Tests for AnalystType definitions
 */

import { describe, it, expect } from 'vitest';
import { AnalystType, type AnalystPayload, type AnalystResponse } from '../types/AnalystType';

describe('AnalystType', () => {
  it('should have all four analyst types', () => {
    expect(AnalystType.FUNDAMENTAL).toBe('FUNDAMENTAL');
    expect(AnalystType.TECHNICAL).toBe('TECHNICAL');
    expect(AnalystType.MARKET).toBe('MARKET');
    expect(AnalystType.SENTIMENT).toBe('SENTIMENT');
  });

  it('should export AnalystPayload interface', () => {
    const payload: AnalystPayload = {
      stockCode: 'AAPL',
    };
    expect(payload.stockCode).toBe('AAPL');
  });

  it('should export AnalystResponse interface', () => {
    const response: AnalystResponse = {
      type: AnalystType.FUNDAMENTAL,
      stockCode: 'AAPL',
      analysis: {
        type: AnalystType.FUNDAMENTAL,
        companyMetrics: { peRatio: 15.5 },
        valuation: { fairValue: 100, discount: 10 },
        financialHealth: 'strong',
        outlook: 'positive',
        reasoning: ['Good'],
      },
      confidence: 0.75,
      timestamp: Date.now(),
    };
    expect(response.type).toBe(AnalystType.FUNDAMENTAL);
    expect(response.confidence).toBe(0.75);
  });

  it('should handle analyst type comparisons', () => {
    const type1 = AnalystType.FUNDAMENTAL;
    const type2 = AnalystType.TECHNICAL;
    expect(type1).not.toBe(type2);
    expect(AnalystType[type1]).toBe('FUNDAMENTAL');
    expect(AnalystType[type2]).toBe('TECHNICAL');
  });
});

describe('AnalystPayload', () => {
  it('should accept minimal payload', () => {
    const payload: AnalystPayload = { stockCode: 'TSLA' };
    expect(payload.stockCode).toBe('TSLA');
  });

  it('should accept full payload with market data', () => {
    const payload: AnalystPayload = {
      stockCode: 'MSFT',
      marketData: [
        { close: 100, high: 105, low: 95, volume: 1000000, open: 98 },
      ],
    };
    expect(payload.marketData).toHaveLength(1);
    expect(payload.marketData?.[0].close).toBe(100);
  });
});