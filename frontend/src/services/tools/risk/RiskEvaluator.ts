/**
 * Risk Evaluator
 * Comprehensive risk assessment including position sizing, probability, and expected value
 */

import type { RiskEvaluatorInput, RiskEvaluatorResult, PositionSizeResult } from '../types';
import { positionCalculator } from './PositionCalculator';

export class RiskEvaluator {
  evaluate(input: RiskEvaluatorInput): RiskEvaluatorResult {
    const { accountBalance, positionValue, entryPrice, stopLoss, takeProfit } = input;

    const riskPercent = 2;
    const positionSizing: PositionSizeResult = {
      positionSize: Math.floor(positionValue / entryPrice),
      riskAmount: accountBalance * (riskPercent / 100),
      maxLoss: Math.abs(positionValue * (Math.abs(entryPrice - stopLoss) / entryPrice)),
      rewardRiskRatio: Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss),
    };

    const stopLossPct = Math.abs(entryPrice - stopLoss) / entryPrice;
    const takeProfitPct = Math.abs(takeProfit - entryPrice) / entryPrice;
    const probabilityOfLoss = takeProfitPct / (stopLossPct + takeProfitPct);
    const winRate = 1 - probabilityOfLoss;
    const expectedValue = (winRate * takeProfitPct) - ((1 - winRate) * stopLossPct);
    const kellyFraction = positionCalculator.calculateKellyFraction(winRate, takeProfitPct, stopLossPct);

    return {
      riskRewardRatio: positionSizing.rewardRiskRatio,
      probabilityOfLoss,
      expectedValue,
      kellyFraction,
      positionSizing,
    };
  }

  quickCheck(accountBalance: number, entryPrice: number, stopLoss: number, takeProfit: number, riskPercent = 2): { pass: boolean; message: string } {
    try {
      const stopLossPct = Math.abs(entryPrice - stopLoss) / entryPrice;
      const riskAmount = accountBalance * (riskPercent / 100);
      const positionSize = Math.floor(riskAmount / (entryPrice * stopLossPct));
      const rewardPct = Math.abs(takeProfit - entryPrice) / entryPrice;

      if (stopLossPct < 0.005) return { pass: false, message: 'Stop loss too tight (< 0.5%)' };
      if (stopLossPct > 0.20) return { pass: false, message: 'Stop loss too wide (> 20%)' };
      if (rewardPct < stopLossPct) return { pass: false, message: 'Reward-to-risk ratio < 1:1' };
      if (positionSize < 1) return { pass: false, message: 'Position size too small' };

      return { pass: true, message: 'Risk check passed' };
    } catch (e) {
      return { pass: false, message: e instanceof Error ? e.message : 'Unknown error' };
    }
  }
}

export const riskEvaluator = new RiskEvaluator();