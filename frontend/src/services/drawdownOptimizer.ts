/**
 * Drawdown Optimization Engine
 * Rolling Maximum Drawdown calculator and grid search optimizer
 */

/**
 * Calculate rolling window maximum drawdown
 * @param returns - Array of period returns (e.g., daily returns)
 * @param window - Rolling window size in periods (default 252 for daily = 1 year)
 * @returns Rolling max drawdown value (negative decimal, e.g., -0.15 for -15%)
 */
export function rollingMaxDrawdown(returns: number[], window: number = 252): number {
  if (returns.length < 2) return 0;
  
  // Calculate cumulative returns (equity curve)
  const equityCurve: number[] = [1];
  for (const r of returns) {
    equityCurve.push(equityCurve[equityCurve.length - 1] * (1 + r));
  }
  
  let maxDrawdown = 0;
  
  // Slide through each window
  for (let i = window; i < equityCurve.length; i++) {
    const startIdx = i - window;
    let windowPeak = -Infinity;
    
    // Find peak in this window
    for (let j = startIdx; j <= i; j++) {
      if (equityCurve[j] > windowPeak) {
        windowPeak = equityCurve[j];
      }
    }
    
    // Calculate drawdown at end of window
    const currentValue = equityCurve[i];
    const drawdown = (currentValue - windowPeak) / windowPeak;
    
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

/**
 * Calculate drawdown series for charting
 * @param returns - Array of period returns
 * @returns Array of drawdown values at each point
 */
export function calculateDrawdownSeries(returns: number[]): number[] {
  if (returns.length < 2) return [];
  
  // Calculate cumulative returns
  const equityCurve: number[] = [1];
  for (const r of returns) {
    equityCurve.push(equityCurve[equityCurve.length - 1] * (1 + r));
  }
  
  const drawdownSeries: number[] = [0]; // First point has no drawdown
  let peak = 1;
  
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      peak = equityCurve[i];
    }
    const dd = (equityCurve[i] - peak) / peak;
    drawdownSeries.push(dd);
  }
  
  return drawdownSeries;
}

/**
 * Calculate standard max drawdown (not rolling)
 */
export function calculateMaxDrawdown(returns: number[]): number {
  if (returns.length < 2) return 0;
  
  const equityCurve: number[] = [1];
  for (const r of returns) {
    equityCurve.push(equityCurve[equityCurve.length - 1] * (1 + r));
  }
  
  let maxDrawdown = 0;
  let peak = equityCurve[0];
  
  for (const value of equityCurve) {
    if (value > peak) {
      peak = value;
    }
    const dd = (value - peak) / peak;
    if (dd < maxDrawdown) {
      maxDrawdown = dd;
    }
  }
  
  return maxDrawdown;
}

/**
 * Calculate portfolio returns from weight and asset returns
 */
export function calculatePortfolioReturns(
  weights: number[],
  assetReturns: number[][]
): number[] {
  if (weights.length !== assetReturns.length || weights.length === 0) {
    return [];
  }
  
  const periods = assetReturns[0].length;
  const portfolioReturns: number[] = [];
  
  for (let t = 0; t < periods; t++) {
    let portReturn = 0;
    for (let i = 0; i < weights.length; i++) {
      portReturn += weights[i] * assetReturns[i][t];
    }
    portfolioReturns.push(portReturn);
  }
  
  return portfolioReturns;
}

/**
 * Strategy parameter grid definition for drawdown optimization
 */
export interface DrawdownStrategyParams {
  maShortRange: { min: number; max: number; step: number };
  maLongRange: { min: number; max: number; step: number };
  stopLossRange: { min: number; max: number; step: number };
  takeProfitRange: { min: number; max: number; step: number };
}

/**
 * Optimization constraints for drawdown optimization
 */
export interface DrawdownOptimizationConstraints {
  minAnnualReturn: number;      // Minimum annualized return (decimal, e.g., 0.05 for 5%)
  maxPositions: number;         // Maximum number of positions
  maxWeightPerAsset: number;    // Maximum weight per asset (decimal)
  riskFreeRate: number;         // Risk-free rate for Sharpe calculation
}

/**
 * Grid search result for a single parameter combination
 */
export interface GridSearchResult {
  params: {
    maShort: number;
    maLong: number;
    stopLoss: number;
    takeProfit: number;
  };
  metrics: {
    totalReturn: number;
    annualReturn: number;
    maxDrawdown: number;
    rollingMaxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
  };
  fitness: number; // Negative of rolling max drawdown (for minimization)
}

/**
 * Generate all parameter combinations for grid search
 */
function generateParameterGrid(
  params: DrawdownStrategyParams
): { maShort: number; maLong: number; stopLoss: number; takeProfit: number }[] {
  const combinations: { maShort: number; maLong: number; stopLoss: number; takeProfit: number }[] = [];
  
  for (let maShort = params.maShortRange.min; maShort <= params.maShortRange.max; maShort += params.maShortRange.step) {
    for (let maLong = params.maLongRange.min; maLong <= params.maLongRange.max; maLong += params.maLongRange.step) {
      if (maShort >= maLong) continue; // MA short must be less than MA long
      for (let stopLoss = params.stopLossRange.min; stopLoss <= params.stopLossRange.max; stopLoss += params.stopLossRange.step) {
        for (let takeProfit = params.takeProfitRange.min; takeProfit <= params.takeProfitRange.max; takeProfit += params.takeProfitRange.step) {
          combinations.push({ maShort, maLong, stopLoss, takeProfit });
        }
      }
    }
  }
  
  return combinations;
}

/**
 * Simulate simple MA crossover strategy returns
 * This is a simplified backtest for demonstration
 */
function simulateStrategyReturns(
  prices: number[],
  maShort: number,
  maLong: number,
  stopLoss: number,
  takeProfit: number
): { returns: number[]; trades: number; wins: number } {
  if (prices.length < maLong * 2) {
    return { returns: [], trades: 0, wins: 0 };
  }
  
  // Calculate moving averages
  const maShortValues: number[] = [];
  const maLongValues: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i >= maShort - 1) {
      const shortSum = prices.slice(i - maShort + 1, i + 1).reduce((a, b) => a + b, 0);
      maShortValues.push(shortSum / maShort);
    }
    if (i >= maLong - 1) {
      const longSum = prices.slice(i - maLong + 1, i + 1).reduce((a, b) => a + b, 0);
      maLongValues.push(longSum / maLong);
    }
  }
  
  // Generate trading signals and returns
  const returns: number[] = [];
  let inPosition = false;
  let entryPrice = 0;
  let trades = 0;
  let wins = 0;
  let lastReturn = 0;
  
  const startIdx = maLong - 1;
  
  for (let i = startIdx; i < prices.length - 1; i++) {
    const maShortIdx = i;
    const maLongIdx = i;
    
    if (maShortIdx >= maShortValues.length || maLongIdx >= maLongValues.length) continue;
    
    const shortMA = maShortValues[maShortIdx];
    const longMA = maLongValues[maLongIdx];
    const prevShortMA = maShortValues[maShortIdx - 1];
    const prevLongMA = maLongValues[maLongIdx - 1];
    
    // Golden cross - buy signal
    if (!inPosition && prevShortMA <= prevLongMA && shortMA > longMA) {
      inPosition = true;
      entryPrice = prices[i];
      trades++;
    }
    // Death cross - sell signal
    else if (inPosition && prevShortMA >= prevLongMA && shortMA < longMA) {
      const exitPrice = prices[i];
      lastReturn = (exitPrice - entryPrice) / entryPrice;
      returns.push(lastReturn);
      if (lastReturn > 0) wins++;
      inPosition = false;
    }
    // Stop loss or take profit while in position
    else if (inPosition) {
      const currentPrice = prices[i];
      const drawdown = (currentPrice - entryPrice) / entryPrice;
      
      if (drawdown <= -stopLoss) {
        // Stop loss triggered
        lastReturn = -stopLoss;
        returns.push(lastReturn);
        if (lastReturn > 0) wins++;
        inPosition = false;
        trades++;
      } else if (drawdown >= takeProfit) {
        // Take profit triggered
        lastReturn = takeProfit;
        returns.push(lastReturn);
        if (lastReturn > 0) wins++;
        inPosition = false;
        trades++;
      }
    }
  }
  
  // Close any remaining position
  if (inPosition) {
    const exitPrice = prices[prices.length - 1];
    lastReturn = (exitPrice - entryPrice) / entryPrice;
    returns.push(lastReturn);
    if (lastReturn > 0) wins++;
  }
  
  // If no trades, use buy-and-hold returns
  if (returns.length === 0 && prices.length > 1) {
    const holdReturn = (prices[prices.length - 1] - prices[0]) / prices[0];
    return { returns: [holdReturn], trades: 1, wins: holdReturn > 0 ? 1 : 0 };
  }
  
  return { returns, trades, wins };
}

/**
 * Calculate fitness for optimization (negative of rolling max drawdown)
 * Lower is better (more negative = worse drawdown)
 */
function calculateFitness(
  returns: number[],
  rollingWindow: number,
  constraints: DrawdownOptimizationConstraints
): { fitness: number; metrics: GridSearchResult['metrics'] } {
  if (returns.length < rollingWindow) {
    return {
      fitness: 0,
      metrics: {
        totalReturn: 0,
        annualReturn: 0,
        maxDrawdown: 0,
        rollingMaxDrawdown: 0,
        sharpeRatio: 0,
        winRate: 0,
      },
    };
  }
  
  // Calculate metrics
  const totalReturn = returns.reduce((a, b) => a + b, 0);
  const avgReturn = totalReturn / returns.length;
  const annualReturn = avgReturn * 252; // Assuming daily returns
  
  const maxDrawdown = calculateMaxDrawdown(returns);
  const rollingMaxDD = rollingMaxDrawdown(returns, rollingWindow);
  
  // Calculate volatility for Sharpe
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance * 252);
  const sharpe = volatility > 0 ? (annualReturn - constraints.riskFreeRate) / volatility : 0;
  
  const wins = returns.filter(r => r > 0).length;
  const winRate = returns.length > 0 ? wins / returns.length : 0;
  
  // Fitness: negative rolling max drawdown (we want to minimize)
  const fitness = -rollingMaxDD;
  
  return {
    fitness,
    metrics: {
      totalReturn,
      annualReturn,
      maxDrawdown,
      rollingMaxDrawdown: rollingMaxDD,
      sharpeRatio: sharpe,
      winRate,
    },
  };
}

/**
 * Progress callback type
 */
export type OptimizationProgressCallback = (
  completed: number,
  total: number,
  currentParams: GridSearchResult['params'] | null,
  bestResult: GridSearchResult | null
) => void;

/**
 * Grid search for drawdown optimization
 * @param prices - Price series for backtesting
 * @param params - Parameter ranges to search
 * @param constraints - Optimization constraints
 * @param rollingWindow - Rolling window for MaxDD calculation (default 252)
 * @param onProgress - Progress callback
 */
export async function gridSearchDrawdown(
  prices: number[],
  params: DrawdownStrategyParams,
  constraints: DrawdownOptimizationConstraints,
  rollingWindow: number = 252,
  onProgress?: OptimizationProgressCallback
): Promise<GridSearchResult> {
  const combinations = generateParameterGrid(params);
  const total = combinations.length;
  
  let bestResult: GridSearchResult | null = null;
  
  // Limit concurrent execution to avoid blocking UI
  const batchSize = 50;
  
  for (let batchStart = 0; batchStart < total; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, total);
    
    const batchResults = await Promise.all(
      combinations.slice(batchStart, batchEnd).map(async (combo) => {
        const { returns } = simulateStrategyReturns(
          prices,
          combo.maShort,
          combo.maLong,
          combo.stopLoss,
          combo.takeProfit
        );
        
        const { fitness, metrics } = calculateFitness(returns, rollingWindow, constraints);
        
        // Apply constraints
        if (metrics.annualReturn < constraints.minAnnualReturn) {
          // Penalize low returns
          return {
            params: combo,
            metrics,
            fitness: fitness - 1, // Make it worse
          };
        }
        
        return { params: combo, metrics, fitness };
      })
    );
    
    // Find best in batch
    for (const result of batchResults) {
      if (!bestResult || result.fitness > bestResult.fitness) {
        bestResult = result;
      }
    }
    
    // Report progress
    if (onProgress) {
      onProgress(batchEnd, total, null, bestResult);
    }
    
    // Yield to UI
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return bestResult || {
    params: { maShort: 0, maLong: 0, stopLoss: 0, takeProfit: 0 },
    metrics: {
      totalReturn: 0,
      annualReturn: 0,
      maxDrawdown: 0,
      rollingMaxDrawdown: 0,
      sharpeRatio: 0,
      winRate: 0,
    },
    fitness: 0,
  };
}

/**
 * Main optimization function - optimizes strategy parameters for minimum rolling max drawdown
 */
export async function optimizeForDrawdown(
  prices: number[],
  strategyParams: DrawdownStrategyParams,
  constraints: DrawdownOptimizationConstraints,
  rollingWindow?: number,
  onProgress?: OptimizationProgressCallback
): Promise<GridSearchResult> {
  const window = rollingWindow || Math.min(252, Math.floor(prices.length / 2));
  
  return gridSearchDrawdown(prices, strategyParams, constraints, window, onProgress);
}

/**
 * Run sensitivity analysis on optimal parameters
 */
export async function runSensitivityAnalysis(
  prices: number[],
  optimalParams: GridSearchResult['params'],
  _constraints: DrawdownOptimizationConstraints,
  perturbations: number[] = [-0.1, -0.05, 0.05, 0.1],
  rollingWindow: number = 252
): Promise<{ perturbation: number; paramName: string; rollingMaxDD: number }[]> {
  const results: { perturbation: number; paramName: string; rollingMaxDD: number }[] = [];
  
  const paramNames = ['maShort', 'maLong', 'stopLoss', 'takeProfit'] as const;
  
  for (const paramName of paramNames) {
    for (const pert of perturbations) {
      const testParams = { ...optimalParams };
      testParams[paramName] = optimalParams[paramName] * (1 + pert);
      
      // Ensure valid values
      if (testParams[paramName] <= 0) continue;
      if (paramName === 'maShort' && testParams[paramName] >= testParams.maLong) continue;
      
      const { returns } = simulateStrategyReturns(
        prices,
        testParams.maShort,
        testParams.maLong,
        testParams.stopLoss,
        testParams.takeProfit
      );

      const rollingDD = rollingMaxDrawdown(returns, rollingWindow);

      results.push({
        perturbation: pert * 100,
        paramName,
        rollingMaxDD: rollingDD,
      });
    }
  }
  
  return results;
}
