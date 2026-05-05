/**
 * Trading service with proper fee calculation
 * Commission: 0.03% (both buy and sell)
 * Stamp tax: 0.1% (only on sell, Chinese stock market rule)
 * 
 * Fee calculation formula:
 * - Buy: total_cost = price * quantity * (1 + 0.0003)
 * - Sell: total_cost = price * quantity * (1 - 0.0003 - 0.001) = price * quantity * 0.9987
 */

import type { Portfolio, Position, Trade, TradeRequest, StockInfo } from "../types";
import {
  getAccount,
  saveAccount,
  getPositions,
  savePosition,
  deletePosition,
  getTrades as dbGetTrades,
  addTrade as dbAddTrade,
  resetAllData,
  PositionData,
} from "./db";

// ============== Fee Constants ==============

export const COMMISSION_RATE = 0.0003; // 0.03% both sides
export const STAMP_TAX_RATE = 0.001; // 0.1% only on sell

// ============== Portfolio Calculation ==============

export function calculatePortfolio(
  account: { cash: number },
  positions: PositionData[],
  stockPrices: Map<string, StockInfo>
): Portfolio {
  let totalMarketValue = 0;

  const positionDetails: Position[] = positions.map((pos) => {
    const stock = stockPrices.get(pos.symbol);
    const currentPrice = stock?.price ?? pos.avg_cost;
    const marketValue = pos.quantity * currentPrice;
    const cost = pos.quantity * pos.avg_cost;
    totalMarketValue += marketValue;

    return {
      id: pos.id,
      symbol: pos.symbol,
      name: pos.name,
      quantity: pos.quantity,
      avg_cost: pos.avg_cost,
      current_price: currentPrice,
      market_value: marketValue,
      profit_loss: marketValue - cost,
      profit_loss_pct: cost > 0 ? ((marketValue - cost) / cost) * 100 : 0,
    };
  });

  const totalAssets = account.cash + totalMarketValue;
  const INITIAL_CASH = 1_000_000;
  const totalProfitLoss = totalAssets - INITIAL_CASH;
  const totalProfitLossPct = (totalProfitLoss / INITIAL_CASH) * 100;

  return {
    id: 1,
    name: "默认模拟账户",
    cash: account.cash,
    total_market_value: totalMarketValue,
    total_assets: totalAssets,
    total_profit_loss: totalProfitLoss,
    total_profit_loss_pct: totalProfitLossPct,
    positions: positionDetails,
  };
}

// ============== Trading Validation ==============

export interface TradeValidation {
  valid: boolean;
  error?: string;
  estimatedCost?: number;
  estimatedCommission?: number;
  estimatedStampTax?: number;
}

export function validateTrade(
  tradeType: "buy" | "sell",
  quantity: number,
  price: number,
  availableCash: number,
  availableShares: number
): TradeValidation {
  if (quantity <= 0) {
    return { valid: false, error: "数量必须大于0" };
  }

  if (price <= 0) {
    return { valid: false, error: "价格必须大于0" };
  }

  // Round to nearest 100 (A-share requirement)
  if (quantity % 100 !== 0) {
    return { valid: false, error: "A股数量必须是100的整数倍" };
  }

  const grossAmount = price * quantity;
  const commission = grossAmount * COMMISSION_RATE;
  const stampTax = tradeType === "sell" ? grossAmount * STAMP_TAX_RATE : 0;

  if (tradeType === "buy") {
    const totalCost = grossAmount + commission;
    if (totalCost > availableCash) {
      return { valid: false, error: `资金不足。需要 ¥${totalCost.toFixed(2)}，可用 ¥${availableCash.toFixed(2)}` };
    }
    return {
      valid: true,
      estimatedCost: totalCost,
      estimatedCommission: commission,
      estimatedStampTax: 0,
    };
  } else {
    if (quantity > availableShares) {
      return { valid: false, error: `持仓不足。最大可卖 ${availableShares} 股` };
    }
    const netProceed = grossAmount - commission - stampTax;
    return {
      valid: true,
      estimatedCost: netProceed,
      estimatedCommission: commission,
      estimatedStampTax: stampTax,
    };
  }
}

// ============== Execute Trade ==============

export interface TradeResult {
  success: boolean;
  trade?: Trade;
  error?: string;
}

export async function executeTrade(
  req: TradeRequest,
  currentPrice: number,
  accountId: number = 1
): Promise<TradeResult> {
  try {
    const account = await getAccount();
    const positions = await getPositions(accountId);

    const price = req.price ?? currentPrice;
    const quantity = req.quantity;

    // Find existing position
    const existingPos = positions.find((p) => p.symbol === req.symbol);

    // Validate trade
    const validation = validateTrade(
      req.trade_type,
      quantity,
      price,
      account.cash,
      existingPos?.quantity ?? 0
    );

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Calculate fees
    const grossAmount = price * quantity;
    const commission = grossAmount * COMMISSION_RATE;
    const stampTax = req.trade_type === "sell" ? grossAmount * STAMP_TAX_RATE : 0;

    let trade: Trade;

    if (req.trade_type === "buy") {
      // Buy: deduct cost + commission from cash
      const totalCost = grossAmount + commission;
      account.cash -= totalCost;

      if (existingPos) {
        // Update existing position - calculate new average cost
        const totalShares = existingPos.quantity + quantity;
        const totalCostBasis = existingPos.avg_cost * existingPos.quantity + price * quantity;
        existingPos.avg_cost = totalCostBasis / totalShares;
        existingPos.quantity = totalShares;
        await savePosition(existingPos);
      } else {
        // Create new position
        const newPosition: PositionData = {
          id: Date.now(),
          account_id: accountId,
          symbol: req.symbol,
          name: req.name || req.symbol,
          quantity: quantity,
          avg_cost: price,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await savePosition(newPosition);
      }

      trade = {
        id: Date.now(),
        symbol: req.symbol,
        name: req.name || req.symbol,
        trade_type: "buy" as const,
        price: price,
        quantity: quantity,
        commission: commission,
        total_cost: totalCost,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Sell: add net proceed to cash
      const netProceed = grossAmount - commission - stampTax;
      account.cash += netProceed;

      if (existingPos) {
        existingPos.quantity -= quantity;
        if (existingPos.quantity === 0) {
          await deletePosition(existingPos.id);
        } else {
          await savePosition(existingPos);
        }
      }

      trade = {
        id: Date.now(),
        symbol: req.symbol,
        name: req.name || req.symbol,
        trade_type: "sell" as const,
        price: price,
        quantity: quantity,
        commission: commission,
        total_cost: -netProceed, // negative because it's a credit
        timestamp: new Date().toISOString(),
      };
    }

    // Save account and trade
    await saveAccount(account);
    
    // Create TradeData object with proper typing
    const tradeData = {
      id: trade.id,
      account_id: accountId,
      symbol: trade.symbol,
      name: trade.name,
      trade_type: trade.trade_type as "buy" | "sell",
      price: trade.price,
      quantity: trade.quantity,
      commission: trade.commission,
      stamp_tax: stampTax,
      total_cost: trade.total_cost,
      timestamp: trade.timestamp,
    };
    await dbAddTrade(tradeData);

    return { success: true, trade };
  } catch (err) {
    console.error("Trade execution error:", err);
    return { success: false, error: "交易执行失败" };
  }
}

// ============== Portfolio & Trade Queries ==============

export async function getPortfolio(stockPrices: Map<string, StockInfo>): Promise<Portfolio> {
  const account = await getAccount();
  const positions = await getPositions();
  return calculatePortfolio(account, positions, stockPrices);
}

export async function getTradeHistory(limit: number = 50): Promise<Trade[]> {
  const trades = await dbGetTrades(1, limit);
  return trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    name: t.name,
    trade_type: t.trade_type,
    price: t.price,
    quantity: t.quantity,
    commission: t.commission,
    total_cost: t.total_cost,
    timestamp: t.timestamp,
  }));
}

export async function resetPortfolio(): Promise<{ message: string }> {
  await resetAllData();
  return { message: "Portfolio reset successfully" };
}
