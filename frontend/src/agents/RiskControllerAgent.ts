/**
 * Risk Controller Agent
 * Risk checks using drawdownEngine and positionAnalytics
 */

import type { AgentMessage, AgentName, RiskResultPayload, RiskReasonCode } from '../messages';
import { createAgentMessage } from '../messages';
import { computeDrawdown, type DrawdownResult } from '../../services/drawdownEngine';
import type { Position } from '../../types';

export interface RiskControllerPayload {
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  positions: Position[];
  portfolioCash: number;
  maxDrawdownThreshold?: number;
}

const RISK_REJECTION_CODES: Record<string, RiskReasonCode> = {
  DD_05: { code: 'DD_05', detail: 'Drawdown exceeds 5% threshold' },
  DD_10: { code: 'DD_10', detail: 'Drawdown exceeds 10% threshold' },
  INSUFFICIENT_CASH: { code: 'CASH_01', detail: 'Insufficient cash for buy order' },
  POSITION_LIMIT: { code: 'POS_01', detail: 'Position size exceeds limit' },
  CONCENTRATION: { code: 'CON_01', detail: 'Single position concentration too high' },
};

function checkRisk(payload: RiskControllerPayload): RiskResultPayload {
  const {
    action,
    quantity,
    price,
    positions,
    portfolioCash,
    maxDrawdownThreshold = -0.1,
  } = payload;

  // Check current drawdown using drawdownEngine
  const drawdownResult: DrawdownResult = computeDrawdown();

  // Check if drawdown exceeds threshold
  if (drawdownResult.currentDrawdown < maxDrawdownThreshold) {
    const reasonCode = maxDrawdownThreshold <= -0.1 ? 'DD_10' : 'DD_05';
    return {
      approved: false,
      reasonCode: RISK_REJECTION_CODES[reasonCode],
      reason: `Current drawdown ${(drawdownResult.currentDrawdown * 100).toFixed(1)}% exceeds threshold`,
      drawdown: drawdownResult.currentDrawdown,
    };
  }

  // For buy orders, check cash sufficiency
  if (action === 'buy') {
    const totalCost = quantity * price * 1.0003; // Include commission
    if (portfolioCash < totalCost) {
      return {
        approved: false,
        reasonCode: RISK_REJECTION_CODES['INSUFFICIENT_CASH'],
        reason: `Insufficient cash: need ${totalCost.toFixed(2)}, have ${portfolioCash.toFixed(2)}`,
      };
    }

    // Check position concentration (max 30% per position)
    const positionValue = quantity * price;
    const totalPortfolioValue = positions.reduce((sum, p) => sum + p.market_value, 0) + portfolioCash;
    const newWeight = positionValue / totalPortfolioValue;
    if (newWeight > 0.3) {
      return {
        approved: false,
        reasonCode: RISK_REJECTION_CODES['CONCENTRATION'],
        reason: `Position weight ${(newWeight * 100).toFixed(1)}% would exceed 30% limit`,
      };
    }
  }

  // All checks passed
  return {
    approved: true,
    reason: 'Risk checks passed',
    portfolioValue: positions.reduce((sum, p) => sum + p.market_value, 0) + portfolioCash,
    positionValue: action === 'buy' ? quantity * price : 0,
    drawdown: drawdownResult.currentDrawdown,
  };
}

export const RiskControllerAgent = {
  name: 'risk' as AgentName,

  process(message: AgentMessage): AgentMessage {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('risk', message.from as AgentName, 'error',
          { error: 'Risk controller expects request type' }, message.traceId);
      }

      const payload = message.payload as RiskControllerPayload;
      const result = checkRisk(payload);

      const responsePayload = {
        ...result,
        duration: Date.now() - startTime,
      };

      return createAgentMessage('risk', 'supervisor', 'response', responsePayload, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('risk', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};
