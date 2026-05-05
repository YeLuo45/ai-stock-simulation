/**
 * Real-time stock quotes service
 * Uses free public APIs from East Money (东方财富) and Sina Finance
 * 
 * Note: CORS restrictions may apply when calling these APIs directly from browser
 * In production, consider using a CORS proxy or backend relay
 */

import type { StockInfo } from "../types";

// ============== Default Stocks (Fallback Data) ==============

export const DEFAULT_STOCKS: StockInfo[] = [
  { symbol: "000001", name: "平安银行", price: 12.35, change_pct: 1.23, volume: 45678900, pe: 6.5, pb: 0.85, market_cap: 2100 },
  { symbol: "000002", name: "万科A", price: 8.92, change_pct: -0.67, volume: 32145600, pe: 8.2, pb: 1.12, market_cap: 1050 },
  { symbol: "600036", name: "招商银行", price: 38.56, change_pct: 0.89, volume: 23456700, pe: 7.8, pb: 1.35, market_cap: 9800 },
  { symbol: "600519", name: "贵州茅台", price: 1688.00, change_pct: 2.15, volume: 1234567, pe: 32.5, pb: 11.2, market_cap: 21200 },
  { symbol: "601318", name: "中国平安", price: 48.23, change_pct: 1.45, volume: 56789000, pe: 9.2, pb: 1.68, market_cap: 8900 },
  { symbol: "000858", name: "五粮液", price: 142.30, change_pct: -1.23, volume: 18923400, pe: 22.5, pb: 5.8, market_cap: 5600 },
  { symbol: "600900", name: "长江电力", price: 23.45, change_pct: 0.34, volume: 9876500, pe: 18.5, pb: 2.45, market_cap: 5200 },
  { symbol: "601888", name: "中国中免", price: 68.90, change_pct: 3.21, volume: 23456700, pe: 28.5, pb: 4.2, market_cap: 1350 },
  { symbol: "000333", name: "美的集团", price: 58.76, change_pct: 0.78, volume: 15678900, pe: 12.5, pb: 3.2, market_cap: 4200 },
  { symbol: "002594", name: "比亚迪", price: 238.50, change_pct: -2.15, volume: 34567800, pe: 45.2, pb: 6.8, market_cap: 6950 },
  { symbol: "600276", name: "恒瑞医药", price: 45.67, change_pct: 1.89, volume: 12345600, pe: 65.5, pb: 8.9, market_cap: 2900 },
  { symbol: "688981", name: "中芯国际", price: 52.30, change_pct: 4.56, volume: 78923400, pe: 78.5, pb: 4.5, market_cap: 4200 },
  { symbol: "300750", name: "宁德时代", price: 192.45, change_pct: 2.34, volume: 23456700, pe: 35.2, pb: 5.8, market_cap: 8500 },
  { symbol: "600009", name: "上海机场", price: 52.18, change_pct: -0.45, volume: 8765400, pe: 28.5, pb: 3.2, market_cap: 980 },
  { symbol: "601166", name: "兴业银行", price: 17.23, change_pct: 0.67, volume: 34567800, pe: 4.8, pb: 0.72, market_cap: 3600 },
];

// Cache for stock prices (in-memory)
const priceCache: Map<string, { price: number; timestamp: number }> = new Map();
const CACHE_TTL = 10000; // 10 seconds cache

// ============== East Money API ==============

/**
 * Get real-time quote from East Money (东方财富)
 * API: https://push2.eastmoney.com/api/qt/stock/get
 */
async function fetchFromEastMoney(symbol: string): Promise<StockInfo | null> {
  try {
    // Normalize symbol for A-shares
    let market = "";
    if (symbol.startsWith("6")) {
      market = "1"; // Shanghai
    } else if (symbol.startsWith("0") || symbol.startsWith("3")) {
      market = "0"; // Shenzhen
    } else if (symbol.startsWith("4") || symbol.startsWith("8")) {
      market = "0"; // Beijing
    } else {
      return null;
    }

    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${market}.${symbol}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f107,f169,f170,f171`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Referer": "https://quote.eastmoney.com/",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const d = data.data;

    if (!d) return null;

    return {
      symbol: symbol,
      name: d.f58 || symbol,
      price: parseFloat((d.f43 / 100).toFixed(2)), // Current price (divided by 100)
      change_pct: parseFloat((d.f170 / 100).toFixed(2)), // Change percent
      volume: d.f48 || 0,
      pe: d.f162 ? parseFloat((d.f162 / 100).toFixed(2)) : undefined,
      pb: d.f167 ? parseFloat((d.f167 / 100).toFixed(2)) : undefined,
      market_cap: d.f116 ? d.f116 / 100000000 : undefined, // Convert to 亿
    };
  } catch (err) {
    console.warn(`East Money API failed for ${symbol}:`, err);
    return null;
  }
}

// ============== Sina Finance API ==============

/**
 * Get real-time quote from Sina Finance
 * API: https://hq.sinajs.cn/list=sh600519
 */
async function fetchFromSina(symbol: string): Promise<StockInfo | null> {
  try {
    // Normalize symbol for Sina (sh prefix for Shanghai, sz for Shenzhen)
    let prefix = "";
    if (symbol.startsWith("6")) {
      prefix = "sh";
    } else if (symbol.startsWith("0") || symbol.startsWith("3")) {
      prefix = "sz";
    } else {
      return null;
    }

    const url = `https://hq.sinajs.cn/list=${prefix}${symbol}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Referer": "https://finance.sina.com.cn/",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const text = await response.text();
    // Parse: var hq_str_sh600519="贵州茅台,1688.00,1695.00,1675.00,1690.00,1685.00,1688.00,1688.00,1234567,..."
    const match = text.match(/"([^"]+)"/);
    if (!match) return null;

    const fields = match[1].split(",");
    if (fields.length < 32) return null;

    const price = parseFloat(fields[3]); // Current price
    const yesterdayClose = parseFloat(fields[2]);
    const changePct = ((price - yesterdayClose) / yesterdayClose) * 100;

    return {
      symbol: symbol,
      name: fields[0],
      price: price,
      change_pct: parseFloat(changePct.toFixed(2)),
      volume: parseInt(fields[8]) || 0,
    };
  } catch (err) {
    console.warn(`Sina API failed for ${symbol}:`, err);
    return null;
  }
}

// ============== Public API Functions ==============

/**
 * Get real-time quote for a single stock
 * Tries East Money first, then Sina, falls back to default data
 */
export async function getStockQuote(symbol: string): Promise<StockInfo> {
  // Check cache first
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { ...DEFAULT_STOCKS.find((s) => s.symbol === symbol) || DEFAULT_STOCKS[0], price: cached.price };
  }

  // Try APIs
  let quote = await fetchFromEastMoney(symbol);
  if (!quote) {
    quote = await fetchFromSina(symbol);
  }

  if (quote) {
    priceCache.set(symbol, { price: quote.price, timestamp: Date.now() });
    return quote;
  }

  // Fallback to default data
  const defaultStock = DEFAULT_STOCKS.find((s) => s.symbol === symbol);
  return defaultStock || DEFAULT_STOCKS[0];
}

/**
 * Get real-time quotes for multiple stocks
 */
export async function getMultipleQuotes(symbols: string[]): Promise<StockInfo[]> {
  // Use Promise.allSettled to handle partial failures
  const results = await Promise.allSettled(symbols.map((s) => getStockQuote(s)));

  return symbols.map((symbol, idx) => {
    const result = results[idx];
    if (result.status === "fulfilled") {
      return result.value;
    }
    return DEFAULT_STOCKS.find((s) => s.symbol === symbol) || DEFAULT_STOCKS[0];
  });
}

/**
 * Search stocks by keyword (name or symbol)
 * Uses default stocks as fallback, can be extended with search APIs
 */
export async function searchStocks(keyword: string): Promise<StockInfo[]> {
  const kw = keyword.toLowerCase();
  return DEFAULT_STOCKS.filter(
    (s) => s.name.toLowerCase().includes(kw) || s.symbol.includes(kw)
  );
}

/**
 * Get all available stocks (default list)
 */
export function getDefaultStocks(): StockInfo[] {
  return [...DEFAULT_STOCKS];
}

/**
 * Clear price cache (useful for forcing refresh)
 */
export function clearPriceCache(): void {
  priceCache.clear();
}
