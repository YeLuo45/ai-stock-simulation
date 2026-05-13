/**
 * PortfolioManagerAgent - Portfolio Rebalancing Engine
 * Calculates optimal position sizing using Kelly Criterion
 * Enforces risk limits and generates rebalancing directives
 */

import type { PaperPosition } from './messages';

// ============ Interfaces ============

export interface Position {
  code: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  profitLoss: number;
  profitLossPct: number;
  weight: number; // percentage
}

export interface PortfolioState {
  cash: number;
  totalValue: number;
  positions: Position[];
  targetPositions: Position[];
}

export interface RebalanceDirective {
  code: string;
  name: string;
  action: 'BUY' | 'SELL' | 'CLEAR';
  shares: number;
  price: number;
  reason: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RiskLimits {
  maxPositionWeight: number; // Max % per position (default 30)
  maxTotalPosition: number;  // Max total position % (default 80)
  stopLossPct: number;       // Stop loss % (default -8)
  maxDrawdown: number;       // Max drawdown % (default -15)
}

export interface TargetPosition {
  code: string;
  weight: number;     // Target weight percentage
  confidence: number; // 0-1, from JudgeAgent
  action?: 'BUY' | 'SELL' | 'HOLD';
}

// ============ Kelly Criterion ============

/**
 * Calculate Kelly Criterion position size
 * Kelly % = W - (1-W)/R
 * W = win rate, R = reward/risk ratio (avgWinPct/avgLossPct)
 * 
 * @param winRate - Historical win rate (0-1)
 * @param avgWinPct - Average win percentage (e.g., 10 for 10%)
 * @param avgLossPct - Average loss percentage (e.g., 5 for 5%)
 * @param totalValue - Total portfolio value
 * @param maxWeight - Maximum weight cap (as decimal, e.g., 0.3 for 30%)
 * @returns { weight: number (0-1), shares: number, kellyPct: number }
 */
export function calculateKellyPosition(
  winRate: number,
  avgWinPct: number,
  avgLossPct: number,
  totalValue: number,
  maxWeight: number = 0.3
): { weight: number; shares: number; kellyPct: number } {
  // Avoid division by zero
  if (avgLossPct <= 0 || winRate <= 0 || winRate >= 1) {
    return { weight: 0, shares: 0, kellyPct: 0 };
  }

  const R = avgWinPct / avgLossPct; // Reward-to-risk ratio
  const kellyPct = winRate - (1 - winRate) / R;
  
  // Cap at max weight and floor at 5% (minimum viable position)
  const cappedWeight = Math.min(Math.max(kellyPct, 0.05), maxWeight);
  
  return {
    weight: cappedWeight,
    shares: 0, // Shares calculated when price is known
    kellyPct: Math.max(kellyPct, 0),
  };
}

/**
 * Calculate recommended shares based on Kelly weight
 * @param kellyWeight - Kelly calculated weight (0-1)
 * @param totalValue - Total portfolio value
 * @param currentPrice - Current stock price
 * @returns number of shares (floored)
 */
export function calculateSharesFromWeight(
  kellyWeight: number,
  totalValue: number,
  currentPrice: number
): number {
  if (currentPrice <= 0) return 0;
  const positionValue = totalValue * kellyWeight;
  return Math.floor(positionValue / currentPrice);
}

// ============ Risk Checks ============

export interface RiskCheckResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
}

/**
 * Check if a single position violates risk limits
 */
export function checkPositionRisk(
  position: Position,
  riskLimits: RiskLimits,
  totalPortfolioValue: number
): RiskCheckResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Check stop loss
  if (position.profitLossPct <= riskLimits.stopLossPct) {
    violations.push(`Stop loss triggered: ${position.code} at ${position.profitLossPct.toFixed(2)}% (limit: ${riskLimits.stopLossPct}%)`);
  } else if (position.profitLossPct <= riskLimits.stopLossPct * 1.5) {
    warnings.push(`Stop loss warning: ${position.code} at ${position.profitLossPct.toFixed(2)}%`);
  }

  // Check max position weight
  if (position.weight > riskLimits.maxPositionWeight) {
    violations.push(`Max weight exceeded: ${position.code} at ${position.weight.toFixed(2)}% (limit: ${riskLimits.maxPositionWeight}%)`);
  } else if (position.weight > riskLimits.maxPositionWeight * 0.8) {
    warnings.push(`Weight warning: ${position.code} at ${position.weight.toFixed(2)}%`);
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings,
  };
}

/**
 * Check total portfolio exposure
 */
export function checkTotalExposure(
  positions: Position[],
  riskLimits: RiskLimits,
  cash: number,
  totalValue: number
): RiskCheckResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  const totalPositionValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalWeight = (totalPositionValue / totalValue) * 100;

  if (totalWeight > riskLimits.maxTotalPosition) {
    violations.push(`Max total position exceeded: ${totalWeight.toFixed(2)}% (limit: ${riskLimits.maxTotalPosition}%)`);
  } else if (totalWeight > riskLimits.maxTotalPosition * 0.9) {
    warnings.push(`Total position warning: ${totalWeight.toFixed(2)}%`);
  }

  // Check cash reserve
  const cashRatio = (cash / totalValue) * 100;
  if (cashRatio < 10) {
    warnings.push(`Low cash reserve: ${cashRatio.toFixed(2)}%`);
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings,
  };
}

// ============ Rebalancing Logic ============

export interface RebalanceResult {
  directives: RebalanceDirective[];
  riskResult: RiskCheckResult;
  totalExposure: number;
  kellyRecommendations: Map<string, { weight: number; shares: number }>;
}

/**
 * Main rebalance function - generates rebalancing directives
 * 
 * @param targetPositions - Target positions from JudgeAgent/Supervisor
 * @param portfolioState - Current portfolio state
 * @param riskLimits - Risk limits configuration
 * @param mode - 'REAL' or 'PAPER' trading mode
 * @param currentPrices - Map of symbol to current price
 * @returns RebalanceResult with directives and risk status
 */
export function rebalance(
  targetPositions: TargetPosition[],
  portfolioState: PortfolioState,
  riskLimits: RiskLimits,
  mode: 'REAL' | 'PAPER',
  currentPrices: Map<string, number> = new Map()
): RebalanceResult {
  const directives: RebalanceDirective[] = [];
  const violations: string[] = [];
  const warnings: string[] = [];
  const kellyRecommendations = new Map<string, { weight: number; shares: number }>();

  const { cash, totalValue, positions } = portfolioState;

  // Calculate current position map for quick lookup
  const currentPositionsMap = new Map<string, Position>();
  for (const pos of positions) {
    currentPositionsMap.set(pos.code, pos);
  }

  // Calculate total position value and weight
  let totalPositionValue = 0;
  for (const pos of positions) {
    totalPositionValue += pos.marketValue;
  }

  // ============ Step 1: Risk Checks on Existing Positions ============
  
  // Check each existing position for risk violations
  for (const pos of positions) {
    const price = currentPrices.get(pos.code) ?? pos.currentPrice;
    const currentPos: Position = {
      ...pos,
      currentPrice: price,
      marketValue: pos.shares * price,
      profitLoss: (price - pos.avgCost) * pos.shares,
      profitLossPct: ((price - pos.avgCost) / pos.avgCost) * 100,
    };

    const riskCheck = checkPositionRisk(currentPos, riskLimits, totalValue);
    violations.push(...riskCheck.violations);
    warnings.push(...riskCheck.warnings);

    // Generate stop-loss directive if needed
    if (currentPos.profitLossPct <= riskLimits.stopLossPct) {
      directives.push({
        code: currentPos.code,
        name: currentPos.name,
        action: 'CLEAR',
        shares: currentPos.shares,
        price: currentPos.currentPrice,
        reason: `Stop loss triggered at ${currentPos.profitLossPct.toFixed(2)}%`,
        urgency: 'HIGH',
      });
    }
  }

  // Check total exposure
  const exposureCheck = checkTotalExposure(positions, riskLimits, cash, totalValue);
  violations.push(...exposureCheck.violations);
  warnings.push(...exposureCheck.warnings);

  // ============ Step 2: Process Target Positions ============
  
  // Calculate available cash for new positions
  let availableCash = cash;
  
  // First, account for existing positions we might reduce
  for (const target of targetPositions) {
    const currentPos = currentPositionsMap.get(target.code);
    if (currentPos) {
      // We'll potentially reduce this position
      availableCash += currentPos.marketValue;
    }
  }

  for (const target of targetPositions) {
    const currentPos = currentPositionsMap.get(target.code);
    const currentPrice = currentPrices.get(target.code) ?? currentPos?.currentPrice ?? 0;
    
    if (currentPrice <= 0) continue;

    // Calculate target market value based on weight
    const targetMarketValue = totalValue * (target.weight / 100);
    const targetShares = Math.floor(targetMarketValue / currentPrice);

    if (currentPos) {
      // Existing position - calculate adjustment
      const diffShares = targetShares - currentPos.shares;
      const diffValue = diffShares * currentPrice;

      if (Math.abs(diffShares) >= 10) { // Minimum 10 shares change
        if (diffShares > 0) {
          // Need to buy more
          const buyValue = diffShares * currentPrice;
          if (buyValue <= availableCash * 0.95) { // Keep 5% cash buffer
            directives.push({
              code: currentPos.code,
              name: currentPos.name,
              action: 'BUY',
              shares: diffShares,
              price: currentPrice,
              reason: `Rebalance: increase from ${currentPos.weight.toFixed(1)}% to ${target.weight}% (Kelly confidence: ${(target.confidence * 100).toFixed(0)}%)`,
              urgency: target.confidence > 0.7 ? 'HIGH' : 'MEDIUM',
            });
            availableCash -= buyValue;
          }
        } else {
          // Need to sell
          directives.push({
            code: currentPos.code,
            name: currentPos.name,
            action: 'SELL',
            shares: Math.abs(diffShares),
            price: currentPrice,
            reason: `Rebalance: reduce from ${currentPos.weight.toFixed(1)}% to ${target.weight}%`,
            urgency: 'MEDIUM',
          });
          availableCash += Math.abs(diffShares) * currentPrice;
        }
      }

      // Update Kelly recommendations
      kellyRecommendations.set(currentPos.code, {
        weight: target.weight,
        shares: targetShares,
      });
    } else {
      // New position
      const newPositionValue = targetShares * currentPrice;
      
      // Check if we have room for new positions
      const currentTotalWeight = (totalPositionValue / totalValue) * 100;
      
      if (newPositionValue <= availableCash * 0.95 && currentTotalWeight < riskLimits.maxTotalPosition) {
        directives.push({
          code: target.code,
          name: target.code, // Will be enriched with name later
          action: 'BUY',
          shares: targetShares,
          price: currentPrice,
          reason: `New position: Kelly target weight ${target.weight}% (confidence: ${(target.confidence * 100).toFixed(0)}%)`,
          urgency: target.confidence > 0.8 ? 'HIGH' : target.confidence > 0.5 ? 'MEDIUM' : 'LOW',
        });
        availableCash -= newPositionValue;
      }

      kellyRecommendations.set(target.code, {
        weight: target.weight,
        shares: targetShares,
      });
    }
  }

  // ============ Step 3: Check for Overweight Positions ============
  
  // Find positions not in target list that should be reduced
  const targetCodes = new Set(targetPositions.map(t => t.code));
  for (const pos of positions) {
    if (!targetCodes.has(pos.code) && pos.weight > 5) {
      // Position not in targets and has meaningful weight - suggest reducing
      directives.push({
        code: pos.code,
        name: pos.name,
        action: 'SELL',
        shares: pos.shares,
        price: pos.currentPrice,
        reason: `Position not in target list (current weight: ${pos.weight.toFixed(1)}%)`,
        urgency: 'LOW',
      });
    }
  }

  const totalExposure = totalPositionValue / totalValue * 100;

  return {
    directives,
    riskResult: {
      passed: violations.length === 0,
      violations,
      warnings,
    },
    totalExposure,
    kellyRecommendations,
  };
}

// ============ Utility Functions ============

/**
 * Convert PaperTradeEngine positions to PortfolioState
 */
export function fromPaperPositions(
  paperPositions: PaperPosition[],
  cash: number,
  totalValue: number
): PortfolioState {
  const positions: Position[] = paperPositions.map(p => ({
    code: p.symbol,
    name: p.name,
    shares: p.shares,
    avgCost: p.avgCost,
    currentPrice: p.currentPrice,
    marketValue: p.marketValue,
    profitLoss: p.unrealizedPnL,
    profitLossPct: p.unrealizedPnLPct,
    weight: (p.marketValue / totalValue) * 100,
  }));

  return {
    cash,
    totalValue,
    positions,
    targetPositions: [],
  };
}

/**
 * Get default risk limits
 */
export function getDefaultRiskLimits(): RiskLimits {
  return {
    maxPositionWeight: 30,     // 30% max per position
    maxTotalPosition: 80,      // 80% max total position
    stopLossPct: -8,           // -8% stop loss
    maxDrawdown: -15,          // -15% max drawdown
  };
}

/**
 * Calculate portfolio statistics
 */
export interface PortfolioStats {
  totalValue: number;
  totalPositionValue: number;
  cash: number;
  cashRatio: number;
  totalExposure: number;
  totalProfitLoss: number;
  totalProfitLossPct: number;
  positionCount: number;
  avgPositionWeight: number;
  largestPosition: Position | null;
}

export function calculatePortfolioStats(portfolioState: PortfolioState): PortfolioStats {
  const totalPositionValue = portfolioState.positions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalProfitLoss = portfolioState.positions.reduce((sum, p) => sum + p.profitLoss, 0);
  const totalCost = portfolioState.positions.reduce((sum, p) => sum + p.shares * p.avgCost, 0);
  
  const sortedPositions = [...portfolioState.positions].sort((a, b) => b.weight - a.weight);
  
  return {
    totalValue: portfolioState.totalValue,
    totalPositionValue,
    cash: portfolioState.cash,
    cashRatio: (portfolioState.cash / portfolioState.totalValue) * 100,
    totalExposure: (totalPositionValue / portfolioState.totalValue) * 100,
    totalProfitLoss,
    totalProfitLossPct: totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0,
    positionCount: portfolioState.positions.length,
    avgPositionWeight: portfolioState.positions.length > 0 
      ? totalPositionValue / portfolioState.positions.length / portfolioState.totalValue * 100 
      : 0,
    largestPosition: sortedPositions[0] || null,
  };
}
