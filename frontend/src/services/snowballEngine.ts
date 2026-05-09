/**
 * Snowball Autocallable Pricing & Backtesting Engine
 * 
 * Implements path simulation, Monte Carlo, scenario analysis, and sensitivity analysis
 * for Snowball (Autocallable) structured products.
 */

import type {
  SnowballConfig,
  SnowballBacktestResult,
  SnowballScenarioResult,
  SnowballSensitivityPoint,
} from '../types';

// ============== Path Simulation ==============

export interface SnowballPathResult {
  pnl: number;
  knockOut: boolean;
  knockIn: boolean;
  knockOutDate?: string;
  holdingMonths: number;
  finalPrice: number;
}

/**
 * Simulate a single Snowball path given price series and observation dates
 */
export function simulateSnowballPath(
  config: SnowballConfig,
  priceSeries: { date: string; close: number }[],
  observationDates: string[]
): SnowballPathResult {
  const { initialPrice, couponRate, knockOutBarrier, knockInBarrier, direction } = config;
  const multiplier = direction === 'long' ? 1 : -1;

  let knockOut = false;
  let knockIn = false;
  let knockOutDate: string | undefined;
  let holdingMonths = 0;

  for (let i = 0; i < observationDates.length; i++) {
    const obsDate = observationDates[i];
    const pricePoint = priceSeries.find(p => p.date === obsDate);
    if (!pricePoint) continue;

    const currentPrice = pricePoint.close;
    const priceRatio = currentPrice / initialPrice;

    holdingMonths = i + 1;

    // Check knock-out (upward breach)
    if (priceRatio >= knockOutBarrier) {
      knockOut = true;
      knockOutDate = obsDate;
      const coupon = couponRate * (holdingMonths / 12);
      return {
        pnl: multiplier * coupon,
        knockOut: true,
        knockIn: false,
        knockOutDate,
        holdingMonths,
        finalPrice: currentPrice,
      };
    }

    // Check knock-in (downward breach)
    if (priceRatio <= knockInBarrier) {
      knockIn = true;
    }
  }

  // End of tenure
  const finalPricePoint = priceSeries[priceSeries.length - 1];
  const finalPrice = finalPricePoint ? finalPricePoint.close : initialPrice;
  const finalRatio = finalPrice / initialPrice;

  let pnl: number;
  if (knockIn) {
    if (finalRatio >= 1) {
      // Knocked in but recovered to initial price
      pnl = 0;
    } else {
      // Knocked in and stayed below initial price - take loss
      pnl = multiplier * (finalRatio - 1);
    }
  } else {
    // No knock-in, no knock-out - full coupon
    pnl = multiplier * couponRate * (config.tenure / 12);
  }

  return {
    pnl,
    knockOut,
    knockIn,
    holdingMonths: config.tenure,
    finalPrice,
  };
}

// ============== Backtesting with Historical Data ==============

/**
 * Run backtest using historical price data
 */
export function runSnowballBacktest(
  config: SnowballConfig,
  priceSeries: { date: string; close: number }[]
): SnowballBacktestResult {
  const result = simulateSnowballPath(config, priceSeries, config.observationDates);

  // Calculate simple metrics from single path
  const totalReturn = result.pnl;
  const annualizedReturn = totalReturn / (result.holdingMonths / 12);

  // For single path, max drawdown is simplified
  const maxDrawdown = result.knockIn && result.pnl < 0 ? Math.abs(result.pnl) : 0;
  const sharpe = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

  const knockOutRate = result.knockOut ? 1 : 0;
  const knockInRate = result.knockIn ? 1 : 0;

  // Monthly P&L sequence (simplified)
  const monthlyPnl: number[] = [];
  for (let m = 1; m <= result.holdingMonths; m++) {
    monthlyPnl.push(config.couponRate * (m / 12) * (result.knockOut && m === result.holdingMonths ? 1 : 0));
  }

  return {
    totalReturn,
    annualizedReturn,
    maxDrawdown,
    sharpe,
    knockOutRate,
    knockInRate,
    avgHoldingPeriod: result.holdingMonths,
    pnlByScenario: { bull: totalReturn, sideways: totalReturn * 0.8, bear: totalReturn * -0.5 },
    monthlyPnl,
  };
}

// ============== Monte Carlo Simulation ==============

export interface MonteCarloResult {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpe: number;
  knockOutRate: number;
  knockInRate: number;
  avgHoldingPeriod: number;
  returnDistribution: { bin: number; count: number }[];
  pnlByScenario: { bull: number; sideways: number; bear: number };
  monthlyPnl: number[];
}

/**
 * Run Monte Carlo simulation for Snowball
 */
export function monteCarloSnowball(
  config: SnowballConfig,
  nSimulations: number = 1000,
  seed?: number
): MonteCarloResult {
  const rng = seed !== undefined ? seededRandom(seed) : Math.random;

  const returns: SnowballPathResult[] = [];
  let knockOutCount = 0;
  let knockInCount = 0;
  let totalHoldingMonths = 0;

  for (let sim = 0; sim < nSimulations; sim++) {
    const priceSeries = generateSimulatedPath(config, rng);
    const result = simulateSnowballPath(config, priceSeries, config.observationDates);
    returns.push(result);

    if (result.knockOut) knockOutCount++;
    if (result.knockIn) knockInCount++;
    totalHoldingMonths += result.holdingMonths;
  }

  const pnls = returns.map(r => r.pnl);
  const avgReturn = pnls.reduce((a, b) => a + b, 0) / nSimulations;

  // Annualized (assuming 12-month tenure)
  const annualizedReturn = avgReturn / (config.tenure / 12);

  // Max drawdown (simplified: worst single path loss)
  const maxDrawdown = Math.max(0, ...pnls.filter(p => p < 0).map(p => Math.abs(p)));
  const sharpe = maxDrawdown > 0 ? avgReturn / maxDrawdown : 0;

  // Return distribution histogram
  const returnDistribution = buildHistogram(pnls, 20);

  // Monthly P&L (average across simulations)
  const monthlyPnl: number[] = [];
  for (let m = 1; m <= config.tenure; m++) {
    const avgCoupon = config.couponRate * (m / 12);
    monthlyPnl.push(avgCoupon);
  }

  return {
    totalReturn: avgReturn,
    annualizedReturn,
    maxDrawdown,
    sharpe,
    knockOutRate: knockOutCount / nSimulations,
    knockInRate: knockInCount / nSimulations,
    avgHoldingPeriod: totalHoldingMonths / nSimulations,
    returnDistribution,
    pnlByScenario: {
      bull: avgReturn * 1.2,
      sideways: avgReturn * 0.8,
      bear: avgReturn * -0.3,
    },
    monthlyPnl,
  };
}

/**
 * Generate a simulated price path using Geometric Brownian Motion
 */
function generateSimulatedPath(
  config: SnowballConfig,
  rng: () => number
): { date: string; close: number }[] {
  const { initialPrice, tenure } = config;
  const months = tenure;
  const steps = months; // monthly steps
  const dt = 1 / 12; // monthly time step

  // GBM parameters (annualized)
  const mu = 0.08;  // drift 8%
  const sigma = 0.20; // volatility 20%

  const prices: { date: string; close: number }[] = [];
  let price = initialPrice;

  for (let t = 0; t <= steps; t++) {
    // Generate observation dates (monthly)
    const date = new Date(2024, 0, 1);
    date.setMonth(date.getMonth() + t);
    const dateStr = date.toISOString().split('T')[0];

    if (t === 0) {
      prices.push({ date: dateStr, close: price });
    } else {
      // GBM: S(t+dt) = S(t) * exp((mu - 0.5*sigma^2)*dt + sigma*sqrt(dt)*Z)
      const Z = normalRandom(rng);
      const drift = (mu - 0.5 * sigma * sigma) * dt;
      const diffusion = sigma * Math.sqrt(dt) * Z;
      price = price * Math.exp(drift + diffusion);
      prices.push({ date: dateStr, close: price });
    }
  }

  return prices;
}

/**
 * Box-Muller transform for normal random numbers
 */
function normalRandom(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Seeded random number generator (simple LCG)
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Build histogram bins for return distribution
 */
function buildHistogram(values: number[], bins: number): { bin: number; count: number }[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binWidth = range / bins;

  const histogram: { bin: number; count: number }[] = [];
  for (let i = 0; i < bins; i++) {
    const binStart = min + i * binWidth;
    const binEnd = binStart + binWidth;
    const count = values.filter(v => v >= binStart && (i === bins - 1 ? v <= binEnd : v < binEnd)).length;
    histogram.push({ bin: binStart + binWidth / 2, count });
  }

  return histogram;
}

// ============== Scenario Analysis ==============

/**
 * Run scenario analysis for bull, sideways, and bear markets
 */
export function computeScenarioAnalysis(
  config: SnowballConfig,
  nSimulations: number = 500
): SnowballScenarioResult[] {
  const scenarios: Array<{
    name: 'bull' | 'sideways' | 'bear';
    mu: number;
    label: string;
  }> = [
    { name: 'bull', mu: 0.15, label: '牛市' },
    { name: 'sideways', mu: 0.0, label: '震荡' },
    { name: 'bear', mu: -0.10, label: '熊市' },
  ];

  return scenarios.map(({ name, mu }) => {
    const sigma = 0.20;
    const returns: SnowballPathResult[] = [];

    for (let sim = 0; sim < nSimulations; sim++) {
      const priceSeries = generateScenarioPath(config, mu, sigma);
      const result = simulateSnowballPath(config, priceSeries, config.observationDates);
      returns.push(result);
    }

    const pnls = returns.map(r => r.pnl);
    const avgReturn = pnls.reduce((a, b) => a + b, 0) / nSimulations;
    const knockOutCount = returns.filter(r => r.knockOut).length;
    const knockInCount = returns.filter(r => r.knockIn).length;
    const avgHolding = returns.reduce((a, r) => a + r.holdingMonths, 0) / nSimulations;

    return {
      scenario: name,
      totalReturn: avgReturn,
      knockOutRate: knockOutCount / nSimulations,
      knockInRate: knockInCount / nSimulations,
      avgHoldingPeriod: avgHolding,
    };
  });
}

/**
 * Generate a simulated price path for a specific scenario
 */
function generateScenarioPath(
  config: SnowballConfig,
  mu: number,
  sigma: number,
  rng?: () => number
): { date: string; close: number }[] {
  const { initialPrice, tenure } = config;
  const steps = tenure;
  const dt = 1 / 12;
  const rand = rng || (() => Math.random());

  const prices: { date: string; close: number }[] = [];
  let price = initialPrice;

  for (let t = 0; t <= steps; t++) {
    const date = new Date(2024, 0, 1);
    date.setMonth(date.getMonth() + t);
    const dateStr = date.toISOString().split('T')[0];

    if (t === 0) {
      prices.push({ date: dateStr, close: price });
    } else {
      const Z = normalRandom(rand);
      const drift = (mu - 0.5 * sigma * sigma) * dt;
      const diffusion = sigma * Math.sqrt(dt) * Z;
      price = price * Math.exp(drift + diffusion);
      prices.push({ date: dateStr, close: price });
    }
  }

  return prices;
}

// ============== Sensitivity Analysis ==============

/**
 * Compute sensitivity surface: knock-out barrier vs coupon rate
 */
export function computeSensitivitySurface(
  baseConfig: SnowballConfig,
  knockOutRange: number[],
  couponRange: number[],
  nSimulations: number = 100
): SnowballSensitivityPoint[] {
  const points: SnowballSensitivityPoint[] = [];

  for (const ko of knockOutRange) {
    for (const coupon of couponRange) {
      const config: SnowballConfig = {
        ...baseConfig,
        knockOutBarrier: ko,
        couponRate: coupon,
      };

      const result = monteCarloSnowball(config, nSimulations);
      points.push({
        param1: ko,
        param2: coupon,
        return: result.totalReturn,
      });
    }
  }

  return points;
}

/**
 * Compute sensitivity: knock-in barrier vs return
 */
export function computeKnockInSensitivity(
  baseConfig: SnowballConfig,
  knockInRange: number[],
  nSimulations: number = 100
): { ki: number; return: number; knockInRate: number }[] {
  return knockInRange.map(ki => {
    const config: SnowballConfig = {
      ...baseConfig,
      knockInBarrier: ki,
    };

    const result = monteCarloSnowball(config, nSimulations);
    return {
      ki,
      return: result.totalReturn,
      knockInRate: result.knockInRate,
    };
  });
}

// ============== Payoff Calculation ==============

/**
 * Calculate payoff at maturity for different price scenarios
 */
export function computePayoffDiagram(
  config: SnowballConfig,
  priceRatios: number[] // e.g. [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.05, 1.1, 1.2]
): { priceRatio: number; payoff: number; event: string }[] {
  const { couponRate, knockOutBarrier, knockInBarrier, direction } = config;
  const multiplier = direction === 'long' ? 1 : -1;

  return priceRatios.map(ratio => {
    let payoff: number;
    let event: string;

    if (ratio >= knockOutBarrier) {
      // Knocked out - get coupon
      payoff = multiplier * couponRate * (config.tenure / 12);
      event = '敲出';
    } else if (ratio <= knockInBarrier) {
      // Knocked in
      if (ratio >= 1) {
        payoff = 0;
        event = '敲入(未跌破)';
      } else {
        payoff = multiplier * (ratio - 1);
        event = '敲入(跌破)';
      }
    } else {
      // No event - full coupon
      payoff = multiplier * couponRate * (config.tenure / 12);
      event = '持有到期';
    }

    return { priceRatio: ratio, payoff, event };
  });
}
