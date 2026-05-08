/**
 * Factor Engine Service
 * Pure-JS factor computation, screening, and backtesting
 * Works entirely client-side using mock/generated data
 */
import type {
  FactorDefinition,
  FactorWeight,
  FactorBacktestRequest,
  FactorBacktestResult,
  FactorScreenerRequest,
  FactorScreenerResult,
  SavedFactor,
  FactorPortfolio,
} from '../types';
import { generatePriceHistory, calculateAllIndicators, type OHLCV } from './indicators';
import type { BacktestSignal } from './indicators';

// ---- Built-in Factor Definitions ----

export const BUILTIN_FACTORS: FactorDefinition[] = [
  // Price factors
  {
    id: 'price_change_1d',
    name: 'price_change_1d',
    name_cn: '1日涨跌幅',
    description: '过去1日价格变化百分比',
    category: 'price',
    data_type: 'number',
    scope: 'stock',
    order: 1,
    norm_min: -10,
    norm_max: 10,
  },
  {
    id: 'price_change_5d',
    name: 'price_change_5d',
    name_cn: '5日涨跌幅',
    description: '过去5日价格变化百分比',
    category: 'price',
    data_type: 'number',
    scope: 'stock',
    order: 2,
    norm_min: -30,
    norm_max: 30,
  },
  {
    id: 'price_change_20d',
    name: 'price_change_20d',
    name_cn: '20日涨跌幅',
    description: '过去20日价格变化百分比',
    category: 'price',
    data_type: 'number',
    scope: 'stock',
    order: 3,
    norm_min: -50,
    norm_max: 50,
  },
  {
    id: 'volume_ratio',
    name: 'volume_ratio',
    name_cn: '量比',
    description: '当日成交量/过去5日平均成交量',
    category: 'price',
    data_type: 'number',
    scope: 'stock',
    order: 4,
    norm_min: 0,
    norm_max: 5,
  },
  {
    id: 'turnover_rate',
    name: 'turnover_rate',
    name_cn: '换手率',
    description: '当日换手率百分比',
    category: 'price',
    data_type: 'number',
    scope: 'stock',
    order: 5,
    norm_min: 0,
    norm_max: 20,
  },
  // Technical factors
  {
    id: 'rsi_14',
    name: 'rsi_14',
    name_cn: 'RSI(14)',
    description: '14日相对强弱指标',
    category: 'technical',
    data_type: 'number',
    scope: 'stock',
    order: 10,
    norm_min: 0,
    norm_max: 100,
  },
  {
    id: 'macd_signal',
    name: 'macd_signal',
    name_cn: 'MACD信号',
    description: 'MACD柱状图值，正值看多',
    category: 'technical',
    data_type: 'number',
    scope: 'stock',
    order: 11,
    norm_min: -1,
    norm_max: 1,
  },
  {
    id: 'kdj_signal',
    name: 'kdj_signal',
    name_cn: 'KDJ信号',
    description: 'KDJ J值，>80超买,<20超卖',
    category: 'technical',
    data_type: 'number',
    scope: 'stock',
    order: 12,
    norm_min: 0,
    norm_max: 100,
  },
  {
    id: 'boll_position',
    name: 'boll_position',
    name_cn: '布林位置',
    description: '价格在布林带中的位置(0-1)，<0.2超卖,>0.8超买',
    category: 'technical',
    data_type: 'number',
    scope: 'stock',
    order: 13,
    norm_min: 0,
    norm_max: 1,
  },
  {
    id: 'ma5_ma20_cross',
    name: 'ma5_ma20_cross',
    name_cn: 'MA金叉/死叉',
    description: 'MA5/MA20比值，>1金叉，<1死叉',
    category: 'technical',
    data_type: 'number',
    scope: 'stock',
    order: 14,
    norm_min: 0.8,
    norm_max: 1.2,
  },
  {
    id: 'ma_trend',
    name: 'ma_trend',
    name_cn: '均线多头',
    description: 'MA5>MA10>MA20为多头排列，值越大越强',
    category: 'technical',
    data_type: 'number',
    scope: 'stock',
    order: 15,
    norm_min: 0,
    norm_max: 3,
  },
  {
    id: 'volume_price_trend',
    name: 'volume_price_trend',
    name_cn: '量价趋势',
    description: '价涨量增的协调程度',
    category: 'technical',
    data_type: 'number',
    scope: 'stock',
    order: 16,
    norm_min: -1,
    norm_max: 1,
  },
  // Financial factors
  {
    id: 'pe_ratio',
    name: 'pe_ratio',
    name_cn: '市盈率',
    description: 'PE比率，越低越便宜',
    category: 'financial',
    data_type: 'number',
    scope: 'stock',
    order: 20,
    norm_min: 0,
    norm_max: 100,
  },
  {
    id: 'pb_ratio',
    name: 'pb_ratio',
    name_cn: '市净率',
    description: 'PB比率，越低越便宜',
    category: 'financial',
    data_type: 'number',
    scope: 'stock',
    order: 21,
    norm_min: 0,
    norm_max: 20,
  },
  {
    id: 'roe',
    name: 'roe',
    name_cn: 'ROE',
    description: '净资产收益率，越高越好',
    category: 'financial',
    data_type: 'number',
    scope: 'stock',
    order: 22,
    norm_min: -20,
    norm_max: 40,
  },
  {
    id: 'revenue_growth',
    name: 'revenue_growth',
    name_cn: '营收增长率',
    description: '营业收入同比增长率',
    category: 'financial',
    data_type: 'number',
    scope: 'stock',
    order: 23,
    norm_min: -50,
    norm_max: 100,
  },
  {
    id: 'profit_growth',
    name: 'profit_growth',
    name_cn: '利润增长率',
    description: '净利润同比增长率',
    category: 'financial',
    data_type: 'number',
    scope: 'stock',
    order: 24,
    norm_min: -100,
    norm_max: 200,
  },
  {
    id: 'gross_margin',
    name: 'gross_margin',
    name_cn: '毛利率',
    description: '销售毛利率',
    category: 'financial',
    data_type: 'number',
    scope: 'stock',
    order: 25,
    norm_min: 0,
    norm_max: 80,
  },
  // Sentiment factors (simulated)
  {
    id: 'news_sentiment',
    name: 'news_sentiment',
    name_cn: '新闻情绪',
    description: '近期新闻情绪评分(-1到1)',
    category: 'sentiment',
    data_type: 'number',
    scope: 'stock',
    order: 30,
    norm_min: -1,
    norm_max: 1,
  },
  {
    id: 'social_sentiment',
    name: 'social_sentiment',
    name_cn: '社交情绪',
    description: '社交媒体情绪评分(-1到1)',
    category: 'sentiment',
    data_type: 'number',
    scope: 'stock',
    order: 31,
    norm_min: -1,
    norm_max: 1,
  },
  {
    id: 'analyst_rating',
    name: 'analyst_rating',
    name_cn: '分析师评级',
    description: '分析师综合评级(1-5)',
    category: 'sentiment',
    data_type: 'number',
    scope: 'stock',
    order: 32,
    norm_min: 1,
    norm_max: 5,
  },
];

// ---- Factor Computation ----

export interface FactorDataMap {
  [symbol: string]: {
    [factor_id: string]: number;
  };
}

/** Generate mock factor data for a set of symbols */
export function generateFactorData(
  symbols: string[],
  _endDate: string = '2026-04-18'
): FactorDataMap {
  const result: FactorDataMap = {};

  for (const symbol of symbols) {
    const basePrice = 10 + Math.random() * 200;
    const history = generatePriceHistory(basePrice, 60);
    const indicators = calculateAllIndicators(history);
    const latest = history[history.length - 1];
    const prev5 = history[Math.max(0, history.length - 6)];
    const prev20 = history[Math.max(0, history.length - 21)];

    const price1d = ((latest.close - history[history.length - 2].close) / history[history.length - 2].close) * 100;
    const price5d = ((latest.close - prev5.close) / prev5.close) * 100;
    const price20d = ((latest.close - prev20.close) / prev20.close) * 100;

    const vol5avg = history.slice(-6, -1).reduce((s, h) => s + h.volume, 0) / 5;
    const volRatio = latest.volume / vol5avg;

    const bollPos = (latest.close - indicators.BOLL_LOWER) / (indicators.BOLL_UPPER - indicators.BOLL_LOWER + 0.001);

    const maTrend =
      (indicators.MA5 > indicators.MA10 ? 1 : 0) +
      (indicators.MA10 > indicators.MA20 ? 1 : 0) +
      (indicators.MA20 > indicators.MA60 ? 1 : 0);

    result[symbol] = {
      price_change_1d: price1d,
      price_change_5d: price5d,
      price_change_20d: price20d,
      volume_ratio: volRatio,
      turnover_rate: Math.random() * 10,
      rsi_14: indicators.RSI,
      macd_signal: indicators.MACD_HIST,
      kdj_signal: indicators.KDJ_J,
      boll_position: bollPos,
      ma5_ma20_cross: indicators.MA5 / (indicators.MA20 + 0.001),
      ma_trend: maTrend,
      volume_price_trend: price1d > 0 && volRatio > 1 ? 1 : price1d < 0 && volRatio < 1 ? 1 : 0,
      pe_ratio: 5 + Math.random() * 50,
      pb_ratio: 0.5 + Math.random() * 8,
      roe: -10 + Math.random() * 40,
      revenue_growth: -30 + Math.random() * 80,
      profit_growth: -50 + Math.random() * 150,
      gross_margin: 10 + Math.random() * 60,
      news_sentiment: (Math.random() - 0.5) * 2,
      social_sentiment: (Math.random() - 0.5) * 2,
      analyst_rating: 2 + Math.random() * 3,
    };
  }

  return result;
}

/** Normalize factor value to 0-1 range using min/max */
export function normalizeFactorValue(factorId: string, value: number): number {
  const factor = BUILTIN_FACTORS.find(f => f.id === factorId);
  if (!factor || factor.norm_min === undefined || factor.norm_max === undefined) return 0.5;
  return Math.max(0, Math.min(1, (value - factor.norm_min) / (factor.norm_max - factor.norm_min)));
}

/** Compute weighted composite score for each symbol */
export function computeCompositeScores(
  factorData: FactorDataMap,
  weights: FactorWeight[]
): Record<string, number> {
  const scores: Record<string, number> = {};
  const symbols = Object.keys(factorData);

  for (const symbol of symbols) {
    let totalScore = 0;
    let totalWeight = 0;

    for (const w of weights) {
      const val = factorData[symbol][w.factor_id];
      if (val === undefined) continue;
      const normalized = normalizeFactorValue(w.factor_id, val);
      const effectiveWeight = w.direction === 'short' ? -w.weight : w.weight;
      totalScore += normalized * effectiveWeight;
      totalWeight += Math.abs(w.weight);
    }

    scores[symbol] = totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  return scores;
}

// ---- Factor Screener ----

export function screenFactors(req: FactorScreenerRequest): FactorScreenerResult[] {
  const factorData = generateFactorData(req.symbols);
  const scores = computeCompositeScores(factorData, req.factors);

  const results: FactorScreenerResult[] = req.symbols.map(symbol => {
    const scoreMap: Record<string, number> = {};
    for (const fw of req.factors) {
      const raw = factorData[symbol][fw.factor_id];
      scoreMap[fw.factor_id] = raw !== undefined ? normalizeFactorValue(fw.factor_id, raw) : 0.5;
    }
    return {
      symbol,
      name: symbol,
      scores: scoreMap,
      composite_score: scores[symbol] ?? 0,
      rank: 0,
    };
  });

  // Sort
  if (req.sort_by) {
    if (req.sort_by === 'composite_score') {
      results.sort((a, b) => req.sort_desc ? b.composite_score - a.composite_score : a.composite_score - b.composite_score);
    } else {
      results.sort((a, b) => {
        const av = a.scores[req.sort_by!] ?? 0;
        const bv = b.scores[req.sort_by!] ?? 0;
        return req.sort_desc ? bv - av : av - bv;
      });
    }
  } else {
    results.sort((a, b) => b.composite_score - a.composite_score);
  }

  // Assign ranks
  results.forEach((r, i) => { r.rank = i + 1; });

  // Apply limit
  return req.limit ? results.slice(0, req.limit) : results;
}

// ---- Factor Backtesting ----

export function runFactorBacktest(req: FactorBacktestRequest): FactorBacktestResult {
  const {
    symbols,
    start_date,
    end_date,
    initial_cash = 1000000,
    rebalance_interval = 5,
    top_n = 10,
    long_short: _longShort = false,
    factors,
  } = req;

  if (!factors || factors.length === 0) {
    throw new Error('No factors provided');
  }

  // Generate price history for each symbol
  const histories: Record<string, OHLCV[]> = {};
  for (const sym of symbols) {
    const basePrice = 10 + Math.random() * 200;
    histories[sym] = generatePriceHistory(basePrice, 120);
  }

  const allDates = [...new Set(Object.values(histories)[0].map(h => h.date))].sort();
  const startIdx = allDates.findIndex(d => d >= start_date);
  const endIdx = allDates.findIndex(d => d >= end_date);
  const relevantDates = allDates.slice(Math.max(0, startIdx), endIdx > 0 ? endIdx : allDates.length);

  let cash = initial_cash;
  let position = 0;
  let shares = 0;
  let peak = initial_cash;
  let maxDrawdown = 0;
  let wins = 0, losses = 0;
  const equityCurve: { date: string; value: number }[] = [];
  const allTrades: BacktestSignal[] = [];

  let lastRebalanceDay = -999;

  for (let dayIdx = 0; dayIdx < relevantDates.length; dayIdx++) {
    const date = relevantDates[dayIdx];

    // Compute factor scores for all symbols on this day
    const scores: Record<string, number> = {};
    for (const sym of symbols) {
      const hist = histories[sym];
      const dayHist = hist.find(h => h.date === date) || hist[hist.length - 1];
      if (!dayHist) continue;

      // Quick factor data build
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

      const rsi = calculateRSI(closes5);
      const macd = calculateMACD(closes5);
      const kdj = calculateKDJ(highs20, lows20, closes20);
      const boll = calculateBOLL(closes20);
      const bollPos = (dayHist.close - boll.lower) / (boll.upper - boll.lower + 0.001);
      const maTrend = (closes5[closes5.length - 1] > closes5[0] ? 1 : 0) + (closes5[0] > closes20[0] ? 1 : 0) + (closes20[0] > recent20[0].close ? 1 : 0);

      const factorValues: Record<string, number> = {
        price_change_1d: p1d,
        price_change_5d: p5d,
        price_change_20d: p20d,
        volume_ratio: vRatio,
        rsi_14: rsi,
        macd_signal: macd.hist,
        kdj_signal: kdj.j,
        boll_position: bollPos,
        ma_trend: maTrend,
      };

      let score = 0;
      let wSum = 0;
      for (const fw of factors) {
        const v = factorValues[fw.factor_id] ?? 0.5;
        const norm = normalizeFactorValue(fw.factor_id, v);
        const w = fw.direction === 'short' ? -fw.weight : fw.weight;
        score += norm * w;
        wSum += Math.abs(fw.weight);
      }
      scores[sym] = wSum > 0 ? score / wSum : 0;
    }

    // Rebalance check
    if (dayIdx - lastRebalanceDay >= rebalance_interval) {
      lastRebalanceDay = dayIdx;

      // Sort by score
      const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      const topSymbols = sorted.slice(0, top_n).map(([sym]) => sym);

      // Close current position if not in top
      if (position === 1) {
        const curSym = allTrades[allTrades.length - 1]?.reason?.split(' ')[0];
        if (!topSymbols.includes(curSym) || topSymbols.indexOf(curSym) >= top_n) {
          const curPrice = histories[curSym!].find(h => h.date === date)?.close || histories[curSym!][histories[curSym!].length - 1].close;
          cash += shares * curPrice;
          const profitPct = (curPrice - (allTrades[allTrades.length - 1]?.price || curPrice)) / (allTrades[allTrades.length - 1]?.price || curPrice);
          if (profitPct > 0) wins++;
          else losses++;
          allTrades.push({ date, action: 'sell', price: curPrice, reason: `换仓` });
          shares = 0;
          position = 0;
        }
      }

      // Open new positions
      for (const sym of topSymbols) {
        if (position === 0) {
          const price = histories[sym].find(h => h.date === date)?.close || histories[sym][histories[sym].length - 1].close;
          const nShares = Math.floor(cash / price);
          if (nShares > 0) {
            cash -= nShares * price;
            shares = nShares;
            position = 1;
            allTrades.push({ date, action: 'buy', price, reason: `买入${sym}，score=${scores[sym].toFixed(3)}` });
            break; // only hold one for simplicity
          }
        }
      }
    }

    // Record equity
    const currentPrice = histories[symbols[0]].find(h => h.date === date)?.close || 0;
    const equity = cash + shares * currentPrice;
    equityCurve.push({ date, value: equity });
    if (equity > peak) peak = equity;
    const drawdown = (peak - equity) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Close position
  if (position === 1 && shares > 0) {
    const lastDate = relevantDates[relevantDates.length - 1];
    const sym = allTrades[allTrades.length - 1]?.reason?.match(/^买入(\S+)/)?.[1] || symbols[0];
    const price = histories[sym].find(h => h.date === lastDate)?.close || histories[sym][histories[sym].length - 1].close;
    cash += shares * price;
    shares = 0;
    position = 0;
  }

  const finalValue = cash;
  const totalReturn = ((finalValue - initial_cash) / initial_cash) * 100;
  const years = relevantDates.length / 252;
  const annualReturn = years > 0 ? (Math.pow(finalValue / initial_cash, 1 / years) - 1) * 100 : 0;
  const totalTrades = allTrades.filter(t => t.action !== 'hold').length;
  const winRate = totalTrades > 0 ? wins / (wins + losses || 1) : 0;

  const returns = equityCurve.slice(1).map((e, i) => (e.value - equityCurve[i].value) / equityCurve[i].value);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = Math.sqrt(returns.length > 0 ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0);
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

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
    factor_returns: {},
    trades: allTrades.filter(t => t.action !== 'hold').map(t => ({
      date: t.date,
      symbol: t.reason?.match(/^买入(\S+)/)?.[1] || t.reason?.split(' ')[1] || '',
      action: t.action as 'buy' | 'sell',
      price: t.price,
      reason: t.reason || '',
      factor_values: {},
    })),
  };
}

// ---- Factor Portfolio CRUD (localStorage) ----

const FP_KEY = 'ai-stock-factor-portfolios';

export function saveFactorPortfolio(portfolio: FactorPortfolio): void {
  const existing = getFactorPortfolios();
  const idx = existing.findIndex(p => p.id === portfolio.id);
  if (idx >= 0) existing[idx] = portfolio;
  else existing.push(portfolio);
  localStorage.setItem(FP_KEY, JSON.stringify(existing));
}

export function getFactorPortfolios(): FactorPortfolio[] {
  try {
    return JSON.parse(localStorage.getItem(FP_KEY) || '[]');
  } catch {
    return [];
  }
}

export function deleteFactorPortfolio(id: string): void {
  const existing = getFactorPortfolios().filter(p => p.id !== id);
  localStorage.setItem(FP_KEY, JSON.stringify(existing));
}

// ---- Custom Factor CRUD (localStorage) ----

const CF_KEY = 'ai-stock-custom-factors';

export function saveCustomFactor(factor: SavedFactor): void {
  const existing = getCustomFactors();
  const idx = existing.findIndex(f => f.id === factor.id);
  if (idx >= 0) existing[idx] = factor;
  else existing.push(factor);
  localStorage.setItem(CF_KEY, JSON.stringify(existing));
}

export function getCustomFactors(): SavedFactor[] {
  try {
    return JSON.parse(localStorage.getItem(CF_KEY) || '[]');
  } catch {
    return [];
  }
}

export function deleteCustomFactor(id: string): void {
  const existing = getCustomFactors().filter(f => f.id !== id);
  localStorage.setItem(CF_KEY, JSON.stringify(existing));
}

// ---- Helper: All factors (builtin + custom) ----

export function getAllFactorDefinitions(): FactorDefinition[] {
  const custom = getCustomFactors().map(f => ({
    id: f.id,
    name: f.name,
    name_cn: f.name_cn,
    description: f.description,
    category: f.category,
    data_type: 'number' as const,
    scope: 'stock' as const,
    formula: f.formula,
    params: f.params,
    order: 100 + (getCustomFactors().indexOf(f) || 0),
  }));
  return [...BUILTIN_FACTORS, ...custom];
}

// Import required helpers from indicators
function calculateRSI(closes: number[], period = 14): number {
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

function calculateMACD(closes: number[]): { macd: number; signal: number; hist: number } {
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

function calculateKDJ(highs: number[], lows: number[], closes: number[], period = 9): { k: number; d: number; j: number } {
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

function calculateBOLL(closes: number[], period = 20, stdDev = 2): { mid: number; upper: number; lower: number } {
  const recent = closes.slice(-period);
  const mid = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((sum, p) => sum + Math.pow(p - mid, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { mid, upper: mid + stdDev * std, lower: mid - stdDev * std };
}
