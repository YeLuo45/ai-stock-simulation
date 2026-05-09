/**
 * Walk-Forward Analysis Engine
 * Rolling window backtesting framework for robust strategy validation
 */

import type {
  WalkForwardConfig,
  WalkForwardResult,
  WalkForwardWindow,
  WalkForwardAggregateMetrics,
} from '../types';
import type { BacktestResult } from './indicators';
import {
  meanReversionBacktest,
  trendFollowingBacktest,
  rsiBacktest,
  macdTrendBacktest,
  valueInvestingBacktest,
  generatePriceHistory,
  type OHLCV,
} from './indicators';
import { DEFAULT_STOCKS } from './storage';

const STRATEGY_MAP: Record<string, (history: OHLCV[], cash: number, params: Record<string, unknown>) => BacktestResult> = {
  '均线回归策略': meanReversionBacktest as any,
  '趋势追踪策略': trendFollowingBacktest as any,
  'RSI反转策略': rsiBacktest as any,
  '价值投资策略': valueInvestingBacktest as any,
  'MACD趋势策略': macdTrendBacktest as any,
};

export const DEFAULT_WALKFORWARD_CONFIG: WalkForwardConfig = {
  windowSize: 504,      // 2 years
  trainRatio: 0.7,
  stepSize: 21,         // 1 month
  rebalanceInterval: 5,
  minSamples: 60,
};

/**
 * Run walk-forward analysis on a strategy
 */
export function runWalkForward(
  config: WalkForwardConfig,
  strategyParams: Record<string, unknown>,
  data: { dates: string[]; prices: number[] },
  strategyName: string = '均线回归策略',
  initialCash: number = 1000000
): WalkForwardResult {
  const { windowSize, trainRatio, stepSize, minSamples } = config;
  const trainWindowSize = Math.floor(windowSize * trainRatio);

  const dates = data.dates;
  const closes = data.prices;

  if (dates.length < windowSize) {
    throw new Error(`数据不足：需要至少 ${windowSize} 天数据，当前只有 ${dates.length} 天`);
  }

  const windows: WalkForwardWindow[] = [];
  const allOOSReturns: number[] = [];

  // Build rolling windows
  for (let start = 0; start + windowSize <= dates.length; start += stepSize) {
    const trainEnd = start + trainWindowSize;
    const testEnd = start + windowSize;

    if (testEnd > dates.length) break;
    if (trainEnd - start < minSamples || testEnd - trainEnd < minSamples) continue;

    const trainDates = dates.slice(start, trainEnd);
    const testDates = dates.slice(trainEnd, testEnd);

    // Build OHLCV data for train and test periods
    const trainData: OHLCV[] = trainDates.map((date, i) => {
      const price = closes[start + i];
      return {
        date,
        open: price,
        high: price * 1.01,
        low: price * 0.99,
        close: price,
        volume: 1000000,
      };
    });

    const testData: OHLCV[] = testDates.map((date, i) => {
      const price = closes[trainEnd + i];
      return {
        date,
        open: price,
        high: price * 1.01,
        low: price * 0.99,
        close: price,
        volume: 1000000,
      };
    });

    // Run backtest on training window to get IS performance
    const strategyFn = STRATEGY_MAP[strategyName] || meanReversionBacktest;
    const trainResult = strategyFn(trainData, initialCash, strategyParams);

    // Use same params (or optimized) for test window
    const testResult = strategyFn(testData, initialCash, strategyParams);

    // Calculate returns for OOS
    const oosDailyReturns = testResult.equity_curve.slice(1).map((e, i) => {
      const prev = testResult.equity_curve[i].value;
      return prev > 0 ? (e.value - prev) / prev : 0;
    });

    allOOSReturns.push(...oosDailyReturns);

    windows.push({
      windowIndex: windows.length,
      trainPeriod: [trainDates[0], trainDates[trainDates.length - 1]],
      testPeriod: [testDates[0], testDates[testDates.length - 1]],
      trainReturn: trainResult.total_return,
      testReturn: testResult.total_return,
      testEquityCurve: testResult.equity_curve.map(e => e.value),
      metrics: {
        totalReturn: testResult.total_return,
        annualReturn: testResult.annual_return,
        maxDrawdown: testResult.max_drawdown,
        sharpeRatio: testResult.sharpe_ratio,
        winRate: testResult.win_rate,
        totalTrades: testResult.total_trades,
      },
    });
  }

  // Compute aggregate metrics
  const aggregateMetrics = computeAggregateMetrics(windows);

  // Compute IS vs OOS ratio for overfitting detection
  const avgISReturn = windows.length > 0
    ? windows.reduce((sum, w) => sum + w.trainReturn, 0) / windows.length
    : 0;
  const avgOOSReturn = aggregateMetrics.avgOOSReturn;
  const inSamplevsOOSRatio = avgISReturn !== 0 ? avgOOSReturn / avgISReturn : 0;

  return {
    windows,
    combinedOOSReturns: allOOSReturns,
    aggregateMetrics,
    inSamplevsOOSRatio,
  };
}

/**
 * Compute aggregate metrics from all windows
 */
function computeAggregateMetrics(windows: WalkForwardWindow[]): WalkForwardAggregateMetrics {
  if (windows.length === 0) {
    return {
      avgOOSReturn: 0,
      avgOOSSharpe: 0,
      winRate: 0,
      maxDrawdown: 0,
      oosScore: 0,
    };
  }

  const n = windows.length;

  // Average OOS return (annualized)
  const avgOOSReturn = windows.reduce((sum, w) => sum + w.metrics.annualReturn, 0) / n;

  // Average OOS Sharpe
  const avgOOSSharpe = windows.reduce((sum, w) => sum + w.metrics.sharpeRatio, 0) / n;

  // Win rate: percentage of windows with positive return
  const winCount = windows.filter(w => w.testReturn > 0).length;
  const winRate = winCount / n;

  // Max drawdown across all windows
  const maxDrawdown = windows.reduce((max, w) => Math.max(max, w.metrics.maxDrawdown), 0);

  // OOS Score: ratio of OOS Sharpe to IS Sharpe (stability indicator)
  // Average IS Sharpe
  const avgISSharpe = windows.reduce((sum, w) => {
    // Approximate IS Sharpe from trainReturn ratio
    const isSharpe = w.trainReturn / 100 * Math.sqrt(252) / (Math.abs(w.trainReturn) / 100 + 0.01);
    return sum + isSharpe;
  }, 0) / n;

  const oosScore = avgISSharpe !== 0 ? avgOOSSharpe / Math.abs(avgISSharpe) : 0;

  return {
    avgOOSReturn,
    avgOOSSharpe,
    winRate,
    maxDrawdown,
    oosScore,
  };
}

/**
 * Generate demo walk-forward data
 */
export function generateWalkForwardDemoData(days: number = 1000): { dates: string[]; prices: number[] } {
  const basePrice = DEFAULT_STOCKS[0].price;
  const history = generatePriceHistory(basePrice, days);
  return {
    dates: history.map(h => h.date),
    prices: history.map(h => h.close),
  };
}

/**
 * Get overfitting level based on IS/OOS ratio
 */
export function getOverfittingLevel(ratio: number): 'severe' | 'warning' | 'normal' {
  if (ratio < 0.5) return 'severe';
  if (ratio < 0.7) return 'warning';
  return 'normal';
}

/**
 * Get overfitting color for UI
 */
export function getOverfittingColor(ratio: number): string {
  const level = getOverfittingLevel(ratio);
  switch (level) {
    case 'severe': return '#ef4444';  // red
    case 'warning': return '#f59e0b'; // amber
    case 'normal': return '#22c55e';  // green
  }
}
