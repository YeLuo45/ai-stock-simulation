/**
 * BacktestEngine - Event-sourced backtesting engine
 * Simulates trading strategies on historical OHLCV data
 */
import type { OHLCV } from '../indicators';
import type { Regime } from '../regime/types';
import { sma, calculateRSI, calculateMACD } from '../indicators';

// ============================================================================
// Types
// ============================================================================

export interface BacktestTrade {
  id: string;
  timestamp: string;
  entryPrice: number;
  exitPrice: number;
  slippage: number;        // Slippage as decimal (e.g., 0.001 = 0.1%)
  regime: Regime;
  pnl: number;             // Net P&L after slippage and commission
  holdingPeriod: number;   // Number of bars held
  commission: number;      // Commission cost
  direction: 'long' | 'short';
  signal: string;          // Entry/exit signal description
}

export interface Position {
  entryPrice: number;
  entryDate: string;
  quantity: number;
  direction: 'long' | 'short';
  entrySlippage: number;
}

export interface BacktestConfig {
  initialCash: number;
  commission: number;      // Commission rate as decimal (e.g., 0.001 = 0.1%)
  slippage: number;        // Slippage rate as decimal
  positionSize: number;    // Position size as fraction of cash (0-1)
}

export interface StrategySignal {
  date: string;
  action: 'buy' | 'sell' | 'hold';
  price: number;
  reason: string;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  finalValue: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitLossRatio: number;
  equityCurve: { date: string; value: number }[];
}

export interface StrategyParams {
  maFast?: number;
  maSlow?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  bbStd?: number;
  stopLoss?: number;
  takeProfit?: number;
}

// ============================================================================
// Default Config
// ============================================================================

export const DEFAULT_CONFIG: BacktestConfig = {
  initialCash: 100000,
  commission: 0.001,       // 0.1%
  slippage: 0.0005,        // 0.05%
  positionSize: 0.1,       // 10% of cash per trade
};

// ============================================================================
// Backtest Engine
// ============================================================================

export const BacktestEngine = {
  /**
   * Run backtest on historical OHLCV data
   */
  run(
    ohlcvData: OHLCV[],
    params: StrategyParams,
    regime: Regime,
    config: Partial<BacktestConfig> = {}
  ): BacktestResult {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    
    if (ohlcvData.length < 60) {
      return createEmptyResult(cfg.initialCash, ohlcvData);
    }

    let cash = cfg.initialCash;
    let position: Position | null = null;
    const trades: BacktestTrade[] = [];
    const equityCurve: { date: string; value: number }[] = [];
    let peakValue = cfg.initialCash;
    let maxDrawdown = 0;
    let tradeIdCounter = 1;

    // Build indicator arrays
    const closes = ohlcvData.map((k) => k.close);
    const highs = ohlcvData.map((k) => k.high);
    const lows = ohlcvData.map((k) => k.low);

    for (let i = 60; i < ohlcvData.length; i++) {
      const currentBar = ohlcvData[i];
      const currentDate = currentBar.date;
      const currentPrice = currentBar.close;

      // Calculate indicators
      const maFast = params.maFast ?? 5;
      const maSlow = params.maSlow ?? 20;
      const rsiOversold = params.rsiOversold ?? 30;
      const rsiOverbought = params.rsiOverbought ?? 70;
      const stopLossPct = params.stopLoss ?? 0.05;
      const takeProfitPct = params.takeProfit ?? 0.10;

      // Get lookback slice for indicators
      const lookbackCloses = closes.slice(Math.max(0, i - maSlow - 5), i + 1);
      const maFastVal = sma(lookbackCloses, maFast);
      const maSlowVal = sma(lookbackCloses, maSlow);
      const rsiVal = calculateRSI(lookbackCloses.slice(-20), 14);
      const macdData = calculateMACD(lookbackCloses);

      // Calculate current equity
      let equity = cash;
      if (position) {
        const unrealizedPnl = position.direction === 'long'
          ? (currentPrice - position.entryPrice) * position.quantity
          : (position.entryPrice - currentPrice) * position.quantity;
        equity += unrealizedPnl + position.entryPrice * position.quantity;
      }

      // Update equity curve
      equityCurve.push({ date: currentDate, value: equity });

      // Track drawdown
      if (equity > peakValue) peakValue = equity;
      const drawdown = (peakValue - equity) / peakValue;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      // Generate signals
      const signal = generateSignal(
        i, ohlcvData, lookbackCloses, maFastVal, maSlowVal,
        rsiVal, macdData, rsiOversold, rsiOverbought
      );

      // Entry logic - MA cross with RSI filter
      if (!position && signal.action === 'buy') {
        const entrySlippage = simulateSlippage(currentPrice, cfg.slippage);
        const adjustedPrice = currentPrice * (1 + entrySlippage);
        const positionValue = cash * cfg.positionSize;
        const qty = Math.floor(positionValue / adjustedPrice);
        const commissionCost = qty * adjustedPrice * cfg.commission;

        if (qty > 0) {
          cash -= qty * adjustedPrice + commissionCost;
          position = {
            entryPrice: adjustedPrice,
            entryDate: currentDate,
            quantity: qty,
            direction: 'long',
            entrySlippage,
          };
        }
      }

      // Exit logic
      if (position) {
        let shouldExit = false;
        let exitReason = '';
        const entryPrice = position.entryPrice;

        // Stop loss check
        if (position.direction === 'long') {
          const pnlPct = (currentPrice - entryPrice) / entryPrice;
          if (pnlPct <= -stopLossPct) {
            shouldExit = true;
            exitReason = 'stop_loss';
          } else if (pnlPct >= takeProfitPct) {
            shouldExit = true;
            exitReason = 'take_profit';
          }
        }

        // Exit on sell signal
        if (signal.action === 'sell' && !shouldExit) {
          shouldExit = true;
          exitReason = 'signal';
        }

        // Close on last bar
        if (i === ohlcvData.length - 1) {
          shouldExit = true;
          exitReason = 'end';
        }

        if (shouldExit) {
          const exitSlippage = simulateSlippage(currentPrice, cfg.slippage);
          const exitPrice = currentPrice * (1 - exitSlippage); // Slippage against us
          const rawPnl = position.direction === 'long'
            ? (exitPrice - entryPrice) * position.quantity
            : (entryPrice - exitPrice) * position.quantity;
          const commissionCost = position.quantity * exitPrice * cfg.commission;
          const netPnl = rawPnl - position.quantity * entryPrice * position.entrySlippage - commissionCost;

          const holdingPeriod = calculateBarsHeld(position.entryDate, currentDate, ohlcvData);

          trades.push({
            id: `T${String(tradeIdCounter++).padStart(4, '0')}`,
            timestamp: currentDate,
            entryPrice,
            exitPrice,
            slippage: position.entrySlippage + exitSlippage,
            regime,
            pnl: netPnl,
            holdingPeriod,
            commission: commissionCost,
            direction: position.direction,
            signal: exitReason,
          });

          // Update cash
          if (position.direction === 'long') {
            cash += position.quantity * exitPrice - commissionCost;
          } else {
            cash += position.quantity * entryPrice + netPnl - commissionCost;
          }

          position = null;
        }
      }
    }

    // Final equity
    let finalValue = cash;
    if (position) {
      const lastPrice = ohlcvData[ohlcvData.length - 1].close;
      finalValue += position.direction === 'long'
        ? position.quantity * lastPrice
        : position.quantity * (position.entryPrice * 2 - lastPrice);
    }

    // Calculate metrics
    const totalReturn = (finalValue - cfg.initialCash) / cfg.initialCash;
    const winningTrades = trades.filter((t) => t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl <= 0);
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((s, t) => s + t.pnl, 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((s, t) => s + t.pnl, 0) / losingTrades.length)
      : 1;
    const profitLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Calculate Sharpe ratio (simplified, annualized)
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const ret = (equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value;
      returns.push(ret);
    }
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdReturn = returns.length > 0
      ? Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length)
      : 1;
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

    return {
      trades,
      finalValue,
      totalReturn,
      maxDrawdown,
      sharpeRatio,
      winRate,
      profitLossRatio,
      equityCurve,
    };
  },

  /**
   * Calculate slippage for a price
   */
  calculateSlippage(price: number, slippageRate: number): number {
    const randomFactor = 0.5 + Math.random();
    return price * slippageRate * randomFactor;
  },
};

/**
 * Generate trading signal based on strategy
 */
function generateSignal(
  index: number,
  ohlcvData: OHLCV[],
  lookbackCloses: number[],
  maFastVal: number,
  maSlowVal: number,
  rsiVal: number,
  macdData: { macd: number; signal: number; hist: number },
  rsiOversold: number,
  rsiOverbought: number
): StrategySignal {
  const currentBar = ohlcvData[index];
  const prevBar = index > 0 ? ohlcvData[index - 1] : currentBar;
  const reason: string[] = [];

  // Previous MA relationship
  const prevLookback = lookbackCloses.slice(0, -1);
  const prevMaFast = prevLookback.length >= 5 ? sma(prevLookback, 5) : maFastVal;
  const prevMaSlow = prevLookback.length >= 20 ? sma(prevLookback, 20) : maSlowVal;

  // Golden cross (MA5 crosses above MA20)
  if (prevMaFast <= prevMaSlow && maFastVal > maSlowVal) {
    // Check RSI not overbought
    if (rsiVal < rsiOverbought) {
      return {
        date: currentBar.date,
        action: 'buy',
        price: currentBar.close,
        reason: 'MA_Golden_Cross',
      };
    }
    reason.push('MA_Golden_Cross_RSI_High');
  }

  // Death cross (MA5 crosses below MA20)
  if (prevMaFast >= prevMaSlow && maFastVal < maSlowVal) {
    return {
      date: currentBar.date,
      action: 'sell',
      price: currentBar.close,
      reason: 'MA_Death_Cross',
    };
  }

  // RSI oversold bounce
  if (rsiVal < rsiOversold && prevBar.close < currentBar.close) {
    return {
      date: currentBar.date,
      action: 'buy',
      price: currentBar.close,
      reason: 'RSI_Oversold_Bounce',
    };
  }

  // RSI overbought reversal
  if (rsiVal > rsiOverbought) {
    return {
      date: currentBar.date,
      action: 'sell',
      price: currentBar.close,
      reason: 'RSI_Overbought',
    };
  }

  // MACD histogram reversal
  if (macdData.hist < 0 && macdData.hist > (macdData.macd - macdData.signal) * 0.5) {
    // MACD turning positive
    return {
      date: currentBar.date,
      action: 'buy',
      price: currentBar.close,
      reason: 'MACD_Turn',
    };
  }

  return {
    date: currentBar.date,
    action: 'hold',
    price: currentBar.close,
    reason: 'No_Signal',
  };
}

/**
 * Simulate slippage (random, slightly adverse)
 */
function simulateSlippage(price: number, slippageRate: number): number {
  // Random factor between 0.5 and 1.5, biased slightly adverse (multiplier > 1 for sells)
  const randomFactor = 0.5 + Math.random();
  return price * slippageRate * randomFactor;
}

/**
 * Calculate number of bars between entry and exit
 */
function calculateBarsHeld(entryDate: string, exitDate: string, ohlcvData: OHLCV[]): number {
  const entryIdx = ohlcvData.findIndex((k) => k.date === entryDate);
  const exitIdx = ohlcvData.findIndex((k) => k.date === exitDate);
  if (entryIdx < 0 || exitIdx < 0) return 0;
  return exitIdx - entryIdx;
}

/**
 * Create empty result when insufficient data
 */
function createEmptyResult(initialCash: number, ohlcvData: OHLCV[]): BacktestResult {
  const equityCurve = ohlcvData.map((k) => ({ date: k.date, value: initialCash }));
  return {
    trades: [],
    finalValue: initialCash,
    totalReturn: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    winRate: 0,
    profitLossRatio: 0,
    equityCurve,
  };
}

export default BacktestEngine;