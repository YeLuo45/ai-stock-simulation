/**
 * 回测引擎 - 真实MA交叉信号实现
 */
import type { BacktestResponse, BacktestTrade, EquityPoint, DrawdownPoint, ReturnDistribution } from '../types';
import { DEFAULT_STOCKS } from './quotes';

export interface BacktestIndicator {
  type: 'MA' | 'RSI' | 'MACD' | 'KDJ' | 'BOLL' | 'VOL' | 'PRICE';
  enabled: boolean;
  params: Record<string, number>;
}

export interface OptimizationResult {
  params: Record<string, number>;
  total_return: number;
  annual_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  profit_loss_ratio: number;
  total_trades: number;
}

/**
 * 计算移动平均线
 */
function calculateMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(prices[i]);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * 生成模拟历史K线数据
 */
function generateHistoricalData(
  symbol: string,
  startDate: string,
  endDate: string,
  basePrice?: number
): { time: string; open: number; high: number; low: number; close: number; volume: number }[] {
  const stock = DEFAULT_STOCKS.find(s => s.symbol === symbol) || DEFAULT_STOCKS[0];
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  
  let price = basePrice || stock.price * (0.7 + Math.random() * 0.3);
  const data: { time: string; open: number; high: number; low: number; close: number; volume: number }[] = [];
  
  for (let t = start; t <= end; t += dayMs) {
    const date = new Date(t);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // 跳过周末
    
    const dateStr = date.toISOString().split('T')[0];
    const dailyVolatility = 0.02 + Math.random() * 0.03;
    const trend = Math.random() > 0.48 ? 1 : -1;
    
    const open = price * (1 + (Math.random() - 0.5) * 0.01);
    const change = price * dailyVolatility * trend;
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.floor(stock.volume * (0.5 + Math.random()));
    
    data.push({ time: dateStr, open, high, low, close, volume });
    price = close;
  }
  
  return data;
}

/**
 * MA交叉策略信号生成
 */
function generateMASignals(
  klineData: { time: string; close: number }[],
  shortPeriod: number = 5,
  longPeriod: number = 20
): { date: string; signal: 'buy' | 'sell' | 'hold'; price: number }[] {
  if (klineData.length < longPeriod) return [];
  
  const closes = klineData.map(d => d.close);
  const shortMA = calculateMA(closes, shortPeriod);
  const longMA = calculateMA(closes, longPeriod);
  
  const signals: { date: string; signal: 'buy' | 'sell' | 'hold'; price: number }[] = [];
  
  for (let i = longPeriod; i < klineData.length; i++) {
    const prevShort = shortMA[i - 1];
    const prevLong = longMA[i - 1];
    const currShort = shortMA[i];
    const currLong = longMA[i];
    
    // 金叉：短均线从下方穿过长均线
    if (prevShort <= prevLong && currShort > currLong) {
      signals.push({ date: klineData[i].time, signal: 'buy', price: klineData[i].close });
    }
    // 死叉：短均线从上方穿过长均线
    else if (prevShort >= prevLong && currShort < currLong) {
      signals.push({ date: klineData[i].time, signal: 'sell', price: klineData[i].close });
    }
  }
  
  return signals;
}

/**
 * 运行单次回测
 */
export function runSingleBacktest(
  symbol: string,
  startDate: string,
  endDate: string,
  initialCash: number,
  shortPeriod: number = 5,
  longPeriod: number = 20
): {
  result: BacktestResponse;
  klineData: { time: string; open: number; high: number; low: number; close: number; volume: number }[];
} {
  const klineData = generateHistoricalData(symbol, startDate, endDate);
  const signals = generateMASignals(klineData, shortPeriod, longPeriod);
  
  let cash = initialCash;
  let position = 0;
  let avgCost = 0;
  const trades: BacktestTrade[] = [];
  
  const equityCurve: EquityPoint[] = [];
  const drawdownCurve: DrawdownPoint[] = [];
  let peak = initialCash;
  let maxDrawdown = 0;
  
  // 模拟交易
  for (const kline of klineData) {
    const signal = signals.find(s => s.date === kline.time);
    
    if (signal) {
      if (signal.signal === 'buy' && position === 0) {
        // 买入
        const quantity = Math.floor(cash * 0.95 / signal.price / 100) * 100;
        if (quantity > 0) {
          avgCost = signal.price;
          cash -= quantity * signal.price;
          position = quantity;
          trades.push({
            date: signal.date,
            symbol,
            type: 'buy',
            price: signal.price,
            quantity,
            amount: quantity * signal.price,
          });
        }
      } else if (signal.signal === 'sell' && position > 0) {
        // 卖出
        const sellAmount = position * signal.price;
        const profit = (signal.price - avgCost) * position;
        cash += sellAmount;
        trades.push({
          date: signal.date,
          symbol,
          type: 'sell',
          price: signal.price,
          quantity: position,
          amount: sellAmount,
          profit,
        });
        position = 0;
        avgCost = 0;
      }
    }
    
    // 计算当前资产
    const currentValue = cash + position * kline.close;
    equityCurve.push({ date: kline.time, value: Math.round(currentValue) });
    
    // 回撤计算
    if (currentValue > peak) peak = currentValue;
    const drawdown = ((peak - currentValue) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    drawdownCurve.push({
      date: kline.time,
      drawdown: Math.round(drawdown * 100) / 100,
      peak: Math.round(peak),
      equity: Math.round(currentValue),
    });
  }
  
  // 平仓
  if (position > 0) {
    const lastPrice = klineData[klineData.length - 1].close;
    const profit = (lastPrice - avgCost) * position;
    trades.push({
      date: klineData[klineData.length - 1].time,
      symbol,
      type: 'sell',
      price: lastPrice,
      quantity: position,
      amount: position * lastPrice,
      profit,
    });
    cash += position * lastPrice;
    position = 0;
  }
  
  // 生成月度收益
  const monthlyReturns: { month: string; return_pct: number }[] = [];
  const monthMap = new Map<string, number>();
  
  for (const point of equityCurve) {
    const month = point.date.slice(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, point.value);
    }
  }
  
  const months = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (let i = 1; i < months.length; i++) {
    const returnPct = ((months[i][1] - months[i - 1][1]) / months[i - 1][1]) * 100;
    monthlyReturns.push({ month: months[i][0], return_pct: Math.round(returnPct * 100) / 100 });
  }
  
  // 收益分布
  const closedTrades = trades.filter(t => t.profit !== undefined);
  const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0);
  const losingTrades = closedTrades.filter(t => (t.profit || 0) < 0);
  
  const returnDistribution: ReturnDistribution[] = [
    { range: '<-5%', count: 0, percentage: 0 },
    { range: '-5%~0%', count: 0, percentage: 0 },
    { range: '0%~5%', count: 0, percentage: 0 },
    { range: '5%~10%', count: 0, percentage: 0 },
    { range: '>10%', count: 0, percentage: 0 },
  ];
  
  for (const trade of closedTrades) {
    const profitPct = (trade.profit || 0) / (trade.price * trade.quantity) * 100;
    if (profitPct < -5) returnDistribution[0].count++;
    else if (profitPct < 0) returnDistribution[1].count++;
    else if (profitPct < 5) returnDistribution[2].count++;
    else if (profitPct < 10) returnDistribution[3].count++;
    else returnDistribution[4].count++;
  }
  
  const total = returnDistribution.reduce((sum, r) => sum + r.count, 0);
  returnDistribution.forEach(r => {
    r.percentage = total > 0 ? Math.round((r.count / total) * 100 * 10) / 10 : 0;
  });
  
  const finalValue = equityCurve[equityCurve.length - 1]?.value || initialCash;
  const totalReturn = ((finalValue - initialCash) / initialCash) * 100;
  const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
  
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((s, t) => s + (t.profit || 0), 0) / winningTrades.length
    : 0;
  const avgLoss = losingTrades.length > 0
    ? Math.abs(losingTrades.reduce((s, t) => s + (t.profit || 0), 0) / losingTrades.length)
    : 1;
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
  const profitLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  
  // 计算夏普比率（简化版）
  const returns = monthlyReturns.map(m => m.return_pct);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length || 1);
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(12) : 0;
  
  const result: BacktestResponse = {
    id: Date.now(),
    strategy_name: `MA${shortPeriod}/MA${longPeriod}交叉策略`,
    total_return: Math.round(totalReturn * 100) / 100,
    annual_return: Math.round((totalReturn * 365 / days) * 100) / 100,
    max_drawdown: Math.round(maxDrawdown * 100) / 100,
    sharpe_ratio: Math.round(sharpeRatio * 100) / 100,
    win_rate: Math.round(winRate * 10) / 10,
    profit_loss_ratio: Math.round(profitLossRatio * 100) / 100,
    total_trades: trades.length,
    equity_curve: equityCurve,
    drawdown_curve: drawdownCurve,
    return_distribution: returnDistribution,
    monthly_returns: monthlyReturns,
    trades,
  };
  
  return { result, klineData };
}

/**
 * 网格搜索参数优化
 */
export function gridSearchOptimization(
  symbol: string,
  startDate: string,
  endDate: string,
  initialCash: number,
  optimizationParams: Record<string, [number, number, number]>
): OptimizationResult[] {
  const results: OptimizationResult[] = [];

  // 解析优化参数
  const shortMAPeriods = generateRange(
    optimizationParams['MA.short']?.[0] || 5,
    optimizationParams['MA.short']?.[1] || 20,
    optimizationParams['MA.short']?.[2] || 5
  );

  const longMAPeriods = generateRange(
    optimizationParams['MA.long']?.[0] || 20,
    optimizationParams['MA.long']?.[1] || 60,
    optimizationParams['MA.long']?.[2] || 10
  );

  // 网格搜索
  for (const shortPeriod of shortMAPeriods) {
    for (const longPeriod of longMAPeriods) {
      if (shortPeriod >= longPeriod) continue; // 短周期必须小于长周期

      const { result } = runSingleBacktest(symbol, startDate, endDate, initialCash, shortPeriod, longPeriod);

      results.push({
        params: { 'MA.short': shortPeriod, 'MA.long': longPeriod },
        total_return: result.total_return,
        annual_return: result.annual_return,
        sharpe_ratio: result.sharpe_ratio,
        max_drawdown: result.max_drawdown,
        win_rate: result.win_rate,
        profit_loss_ratio: result.profit_loss_ratio,
        total_trades: result.total_trades,
      });
    }
  }

  // 按总收益排序
  results.sort((a, b) => b.total_return - a.total_return);

  return results;
}

/**
 * 多策略对比回测
 */
export function runMultiStrategyBacktest(
  symbol: string,
  startDate: string,
  endDate: string,
  initialCash: number,
  strategies: Array<{ id: string; name: string; shortPeriod: number; longPeriod: number; color: string }>
): {
  results: import('../types').MultiStrategyResult[];
  klineData: { time: string; open: number; high: number; low: number; close: number; volume: number }[];
} {
  const results: import('../types').MultiStrategyResult[] = [];
  let klineData: { time: string; open: number; high: number; low: number; close: number; volume: number }[] = [];

  for (const strategy of strategies) {
    const { result, klineData: kd } = runSingleBacktest(
      symbol, startDate, endDate, initialCash, strategy.shortPeriod, strategy.longPeriod
    );

    if (klineData.length === 0) {
      klineData = kd;
    }

    results.push({
      strategy_id: strategy.id,
      strategy_name: strategy.name,
      color: strategy.color,
      total_return: result.total_return,
      annual_return: result.annual_return,
      max_drawdown: result.max_drawdown,
      sharpe_ratio: result.sharpe_ratio,
      win_rate: result.win_rate,
      profit_loss_ratio: result.profit_loss_ratio,
      total_trades: result.total_trades,
      equity_curve: result.equity_curve,
    });
  }

  // 按总收益排序
  results.sort((a, b) => b.total_return - a.total_return);

  return { results, klineData };
}

/**
 * 生成范围数组
 */
function generateRange(min: number, max: number, step: number): number[] {
  const result: number[] = [];
  for (let v = min; v <= max; v += step) {
    result.push(Math.round(v));
  }
  return result;
}
