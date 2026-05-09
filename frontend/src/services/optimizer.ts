/**
 * Portfolio Optimization Engine
 * Implements Mean-Variance (Markowitz), Risk Parity, and Efficient Frontier
 * Uses numerical optimization (gradient descent / Newton iteration)
 */

export interface OptimizationConstraints {
  maxWeight: number;   // Max weight per asset (default 0.3 = 30%)
  minWeight: number;   // Min weight per asset (default 0 = 0%)
  allowShort: boolean; // Allow short positions (negative weights)
}

export interface OptimizationResult {
  weights: number[];              // Optimal weights (sum to 1)
  expectedReturn: number;         // Expected annual return (decimal)
  volatility: number;             // Annual volatility (decimal)
  sharpeRatio: number;            // Sharpe ratio
  riskContributions?: number[];   // Risk contribution of each asset
}

export interface EfficientFrontierPoint {
  return: number;     // Expected return (decimal)
  volatility: number; // Volatility (decimal)
  weights?: number[]; // Portfolio weights at this point
  isMaxSharpe?: boolean;
  isMinVariance?: boolean;
}

// Default constraints
export const DEFAULT_CONSTRAINTS: OptimizationConstraints = {
  maxWeight: 0.30,
  minWeight: 0.00,
  allowShort: false,
};

/**
 * Compute covariance matrix from return matrix
 * @param returnsMatrix - Array of return arrays, each inner array is returns for one asset
 * @returns Covariance matrix (n x n)
 */
export function computeCovarianceMatrix(returnsMatrix: number[][]): number[][] {
  const nAssets = returnsMatrix.length;
  if (nAssets === 0) return [];
  
  const nDays = returnsMatrix[0].length;
  
  // Compute mean for each asset
  const means = returnsMatrix.map(returns => 
    returns.reduce((a, b) => a + b, 0) / nDays
  );
  
  // Compute covariance matrix
  const covMatrix: number[][] = [];
  for (let i = 0; i < nAssets; i++) {
    covMatrix[i] = [];
    for (let j = 0; j < nAssets; j++) {
      let cov = 0;
      for (let t = 0; t < nDays; t++) {
        cov += (returnsMatrix[i][t] - means[i]) * (returnsMatrix[j][t] - means[j]);
      }
      covMatrix[i][j] = cov / (nDays - 1);
    }
  }
  
  return covMatrix;
}

/**
 * Annualize returns and covariance
 */
export function annualizeReturns(returns: number[], tradingDays = 252): number {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  return mean * tradingDays;
}

export function annualizeCovariance(covMatrix: number[][], tradingDays = 252): number[][] {
  return covMatrix.map(row => row.map(v => v * tradingDays));
}

/**
 * Compute portfolio return given weights and asset returns
 */
export function portfolioReturn(weights: number[], returns: number[]): number {
  return weights.reduce((sum, w, i) => sum + w * returns[i], 0);
}

/**
 * Compute portfolio volatility (standard deviation)
 */
export function portfolioVolatility(weights: number[], covMatrix: number[][]): number {
  const n = weights.length;
  let vol = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      vol += weights[i] * weights[j] * covMatrix[i][j];
    }
  }
  return Math.sqrt(Math.max(0, vol));
}

/**
 * Compute risk contributions (marginal contribution to portfolio risk)
 */
export function computeRiskContributions(weights: number[], covMatrix: number[][]): number[] {
  const n = weights.length;
  const portVol = portfolioVolatility(weights, covMatrix);
  if (portVol === 0) return weights.map(() => 0);
  
  const marginalContrib: number[] = [];
  for (let i = 0; i < n; i++) {
    let mc = 0;
    for (let j = 0; j < n; j++) {
      mc += weights[j] * covMatrix[i][j];
    }
    marginalContrib.push(mc / portVol);
  }
  
  // Risk contribution = weight * marginal contribution
  return weights.map((w, i) => w * marginalContrib[i]);
}

/**
 * Normalize weights to sum to 1
 */
function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(sum) < 1e-10) {
    return weights.map(() => 1 / weights.length);
  }
  return weights.map(w => w / sum);
}

/**
 * Project weights to satisfy constraints
 */
function projectWeights(weights: number[], constraints: OptimizationConstraints): number[] {
  const { maxWeight, minWeight, allowShort } = constraints;
  
  return weights.map(w => {
    if (!allowShort) {
      w = Math.max(0, w);
    }
    w = Math.min(maxWeight, Math.max(minWeight, w));
    return w;
  });
}

/**
 * Gradient descent optimizer for mean-variance
 */
function gradientDescent(
  _objective: (w: number[]) => number,
  gradient: (w: number[]) => number[],
  nAssets: number,
  constraints: OptimizationConstraints,
  maxIterations = 500,
  learningRate = 0.01
): number[] {
  let weights = new Array(nAssets).fill(1 / nAssets); // Start with equal weights
  
  for (let iter = 0; iter < maxIterations; iter++) {
    const grad = gradient(weights);
    let newWeights = weights.map((w, i) => w - learningRate * grad[i]);
    
    // Project to constraints
    newWeights = projectWeights(newWeights, constraints);
    
    // Normalize to sum to 1
    newWeights = normalizeWeights(newWeights);
    
    // Check convergence
    const maxDiff = Math.max(...weights.map((w, i) => Math.abs(w - newWeights[i])));
    weights = newWeights;
    
    if (maxDiff < 1e-6) break;
  }
  
  return weights;
}

/**
 * Mean-Variance Optimization (Max Sharpe or Min Variance)
 */
export function meanVarianceOptimize(
  symbols: string[],
  returnsMatrix: number[][],
  covMatrix: number[][],
  riskFreeRate: number = 0.03,
  constraints: OptimizationConstraints = DEFAULT_CONSTRAINTS,
  targetType: 'max_sharpe' | 'min_variance' = 'max_sharpe',
  targetReturn?: number
): OptimizationResult {
  const n = symbols.length;
  if (n === 0) {
    return { weights: [], expectedReturn: 0, volatility: 0, sharpeRatio: 0 };
  }
  
  // Compute annualized returns from covariance matrix diagonal
  const meanReturns = covMatrix.map((_, i) => {
    // Use actual returns if available
    if (returnsMatrix[i]) {
      return annualizeReturns(returnsMatrix[i]);
    }
    // Fallback: estimate from covariance diagonal
    return 0;
  });
  
  if (targetType === 'min_variance' && targetReturn !== undefined) {
    // Minimize variance for a given target return
    const obj = (w: number[]) => {
      const vol = portfolioVolatility(w, covMatrix);
      const ret = portfolioReturn(w, meanReturns);
      const retPenalty = Math.max(0, targetReturn - ret) * 100;
      return vol + retPenalty;
    };
    
    const grad = (w: number[]) => {
      const vol = portfolioVolatility(w, covMatrix);
      if (vol === 0) return new Array(n).fill(0);
      // Numerical gradient
      const eps = 1e-5;
      return w.map((_, i) => {
        const wPlus = [...w];
        wPlus[i] += eps;
        return (portfolioVolatility(wPlus, covMatrix) - vol) / eps;
      });
    };
    
    const weights = gradientDescent(obj, grad, n, constraints);
    const ret = portfolioReturn(weights, meanReturns);
    const vol = portfolioVolatility(weights, covMatrix);
    const sharpe = vol > 0 ? (ret - riskFreeRate) / vol : 0;
    
    return {
      weights,
      expectedReturn: ret,
      volatility: vol,
      sharpeRatio: sharpe,
      riskContributions: computeRiskContributions(weights, covMatrix),
    };
  }
  
  // Max Sharpe optimization
  const obj = (w: number[]) => {
    const ret = portfolioReturn(w, meanReturns);
    const vol = portfolioVolatility(w, covMatrix);
    const sharpe = vol > 0 ? (ret - riskFreeRate) / vol : 0;
    return -sharpe; // Minimize negative Sharpe = maximize Sharpe
  };
  
  const grad = (w: number[]) => {
    const ret = portfolioReturn(w, meanReturns);
    const vol = portfolioVolatility(w, covMatrix);
    if (vol === 0) return new Array(n).fill(0);
    // Numerical gradient of negative Sharpe
    const eps = 1e-5;
    return w.map((_, i) => {
      const wPlus = [...w];
      wPlus[i] += eps;
      const retP = portfolioReturn(wPlus, meanReturns);
      const volP = portfolioVolatility(wPlus, covMatrix);
      const sharpeP = volP > 0 ? (retP - riskFreeRate) / volP : 0;
      return -(sharpeP - (vol > 0 ? (ret - riskFreeRate) / vol : 0)) / eps;
    });
  };
  
  const weights = gradientDescent(obj, grad, n, constraints);
  const ret = portfolioReturn(weights, meanReturns);
  const vol = portfolioVolatility(weights, covMatrix);
  const sharpe = vol > 0 ? (ret - riskFreeRate) / vol : 0;
  
  return {
    weights,
    expectedReturn: ret,
    volatility: vol,
    sharpeRatio: sharpe,
    riskContributions: computeRiskContributions(weights, covMatrix),
  };
}

/**
 * Risk Parity Optimization using Newton iteration
 */
export function riskParityOptimize(
  symbols: string[],
  covMatrix: number[][],
  constraints: OptimizationConstraints = DEFAULT_CONSTRAINTS,
  maxIterations = 200
): OptimizationResult {
  const n = symbols.length;
  if (n === 0) {
    return { weights: [], expectedReturn: 0, volatility: 0, sharpeRatio: 0 };
  }
  
  // Initial weights (inverse volatility)
  let weights = covMatrix.map((_, i) => {
    const vol = Math.sqrt(Math.max(covMatrix[i][i], 1e-10));
    return 1 / vol;
  });
  weights = normalizeWeights(weights);
  
  // Risk target = total portfolio risk / n (equal risk contribution)
  for (let iter = 0; iter < maxIterations; iter++) {
    const vol = portfolioVolatility(weights, covMatrix);
    if (vol === 0) break;
    
    const riskContrib = computeRiskContributions(weights, covMatrix);
    const targetRC = vol / n;
    
    // Compute new weights to equalize risk contributions
    const newWeights = weights.map((w, i) => {
      if (riskContrib[i] === 0) return w;
      return w * (targetRC / riskContrib[i]);
    });
    
    // Project and normalize
    const projected = projectWeights(newWeights, constraints);
    const normalized = normalizeWeights(projected);
    
    // Check convergence
    const maxDiff = Math.max(...weights.map((w, i) => Math.abs(w - normalized[i])));
    weights = normalized;
    
    if (maxDiff < 1e-6) break;
  }
  
  // Compute portfolio stats
  const vol = portfolioVolatility(weights, covMatrix);
  
  // For risk parity, expected return is not well-defined without return assumptions
  // Use equal weights for return estimate or assume zero
  const expectedReturn = 0;
  const riskFreeRate = 0.03;
  const sharpe = vol > 0 ? (expectedReturn - riskFreeRate) / vol : 0;
  
  return {
    weights,
    expectedReturn,
    volatility: vol,
    sharpeRatio: sharpe,
    riskContributions: computeRiskContributions(weights, covMatrix),
  };
}

/**
 * Compute the Efficient Frontier
 */
export function computeEfficientFrontier(
  symbols: string[],
  returnsMatrix: number[][],
  covMatrix: number[][],
  nPoints: number = 30,
  riskFreeRate: number = 0.03
): EfficientFrontierPoint[] {
  const n = symbols.length;
  if (n === 0) return [];
  
  // Compute mean returns
  const meanReturns = returnsMatrix.map(r => annualizeReturns(r));
  
  // Find min and max returns in the feasible space
  const minReturn = Math.min(...meanReturns);
  const maxReturn = Math.max(...meanReturns);
  
  // Generate target returns
  const points: EfficientFrontierPoint[] = [];
  
  // Add min variance point
  const minVarResult = meanVarianceOptimize(
    symbols, returnsMatrix, covMatrix, riskFreeRate,
    DEFAULT_CONSTRAINTS, 'min_variance', minReturn
  );
  points.push({
    return: minVarResult.expectedReturn,
    volatility: minVarResult.volatility,
    weights: minVarResult.weights,
    isMinVariance: true,
  });
  
  // Generate points along the frontier
  for (let i = 1; i < nPoints - 1; i++) {
    const targetReturn = minReturn + (maxReturn - minReturn) * (i / (nPoints - 2));
    
    const result = meanVarianceOptimize(
      symbols, returnsMatrix, covMatrix, riskFreeRate,
      DEFAULT_CONSTRAINTS, 'min_variance', targetReturn
    );
    
    // Only add if valid
    if (result.volatility > 0 && isFinite(result.volatility)) {
      points.push({
        return: result.expectedReturn,
        volatility: result.volatility,
        weights: result.weights,
      });
    }
  }
  
  // Add max Sharpe point
  const maxSharpeResult = meanVarianceOptimize(
    symbols, returnsMatrix, covMatrix, riskFreeRate,
    DEFAULT_CONSTRAINTS, 'max_sharpe'
  );
  points.push({
    return: maxSharpeResult.expectedReturn,
    volatility: maxSharpeResult.volatility,
    weights: maxSharpeResult.weights,
    isMaxSharpe: true,
  });
  
  // Sort by volatility
  points.sort((a, b) => a.volatility - b.volatility);
  
  // Note: max Sharpe point is found via findIndex when rendering

  return points;
}

/**
 * Generate random portfolios for visualization (feasible region)
 */
export function generateRandomPortfolios(
  symbols: string[],
  returnsMatrix: number[][],
  covMatrix: number[][],
  nPortfolios: number = 200,
  constraints: OptimizationConstraints = DEFAULT_CONSTRAINTS
): EfficientFrontierPoint[] {
  const n = symbols.length;
  if (n === 0) return [];
  
  const meanReturns = returnsMatrix.map(r => annualizeReturns(r));
  const portfolios: EfficientFrontierPoint[] = [];
  
  for (let i = 0; i < nPortfolios; i++) {
    // Random weights respecting constraints
    let weights = new Array(n).fill(0).map(() => Math.random());
    
    // Project to max weight
    weights = weights.map(w => Math.min(w, constraints.maxWeight));
    
    // Normalize
    weights = normalizeWeights(weights);
    
    // Project again after normalization
    weights = projectWeights(weights, constraints);
    weights = normalizeWeights(weights);
    
    const ret = portfolioReturn(weights, meanReturns);
    const vol = portfolioVolatility(weights, covMatrix);
    
    if (vol > 0 && isFinite(vol) && isFinite(ret)) {
      portfolios.push({
        return: ret,
        volatility: vol,
        weights,
      });
    }
  }
  
  return portfolios;
}
