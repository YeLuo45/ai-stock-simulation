/**
 * Backtest Engine
 * Strategy backtesting with Monte Carlo simulation support
 */

import type { 
  BacktestConfig, BacktestMetrics, BacktestResult, BacktestSignal,
  MonteCarloConfig, MonteCarloResult, OHLCV 
} from '../types';

export class BacktestEngine {
  private config: BacktestConfig | null = null;
  private equityCurve: { date: string; value: number }[] = [];
  private trades: BacktestSignal[] = [];

  setConfig(config: BacktestConfig): void {
    this.config = config;
    this.equityCurve = [];
    this.trades = [];
  }

  run(history: OHLCV[]): BacktestResult {
    if (!this.config) throw new Error('Config not set');

    const { initialCash, strategyType, params } = this.config;
    const closes = history.map(h => h.close);

    let cash = initialCash;
    let position = 0;
    let shares = 0;
    let peak = initialCash;
    let maxDrawdown = 0;
    let wins = 0, losses = 0;
    this.equityCurve = [];
    this.trades = [];

    const strategyMap: Record<string, (i: number) => { buy?: boolean; sell?: boolean; reason: string }> = {
      trend: (i) => this.trendSignal(closes, i, params),
      mean_reversion: (i) => this.meanReversionSignal(history, i, params),
      rsi: (i) => this.rsiSignal(closes, i, params),
      macd: (i) => this.macdSignal(closes, i, params),
      boll: (i) => this.bollSignal(history, i, params),
    };

    const signalFn = strategyMap[strategyType] || strategyMap.trend;
    const startIdx = 20;

    for (let i = startIdx; i < closes.length; i++) {
      const signal = signalFn(i);
      const price = closes[i];
      const date = history[i].date;

      if (position === 0 && signal.buy) {
        shares = Math.floor(cash / price);
        if (shares > 0) {
          cash -= shares * price;
          position = 1;
          this.trades.push({ date, type: 'buy', price, quantity: shares, reason: signal.reason });
        }
      } else if (position === 1 && signal.sell) {
        cash += shares * price;
        const entryPrice = this.trades[this.trades.length - 1].price;
        const pnl = (price - entryPrice) / entryPrice;
        if (pnl > 0) wins++;
        else losses++;
        this.trades.push({ date, type: 'sell', price, quantity: shares, pnl, reason: signal.reason });
        shares = 0;
        position = 0;
      }

      const equity = cash + shares * price;
      this.equityCurve.push({ date, value: equity });
      if (equity > peak) peak = equity;
      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    if (position === 1) {
      cash += shares * closes[closes.length - 1];
    }

    return this.buildResult(cash, wins, losses, maxDrawdown);
  }

  private trendSignal(closes: number[], i: number, params: Record<string, number>) {
    const maShort = params.ma_short || 5;
    const maLong = params.ma_long || 20;
    if (i < maLong) return { reason: '' };

    const maS = closes.slice(i - maShort, i).reduce((a, b) => a + b, 0) / maShort;
    const maL = closes.slice(i - maLong, i).reduce((a, b) => a + b, 0) / maLong;
    const maSPrev = closes.slice(i - maShort - 1, i - 1).reduce((a, b) => a + b, 0) / maShort;
    const maLPrev = closes.slice(i - maLong - 1, i - 1).reduce((a, b) => a + b, 0) / maLong;

    if (maS > maL && maSPrev <= maLPrev) return { buy: true, reason: 'MA金叉' };
    if (maS < maL && maSPrev >= maLPrev) return { sell: true, reason: 'MA死叉' };
    return { reason: '' };
  }

  private meanReversionSignal(history: OHLCV[], i: number, params: Record<string, number>) {
    const period = params.boll_period || 20;
    if (i < period) return { reason: '' };

    const recent = history.slice(i - period, i);
    const closes = recent.map(h => h.close);
    const mid = closes.reduce((a, b) => a + b, 0) / period;
    const variance = closes.reduce((s, p) => s + Math.pow(p - mid, 2), 0) / period;
    const std = Math.sqrt(variance);
    const upper = mid + 2 * std;
    const lower = mid - 2 * std;
    const price = history[i].close;

    if (price < lower) return { buy: true, reason: '价格低于布林下轨' };
    if (price > upper) return { sell: true, reason: '价格高于布林上轨' };
    return { reason: '' };
  }

  private rsiSignal(closes: number[], i: number, params: Record<string, number>) {
    const period = params.rsi_period || 14;
    if (i < period + 1) return { reason: '' };

    let gains = 0, losses = 0;
    for (let j = i - period; j < i; j++) {
      const diff = closes[j] - closes[j - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return { reason: '' };
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    const oversold = params.oversold || 30;
    const overbought = params.overbought || 70;

    if (rsi < oversold) return { buy: true, reason: `RSI超卖${rsi.toFixed(1)}` };
    if (rsi > overbought) return { sell: true, reason: `RSI超买${rsi.toFixed(1)}` };
    return { reason: '' };
  }

  private macdSignal(closes: number[], i: number, params: Record<string, number>) {
    const fast = params.macd_fast || 12;
    const slow = params.macd_slow || 26;
    if (i < slow + 9) return { reason: '' };

    const emaFast = (idx: number) => {
      const slice = closes.slice(idx - fast + 1, idx + 1);
      let e = slice[0];
      const k = 2 / (fast + 1);
      for (let x = 1; x < slice.length; x++) e = slice[x] * k + e * (1 - k);
      return e;
    };
    const emaSlow = (idx: number) => {
      const slice = closes.slice(idx - slow + 1, idx + 1);
      let e = slice[0];
      const k = 2 / (slow + 1);
      for (let x = 1; x < slice.length; x++) e = slice[x] * k + e * (1 - k);
      return e;
    };

    const macd = emaFast(i) - emaSlow(i);
    const macdPrev = emaFast(i - 1) - emaSlow(i - 1);
    const sig = macd * 0.9;

    if (macd > sig && macdPrev <= sig * 0.9) return { buy: true, reason: 'MACD金叉' };
    if (macd < sig && macdPrev >= sig * 0.9) return { sell: true, reason: 'MACD死叉' };
    return { reason: '' };
  }

  private bollSignal(history: OHLCV[], i: number, params: Record<string, number>) {
    return this.meanReversionSignal(history, i, params);
  }

  private buildResult(finalCash: number, wins: number, losses: number, maxDrawdown: number): BacktestResult {
    if (!this.config) throw new Error('No config');
    const { initialCash } = this.config;

    const finalValue = finalCash;
    const totalReturn = ((finalValue - initialCash) / initialCash) * 100;
    const years = this.equityCurve.length / 252;
    const annualReturn = years > 0 ? (Math.pow(finalValue / initialCash, 1 / years) - 1) * 100 : 0;
    const totalTrades = this.trades.filter(t => t.type === 'buy').length;
    const winRate = totalTrades > 0 ? wins / (wins + losses || 1) : 0;

    const returns = this.equityCurve.slice(1).map((e, i) => (e.value - this.equityCurve[i].value) / this.equityCurve[i].value);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdReturn = Math.sqrt(returns.length > 0 ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0);
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

    const avgHoldingPeriod = totalTrades > 0 ? this.equityCurve.length / totalTrades : 0;

    const completedTrades = this.trades.filter(t => t.pnl !== undefined);
    const totalPnL = completedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const profitLossRatio = wins > 0 && losses > 0 ? (wins / losses) : (wins > 0 ? Infinity : 0);

    const monthlyStats: { month: string; return: number }[] = [];
    const monthMap = new Map<string, number[]>();
    for (const ep of this.equityCurve) {
      const month = ep.date.slice(0, 7);
      if (!monthMap.has(month)) monthMap.set(month, []);
      monthMap.get(month)!.push(ep.value);
    }
    const sortedMonths = Array.from(monthMap.keys()).sort();
    for (let i = 1; i < sortedMonths.length; i++) {
      const prev = monthMap.get(sortedMonths[i - 1])!;
      const curr = monthMap.get(sortedMonths[i])!;
      const ret = (curr[curr.length - 1] - prev[prev.length - 1]) / prev[prev.length - 1] * 100;
      monthlyStats.push({ month: sortedMonths[i], return: ret });
    }

    return {
      config: this.config,
      metrics: {
        totalReturn,
        annualReturn,
        maxDrawdown: -maxDrawdown * 100,
        sharpeRatio,
        winRate,
        profitLossRatio,
        totalTrades,
        avgHoldingPeriod,
      },
      equityCurve: this.equityCurve,
      trades: this.trades,
      monthlyStats,
    };
  }

  runMonteCarlo(config: MonteCarloConfig): MonteCarloResult {
    const { simulations, years, initialInvestment, annualReturn, volatility } = config;
    const periods = years * 252;
    const projections: number[][] = [];

    for (let s = 0; s < simulations; s++) {
      const path: number[] = [initialInvestment];
      for (let d = 0; d < periods; d++) {
        const ret = (Math.random() - 0.5) * 2 * volatility + annualReturn / 252;
        path.push(path[path.length - 1] * (1 + ret));
      }
      projections.push(path);
    }

    const finalValues = projections.map(p => p[p.length - 1]).sort((a, b) => a - b);
    const p5 = finalValues[Math.floor(simulations * 0.05)];
    const p50 = finalValues[Math.floor(simulations * 0.50)];
    const p95 = finalValues[Math.floor(simulations * 0.95)];
    const probLoss = finalValues.filter(v => v < initialInvestment).length / simulations;

    return { median: p50, percentile5: p5, percentile95: p95, probabilityOfLoss: probLoss, projections };
  }
}

export const backtestEngine = new BacktestEngine();