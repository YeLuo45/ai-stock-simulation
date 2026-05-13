// Eastmoney Service - Real-time market data from Eastmoney API
import type { StockQuote, FinancialData, NewsItem } from '../types/DataSource';

const CORS_PROXY = 'https://corsproxy.io/?';
const EASTMONEY_REALTIME_URL = 'https://push2.eastmoney.com/api/qt/stock/get';
const EASTMONEY_FINANCIAL_URL = 'https://datacenter.eastmoney.com/securities/api/data/v1/get';
const EASTMONEY_NEWS_URL = 'https://np-anotice-stock.eastmoney.com/api/security/ann';

export interface EastmoneyQuoteResponse {
  data: {
    f43: number;  // 最新价
    f44: number;  // 最高
    f45: number;  // 最低
    f46: number;  // 今开
    f47: number;  // 成交量
    f48: number;  // 成交额
    f50: number;  // 涨跌额
    f51: number;  // 涨跌幅
    f57: string;  // 代码
    f58: string;  // 名称
    f107: number; // 昨收
  };
}

export interface EastmoneyFinancialResponse {
  result: {
    data: Array<{
      security_code: string;
      security_name: string;
      pe_ttm: number;
      pb_mrq: number;
      total_market_cap: number;
      float_market_cap: number;
      operating_revenue: number;
      net_profit: number;
      roe: number;
      gross_margin: number;
    }>;
  };
}

export class EastmoneyService {
  private static instance: EastmoneyService;
  private corsProxy: string;

  private constructor() {
    this.corsProxy = CORS_PROXY;
  }

  static getInstance(): EastmoneyService {
    if (!EastmoneyService.instance) {
      EastmoneyService.instance = new EastmoneyService();
    }
    return EastmoneyService.instance;
  }

  /**
   * Fetch real-time quote for a single stock
   */
  async fetchQuote(code: string): Promise<StockQuote | null> {
    try {
      // Normalize stock code (add suffix if needed)
      const normalizedCode = this.normalizeCode(code);
      const fields = 'f43,f44,f45,f46,f47,f48,f50,f51,f57,f58,f107';
      const url = `${this.corsProxy}${encodeURIComponent(
        `${EASTMONEY_REALTIME_URL}?fields=${fields}&secid=${normalizedCode}`
      )}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[Eastmoney] HTTP ${response.status} for ${code}`);
        return this.getMockQuote(code);
      }

      const data: EastmoneyQuoteResponse = await response.json();

      if (!data?.data) {
        console.warn(`[Eastmoney] No data for ${code}, using mock`);
        return this.getMockQuote(code);
      }

      const d = data.data;
      return {
        code: d.f57,
        name: d.f58,
        price: d.f43 / 100,
        change: d.f50 / 100,
        changePercent: d.f51 / 100,
        volume: d.f47,
        amount: d.f48,
        high: d.f44 / 100,
        low: d.f45 / 100,
        open: d.f46 / 100,
        close: d.f107 / 100,
        timestamp: Date.now(),
      };
    } catch (err) {
      console.warn(`[Eastmoney] Failed to fetch quote for ${code}:`, err);
      return this.getMockQuote(code);
    }
  }

  /**
   * Fetch financial data for a stock
   */
  async fetchFinancial(code: string): Promise<FinancialData | null> {
    try {
      const normalizedCode = this.normalizeCode(code);
      const url = `${this.corsProxy}${encodeURIComponent(
        `${EASTMONEY_FINANCIAL_URL}?reportName=RPT_LICO_FN_CPD&columns=security_code,security_name,pe_ttm,pb_mrq,total_market_cap,float_market_cap,operating_revenue,net_profit,roe,gross_margin&filter=security_code="${normalizedCode}"`
      )}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[Eastmoney] Financial HTTP ${response.status} for ${code}`);
        return this.getMockFinancial(code);
      }

      const data: EastmoneyFinancialResponse = await response.json();
      const item = data?.result?.data?.[0];

      if (!item) {
        return this.getMockFinancial(code);
      }

      return {
        code: item.security_code,
        pe: item.pe_ttm || 0,
        pb: item.pb_mrq || 0,
        marketCap: item.total_market_cap || 0,
        floatCap: item.float_market_cap || 0,
        revenue: item.operating_revenue || 0,
        netProfit: item.net_profit || 0,
        roe: item.roe || 0,
        grossMargin: item.gross_margin || 0,
        timestamp: Date.now(),
      };
    } catch (err) {
      console.warn(`[Eastmoney] Failed to fetch financial for ${code}:`, err);
      return this.getMockFinancial(code);
    }
  }

  /**
   * Fetch news for a stock
   */
  async fetchNews(code: string, limit: number = 5): Promise<NewsItem[]> {
    try {
      const normalizedCode = this.normalizeCode(code);
      const url = `${this.corsProxy}${encodeURIComponent(
        `${EASTMONEY_NEWS_URL}?sr=-1&page_size=${limit}&page_index=1&ann_type=A&client_source=web&f_node=0&s_node=0&stock_list=${normalizedCode}`
      )}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return this.getMockNews(code);
      }

      const data = await response.json();
      const list = data?.data?.list || [];

      if (list.length === 0) {
        return this.getMockNews(code);
      }

      return list.map((item: any, index: number) => ({
        id: `em_${item.id || code}_${index}`,
        title: item.title || '无标题',
        summary: item.summary || item.notice_content || '',
        source: item.media_name || '东方财富',
        url: item.art_url || `https://finance.eastmoney.com/news/${item.id}.html`,
        timestamp: item.publish_time ? item.publish_time * 1000 : Date.now(),
        sentiment: this.analyzeSentiment(item.title + ' ' + (item.summary || '')),
        relatedCodes: [code],
      }));
    } catch (err) {
      console.warn(`[Eastmoney] Failed to fetch news for ${code}:`, err);
      return this.getMockNews(code);
    }
  }

  /**
   * Normalize stock code to Eastmoney format (secid)
   * A股: 1.600000 (上海) 或 0.000001 (深圳)
   */
  private normalizeCode(code: string): string {
    const cleanCode = code.replace(/[^\d]/g, '');

    // 判断沪市或深市
    if (cleanCode.startsWith('6')) {
      return `1.${cleanCode}`;
    } else if (cleanCode.startsWith('0') || cleanCode.startsWith('3')) {
      return `0.${cleanCode}`;
    }
    // 默认按沪市处理
    return `1.${cleanCode}`;
  }

  /**
   * Simple sentiment analysis based on keywords
   */
  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positive = ['涨', '升', '增长', '盈利', '突破', '利好', '增持', '买入', '看涨', '新高'];
    const negative = ['跌', '降', '亏损', '利空', '减持', '卖出', '看跌', '新低', '风险', '预警'];

    const lower = text.toLowerCase();
    let pos = 0, neg = 0;
    positive.forEach(w => { if (lower.includes(w)) pos++; });
    negative.forEach(w => { if (lower.includes(w)) neg++; });

    if (pos > neg) return 'positive';
    if (neg > pos) return 'negative';
    return 'neutral';
  }

  /**
   * Generate mock quote data when API fails
   */
  private getMockQuote(code: string): StockQuote {
    const basePrice = Math.random() * 100 + 10;
    const change = (Math.random() - 0.5) * 10;
    return {
      code,
      name: this.getStockName(code),
      price: basePrice,
      change,
      changePercent: change / basePrice * 100,
      volume: Math.floor(Math.random() * 10000000),
      amount: Math.floor(Math.random() * 100000000),
      high: basePrice + Math.random() * 5,
      low: basePrice - Math.random() * 5,
      open: basePrice + (Math.random() - 0.5) * 2,
      close: basePrice - change,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate mock financial data when API fails
   */
  private getMockFinancial(code: string): FinancialData {
    return {
      code,
      pe: Math.random() * 30 + 5,
      pb: Math.random() * 5 + 0.5,
      marketCap: Math.random() * 10000000000,
      floatCap: Math.random() * 5000000000,
      revenue: Math.random() * 1000000000,
      netProfit: Math.random() * 100000000,
      roe: Math.random() * 20,
      grossMargin: Math.random() * 40 + 10,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate mock news when API fails
   */
  private getMockNews(code: string): NewsItem[] {
    const mockTitles = [
      `${this.getStockName(code)}发布年度财报，营收同比增长`,
      `${this.getStockName(code)}宣布重大战略合作`,
      `券商看好${this.getStockName(code)}，维持增持评级`,
      `${this.getStockName(code)}股价波动加大，注意风险`,
      `机构调研${this.getStockName(code)}，关注业务发展`,
    ];

    return mockTitles.slice(0, 3).map((title, i) => ({
      id: `mock_${code}_${i}`,
      title,
      summary: '该新闻为模拟数据，实际数据请检查网络连接。',
      source: '系统模拟',
      url: '#',
      timestamp: Date.now() - i * 3600000,
      sentiment: i % 3 === 0 ? 'positive' : i % 3 === 1 ? 'neutral' : 'negative',
      relatedCodes: [code],
    }));
  }

  private getStockName(code: string): string {
    const names: Record<string, string> = {
      '600000': '浦发银行',
      '600036': '招商银行',
      '600519': '贵州茅台',
      '000001': '平安银行',
      '000002': '万科A',
      '000858': '五粮液',
    };
    return names[code] || `股票${code}`;
  }
}

export const eastmoneyService = EastmoneyService.getInstance();
