/**
 * Memory Service - Strategic Memory System
 * Provides memory creation, outcome tracking, and recommendation engine
 */
import type { Position, Trade, MemoryEntry } from "../types";
import type { OHLCV } from "./indicators";
import { getMemoryEntries, addMemoryEntry, updateMemoryEntry } from "./storage";

export type MemoryOutcome = 'pending' | 'profit' | 'loss' | 'stop_loss' | 'take_profit';

export interface MemoryStatsData {
  total: number;
  pending: number;
  profit: number;
  loss: number;
  stopLoss: number;
  takeProfit: number;
  avgHoldingDays: number;
  winRate: number;
  factorStats: Record<string, { total: number; wins: number; winRate: number }>;
}

// ============ Decision Factor Calculation ============

/**
 * Calculate decision factors based on position and price history
 */
export function calculateDecisionFactors(position: Position, history: OHLCV[]): string[] {
  const factors: string[] = [];
  if (history.length < 20) return factors;

  const closes = history.map(h => h.close);
  const latest = closes[closes.length - 1];
  const rsi = calculateRSI(closes, 14);
  const { MA5, MA20 } = calculateMA(closes);
  const { MACD, MACD_SIGNAL } = calculateMACD(closes);

  // RSI factors
  if (rsi < 30) factors.push('RSI超卖');
  else if (rsi > 70) factors.push('RSI超买');
  else if (rsi >= 40 && rsi <= 60) factors.push('RSI中性');

  // MA factors
  if (MA5 > MA20) factors.push('MA金叉');
  else if (MA5 < MA20) factors.push('MA死叉');

  // MACD factors
  if (MACD > MACD_SIGNAL) factors.push('MACD多头');
  else if (MACD < MACD_SIGNAL) factors.push('MACD空头');

  // Volume factor (simplified - assume volume exists)
  if (history.length >= 5) {
    const recentVol = history.slice(-5).reduce((sum, h) => sum + h.volume, 0);
    const avgVol = recentVol / 5;
    const lastVol = history[history.length - 1].volume;
    if (lastVol > avgVol * 2) factors.push('放量');
  }

  // Price position relative to MA
  if (latest > MA20 * 1.05) factors.push('站上MA20');
  else if (latest < MA20 * 0.95) factors.push('跌破MA20');

  // Cost basis factor
  const costDiff = ((latest - position.avg_cost) / position.avg_cost) * 100;
  if (costDiff > 5) factors.push('浮盈');
  else if (costDiff < -5) factors.push('浮亏');

  return factors;
}

// ============ Simple Technical Indicators ============

function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMA(prices: number[]): { MA5: number; MA10: number; MA20: number } {
  const avg = (arr: number[], n: number) => {
    if (arr.length < n) return arr[arr.length - 1];
    const slice = arr.slice(-n);
    return slice.reduce((a, b) => a + b, 0) / n;
  };
  return {
    MA5: avg(prices, 5),
    MA10: avg(prices, 10),
    MA20: avg(prices, 20),
  };
}

function calculateMACD(prices: number[]): { MACD: number; MACD_SIGNAL: number } {
  const ema = (arr: number[], n: number) => {
    if (arr.length < n) return arr[arr.length - 1];
    const k = 2 / (n + 1);
    let emaVal = arr.slice(0, n).reduce((a, b) => a + b, 0) / n;
    for (let i = n; i < arr.length; i++) {
      emaVal = arr[i] * k + emaVal * (1 - k);
    }
    return emaVal;
  };
  const ema12 = ema(prices, 12);
  const ema26 = ema(prices, 26);
  const macd = ema12 - ema26;
  const signal = macd * 0.8; // simplified signal line
  return { MACD: macd, MACD_SIGNAL: signal };
}

// ============ Similar Memory Search ============

/**
 * Find similar historical memories based on symbol and factors
 */
export function findSimilarMemories(symbol: string, factors: string[], limit = 5): MemoryEntry[] {
  const entries = getMemoryEntries();
  const scored = entries
    .filter(e => e.symbol === symbol && e.auto === true)
    .map(e => {
      let score = 0;
      if (e.decisionFactors) {
        for (const f of factors) {
          if (e.decisionFactors.includes(f)) score++;
        }
        // Bonus for exact factor count match
        if (e.decisionFactors.length === factors.length) score += 2;
      }
      return { entry: e, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.entry);
}

// ============ Memory Stats ============

/**
 * Compute memory statistics for the stats panel
 */
export function computeMemoryStats(): MemoryStatsData {
  const entries = getMemoryEntries().filter(e => e.auto === true);
  
  const stats: MemoryStatsData = {
    total: entries.length,
    pending: 0,
    profit: 0,
    loss: 0,
    stopLoss: 0,
    takeProfit: 0,
    avgHoldingDays: 0,
    winRate: 0,
    factorStats: {},
  };

  let totalHoldingDays = 0;
  let closedCount = 0;

  for (const e of entries) {
    switch (e.outcome) {
      case 'pending': stats.pending++; break;
      case 'profit': stats.profit++; closedCount++; break;
      case 'loss': stats.loss++; closedCount++; break;
      case 'stop_loss': stats.stopLoss++; closedCount++; break;
      case 'take_profit': stats.takeProfit++; closedCount++; break;
    }

    if (e.holdingDays) {
      totalHoldingDays += e.holdingDays;
    }

    if (e.decisionFactors) {
      for (const factor of e.decisionFactors) {
        if (!stats.factorStats[factor]) {
          stats.factorStats[factor] = { total: 0, wins: 0, winRate: 0 };
        }
        stats.factorStats[factor].total++;
        if (e.outcome === 'profit' || e.outcome === 'take_profit') {
          stats.factorStats[factor].wins++;
        }
      }
    }
  }

  // Calculate win rates
  if (closedCount > 0) {
    stats.winRate = ((stats.profit + stats.takeProfit) / closedCount) * 100;
  }
  if (closedCount > 0) {
    stats.avgHoldingDays = totalHoldingDays / closedCount;
  }
  for (const factor of Object.keys(stats.factorStats)) {
    const fs = stats.factorStats[factor];
    if (fs.total > 0) {
      fs.winRate = (fs.wins / fs.total) * 100;
    }
  }

  return stats;
}

// ============ Trade Memory Creation ============

/**
 * Create a memory entry when a trade is executed (buy)
 */
export function createTradeMemory(trade: Trade, position: Position, factors: string[]): MemoryEntry {
  const entry: MemoryEntry = {
    id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'trade_decision',
    title: `${trade.name} (${trade.symbol}) - 买入决策`,
    content: `买入 ${trade.quantity} 股，单价 ¥${trade.price.toFixed(2)}，总成本 ¥${Math.abs(trade.total_cost).toFixed(2)}。决策因子：${factors.join(', ') || '无明显信号'}`,
    tags: ['自动记录', '买入', ...factors],
    symbol: trade.symbol,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    linkedTradeId: String(trade.id),
    linkedPositionId: String(position.id),
    outcome: 'pending',
    pnlPercent: trade.price, // Store buy price as reference (pnlPercent will be updated on sell)
    holdingDays: 0,
    decisionFactors: factors,
    auto: true,
  };

  addMemoryEntry(entry);
  return entry;
}

// ============ Memory Outcome Update ============

/**
 * Update memory outcome when a position is closed (sell)
 */
export function updateMemoryOutcome(
  memoryId: string,
  outcome: MemoryOutcome,
  pnlPercent: number,
  holdingDays: number
): void {
  updateMemoryEntry(memoryId, {
    outcome,
    pnlPercent,
    holdingDays,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Find memory entry by position ID
 */
export function findMemoryByPositionId(positionId: string): MemoryEntry | undefined {
  const entries = getMemoryEntries();
  return entries.find(e => e.linkedPositionId === String(positionId));
}

/**
 * Find memory entry by trade ID
 */
export function findMemoryByTradeId(tradeId: string): MemoryEntry | undefined {
  const entries = getMemoryEntries();
  return entries.find(e => e.linkedTradeId === String(tradeId));
}
