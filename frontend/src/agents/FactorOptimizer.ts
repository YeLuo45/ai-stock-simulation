/**
 * Factor Weight Auto-Optimization Module
 * Grid Search and Random Search for factor weight optimization
 */
import type { FactorWeight } from '../types';
import { generateFactorData, computeCompositeScores, normalizeFactorValue } from '../services/factorEngine';

// ---- Interfaces ----

export interface FactorConfig {
  factor_id: string;
  weight: number;
  direction: 'long' | 'short';
  enabled: boolean;
}

export interface OptimizationResult {
  id: string;
  createdAt: number;
  method: 'grid' | 'random';
  objective: 'sharpe' | 'return' | 'winrate';
  topWeights: FactorConfig[];
  metrics: {
    sharpeRatio: number;
    totalReturn: number;
    winRate: number;
    maxDrawdown: number;
  };
  trials: number;
}

export interface OptimizationMetrics {
  sharpeRatio: number;
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
}

export interface RunOptimizationConfig {
  symbols: string[];
  factors: FactorConfig[];
  method: 'grid' | 'random';
  objective: 'sharpe' | 'return' | 'winrate';
  trials?: number; // Random Search only
  onProgress?: (current: number, total: number, currentWeights: number[]) => void;
}

// ---- Constants ----

const GRID_VALUES = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
const RESULTS_KEY = 'factor_optimization_results';
const BEST_WEIGHTS_KEY = 'factor_best_weights';

// ---- Helper Functions ----

function normalize(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + Math.abs(b), 0);
  return sum === 0 ? weights.map(() => 1 / weights.length) : weights.map(w => w / sum);
}

function calculateSharpe(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(
    returns.map(r => (r - mean) ** 2).reduce((a, b) => a + b, 0) / returns.length
  );
  return std === 0 ? 0 : (mean * 252) / (std * Math.sqrt(252));
}

function generateCombinations<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  const result: T[][] = [];
  const helper = (index: number, current: T[]) => {
    if (index === arrays.length) {
      result.push([...current]);
      return;
    }
    for (const value of arrays[index]) {
      current.push(value);
      helper(index + 1, current);
      current.pop();
    }
  };
  helper(0, []);
  return result;
}

function computeBacktestMetrics(
  symbols: string[],
  weights: FactorWeight[]
): OptimizationMetrics {
  // Use generateFactorData for each symbol
  const factorData = generateFactorData(symbols);

  // Compute composite scores
  const scores = computeCompositeScores(factorData, weights);

  // Sort symbols by score
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  // Simulate daily returns based on factor scores
  // Higher score = higher expected return
  const days = 60;
  const dailyReturns: number[] = [];

  let peak = 1;
  let equity = 1;
  let maxDrawdown = 0;
  let wins = 0;
  let losses = 0;

  for (let d = 0; d < days; d++) {
    // Simulate daily portfolio return based on top-ranked stocks
    const topCount = Math.max(1, Math.floor(sorted.length * 0.2)); // top 20%
    let dayReturn = 0;
    for (let i = 0; i < topCount; i++) {
      const sym = sorted[i][0];
      const score = scores[sym] || 0;
      // Score range [-1, 1] maps to return range
      const baseReturn = score * 0.02; // scale factor
      // Add noise
      const noise = (Math.random() - 0.5) * 0.01;
      dayReturn += baseReturn + noise;
    }
    dayReturn /= topCount;

    // Apply to long-short: high score = long, low score = short
    const bottomCount = Math.max(1, Math.floor(sorted.length * 0.2));
    let shortReturn = 0;
    for (let i = 0; i < bottomCount; i++) {
      const sym = sorted[sorted.length - 1 - i][0];
      const score = scores[sym] || 0;
      const baseReturn = -score * 0.015;
      const noise = (Math.random() - 0.5) * 0.01;
      shortReturn += baseReturn + noise;
    }
    shortReturn /= bottomCount;

    // Combined return (60% long, 40% short)
    const combinedReturn = dayReturn * 0.6 + shortReturn * 0.4;
    dailyReturns.push(combinedReturn);

    equity *= 1 + combinedReturn;
    if (equity > peak) peak = equity;
    const drawdown = (peak - equity) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    if (combinedReturn > 0) wins++;
    else losses++;
  }

  // Calculate metrics
  const totalReturn = (equity - 1) * 100;
  const sharpeRatio = calculateSharpe(dailyReturns);
  const winRate = (wins + losses) > 0 ? wins / (wins + losses) : 0;

  return {
    sharpeRatio,
    totalReturn,
    winRate,
    maxDrawdown: maxDrawdown * 100,
  };
}

// ---- Grid Search ----

async function gridSearch(
  symbols: string[],
  enabledFactors: FactorConfig[],
  objective: 'sharpe' | 'return' | 'winrate',
  onProgress?: (current: number, total: number, currentWeights: number[]) => void
): Promise<{ weights: FactorConfig[]; metrics: OptimizationMetrics; trials: number }> {
  const n = enabledFactors.length;
  const weightArrays = Array.from({ length: n }, () => GRID_VALUES);

  // For performance, when n > 5 use sparse grid
  const combinations = generateCombinations(weightArrays);
  const total = combinations.length;

  let bestWeights: number[] | null = null;
  let bestMetrics: OptimizationMetrics | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < combinations.length; i++) {
    const rawWeights = combinations[i];
    const normalized = normalize(rawWeights);

    const factorWeights: FactorWeight[] = enabledFactors.map((f, idx) => ({
      factor_id: f.factor_id,
      weight: normalized[idx],
      direction: f.direction,
    }));

    const metrics = computeBacktestMetrics(symbols, factorWeights);

    let score: number;
    switch (objective) {
      case 'sharpe':
        score = metrics.sharpeRatio;
        break;
      case 'return':
        score = metrics.totalReturn;
        break;
      case 'winrate':
        score = metrics.winRate;
        break;
    }

    if (score > bestScore) {
      bestScore = score;
      bestWeights = normalized;
      bestMetrics = metrics;
    }

    // Report progress every 50 combinations or at end
    if (i % 50 === 0 || i === combinations.length - 1) {
      onProgress?.(i + 1, total, rawWeights);
      // Yield to UI
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  if (!bestWeights || !bestMetrics) {
    throw new Error('Optimization failed');
  }

  const topWeights: FactorConfig[] = enabledFactors.map((f, idx) => ({
    factor_id: f.factor_id,
    weight: bestWeights![idx],
    direction: f.direction,
    enabled: true,
  }));

  return { weights: topWeights, metrics: bestMetrics, trials: combinations.length };
}

// ---- Random Search ----

async function randomSearch(
  symbols: string[],
  enabledFactors: FactorConfig[],
  objective: 'sharpe' | 'return' | 'winrate',
  trials: number,
  onProgress?: (current: number, total: number, currentWeights: number[]) => void
): Promise<{ weights: FactorConfig[]; metrics: OptimizationMetrics; trials: number }> {
  let bestWeights: number[] | null = null;
  let bestMetrics: OptimizationMetrics | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < trials; i++) {
    // Generate random weights
    const rawWeights = enabledFactors.map(() => Math.random());
    const normalized = normalize(rawWeights);

    const factorWeights: FactorWeight[] = enabledFactors.map((f, idx) => ({
      factor_id: f.factor_id,
      weight: normalized[idx],
      direction: f.direction,
    }));

    const metrics = computeBacktestMetrics(symbols, factorWeights);

    let score: number;
    switch (objective) {
      case 'sharpe':
        score = metrics.sharpeRatio;
        break;
      case 'return':
        score = metrics.totalReturn;
        break;
      case 'winrate':
        score = metrics.winRate;
        break;
    }

    if (score > bestScore) {
      bestScore = score;
      bestWeights = normalized;
      bestMetrics = metrics;
    }

    if (i % 10 === 0 || i === trials - 1) {
      onProgress?.(i + 1, trials, rawWeights);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  if (!bestWeights || !bestMetrics) {
    throw new Error('Optimization failed');
  }

  const topWeights: FactorConfig[] = enabledFactors.map((f, idx) => ({
    factor_id: f.factor_id,
    weight: bestWeights![idx],
    direction: f.direction,
    enabled: true,
  }));

  return { weights: topWeights, metrics: bestMetrics, trials };
}

// ---- Main Optimization Entry ----

export async function runOptimization(
  config: RunOptimizationConfig
): Promise<OptimizationResult> {
  const { symbols, factors, method, objective, trials = 100, onProgress } = config;

  // Filter only enabled factors
  const enabledFactors = factors.filter(f => f.enabled);
  if (enabledFactors.length === 0) {
    throw new Error('No enabled factors to optimize');
  }

  let result: { weights: FactorConfig[]; metrics: OptimizationMetrics; trials: number };

  if (method === 'grid') {
    result = await gridSearch(symbols, enabledFactors, objective, onProgress);
  } else {
    result = await randomSearch(symbols, enabledFactors, objective, trials, onProgress);
  }

  const optimizationResult: OptimizationResult = {
    id: `opt_${Date.now()}`,
    createdAt: Date.now(),
    method,
    objective,
    topWeights: result.weights,
    metrics: result.metrics,
    trials: result.trials,
  };

  // Save result
  saveOptimizationResult(optimizationResult);
  saveBestWeights(optimizationResult.topWeights);

  return optimizationResult;
}

// ---- Storage Functions ----

export function saveOptimizationResult(result: OptimizationResult): void {
  try {
    const existing = getOptimizationResults();
    existing.unshift(result);
    // Keep only last 20 results
    const trimmed = existing.slice(0, 20);
    localStorage.setItem(RESULTS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save optimization result', e);
  }
}

export function getOptimizationResults(): OptimizationResult[] {
  try {
    return JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveBestWeights(weights: FactorConfig[]): void {
  try {
    localStorage.setItem(BEST_WEIGHTS_KEY, JSON.stringify(weights));
  } catch (e) {
    console.error('Failed to save best weights', e);
  }
}

export function getBestWeights(): FactorConfig[] | null {
  try {
    const stored = localStorage.getItem(BEST_WEIGHTS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function clearBestWeights(): void {
  localStorage.removeItem(BEST_WEIGHTS_KEY);
}

// ---- Utility ----

export function getTotalGridCombinations(factorCount: number): number {
  return Math.pow(GRID_VALUES.length, factorCount);
}
