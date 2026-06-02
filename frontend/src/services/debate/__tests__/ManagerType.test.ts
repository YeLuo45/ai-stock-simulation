/**
 * Tests for ManagerType definitions
 */

import { describe, it, expect } from 'vitest';
import { ManagerType, type StrategyManagerPayload, type PortfolioManagerPayload } from '../types/ManagerType';

describe('ManagerType', () => {
  it('should have STRATEGY and PORTFOLIO types', () => {
    expect(ManagerType.STRATEGY).toBe('STRATEGY');
    expect(ManagerType.PORTFOLIO).toBe('PORTFOLIO');
  });
});

describe('StrategyManagerPayload', () => {
  it('should accept minimal payload', () => {
    const payload: StrategyManagerPayload = {
      stockCode: 'AAPL',
      analysisResults: {},
      currentPositions: [],
      portfolioCash: 100000,
    };
    expect(payload.stockCode).toBe('AAPL');
    expect(payload.portfolioCash).toBe(100000);
  });

  it('should accept payload with debate results', () => {
    const payload: StrategyManagerPayload = {
      stockCode: 'TSLA',
      analysisResults: {},
      debateResults: {
        bullArguments: [{ point: 'Growth', weight: 0.7 }],
        bearArguments: [{ point: 'Risk', weight: 0.3 }],
      },
      currentPositions: [],
      portfolioCash: 50000,
    };
    expect(payload.debateResults).toBeDefined();
    expect(payload.debateResults?.bullArguments).toHaveLength(1);
  });
});

describe('PortfolioManagerPayload', () => {
  it('should accept minimal payload', () => {
    const payload: PortfolioManagerPayload = {
      currentPositions: [],
      portfolioCash: 100000,
      signals: [],
    };
    expect(payload.portfolioCash).toBe(100000);
    expect(payload.signals).toHaveLength(0);
  });

  it('should accept payload with signals', () => {
    const payload: PortfolioManagerPayload = {
      currentPositions: [
        { symbol: 'AAPL', quantity: 100, avg_cost: 150, currentPrice: 175, marketValue: 17500 },
      ],
      portfolioCash: 75000,
      signals: [
        {
          symbol: 'NVDA',
          action: 'BUY',
          confidence: 0.8,
          rationale: 'AI trend',
          sourceAgents: ['bull'],
          timestamp: Date.now(),
        },
      ],
    };
    expect(payload.currentPositions).toHaveLength(1);
    expect(payload.signals).toHaveLength(1);
    expect(payload.signals[0].action).toBe('BUY');
  });
});