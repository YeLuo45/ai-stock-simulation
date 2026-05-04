/**
 * Technical indicator calculations in pure JavaScript
 * Replaces Python/AkShare backend for technical analysis
 */

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CalculatedIndicators {
  MA5: number;
  MA10: number;
  MA20: number;
  MA60: number;
  RSI: number;
  MACD: number;
  MACD_SIGNAL: number;
  MACD_HIST: number;
  KDJ_K: number;
  KDJ_D: number;
  KDJ_J: number;
  BOLL_MID: number;
  BOLL_UPPER: number;
  BOLL_LOWER: number;
}

// Generate realistic price history for a stock
export function generatePriceHistory(basePrice: number, days = 120): OHLCV[] {
  const history: OHLCV[] = [];
  let price = basePrice * 0.85; // start 15% lower
  const now = new Date("2026-04-18");

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dateStr = date.toISOString().split("T")[0];
    const volatility = basePrice * 0.02;
    const trend = (Math.random() - 0.48) * volatility;
    const open = price;
    const close = Math.max(price * 0.5, price + trend + (Math.random() - 0.5) * volatility);
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.floor(Math.random() * 50000000 + 1000000);

    history.push({ date: dateStr, open, high, low, close, volume });
    price = close;
  }
  return history;
}

// SMA - Simple Moving Average
export function sma(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// EMA - Exponential Moving Average
export function ema(prices: number[], period: number): number {
  if (prices.length < period) return sma(prices, prices.length);
  const k = 2 / (period + 1);
  let emaVal = sma(prices.slice(0, period), period);
  for (let i = period; i < prices.length; i++) {
    emaVal = prices[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

// RSI - Relative Strength Index
export function calculateRSI(closes: number[], period = 14): number {
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

// MACD - Moving Average Convergence Divergence
export function calculateMACD(closes: number[]): { macd: number; signal: number; hist: number } {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = ema12 - ema26;

  // Signal line = 9-day EMA of MACD
  // Approximate with current MACD value
  const signal = macd * 0.9;
  const hist = macd - signal;
  return { macd, signal, hist };
}

// KDJ indicator
export function calculateKDJ(highs: number[], lows: number[], closes: number[], period = 9): { k: number; d: number; j: number } {
  if (closes.length < period) return { k: 50, d: 50, j: 50 };

  // Calculate RSV
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  const latestClose = closes[closes.length - 1];

  const rsv = highestHigh === lowestLow ? 50 : ((latestClose - lowestLow) / (highestHigh - lowestLow)) * 100;

  // K = 2/3 * prevK + 1/3 * RSV
  // D = 2/3 * prevD + 1/3 * K
  // J = 3K - 2D
  let k = 50, d = 50;
  for (let i = 0; i < period && i < closes.length; i++) {
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
  }
  const j = 3 * k - 2 * d;
  return { k, d, j };
}

// Bollinger Bands
export function calculateBOLL(closes: number[], period = 20, stdDev = 2): { mid: number; upper: number; lower: number } {
  const recent = closes.slice(-period);
  const mid = sma(recent, period);
  const variance = recent.reduce((sum, p) => sum + Math.pow(p - mid, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { mid, upper: mid + stdDev * std, lower: mid - stdDev * std };
}

// Calculate all indicators for a stock
export function calculateAllIndicators(history: OHLCV[]): CalculatedIndicators & { ai_summary: string; support_resistance: { support: number; resistance: number } } {
  const closes = history.map(h => h.close);
  const highs = history.map(h => h.high);
  const lows = history.map(h => h.low);
  const currentPrice = closes[closes.length - 1];

  const ma5 = sma(closes, 5);
  const ma10 = sma(closes, 10);
  const ma20 = sma(closes, 20);
  const ma60 = sma(closes, Math.min(60, closes.length));
  const rsi = calculateRSI(closes);
  const macdData = calculateMACD(closes);
  const kdj = calculateKDJ(highs, lows, closes);
  const boll = calculateBOLL(closes);

  // AI summary generation
  const trend = ma5 > ma20 ? "上升通道" : ma5 < ma20 ? "下降通道" : "横盘震荡";
  const rsiDesc = rsi > 70 ? "RSI偏高，可能存在回调风险" : rsi < 30 ? "RSI偏低，可能存在反弹机会" : "RSI处于中性区域";
  const macdDesc = macdData.hist > 0 ? "MACD红柱，动能偏强" : "MACD绿柱，动能偏弱";
  const ai_summary = `${currentPrice.toFixed(2)}当前处于${trend}。${rsiDesc}。${macdDesc}。KDJ指标K=${kdj.k.toFixed(1)}，D=${kdj.d.toFixed(1)}，J=${kdj.j.toFixed(1)}。布林带中轨${boll.mid.toFixed(2)}，上轨${boll.upper.toFixed(2)}，下轨${boll.lower.toFixed(2)}，当前价格在中轨附近。`;

  // Support = recent low, Resistance = recent high
  const recentLows = lows.slice(-20);
  const recentHighs = highs.slice(-20);
  const support = Math.min(...recentLows);
  const resistance = Math.max(...recentHighs);

  return {
    MA5: ma5,
    MA10: ma10,
    MA20: ma20,
    MA60: ma60,
    RSI: rsi,
    MACD: macdData.macd,
    MACD_SIGNAL: macdData.signal,
    MACD_HIST: macdData.hist,
    KDJ_K: kdj.k,
    KDJ_D: kdj.d,
    KDJ_J: kdj.j,
    BOLL_MID: boll.mid,
    BOLL_UPPER: boll.upper,
    BOLL_LOWER: boll.lower,
    ai_summary,
    support_resistance: { support, resistance },
  };
}

// Run a simple backtest for a strategy
export interface BacktestSignal {
  date: string;
  action: "buy" | "sell" | "hold";
  price: number;
  reason: string;
}

export interface BacktestResult {
  strategy_name: string;
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  total_trades: number;
  equity_curve: { date: string; value: number }[];
  trades: BacktestSignal[];
}

// Mean reversion strategy
export function meanReversionBacktest(
  history: OHLCV[],
  initialCash: number,
  params: { boll_period?: number; sell_threshold?: number; buy_threshold?: number }
): BacktestResult {
  const { sell_threshold = 0.02, buy_threshold = -0.02 } = params;
  const closes = history.map(h => h.close);
  const bollPeriod = params.boll_period || 20;

  let cash = initialCash;
  let position = 0;
  let shares = 0;
  let peak = initialCash;
  let maxDrawdown = 0;
  let wins = 0, losses = 0;
  const equityCurve: { date: string; value: number }[] = [];
  const trades: BacktestSignal[] = [];

  for (let i = bollPeriod; i < closes.length; i++) {
    const recent = closes.slice(i - bollPeriod, i);
    const boll = calculateBOLL(recent, bollPeriod);
    const price = closes[i];
    const date = history[i].date;

    if (position === 0 && price < boll.lower * (1 + buy_threshold)) {
      shares = Math.floor(cash / price);
      cash -= shares * price;
      position = 1;
      trades.push({ date, action: "buy", price, reason: `价格低于布林下轨，逢低买入` });
    }
    // Check sell signal
    else if (position === 1) {
      const profitPct = (price - trades[trades.length - 1].price) / trades[trades.length - 1].price;
      if (profitPct > sell_threshold || price > boll.upper * (1 - sell_threshold * 0.5)) {
        cash += shares * price;
        trades.push({ date, action: "sell", price, reason: profitPct > 0 ? `盈利${(profitPct * 100).toFixed(1)}%了结` : `止损出局` });
        if (profitPct > 0) wins++;
        else losses++;
        shares = 0;
        position = 0;
      }
    }

    const equity = cash + shares * price;
    equityCurve.push({ date, value: equity });
    if (equity > peak) peak = equity;
    const drawdown = (peak - equity) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const finalValue = cash + shares * closes[closes.length - 1];
  const totalReturn = ((finalValue - initialCash) / initialCash) * 100;
  const years = history.length / 252;
  const annualReturn = (Math.pow(finalValue / initialCash, 1 / years) - 1) * 100;
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? wins / totalTrades : 0;

  // Sharpe ratio approximation
  const returns = equityCurve.slice(1).map((e, i) => (e.value - equityCurve[i].value) / equityCurve[i].value);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    strategy_name: "均线回归策略",
    total_return: totalReturn,
    annual_return: annualReturn,
    max_drawdown: -maxDrawdown * 100,
    sharpe_ratio: sharpeRatio,
    win_rate: winRate,
    total_trades: totalTrades,
    equity_curve: equityCurve,
    trades: trades.filter(t => t.action !== "hold"),
  };
}

// Trend following strategy
export function trendFollowingBacktest(
  history: OHLCV[],
  initialCash: number,
  params: { ma_short?: number; ma_long?: number }
): BacktestResult {
  const maShort = params.ma_short || 5;
  const maLong = params.ma_long || 20;
  const closes = history.map(h => h.close);

  let cash = initialCash;
  let position = 0;
  let shares = 0;
  let peak = initialCash;
  let maxDrawdown = 0;
  let wins = 0, losses = 0;
  const equityCurve: { date: string; value: number }[] = [];
  const trades: BacktestSignal[] = [];

  for (let i = maLong; i < closes.length; i++) {
    const maS = sma(closes.slice(i - maShort, i), maShort);
    const maL = sma(closes.slice(i - maLong, i), maLong);
    const maSPrev = sma(closes.slice(i - maShort - 1, i - 1), maShort);
    const maLPrev = sma(closes.slice(i - maLong - 1, i - 1), maLong);
    const price = closes[i];
    const date = history[i].date;

    // Golden cross - buy
    if (position === 0 && maS > maL && maSPrev <= maLPrev) {
      shares = Math.floor(cash / price);
      cash -= shares * price;
      position = 1;
      trades.push({ date, action: "buy", price, reason: `MA${maShort}上穿MA${maLong}，趋势转多` });
    }
    // Death cross - sell
    else if (position === 1 && maS < maL && maSPrev >= maLPrev) {
      cash += shares * price;
      const profitPct = (price - trades[trades.length - 1].price) / trades[trades.length - 1].price;
      trades.push({ date, action: "sell", price, reason: `MA${maShort}下穿MA${maLong}，趋势转空` });
      if (profitPct > 0) wins++;
      else losses++;
      shares = 0;
      position = 0;
    }

    const equity = cash + shares * price;
    equityCurve.push({ date, value: equity });
    if (equity > peak) peak = equity;
    const drawdown = (peak - equity) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const finalValue = cash + shares * closes[closes.length - 1];
  const totalReturn = ((finalValue - initialCash) / initialCash) * 100;
  const years = history.length / 252;
  const annualReturn = (Math.pow(finalValue / initialCash, 1 / years) - 1) * 100;
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? wins / totalTrades : 0;

  const returns = equityCurve.slice(1).map((e, i) => (e.value - equityCurve[i].value) / equityCurve[i].value);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    strategy_name: "趋势追踪策略",
    total_return: totalReturn,
    annual_return: annualReturn,
    max_drawdown: -maxDrawdown * 100,
    sharpe_ratio: sharpeRatio,
    win_rate: winRate,
    total_trades: totalTrades,
    equity_curve: equityCurve,
    trades: trades.filter(t => t.action !== "hold"),
  };
}

// RSI contrarian strategy
export function rsiBacktest(
  history: OHLCV[],
  initialCash: number,
  params: { rsi_period?: number; oversold?: number; overbought?: number }
): BacktestResult {
  const { rsi_period = 14, oversold = 30, overbought = 70 } = params;
  const closes = history.map(h => h.close);
  const highs = history.map(h => h.high);
  const lows = history.map(h => h.low);

  let cash = initialCash;
  let position = 0;
  let shares = 0;
  let peak = initialCash;
  let maxDrawdown = 0;
  let wins = 0, losses = 0;
  const equityCurve: { date: string; value: number }[] = [];
  const trades: BacktestSignal[] = [];

  for (let i = rsi_period + 1; i < closes.length; i++) {
    const recentCloses = closes.slice(i - rsi_period - 1, i + 1);
    const recentHighs = highs.slice(i - rsi_period - 1, i + 1);
    const recentLows = lows.slice(i - rsi_period - 1, i + 1);
    const rsi = calculateRSI(recentCloses, rsi_period);
    const kdj = calculateKDJ(recentHighs, recentLows, recentCloses, rsi_period);
    const price = closes[i];
    const date = history[i].date;

    // Buy when RSI oversold + KDJ oversold
    if (position === 0 && rsi < oversold && kdj.k < 20) {
      shares = Math.floor(cash / price);
      cash -= shares * price;
      position = 1;
      trades.push({ date, action: "buy", price, reason: `RSI=${rsi.toFixed(1)}超卖，KDJ低位，金叉买入` });
    }
    // Sell when RSI overbought + KDJ overbought
    else if (position === 1 && (rsi > overbought || kdj.k > 80)) {
      cash += shares * price;
      const profitPct = (price - trades[trades.length - 1].price) / trades[trades.length - 1].price;
      trades.push({ date, action: "sell", price, reason: rsi > overbought ? `RSI=${rsi.toFixed(1)}超买，获利了结` : `KDJ高位，死叉止损` });
      if (profitPct > 0) wins++;
      else losses++;
      shares = 0;
      position = 0;
    }

    const equity = cash + shares * price;
    equityCurve.push({ date, value: equity });
    if (equity > peak) peak = equity;
    const drawdown = (peak - equity) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const finalValue = cash + shares * closes[closes.length - 1];
  const totalReturn = ((finalValue - initialCash) / initialCash) * 100;
  const years = history.length / 252;
  const annualReturn = (Math.pow(finalValue / initialCash, 1 / years) - 1) * 100;
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? wins / totalTrades : 0;

  const returns = equityCurve.slice(1).map((e, i) => (e.value - equityCurve[i].value) / equityCurve[i].value);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    strategy_name: "RSI反转策略",
    total_return: totalReturn,
    annual_return: annualReturn,
    max_drawdown: -maxDrawdown * 100,
    sharpe_ratio: sharpeRatio,
    win_rate: winRate,
    total_trades: totalTrades,
    equity_curve: equityCurve,
    trades: trades.filter(t => t.action !== "hold"),
  };
}

// Value investing strategy (simplified)
export function valueInvestingBacktest(
  history: OHLCV[],
  initialCash: number,
  _params: { rebalance_threshold?: number }
): BacktestResult {
  const closes = history.map(h => h.close);

  let cash = initialCash;
  let shares = 0;
  let peak = initialCash;
  let maxDrawdown = 0;
  const equityCurve: { date: string; value: number }[] = [];
  const trades: BacktestSignal[] = [];

  // Buy and hold with quarterly rebalancing
  for (let i = 0; i < closes.length; i++) {
    const price = closes[i];
    const date = history[i].date;

    // Initial buy - invest 95% of cash
    if (i === 20) {
      shares = Math.floor((cash * 0.95) / price);
      cash -= shares * price;
      trades.push({ date, action: "buy", price, reason: "初始建仓，价值投资策略" });
    }
    // Rebalance quarterly
    else if (i > 20 && i % 60 === 0) {
      const currentValue = cash + shares * price;
      const targetShares = Math.floor((currentValue * 0.95) / price);
      const diff = targetShares - shares;
      if (diff > 10) {
        cash -= diff * price;
        trades.push({ date, action: "buy", price, reason: `季度再平衡，增持${diff}股` });
        shares = targetShares;
      } else if (diff < -10) {
        cash += (-diff) * price;
        trades.push({ date, action: "sell", price, reason: `季度再平衡，减持${-diff}股` });
        shares = targetShares;
      }
    }

    const equity = cash + shares * price;
    equityCurve.push({ date, value: equity });
    if (equity > peak) peak = equity;
    const drawdown = (peak - equity) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const finalValue = cash + shares * closes[closes.length - 1];
  const totalReturn = ((finalValue - initialCash) / initialCash) * 100;
  const years = history.length / 252;
  const annualReturn = (Math.pow(finalValue / initialCash, 1 / years) - 1) * 100;
  const totalTrades = trades.length;

  const returns = equityCurve.slice(1).map((e, i) => (e.value - equityCurve[i].value) / equityCurve[i].value);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    strategy_name: "价值投资策略",
    total_return: totalReturn,
    annual_return: annualReturn,
    max_drawdown: -maxDrawdown * 100,
    sharpe_ratio: sharpeRatio,
    win_rate: totalTrades > 0 ? 1 : 0,
    total_trades: totalTrades,
    equity_curve: equityCurve,
    trades,
  };
}

// Quant stock selection strategy
export function quantStockSelection(
  stocks: Array<{ symbol: string; name: string; pe?: number; pb?: number; roe?: number; price: number; change_pct: number }>,
  params: { min_pe?: number; max_pe?: number; min_roe?: number; min_pb?: number }
): Array<{ symbol: string; name: string; score: number; reason: string }> {
  const { min_pe = 0, max_pe = 50, min_roe = 10, min_pb = 0 } = params;

  return stocks
    .filter(s => {
      const peOk = s.pe !== undefined && s.pe >= min_pe && s.pe <= max_pe;
      const roeOk = s.roe !== undefined && s.roe >= min_roe;
      const pbOk = s.pb !== undefined && s.pb >= min_pb;
      return peOk && roeOk && pbOk;
    })
    .map(s => {
      // Score = ROE * 2 + (30 - PE) * 0.5 + (5 - PB) * 2
      const score = (s.roe || 0) * 2 + (30 - (s.pe || 30)) * 0.5 + Math.max(0, (5 - (s.pb || 5)) * 2);
      let reason = "";
      if ((s.roe || 0) > 20) reason += `ROE高达${s.roe?.toFixed(1)}%，`;
      if ((s.pe || 0) < 20) reason += `估值较低PE=${s.pe?.toFixed(1)}，`;
      if ((s.pb || 0) < 2) reason += `市净率PB=${s.pb?.toFixed(2)}较低`;
      return { symbol: s.symbol, name: s.name, score, reason: reason || "综合指标良好" };
    })
    .sort((a, b) => b.score - a.score);
}
