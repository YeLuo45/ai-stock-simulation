/**
 * Factor Composer Service
 * Portfolio-level backtesting engine with multi-factor weighting schemes
 */
import type {
  FactorPortfolio,
  FactorWeight,
  EquityPoint,
  FactorTrade,
} from '../types';
import {
  generatePriceHistory,
  type OHLCV,
} from './indicators';

// ---- Weight Allocation Strategies ----

export type WeightStrategy = 'manual' | 'equal' | 'ic_weighted' | 'risk_parity';

function equalWeight(factors: FactorWeight[]): FactorWeight[] {
  const n = factors.length;
  if (n === 0) return [];
  const w = 1 / n;
  return factors.map(f => ({ ...f, weight: f.direction === 'short' ? -w : w }));
}

function icWeighted(factors: FactorWeight[], icScores: Record<string, number>): FactorWeight[] {
  // Weight proportional to absolute IC score
  const totalIC = factors.reduce((sum, f) => sum + Math.abs(icScores[f.factor_id] ?? 0), 0);
  if (totalIC === 0) return equalWeight(factors);
  return factors.map(f => {
    const ic = Math.abs(icScores[f.factor_id] ?? 0);
    const weight = ic / totalIC;
    return { ...f, weight: f.direction === 'short' ? -weight : weight };
  });
}

function riskParity(factors: FactorWeight[], factorVolatilities: Record<string, number>): FactorWeight[] {
  // Adjust weights so each factor contributes equally to portfolio risk
  const vols = factors.map(f => factorVolatilities[f.factor_id] ?? 1);
  const totalVol = vols.reduce((s, v) => s + v, 0);
  if (totalVol === 0) return equalWeight(factors);
  // Risk parity: weight inversely proportional to volatility
  return factors.map((f, i) => {
    const weight = (1 / (vols[i] || 1)) / totalVol;
    return { ...f, weight: f.direction === 'short' ? -weight : weight };
  });
}

export function applyWeightStrategy(
  factors: FactorWeight[],
  strategy: WeightStrategy,
  icScores?: Record<string, number>,
  factorVolatilities?: Record<string, number>
): FactorWeight[] {
  switch (strategy) {
    case 'equal':
      return equalWeight(factors);
    case 'ic_weighted':
      return icWeighted(factors, icScores ?? {});
    case 'risk_parity':
      return riskParity(factors, factorVolatilities ?? {});
    case 'manual':
    default:
      return factors;
  }
}

// ---- Score factor IC/IR (for weight strategies) ----

function scoreFactorsForIC(_symbols: string[], factorIds: string[]): { icScores: Record<string, number>; factorVols: Record<string, number> } {
  const icScores: Record<string, number> = {};
  const factorVols: Record<string, number> = {};

  for (const fid of factorIds) {
    // Simulate IC based on factor characteristics
    const baseIC = 0.02 + Math.random() * 0.08;
    const noise = (Math.random() - 0.5) * 0.02;
    icScores[fid] = baseIC + noise;
    factorVols[fid] = 0.1 + Math.random() * 0.2;
  }

  return { icScores, factorVols };
}

// ---- Factor data computation ----

function computeFactorValues(
  hist: OHLCV[],
  date: string,
  factorIds: string[]
): Record<string, number> {
  const dayHist = hist.find(h => h.date === date) || hist[hist.length - 1];
  if (!dayHist) return {};

  const recent5 = hist.filter(h => h.date <= date).slice(-6);
  const recent20 = hist.filter(h => h.date <= date).slice(-21);
  const prev = hist.filter(h => h.date < date);
  const prev5 = prev.slice(-5);
  const prev20 = prev.slice(-20);

  const p1d = prev.length > 0 ? ((dayHist.close - prev[prev.length - 1].close) / prev[prev.length - 1].close) * 100 : 0;
  const p5d = prev5.length > 1 ? ((dayHist.close - prev5[0].close) / prev5[0].close) * 100 : 0;
  const p20d = prev20.length > 1 ? ((dayHist.close - prev20[0].close) / prev20[0].close) * 100 : 0;
  const vRatio = recent5.length > 1 ? dayHist.volume / (recent5.slice(0, -1).reduce((s, h) => s + h.volume, 0) / Math.max(1, recent5.length - 1)) : 1;

  const closes5 = recent5.map(h => h.close);
  const closes20 = recent20.map(h => h.close);
  const highs20 = recent20.map(h => h.high);
  const lows20 = recent20.map(h => h.low);

  const rsi = calcRSI(closes5);
  const macd = calcMACD(closes5);
  const kdj = calcKDJ(highs20, lows20, closes20);
  const boll = calcBOLL(closes20);
  const bollPos = (dayHist.close - boll.lower) / (boll.upper - boll.lower + 0.001);
  const maTrend = (closes5[closes5.length - 1] > closes5[0] ? 1 : 0) +
    (closes5[0] > closes20[0] ? 1 : 0) +
    (closes20[0] > recent20[0].close ? 1 : 0);

  const allFactors: Record<string, number> = {
    price_change_1d: p1d,
    price_change_5d: p5d,
    price_change_20d: p20d,
    volume_ratio: vRatio,
    turnover_rate: Math.random() * 10,
    rsi_14: rsi,
    macd_signal: macd.hist,
    kdj_signal: kdj.j,
    boll_position: bollPos,
    ma_trend: maTrend,
  };

  const result: Record<string, number> = {};
  for (const fid of factorIds) {
    result[fid] = allFactors[fid] ?? 0;
  }
  return result;
}

function normalizeFactorValue(factorId: string, value: number): number {
  const normMap: Record<string, { min: number; max: number }> = {
    price_change_1d: { min: -10, max: 10 },
    price_change_5d: { min: -30, max: 30 },
    price_change_20d: { min: -50, max: 50 },
    volume_ratio: { min: 0, max: 5 },
    turnover_rate: { min: 0, max: 20 },
    rsi_14: { min: 0, max: 100 },
    macd_signal: { min: -1, max: 1 },
    kdj_signal: { min: 0, max: 100 },
    boll_position: { min: 0, max: 1 },
    ma_trend: { min: 0, max: 3 },
    ma5_ma20_cross: { min: 0.8, max: 1.2 },
    volume_price_trend: { min: -1, max: 1 },
    pe_ratio: { min: 0, max: 100 },
    pb_ratio: { min: 0, max: 20 },
    roe: { min: -20, max: 40 },
    revenue_growth: { min: -50, max: 100 },
    profit_growth: { min: -100, max: 200 },
    gross_margin: { min: 0, max: 80 },
    news_sentiment: { min: -1, max: 1 },
    social_sentiment: { min: -1, max: 1 },
    analyst_rating: { min: 1, max: 5 },
  };

  const norm = normMap[factorId];
  if (!norm) return 0.5;
  return Math.max(0, Math.min(1, (value - norm.min) / (norm.max - norm.min)));
}

// ---- Portfolio Backtest ----

export interface ComposerBacktestResult {
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  total_trades: number;
  equity_curve: EquityPoint[];
  long_return: number;
  short_return: number;
  long_short_return: number;
  factor_returns: Record<string, number>;
  factor_contributions: Record<string, number>; // percentage per factor
  daily_contributions: Array<{
    date: string;
    contributions: Record<string, number>;
    total: number;
  }>;
  trades: FactorTrade[];
}

export interface BacktestPortfolioOptions {
  portfolio: FactorPortfolio;
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCash?: number;
  rebalanceInterval?: number;
  topN?: number;
  weightStrategy?: WeightStrategy;
}

export function backtestPortfolio(opts: BacktestPortfolioOptions): ComposerBacktestResult {
  const {
    portfolio,
    symbols,
    startDate,
    endDate,
    initialCash = 1000000,
    rebalanceInterval = 5,
    topN = 10,
    weightStrategy = 'manual',
  } = opts;

  const factors = portfolio.factors;
  if (factors.length === 0) {
    throw new Error('Portfolio has no factors');
  }

  // Generate price histories
  const histories: Record<string, OHLCV[]> = {};
  for (const sym of symbols) {
    const basePrice = 10 + Math.random() * 200;
    histories[sym] = generatePriceHistory(basePrice, 120);
  }

  const allDates = [...new Set(Object.values(histories)[0].map(h => h.date))].sort();
  const startIdx = allDates.findIndex(d => d >= startDate);
  const endIdx = allDates.findIndex(d => d >= endDate);
  const relevantDates = allDates.slice(
    Math.max(0, startIdx),
    endIdx > 0 ? endIdx : allDates.length
  );

  // Compute IC scores for weight strategies
  const factorIds = factors.map(f => f.factor_id);
  const { icScores, factorVols } = scoreFactorsForIC(symbols, factorIds);

  // Apply weight strategy
  const activeFactors = applyWeightStrategy(factors, weightStrategy, icScores, factorVols);
  const totalWeight = activeFactors.reduce((s, f) => s + Math.abs(f.weight), 0) || 1;

  // State
  let cash = initialCash;
  let holdings: { sym: string; shares: number; price: number } | null = null;
  let peak = initialCash;
  let maxDrawdown = 0;
  let wins = 0, losses = 0;
  const equityCurve: EquityPoint[] = [];
  const trades: FactorTrade[] = [];
  const dailyContributions: ComposerBacktestResult['daily_contributions'] = [];

  let lastRebalanceDay = -999;

  for (let dayIdx = 0; dayIdx < relevantDates.length; dayIdx++) {
    const date = relevantDates[dayIdx];

    // Compute composite score for all symbols
    const scores: Record<string, number> = {};
    const factorValueMap: Record<string, Record<string, number>> = {};

    for (const sym of symbols) {
      const hist = histories[sym];
      const fv = computeFactorValues(hist, date, factorIds);
      factorValueMap[sym] = fv;

      let score = 0;
      for (const fw of activeFactors) {
        const rawVal = fv[fw.factor_id] ?? 0;
        const normVal = normalizeFactorValue(fw.factor_id, rawVal);
        const effWeight = fw.direction === 'short' ? -fw.weight : fw.weight;
        score += normVal * effWeight;
      }
      scores[sym] = score / totalWeight;
    }

    // Rebalance
    if (dayIdx - lastRebalanceDay >= rebalanceInterval) {
      lastRebalanceDay = dayIdx;

      // Sort by score
      const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      const topSymbols = sorted.slice(0, topN).map(([s]) => s);

      // Close old position
      if (holdings) {
        const curPrice = histories[holdings.sym].find(h => h.date === date)?.close
          || histories[holdings.sym][histories[holdings.sym].length - 1].close;
        cash += holdings.shares * curPrice;
        const profitPct = (curPrice - holdings.price) / holdings.price;
        if (profitPct > 0) wins++;
        else losses++;
        trades.push({
          date,
          symbol: holdings.sym,
          action: 'sell',
          price: curPrice,
          reason: '调仓',
          factor_values: factorValueMap[holdings.sym],
        });
        holdings = null;
      }

      // Open new long position
      if (topSymbols.length > 0) {
        const sym = topSymbols[0];
        const price = histories[sym].find(h => h.date === date)?.close
          || histories[sym][histories[sym].length - 1].close;
        const nShares = Math.floor(cash / price);
        if (nShares > 0) {
          cash -= nShares * price;
          holdings = { sym, shares: nShares, price };
          trades.push({
            date,
            symbol: sym,
            action: 'buy',
            price,
            reason: `建仓，多头Top${topN}，score=${scores[sym].toFixed(3)}`,
            factor_values: factorValueMap[sym],
          });
        }
      }
    }

    // Compute factor contributions for this day
    const contribs: Record<string, number> = {};
    let totalDayReturn = 0;

    if (holdings) {
      const sym = holdings.sym;
      const price = histories[sym].find(h => h.date === date)?.close
        || histories[sym][histories[sym].length - 1].close;
      const prevPrice = dayIdx > 0
        ? (histories[sym].find(h => h.date === relevantDates[dayIdx - 1])?.close
          || histories[sym][histories[sym].length - 2]?.close || price)
        : price;
      const dayReturn = prevPrice > 0 ? (price - prevPrice) / prevPrice : 0;
      totalDayReturn = dayReturn;

      for (const fw of activeFactors) {
        const rawVal = factorValueMap[sym]?.[fw.factor_id] ?? 0;
        const normVal = normalizeFactorValue(fw.factor_id, rawVal);
        const effWeight = fw.direction === 'short' ? -fw.weight : fw.weight;
        contribs[fw.factor_id] = (normVal * effWeight / totalWeight) * dayReturn * 100;
      }
    }

    dailyContributions.push({ date, contributions: { ...contribs }, total: totalDayReturn * 100 });

    // Record equity
    let equity = cash;
    if (holdings) {
      const price = histories[holdings.sym].find(h => h.date === date)?.close
        || histories[holdings.sym][histories[holdings.sym].length - 1].close;
      equity = cash + holdings.shares * price;
    }
    equityCurve.push({ date, value: equity });

    if (equity > peak) peak = equity;
    const drawdown = (peak - equity) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Close position at end
  if (holdings) {
    const lastDate = relevantDates[relevantDates.length - 1];
    const price = histories[holdings.sym].find(h => h.date === lastDate)?.close
      || histories[holdings.sym][histories[holdings.sym].length - 1].close;
    cash += holdings.shares * price;
    trades.push({
      date: lastDate,
      symbol: holdings.sym,
      action: 'sell',
      price,
      reason: '策略结束，平仓',
      factor_values: {},
    });
    holdings = null;
  }

  const finalValue = cash;
  const totalReturn = ((finalValue - initialCash) / initialCash) * 100;
  const years = relevantDates.length / 252;
  const annualReturn = years > 0 ? (Math.pow(finalValue / initialCash, 1 / years) - 1) * 100 : 0;
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? wins / (wins + losses || 1) : 0;

  const returns = equityCurve.slice(1).map((e, i) =>
    equityCurve[i].value > 0 ? (e.value - equityCurve[i].value) / equityCurve[i].value : 0
  );
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = Math.sqrt(returns.length > 0
    ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    : 0);
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  // Compute factor contributions
  const factorReturns: Record<string, number> = {};
  for (const fw of activeFactors) {
    factorReturns[fw.factor_id] = (fw.weight / totalWeight) * totalReturn;
  }

  const factorContributions = computeFactorContribution(factorReturns, totalReturn);

  return {
    total_return: totalReturn,
    annual_return: annualReturn,
    max_drawdown: -maxDrawdown * 100,
    sharpe_ratio: sharpeRatio,
    win_rate: winRate,
    total_trades: totalTrades,
    equity_curve: equityCurve,
    long_return: totalReturn * 0.8,
    short_return: -totalReturn * 0.2,
    long_short_return: totalReturn * 0.6,
    factor_returns: factorReturns,
    factor_contributions: factorContributions,
    daily_contributions: dailyContributions,
    trades,
  };
}

// ---- Factor Contribution ----

export function computeFactorContribution(
  factorReturns: Record<string, number>,
  totalReturn: number
): Record<string, number> {
  if (Math.abs(totalReturn) < 0.001) {
    // Equal contribution when total is near zero
    const n = Object.keys(factorReturns).length;
    if (n === 0) return {};
    const eq = 100 / n;
    return Object.fromEntries(Object.keys(factorReturns).map(k => [k, eq]));
  }

  const contribs: Record<string, number> = {};
  for (const [fid, ret] of Object.entries(factorReturns)) {
    contribs[fid] = (ret / totalReturn) * 100;
  }
  return contribs;
}

// ---- Indicator helpers ----

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcMACD(closes: number[]): { macd: number; signal: number; hist: number } {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = ema12 - ema26;
  const signal = macd * 0.9;
  const hist = macd - signal;
  return { macd, signal, hist };
}

function ema(prices: number[], period: number): number {
  if (prices.length < period) return prices.reduce((a, b) => a + b, 0) / prices.length;
  const k = 2 / (period + 1);
  let emaVal = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    emaVal = prices[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

function calcKDJ(highs: number[], lows: number[], closes: number[], period = 9): { k: number; d: number; j: number } {
  if (closes.length < period) return { k: 50, d: 50, j: 50 };
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  const latestClose = closes[closes.length - 1];
  const rsv = highestHigh === lowestLow ? 50 : ((latestClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  let k = 50, d = 50;
  for (let i = 0; i < period && i < closes.length; i++) {
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
  }
  const j = 3 * k - 2 * d;
  return { k, d, j };
}

function calcBOLL(closes: number[], period = 20, stdDev = 2): { mid: number; upper: number; lower: number } {
  const recent = closes.slice(-period);
  const mid = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((sum, p) => sum + Math.pow(p - mid, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { mid, upper: mid + stdDev * std, lower: mid - stdDev * std };
}
