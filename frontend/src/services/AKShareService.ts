// AKShare Service - Wrapper for AKShare HTTP API
import type { StockQuote, FinancialData, NewsItem } from '../types/DataSource';

const CORS_PROXY = 'https://corsproxy.io/?';
const AKSHARE_STOCK_INFO_URL = 'https://akshare.akamily.xyz/api';
const AKSHARE_STOCK_FINANCIAL_URL = 'https://akshare.akamily.xyz/financial';

export class AKShareService {
  private static instance: AKShareService;

  private constructor() {}

  static getInstance(): AKShareService {
    if (!AKShareService.instance) {
      AKShareService.instance = new AKShareService();
    }
    return AKShareService.instance;
  }

  /**
   * Fetch stock quote via AKShare HTTP interface
   */
  async fetchQuote(code: string): Promise<StockQuote | null> {
    try {
      const url = `${AKSHARE_STOCK_INFO_URL}?code=${code}&type=quote`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return this.getMockQuote(code);
      }

      const data = await response.json();

      if (!data || !data.data) {
        return this.getMockQuote(code);
      }

      const d = data.data;
      return {
        code: d.symbol || code,
        name: d.name || this.getStockName(code),
        price: d.price || d.current || 0,
        change: d.change || 0,
        changePercent: d.change_pct || d.pct_change || 0,
        volume: d.volume || 0,
        amount: d.amount || 0,
        high: d.high || 0,
        low: d.low || 0,
        open: d.open || 0,
        close: d.pre_close || d.close || 0,
        timestamp: Date.now(),
      };
    } catch (err) {
      console.warn(`[AKShare] Failed to fetch quote for ${code}:`, err);
      return this.getMockQuote(code);
    }
  }

  /**
   * Fetch financial data via AKShare
   */
  async fetchFinancial(code: string): Promise<FinancialData | null> {
    try {
      const url = `${AKSHARE_STOCK_FINANCIAL_URL}?code=${code}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return this.getMockFinancial(code);
      }

      const data = await response.json();

      if (!data || !data.data) {
        return this.getMockFinancial(code);
      }

      const d = data.data;
      return {
        code,
        pe: d.pe || d.pe_ttm || 0,
        pb: d.pb || d.pb_mrq || 0,
        marketCap: d.market_cap || d.total_market_cap || 0,
        floatCap: d.float_cap || d.float_market_cap || 0,
        revenue: d.revenue || d.operating_revenue || 0,
        netProfit: d.net_profit || d.net_profit_attributable || 0,
        roe: d.roe || 0,
        grossMargin: d.gross_margin || d.gross_profit_margin || 0,
        timestamp: Date.now(),
      };
    } catch (err) {
      console.warn(`[AKShare] Failed to fetch financial for ${code}:`, err);
      return this.getMockFinancial(code);
    }
  }

  /**
   * Fetch stock list with basic info
   */
  async fetchStockList(market: '上海' | '深圳' = '上海'): Promise<Array<{ code: string; name: string }>> {
    try {
      const marketCode = market === '上海' ? 'sh' : 'sz';
      const url = `${AKSHARE_STOCK_INFO_URL}?type=list&market=${marketCode}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return this.getMockStockList();
      }

      const data = await response.json();
      return data?.data || this.getMockStockList();
    } catch (err) {
      console.warn(`[AKShare] Failed to fetch stock list:`, err);
      return this.getMockStockList();
    }
  }

  /**
   * Fetch index components
   */
  async fetchIndexComponents(code: string = '000300'): Promise<string[]> {
    try {
      const url = `${AKSHARE_STOCK_INFO_URL}?type=index&code=${code}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data?.data || [];
    } catch (err) {
      console.warn(`[AKShare] Failed to fetch index components:`, err);
      return [];
    }
  }

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

  private getMockStockList(): Array<{ code: string; name: string }> {
    return [
      { code: '600000', name: '浦发银行' },
      { code: '600036', name: '招商银行' },
      { code: '600519', name: '贵州茅台' },
      { code: '000001', name: '平安银行' },
      { code: '000002', name: '万科A' },
    ];
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

export const akshareService = AKShareService.getInstance();
