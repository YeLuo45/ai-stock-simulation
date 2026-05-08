/**
 * Yahoo Finance API adapter for real stock data
 */

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

/**
 * Normalize China stock code to Yahoo Finance format
 */
export function normalizeSymbol(code: string): string {
  const c = code.trim().toUpperCase();
  if (c.endsWith('.SS') || c.endsWith('.SZ') || c.endsWith('.HK') || c.endsWith('.KS') || c.endsWith('.T')) return c;
  // A shares: 6-digit numbers
  if (/^\d{6}$/.test(c)) {
    const num = parseInt(c);
    if (num >= 600000 && num < 605000) return `${c}.SS`;
    if (num >= 688000) return `${c}.SS`;
    if ((num >= 0 && num < 400000) || (num >= 300000 && num < 400000)) return `${c}.SZ`;
  }
  // HK: 4-5 digits
  if (/^\d{4,5}$/.test(c)) return `${c}.HK`;
  return c;
}

/**
 * Fetch historical K-line data from Yahoo Finance
 */
export async function fetchKlineData(
  symbol: string,
  days = 120,
  interval: '1d' | '1wk' | '1mo' = '1d'
): Promise<{ date: string; open: number; high: number; low: number; close: number; volume: number }[]> {
  const normalized = normalizeSymbol(symbol);
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - days * 24 * 60 * 60;

  const url = `${BASE_URL}/${normalized}?period1=${startDate}&period2=${endDate}&interval=${interval}&events=history`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.chart?.error) {
    throw new Error(data.chart.error.description || 'Unknown error');
  }

  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No data returned');

  const timestamps = result.timestamp as number[];
  const quotes = result.indicators?.quote?.[0];
  if (!timestamps || !quotes) throw new Error('Invalid data format');

  const ohlcv: { date: string; open: number; high: number; low: number; close: number; volume: number }[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
    ohlcv.push({
      date,
      open: quotes.open?.[i] ?? quotes.close?.[i] ?? 0,
      high: quotes.high?.[i] ?? quotes.close?.[i] ?? 0,
      low: quotes.low?.[i] ?? quotes.close?.[i] ?? 0,
      close: quotes.close?.[i] ?? 0,
      volume: quotes.volume?.[i] ?? 0,
    });
  }

  return ohlcv;
}

/**
 * Search stock symbols
 */
export async function searchSymbols(query: string): Promise<{ symbol: string; name: string; exchange: string }[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  return (data.quotes || []).map((q: { symbol: string; shortname?: string; longname?: string; exchange: string }) => ({
    symbol: q.symbol,
    name: q.longname || q.shortname || q.symbol,
    exchange: q.exchange || 'UNKNOWN',
  }));
}

/**
 * Get fundamental data for a stock (PE, PB, market cap, etc.)
 */
export async function fetchFundamentalData(symbol: string): Promise<{
  pe?: number;
  pb?: number;
  marketCap?: number;
  dividendYield?: number;
  week52High?: number;
  week52Low?: number;
  volume?: number;
  avgVolume?: number;
  eps?: number;
  beta?: number;
}> {
  const normalized = normalizeSymbol(symbol);
  const url = `${BASE_URL}/${normalized}?interval=1d&range=5d`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No data');

  const meta = result.meta;
  return {
    pe: meta.trailingPE,
    pb: meta.priceToBook,
    marketCap: meta.marketCap,
    dividendYield: meta.dividendYield,
    week52High: meta.fiftyTwoWeekHigh,
    week52Low: meta.fiftyTwoWeekLow,
    volume: meta.regularMarketVolume,
    avgVolume: meta.averageDailyVolume10Day || meta.averageVolume10d,
    eps: meta.trailingEps,
    beta: meta.beta,
  };
}

/**
 * Get realtime quote
 */
export async function getRealtimeQuote(symbol: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  beta: number;
}> {
  const normalized = normalizeSymbol(symbol);
  const url = `${BASE_URL}/${normalized}?interval=1d&range=1d`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No data');

  const meta = result.meta;
  const quotes = result.indicators?.quote?.[0];

  return {
    price: meta.regularMarketPrice || 0,
    change: meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose || 0),
    changePercent: ((meta.regularMarketPrice - (meta.previousClose || 0)) / (meta.previousClose || 1)) * 100,
    volume: meta.regularMarketVolume || 0,
    high: quotes?.high?.[quotes.high.length - 1] || meta.regularMarketDayHigh || 0,
    low: quotes?.low?.[quotes.low.length - 1] || meta.regularMarketDayLow || 0,
    open: quotes?.open?.[quotes.open.length - 1] || meta.regularMarketOpen || 0,
    previousClose: meta.chartPreviousClose || meta.previousClose || 0,
    beta: meta.beta || 1,
  };
}

/**
 * 获取东方财富个股资讯
 */
export async function fetchStockNews(symbol: string): Promise<Array<{
  title: string;
  pubDate: string;
  url: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}>> {
  // 东方财富资讯API
  const code = normalizeSymbol(symbol); // 000001.SZ -> 000001
  const url = `https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=10&page_index=1&ann_type=SHA%2CSZA&client_source=web&stock_list=${code}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!response.ok) return [];
    
    const data = await response.json();
    const notices = data?.data?.list || [];
    
    return notices.slice(0, 8).map((n: any) => ({
      title: n.title || n.notice_title || '无标题',
      pubDate: n.publish_time ? new Date(n.publish_time).toLocaleDateString('zh-CN') : '',
      url: n.art_url || n.url || '#',
      sentiment: undefined as 'positive' | 'negative' | 'neutral' | undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * 简单的中文情感分析（基于关键词）
 */
export function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  const positiveWords = ['涨', '盈利', '增长', '突破', '看好', '增持', '买入', '业绩', '利润', '分红', '新高', '超预期', '扭亏为盈', '大幅上涨'];
  const negativeWords = ['跌', '亏损', '下降', '减持', '卖出', '预警', '风险', '违约', '诉讼', '处罚', '造假', '大幅下跌', '业绩下滑', '商誉减值'];
  
  let score = 0;
  for (const word of positiveWords) {
    if (lower.includes(word)) score++;
  }
  for (const word of negativeWords) {
    if (lower.includes(word)) score--;
  }
  
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}
