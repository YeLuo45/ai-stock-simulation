/**
 * Symbol utilities for China A-Stocks (EastMoney format)
 */

/**
 * Market code mapping for EastMoney API
 * 上证=1, 深证=0, 北交所=8
 */
export const MARKET_CODE_MAP: Record<string, number> = {
  sh: 1,  // 上海
  sz: 0,  // 深圳
  bj: 8,  // 北京
};

/**
 * Reverse market code mapping
 */
export const CODE_TO_MARKET: Record<number, string> = {
  1: 'sh',
  0: 'sz',
  8: 'bj',
};

/**
 * Parse a stock symbol into market and code components
 * "600519" or "sh600519" or "1.600519" → {market: 'sh', code: '600519'}
 */
export function parseSymbol(raw: string): { market: 'sh' | 'sz' | 'bj'; code: string } {
  const trimmed = raw.trim().toLowerCase();
  
  // Already formatted as "sh600519" or "sz000001" or "bj8xxxx"
  if (trimmed.startsWith('sh') || trimmed.startsWith('sz') || trimmed.startsWith('bj')) {
    const market = trimmed.slice(0, 2) as 'sh' | 'sz' | 'bj';
    const code = trimmed.slice(2);
    return { market, code };
  }
  
  // EastMoney secid format "1.600519" or "0.000001" or "8.8xxxx"
  if (trimmed.includes('.')) {
    const [marketCode, code] = trimmed.split('.');
    const market = CODE_TO_MARKET[parseInt(marketCode)] as 'sh' | 'sz' | 'bj';
    if (market && code) {
      return { market, code };
    }
  }
  
  // Plain code "600519" - auto-detect market based on prefix
  const cleanCode = trimmed.replace(/\D/g, '');
  
  if (cleanCode.startsWith('8') || cleanCode.startsWith('4')) {
    // Beijing stock (4xxxxxx or 8xxxxxx)
    return { market: 'bj', code: cleanCode };
  } else if (cleanCode.startsWith('6')) {
    // Shanghai stock
    return { market: 'sh', code: cleanCode };
  } else if (cleanCode.startsWith('0') || cleanCode.startsWith('3')) {
    // Shenzhen stock
    return { market: 'sz', code: cleanCode };
  }
  
  // Default to Shanghai
  return { market: 'sh', code: cleanCode };
}

/**
 * Format a market and code into standard symbol format
 * ('sh', '600519') → 'sh600519'
 */
export function formatSymbol(market: string, code: string): string {
  return `${market}${code}`.toLowerCase();
}

/**
 * Get EastMoney secid format from symbol
 * 'sh600519' → '1.600519'
 * 'sz000001' → '0.000001'
 * 'bj8xxxx' → '8.8xxxx'
 */
export function getSecid(symbol: string): string {
  const { market, code } = parseSymbol(symbol);
  const marketCode = MARKET_CODE_MAP[market];
  return `${marketCode}.${code}`;
}

/**
 * Check if a symbol is a China A-stock
 * Supports: shxxxxxx, szxxxxxx, bjxxxxxx, 6xxxxxx, 0/3xxxxxx, 4/8xxxxxx
 */
export function isChinaStock(symbol: string): boolean {
  const trimmed = symbol.trim().toLowerCase();
  
  // Already prefixed
  if (trimmed.startsWith('sh') || trimmed.startsWith('sz') || trimmed.startsWith('bj')) {
    return true;
  }
  
  // EastMoney secid format
  if (trimmed.includes('.')) {
    const [marketCode] = trimmed.split('.');
    return ['0', '1', '8'].includes(marketCode);
  }
  
  // Plain code - check if 6-digit
  const cleanCode = trimmed.replace(/\D/g, '');
  if (cleanCode.length === 6) {
    const firstDigit = cleanCode[0];
    // 6 = Shanghai, 0/3 = Shenzhen, 4/8 = Beijing
    return ['6', '0', '3', '4', '8'].includes(firstDigit);
  }
  
  return false;
}

/**
 * Convert a China stock symbol to Yahoo Finance format
 * 'sh600519' → '600519.SS'
 * 'sz000001' → '000001.SZ'
 */
export function toYahooSymbol(symbol: string): string {
  const { market, code } = parseSymbol(symbol);
  const suffix = market === 'sh' ? 'SS' : market === 'sz' ? 'SZ' : 'BJ';
  return `${code}.${suffix}`;
}

/**
 * Normalize any symbol format to sh/sz/bj prefix format
 */
export function normalizeSymbol(symbol: string): string {
  if (isChinaStock(symbol)) {
    const { market, code } = parseSymbol(symbol);
    return formatSymbol(market, code);
  }
  // For non-China stocks, return as-is
  return symbol;
}
