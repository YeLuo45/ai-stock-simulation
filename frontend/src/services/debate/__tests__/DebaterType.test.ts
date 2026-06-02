/**
 * Tests for DebaterType definitions
 */

import { describe, it, expect } from 'vitest';
import { DebaterType, type BullDebatePayload, type BearDebatePayload, type JudgeDebatePayload } from '../types/DebaterType';

describe('DebaterType', () => {
  it('should have BULL, BEAR, and JUDGE types', () => {
    expect(DebaterType.BULL).toBe('BULL');
    expect(DebaterType.BEAR).toBe('BEAR');
    expect(DebaterType.JUDGE).toBe('JUDGE');
  });
});

describe('BullDebatePayload', () => {
  it('should accept minimal payload', () => {
    const payload: BullDebatePayload = {
      stockCode: 'AAPL',
      analysisSummary: 'Strong fundamentals',
    };
    expect(payload.stockCode).toBe('AAPL');
    expect(payload.analysisSummary).toBe('Strong fundamentals');
  });

  it('should accept payload with price target and time horizon', () => {
    const payload: BullDebatePayload = {
      stockCode: 'TSLA',
      analysisSummary: 'EV growth',
      priceTarget: 300,
      timeHorizon: 'medium',
    };
    expect(payload.priceTarget).toBe(300);
    expect(payload.timeHorizon).toBe('medium');
  });
});

describe('BearDebatePayload', () => {
  it('should accept minimal payload', () => {
    const payload: BearDebatePayload = {
      stockCode: 'AAPL',
      analysisSummary: 'Overvalued',
    };
    expect(payload.stockCode).toBe('AAPL');
  });

  it('should accept payload with short time horizon', () => {
    const payload: BearDebatePayload = {
      stockCode: 'GOOGL',
      analysisSummary: 'Risk factors',
      timeHorizon: 'short',
    };
    expect(payload.timeHorizon).toBe('short');
  });
});

describe('JudgeDebatePayload', () => {
  it('should accept minimal payload', () => {
    const payload: JudgeDebatePayload = {
      stockCode: 'AAPL',
      bullArguments: [{ point: 'Test', weight: 0.5 }],
      bearArguments: [{ point: 'Test', weight: 0.5 }],
      positions: [],
      portfolioCash: 100000,
    };
    expect(payload.stockCode).toBe('AAPL');
    expect(payload.bullArguments).toHaveLength(1);
  });

  it('should accept payload with positions', () => {
    const payload: JudgeDebatePayload = {
      stockCode: 'MSFT',
      bullArguments: [],
      bearArguments: [],
      positions: [
        { symbol: 'MSFT', quantity: 100, avg_cost: 350, market_value: 40000 },
      ],
      portfolioCash: 50000,
    };
    expect(payload.positions).toHaveLength(1);
    expect(payload.portfolioCash).toBe(50000);
  });
});