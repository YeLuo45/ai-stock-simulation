/**
 * Tests for PortfolioManager agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortfolioManager } from '../agents/PortfolioManager';
import { createAgentMessage } from '../../../agents/messages';

describe('PortfolioManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name', () => {
    expect(PortfolioManager.name).toBe('portfolio_manager');
  });

  it('should return error for non-request messages', async () => {
    const message = createAgentMessage('supervisor', 'portfolio_manager', 'response', {}, 'trace-1');
    const response = await PortfolioManager.process(message);
    expect(response.type).toBe('error');
  });

  it('should return error for missing positions', async () => {
    const message = createAgentMessage('supervisor', 'portfolio_manager', 'request', {
      portfolioCash: 100000,
      signals: [],
    }, 'trace-1');
    const response = await PortfolioManager.process(message);
    expect((response.payload as any).error).toBe('No positions provided');
  });

  it('should process with positions and signals', async () => {
    const message = createAgentMessage('supervisor', 'portfolio_manager', 'request', {
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
    }, 'trace-1');
    const response = await PortfolioManager.process(message);
    expect(response.type).toBe('response');
    expect(response.payload).toHaveProperty('allocations');
    expect(response.payload).toHaveProperty('portfolioValue');
  });

  it('should calculate correct portfolio value', async () => {
    const message = createAgentMessage('supervisor', 'portfolio_manager', 'request', {
      currentPositions: [
        { symbol: 'AAPL', quantity: 100, avg_cost: 150, currentPrice: 175, marketValue: 17500 },
        { symbol: 'GOOGL', quantity: 50, avg_cost: 140, currentPrice: 155, marketValue: 7750 },
      ],
      portfolioCash: 10000,
      signals: [],
    }, 'trace-1');
    const response = await PortfolioManager.process(message);
    expect((response.payload as any).portfolioValue).toBe(35250); // 17500 + 7750 + 10000
  });
});