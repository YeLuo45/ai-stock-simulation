/**
 * PortfolioManager - 组合经理
 * Manages portfolio allocation, rebalancing, and position sizing
 */

import { createAgentMessage } from '../../../agents/messages';
import type { AgentMessage } from '../../../agents/messages';
import type { PortfolioManagerPayload, PortfolioManagerResponse, ManagerType, PortfolioAllocation } from '../types/ManagerType';
import type { StrategySignal } from '../types/ManagerType';

export const PortfolioManager = {
  name: 'portfolio_manager' as const,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('portfolio_manager', message.from as any, 'error',
          { error: 'PortfolioManager expects request type' }, message.traceId);
      }

      const payload = message.payload as PortfolioManagerPayload;
      const { currentPositions, portfolioCash, signals } = payload;

      if (!currentPositions || !Array.isArray(currentPositions)) {
        return createAgentMessage('portfolio_manager', 'supervisor', 'response',
          { error: 'No positions provided' }, message.traceId);
      }

      // Calculate current portfolio value
      const positionsValue = currentPositions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
      const portfolioValue = positionsValue + portfolioCash;

      // Process signals into allocations
      const allocations: PortfolioAllocation[] = signals.map((signal, index) => {
        const targetWeight = signal.action === 'BUY' ? 0.2 : signal.action === 'SELL' ? 0 : 0.1;
        const currentWeight = currentPositions.find(p => p.symbol === signal.symbol)
          ? (currentPositions.find(p => p.symbol === signal.symbol)!.marketValue / portfolioValue)
          : 0;

        return {
          symbol: signal.symbol,
          targetWeight,
          currentWeight,
          action: signal.action as 'BUY' | 'SELL' | 'HOLD' | 'WAIT',
          shares: 0,
          estimatedPrice: 0,
          priority: index + 1,
        };
      });

      // Calculate rebalance needs
      const totalTargetWeight = allocations.reduce((sum, a) => sum + a.targetWeight, 0);
      const rebalanceNeeded = Math.abs(totalTargetWeight - 1) > 0.1;

      return createAgentMessage('portfolio_manager', 'supervisor', 'response', {
        type: 'PORTFOLIO' as ManagerType,
        allocations,
        rebalance: rebalanceNeeded ? {
          cashNeeded: portfolioValue * 0.2,
          cashAvailable: portfolioCash,
          trades: allocations
            .filter(a => a.action === 'BUY')
            .map(a => ({
              symbol: a.symbol,
              action: 'BUY' as const,
              shares: Math.floor((portfolioValue * a.targetWeight) / 100),
              estimatedProceeds: portfolioValue * a.targetWeight,
            })),
          timestamp: Date.now(),
        } : undefined,
        portfolioValue,
        cashBalance: portfolioCash,
        timestamp: Date.now(),
      } as PortfolioManagerResponse, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('portfolio_manager', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};