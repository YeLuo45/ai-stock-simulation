/**
 * Position Size Calculator
 * Calculates optimal position size based on account balance and risk parameters
 */

import type { PositionSizeInput, PositionSizeResult } from '../types';

export class PositionCalculator {
  calculate(input: PositionSizeInput): PositionSizeResult {
    const { accountBalance, riskPercent, entryPrice, stopLoss } = input;
    if (accountBalance <= 0) throw new Error('Account balance must be positive');
    if (riskPercent <= 0 || riskPercent > 100) throw new Error('Risk percent must be between 0 and 100');
    if (entryPrice <= 0) throw new Error('Entry price must be positive');
    if (stopLoss <= 0) throw new Error('Stop loss must be positive');

    const riskAmount = accountBalance * (riskPercent / 100);
    const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice;
    if (stopLossDistance === 0) throw new Error('Stop loss cannot be same as entry price');

    const positionSize = Math.floor(riskAmount / (entryPrice * stopLossDistance));
    const maxLoss = positionSize * Math.abs(entryPrice - stopLoss);
    return { positionSize, riskAmount, maxLoss, rewardRiskRatio: 0 };
  }

  calculateWithTarget(input: PositionSizeInput & { takeProfit: number }): PositionSizeResult {
    const baseResult = this.calculate(input);
    const { entryPrice, stopLoss, takeProfit } = input;
    const rewardRiskRatio = Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss);
    return { ...baseResult, rewardRiskRatio };
  }

  calculateKellyFraction(winRate: number, avgWin: number, avgLoss: number): number {
    if (winRate <= 0 || winRate >= 1 || avgLoss <= 0) return 0;
    const winLossRatio = avgWin / avgLoss;
    const kelly = (winRate * winLossRatio - (1 - winRate)) / winLossRatio;
    return Math.max(0, Math.min(0.25, kelly));
  }
}

export const positionCalculator = new PositionCalculator();