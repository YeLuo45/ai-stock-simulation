/**
 * Position Analytics Engine
 * BETA / Volatility / VaR / Contribution / Risk Parity calculations
 */
import type { Position } from '../types';
import { fetchKlineData } from './yahooFinance';

export interface RiskMetrics {
  beta: number;
  volatility: number;
  var95: number;
  maxDrawdown: number;
}

export interface PositionRisk extends RiskMetrics {
  symbol: string;
  name: string;
  weight: number;
}

export interface PortfolioRisk {
  beta: number;
  volatility: number;
  var95: number;
  totalValue: number;
}

export interface ContributionItem {
  symbol: string;
  name: string;
  weight: number;
  return: number;
  contribution: number; // % of total portfolio return
}

export interface RebalanceItem {
  symbol: string;
  name: string;
  currentWeight: number;
  targetWeight: number;
  change: number; // difference
  action: 'buy' | 'sell' | 'hold';
}

// Mock industry classification (in production, would use external data)
const INDUSTRY_MAP: Record<string, string> = {
  '600519': '白酒',
  '000001': '银行',
  '600036': '银行',
  '300750': '新能源',
  '000002': '房地产',
  '600000': '银行',
  '601318': '保险',
  '601888': '旅游',
  '600887': '食品饮料',
  '000858': '白酒',
};

const MARKET_CAP_MAP: Record<string, 'small' | 'mid' | 'large' | 'mega'> = {
  '600519': 'mega',
  '000001': 'large',
  '600036': 'large',
  '300750': 'mega',
  '000002': 'large',
};

/**
 * Calculate daily returns from price series
 */
function calcReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

/**
 * Calculate mean of an array
 */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculate standard deviation
 */
function stddev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Compute BETA: correlation(stock, index) * (stock_vol / index_vol)
 * Uses market proxy: SPY or index ETF when available
 */
export async function computeBeta(
  symbol: string,
  indexSymbol = 'SPY',
  days = 120
): Promise<number> {
  try {
    const [stockKline, indexKline] = await Promise.all([
      fetchKlineData(symbol, days),
      fetchKlineData(indexSymbol, days),
    ]);

    const stockPrices = stockKline.map(k => k.close);
    const indexPrices = indexKline.map(k => k.close);

    const stockReturns = calcReturns(stockPrices);
    const indexReturns = calcReturns(indexPrices);

    // Align lengths
    const minLen = Math.min(stockReturns.length, indexReturns.length);
    const sr = stockReturns.slice(-minLen);
    const ir = indexReturns.slice(-minLen);

    if (sr.length < 10) return 1;

    // Correlation
    const mSr = mean(sr);
    const mIr = mean(ir);
    const cov = sr.reduce((sum, r, i) => sum + (r - mSr) * (ir[i] - mIr), 0) / sr.length;
    const stockVol = stddev(sr);
    const indexVol = stddev(ir);

    if (indexVol === 0) return 1;
    return (cov / (stockVol * indexVol)) * (stockVol / indexVol);
  } catch {
    // Fallback: estimate from historical data or use 1
    return 1;
  }
}

/**
 * Compute annualized volatility: daily_std * sqrt(252)
 */
export async function computeVolatility(symbol: string, days = 120): Promise<number> {
  try {
    const kline = await fetchKlineData(symbol, days);
    const prices = kline.map(k => k.close);
    const returns = calcReturns(prices);
    if (returns.length < 2) return 0;
    const dailyStd = stddev(returns);
    return dailyStd * Math.sqrt(252);
  } catch {
    return 0;
  }
}

/**
 * Compute historical VaR (95% confidence): -percentile(returns, 5)
 */
export async function computeVaR(symbol: string, confidence = 0.95, days = 252): Promise<number> {
  try {
    const kline = await fetchKlineData(symbol, days);
    const prices = kline.map(k => k.close);
    const returns = calcReturns(prices);
    if (returns.length < 20) return 0;

    // Sort returns
    const sorted = [...returns].sort((a, b) => a - b);
    const idx = Math.floor((1 - confidence) * sorted.length);
    return -sorted[idx] * Math.sqrt(252); // annualized
  } catch {
    return 0;
  }
}

/**
 * Compute max drawdown from price series
 */
function computeMaxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0;
  let maxDD = 0;
  let peak = prices[0];
  for (const price of prices) {
    if (price > peak) peak = price;
    const dd = (peak - price) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

/**
 * Get industry for a symbol (mock data)
 */
export function getIndustry(symbol: string): string {
  return INDUSTRY_MAP[symbol] || '其他';
}

/**
 * Get market cap tier
 */
export function getMarketCapTier(symbol: string): 'small' | 'mid' | 'large' | 'mega' {
  return MARKET_CAP_MAP[symbol] || 'mid';
}

/**
 * Calculate position-level risk metrics
 */
export async function computePositionRisk(
  position: Position,
  totalValue: number,
  indexSymbol = 'SPY'
): Promise<PositionRisk> {
  const [beta, volatility, var95] = await Promise.all([
    computeBeta(position.symbol, indexSymbol),
    computeVolatility(position.symbol),
    computeVaR(position.symbol),
  ]);

  // Max drawdown calculation
  let maxDD = 0;
  try {
    const kline = await fetchKlineData(position.symbol, 120);
    const prices = kline.map(k => k.close);
    maxDD = computeMaxDrawdown(prices);
  } catch {
    maxDD = 0;
  }

  return {
    symbol: position.symbol,
    name: position.name,
    weight: totalValue > 0 ? position.market_value / totalValue : 0,
    beta,
    volatility,
    var95,
    maxDrawdown: maxDD,
  };
}

/**
 * Calculate portfolio-level risk metrics (weighted average)
 */
export function computePortfolioRisk(positions: PositionRisk[]): PortfolioRisk {
  if (positions.length === 0) {
    return { beta: 1, volatility: 0, var95: 0, totalValue: 0 };
  }

  const totalWeight = positions.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight === 0) return { beta: 1, volatility: 0, var95: 0, totalValue: 0 };

  const beta = positions.reduce((sum, p) => sum + p.beta * p.weight, 0) / totalWeight;
  const volatility = positions.reduce((sum, p) => sum + p.volatility * p.weight, 0) / totalWeight;
  const var95 = positions.reduce((sum, p) => sum + p.var95 * p.weight, 0) / totalWeight;
  const totalValue = positions.reduce((sum, p) => sum + p.weight, 0);

  return { beta, volatility, var95, totalValue };
}

/**
 * Calculate PnL contribution for each position
 * Contribution = (position_return * weight) / total_portfolio_return
 */
export function computePnLContribution(
  positions: Position[],
  totalReturn: number,
  totalValue: number
): ContributionItem[] {
  return positions.map(pos => {
    const ret = pos.profit_loss_pct / 100;
    const weight = totalValue > 0 ? pos.market_value / totalValue : 0;
    const contribution = totalReturn !== 0 ? (ret * weight) / totalReturn : 0;
    return {
      symbol: pos.symbol,
      name: pos.name,
      weight: pos.market_value,
      return: ret,
      contribution,
    };
  }).sort((a, b) => b.contribution - a.contribution);
}

/**
 * Calculate risk parity weights
 * Each asset contributes equally to portfolio risk
 * Risk contribution = weight * beta / sum(weight * beta)
 */
export function computeRiskParityWeights(positions: PositionRisk[]): RebalanceItem[] {
  if (positions.length === 0) return [];

  const totalBetaWeight = positions.reduce((sum, p) => sum + p.weight * p.beta, 0);
  if (totalBetaWeight === 0) {
    // Fallback to equal weight
    const eq = 100 / positions.length;
    return positions.map(p => ({
      symbol: p.symbol,
      name: p.name,
      currentWeight: p.weight * 100,
      targetWeight: eq,
      change: eq - p.weight * 100,
      action: Math.abs(eq - p.weight * 100) < 1 ? 'hold' : eq > p.weight * 100 ? 'buy' : 'sell',
    }));
  }

  return positions.map(p => {
    const riskContrib = p.weight * p.beta / totalBetaWeight;
    const targetWeight = riskContrib * 100;
    const currentWeight = p.weight * 100;
    const change = targetWeight - currentWeight;
    return {
      symbol: p.symbol,
      name: p.name,
      currentWeight,
      targetWeight,
      change,
      action: Math.abs(change) < 1 ? 'hold' : change > 0 ? 'buy' : 'sell',
    };
  });
}

/**
 * Calculate HHI (Herfindahl-Hirschman Index) for concentration
 */
export function calculateHHI(positions: Position[], totalValue: number): number {
  if (totalValue === 0 || positions.length === 0) return 0;
  return positions.reduce((sum, p) => {
    const w = p.market_value / totalValue;
    return sum + w * w;
  }, 0);
}

/**
 * Calculate top 5 concentration
 */
export function calculateTop5Concentration(positions: Position[], totalValue: number): number {
  if (totalValue === 0 || positions.length === 0) return 0;
  const sorted = [...positions].sort((a, b) => b.market_value - a.market_value);
  const top5 = sorted.slice(0, 5);
  return top5.reduce((sum, p) => sum + p.market_value, 0) / totalValue;
}

/**
 * Aggregate positions by industry
 */
export function aggregateByIndustry(
  positions: Position[]
): { industry: string; value: number; count: number }[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const pos of positions) {
    const industry = getIndustry(pos.symbol);
    const existing = map.get(industry) || { value: 0, count: 0 };
    map.set(industry, {
      value: existing.value + pos.market_value,
      count: existing.count + 1,
    });
  }
  return Array.from(map.entries())
    .map(([industry, data]) => ({ industry, ...data }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Aggregate positions by market cap tier
 */
export function aggregateByMarketCap(
  positions: Position[]
): { tier: string; value: number; count: number }[] {
  const tiers = ['small', 'mid', 'large', 'mega'] as const;
  const map = new Map<string, { value: number; count: number }>();
  for (const tier of tiers) {
    map.set(tier, { value: 0, count: 0 });
  }
  for (const pos of positions) {
    const tier = getMarketCapTier(pos.symbol);
    const existing = map.get(tier)!;
    map.set(tier, {
      value: existing.value + pos.market_value,
      count: existing.count + 1,
    });
  }
  return tiers
    .filter(t => (map.get(t)?.count ?? 0) > 0)
    .map(tier => ({ tier, ...map.get(tier)! }));
}
