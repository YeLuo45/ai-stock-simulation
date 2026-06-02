/**
 * StrategyManager - 策略经理
 * Orchestrates analysis results and debate outcomes into actionable strategies
 */

import { createAgentMessage } from '../../../agents/messages';
import type { AgentMessage } from '../../../agents/messages';
import type { StrategyManagerPayload, StrategyManagerResponse, ManagerType, StrategySignal } from '../types/ManagerType';
import type { DebateArgument } from '../types/DebaterType';

export const StrategyManager = {
  name: 'strategy_manager' as const,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('strategy_manager', message.from as any, 'error',
          { error: 'StrategyManager expects request type' }, message.traceId);
      }

      const payload = message.payload as StrategyManagerPayload;
      const { stockCode, debateResults } = payload;

      if (!stockCode) {
        return createAgentMessage('strategy_manager', 'supervisor', 'response',
          { error: 'No stock code provided' }, message.traceId);
      }

      // Build strategy from debate results
      const bullArguments = (debateResults?.bullArguments || []) as DebateArgument[];
      const bearArguments = (debateResults?.bearArguments || []) as DebateArgument[];
      
      const bullScore = bullArguments.reduce((sum, a) => sum + a.weight, 0);
      const bearScore = bearArguments.reduce((sum, a) => sum + a.weight, 0);
      const diff = bullScore - bearScore;

      let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      let confidence = 0.5;
      if (diff > 0.5) { action = 'BUY'; confidence = Math.min(0.9, 0.5 + diff); }
      else if (diff < -0.5) { action = 'SELL'; confidence = Math.min(0.9, 0.5 + Math.abs(diff)); }

      const signal: StrategySignal = {
        symbol: stockCode,
        action,
        confidence,
        rationale: `多空辩论结果：多方${bullScore.toFixed(2)}分，空方${bearScore.toFixed(2)}分，${action === 'BUY' ? '建议买入' : action === 'SELL' ? '建议卖出' : '建议观望'}`,
        sourceAgents: ['bull', 'bear', 'judge'],
        timestamp: Date.now(),
      };

      return createAgentMessage('strategy_manager', 'supervisor', 'response', {
        type: 'STRATEGY' as ManagerType,
        stockCode,
        plan: {
          id: `strategy-${Date.now()}`,
          name: `${stockCode}交易策略`,
          signals: [signal],
          overallConfidence: confidence,
          riskAssessment: {
            level: confidence > 0.7 ? 'medium' : 'low',
            maxDrawdown: 0.1,
            var: 0.05,
          },
          expectedReturn: action === 'BUY' ? 0.15 : action === 'SELL' ? -0.10 : 0,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      } as StrategyManagerResponse, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('strategy_manager', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};