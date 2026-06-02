/**
 * Tests for StrategyManager agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrategyManager } from '../agents/StrategyManager';
import { createAgentMessage } from '../../../agents/messages';

describe('StrategyManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name', () => {
    expect(StrategyManager.name).toBe('strategy_manager');
  });

  it('should return error for non-request messages', async () => {
    const message = createAgentMessage('supervisor', 'strategy_manager', 'response', {}, 'trace-1');
    const response = await StrategyManager.process(message);
    expect(response.type).toBe('error');
  });

  it('should return error for missing stock code', async () => {
    const message = createAgentMessage('supervisor', 'strategy_manager', 'request', {}, 'trace-1');
    const response = await StrategyManager.process(message);
    expect((response.payload as any).error).toBe('No stock code provided');
  });

  it('should process with bullish debate results and recommend BUY', async () => {
    const message = createAgentMessage('supervisor', 'strategy_manager', 'request', {
      stockCode: 'AAPL',
      analysisResults: {},
      debateResults: {
        bullArguments: [
          { point: 'Strong growth', weight: 0.8 },
          { point: 'Good margins', weight: 0.7 },
        ],
        bearArguments: [
          { point: 'Overvalued', weight: 0.3 },
        ],
      },
      currentPositions: [],
      portfolioCash: 100000,
    }, 'trace-1');
    const response = await StrategyManager.process(message);
    expect(response.type).toBe('response');
    expect(response.payload).toHaveProperty('plan');
    const plan = (response.payload as any).plan;
    expect(plan.signals[0].action).toBe('BUY');
  });

  it('should process with bearish debate results and recommend SELL', async () => {
    const message = createAgentMessage('supervisor', 'strategy_manager', 'request', {
      stockCode: 'TSLA',
      analysisResults: {},
      debateResults: {
        bullArguments: [
          { point: 'Weak growth', weight: 0.2 },
        ],
        bearArguments: [
          { point: 'High risk', weight: 0.8 },
          { point: 'Overvalued', weight: 0.7 },
        ],
      },
      currentPositions: [],
      portfolioCash: 100000,
    }, 'trace-1');
    const response = await StrategyManager.process(message);
    const plan = (response.payload as any).plan;
    expect(plan.signals[0].action).toBe('SELL');
  });
});