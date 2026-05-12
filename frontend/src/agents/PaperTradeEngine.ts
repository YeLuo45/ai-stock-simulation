/**
 * Paper Trade Engine
 * Simulates real trading execution without actual money
 * Tracks positions, orders, cash balance, and PnL
 */

import type { PaperTradeSnapshot, PaperPosition, PaperOrder } from './messages';

export { type PaperTradeSnapshot, type PaperPosition, type PaperOrder };

const INITIAL_BALANCE = 100000;

export interface PaperTradeEngine {
  balance: number;
  initialBalance: number;
  positions: Map<string, PaperPosition>;
  orders: PaperOrder[];
  getSnapshot(traceId: string): PaperTradeSnapshot;
  openOrder(symbol: string, name: string, action: 'buy' | 'sell', quantity: number, price: number, traceId: string): void;
  settle(currentPrices: Map<string, number>): void;
  computePnL(): { realized: number; unrealized: number; total: number };
  reset(): void;
}

function createEngine(): PaperTradeEngine {
  let _balance = INITIAL_BALANCE;
  const _initialBalance = INITIAL_BALANCE;
  const _positions = new Map<string, PaperPosition>();
  const _orders: PaperOrder[] = [];

  return {
    get balance() { return _balance; },
    get initialBalance() { return _initialBalance; },
    get positions() { return _positions; },
    get orders() { return _orders; },

    getSnapshot(traceId: string): PaperTradeSnapshot {
      const { realized, unrealized, total } = this.computePnL();
      return {
        traceId,
        timestamp: Date.now(),
        balance: _balance,
        initialBalance: _initialBalance,
        positions: Array.from(_positions.values()),
        orders: _orders.slice(-50), // last 50 orders
        realizedPnL: realized,
        unrealizedPnL: unrealized,
        totalPnL: total,
        totalPnLPct: (total / _initialBalance) * 100,
      };
    },

    openOrder(symbol: string, name: string, action: 'buy' | 'sell', quantity: number, price: number, traceId: string): void {
      const orderId = `PT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const totalAmount = quantity * price;

      if (action === 'buy') {
        if (totalAmount > _balance) {
          console.warn(`[PaperTrade] Insufficient balance: need ¥${totalAmount.toFixed(2)}, have ¥${_balance.toFixed(2)}`);
          return;
        }
        _balance -= totalAmount;

        const existing = _positions.get(symbol);
        if (existing) {
          const totalShares = existing.shares + quantity;
          const totalCost = existing.shares * existing.avgCost + quantity * price;
          existing.avgCost = totalCost / totalShares;
          existing.shares = totalShares;
          existing.currentPrice = price;
          existing.marketValue = existing.shares * price;
          existing.unrealizedPnL = existing.marketValue - (existing.shares * existing.avgCost);
          existing.unrealizedPnLPct = (existing.unrealizedPnL / (existing.shares * existing.avgCost)) * 100;
        } else {
          _positions.set(symbol, {
            symbol,
            name,
            shares: quantity,
            avgCost: price,
            currentPrice: price,
            marketValue: quantity * price,
            unrealizedPnL: 0,
            unrealizedPnLPct: 0,
          });
        }
      } else if (action === 'sell') {
        const pos = _positions.get(symbol);
        if (!pos || pos.shares < quantity) {
          console.warn(`[PaperTrade] Cannot sell ${quantity} shares of ${symbol}: only ${pos?.shares || 0} held`);
          return;
        }
        _balance += totalAmount;
        pos.shares -= quantity;
        if (pos.shares === 0) {
          _positions.delete(symbol);
        } else {
          pos.currentPrice = price;
          pos.marketValue = pos.shares * price;
          pos.unrealizedPnL = pos.marketValue - (pos.shares * pos.avgCost);
          pos.unrealizedPnLPct = (pos.unrealizedPnL / (pos.shares * pos.avgCost)) * 100;
        }
      }

      _orders.push({
        id: orderId,
        symbol,
        name,
        action,
        quantity,
        price,
        totalAmount,
        timestamp: Date.now(),
        traceId,
      });
    },

    settle(currentPrices: Map<string, number>): void {
      for (const [symbol, pos] of _positions) {
        const price = currentPrices.get(symbol) ?? pos.currentPrice;
        pos.currentPrice = price;
        pos.marketValue = pos.shares * price;
        pos.unrealizedPnL = pos.marketValue - (pos.shares * pos.avgCost);
        pos.unrealizedPnLPct = (pos.unrealizedPnL / (pos.shares * pos.avgCost)) * 100;
      }
    },

    computePnL() {
      let unrealized = 0;
      for (const pos of _positions.values()) {
        unrealized += pos.unrealizedPnL;
      }
      const realized = _balance - _initialBalance;
      const total = realized + unrealized;
      return { realized, unrealized, total };
    },

    reset() {
      _balance = INITIAL_BALANCE;
      _positions.clear();
      _orders.length = 0;
    },
  };
}

// Singleton
let _engine: PaperTradeEngine | null = null;
export function getPaperTradeEngine(): PaperTradeEngine {
  if (!_engine) _engine = createEngine();
  return _engine;
}
