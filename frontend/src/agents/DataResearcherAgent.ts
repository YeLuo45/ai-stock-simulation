// Data Researcher Agent - Main agent for fetching and validating market data
import type { StockQuote, FinancialData, NewsItem, ResearchResult, DataType } from '../types/DataSource';
import { dataSourceRegistry } from '../services/DataSourceRegistry';
import { newsResearcherAgent } from './NewsResearcherAgent';

export class DataResearcherAgent {
  private static instance: DataResearcherAgent;

  private constructor() {}

  static getInstance(): DataResearcherAgent {
    if (!DataResearcherAgent.instance) {
      DataResearcherAgent.instance = new DataResearcherAgent();
    }
    return DataResearcherAgent.instance;
  }

  /**
   * Main research method - fetch all requested data types for a stock
   */
  async research(stockCode: string, dataTypes: DataType[] = ['quote', 'financial', 'news']): Promise<ResearchResult> {
    const result: ResearchResult = {
      stockCode,
      news: [],
      dataQuality: { score: 100, issues: [] },
      fetchedAt: Date.now(),
    };

    const issues: string[] = [];

    // Fetch quote
    if (dataTypes.includes('quote')) {
      try {
        const quote = await dataSourceRegistry.getQuote(stockCode);
        if (quote) {
          result.quote = quote;
          // Check data quality
          const quoteQuality = this.assessQuoteQuality(quote);
          if (quoteQuality.issues.length > 0) {
            issues.push(...quoteQuality.issues);
          }
        } else {
          issues.push('行情数据获取失败');
        }
      } catch (err) {
        issues.push('行情数据异常');
      }
    }

    // Fetch financial data
    if (dataTypes.includes('financial')) {
      try {
        const financial = await dataSourceRegistry.getFinancial(stockCode);
        if (financial) {
          result.financial = financial;
        } else {
          issues.push('财务数据获取失败');
        }
      } catch (err) {
        issues.push('财务数据异常');
      }
    }

    // Fetch news
    if (dataTypes.includes('news')) {
      try {
        const news = await newsResearcherAgent.research(stockCode);
        result.news = news;
      } catch (err) {
        issues.push('新闻数据获取失败');
      }
    }

    // Calculate overall quality score
    result.dataQuality = this.assessQuality(result, issues);

    return result;
  }

  /**
   * Fetch quote only
   */
  async fetchQuote(code: string): Promise<StockQuote | null> {
    return dataSourceRegistry.getQuote(code);
  }

  /**
   * Fetch financial data only
   */
  async fetchFinancial(code: string): Promise<FinancialData | null> {
    return dataSourceRegistry.getFinancial(code);
  }

  /**
   * Fetch news only
   */
  async fetchNews(code: string): Promise<NewsItem[]> {
    return newsResearcherAgent.research(code);
  }

  /**
   * Assess data quality
   */
  private assessQuality(data: ResearchResult, issues: string[]): { score: number; issues: string[] } {
    let score = 100;

    // Base score on data completeness
    if (!data.quote) {
      score -= 40;
      issues.push('缺少行情数据');
    }
    if (!data.financial) {
      score -= 30;
      issues.push('缺少财务数据');
    }
    if (data.news.length === 0) {
      score -= 20;
      issues.push('缺少新闻数据');
    }

    // Check data freshness
    const maxAge = 5 * 60 * 1000; // 5 minutes
    if (data.quote && Date.now() - data.quote.timestamp > maxAge) {
      score -= 10;
      issues.push('行情数据可能过期');
    }

    // Check for obvious anomalies
    if (data.quote) {
      const q = data.quote;
      if (q.price <= 0) {
        score -= 20;
        issues.push('价格数据异常');
      }
      if (q.volume < 0) {
        score -= 10;
        issues.push('成交量数据异常');
      }
    }

    if (data.financial) {
      const f = data.financial;
      if (f.pe < 0 && f.pe !== -1) { // -1 means亏损
        score -= 10;
        issues.push('市盈率数据异常');
      }
      if (f.marketCap <= 0) {
        score -= 10;
        issues.push('市值数据异常');
      }
    }

    // News quality
    const now = Date.now();
    const staleNews = data.news.filter(n => now - n.timestamp > 24 * 60 * 60 * 1000);
    if (staleNews.length > data.news.length / 2) {
      score -= 10;
      issues.push('部分新闻数据过旧');
    }

    score = Math.max(0, Math.min(100, score));

    return { score, issues: [...new Set(issues)] };
  }

  /**
   * Assess quote data quality specifically
   */
  private assessQuoteQuality(quote: StockQuote): { score: number; issues: string[] } {
    const issues: string[] = [];

    if (!quote.code) issues.push('股票代码为空');
    if (!quote.name) issues.push('股票名称为空');
    if (quote.price <= 0) issues.push('价格异常');
    if (quote.volume < 0) issues.push('成交量异常');
    if (quote.high < quote.low) issues.push('最高价低于最低价');
    if (quote.open <= 0) issues.push('开盘价异常');
    if (quote.close <= 0) issues.push('收盘价异常');

    // Check for stale data (if market is closed, quote may be from last trading day)
    const now = Date.now();
    const quoteAge = now - quote.timestamp;
    const marketOpen = this.isMarketOpen();

    if (!marketOpen && quoteAge > 24 * 60 * 60 * 1000) {
      issues.push('数据可能来自非交易日');
    }

    const score = Math.max(0, 100 - issues.length * 10);

    return { score, issues };
  }

  /**
   * Check if Chinese market is currently open
   * Trading hours: 9:30-11:30, 13:00-15:00 CST (UTC+8)
   */
  private isMarketOpen(): boolean {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday

    if (day === 0 || day === 6) return false;

    const currentMinutes = hours * 60 + minutes;

    // Morning session: 9:30-11:30
    const morningOpen = 9 * 60 + 30;
    const morningClose = 11 * 60 + 30;

    // Afternoon session: 13:00-15:00
    const afternoonOpen = 13 * 60;
    const afternoonClose = 15 * 60;

    return (currentMinutes >= morningOpen && currentMinutes <= morningClose) ||
           (currentMinutes >= afternoonOpen && currentMinutes <= afternoonClose);
  }

  /**
   * Format data for analyst consumption
   */
  formatForAnalyst(data: ResearchResult): Record<string, any> {
    return {
      stock: {
        code: data.stockCode,
        name: data.quote?.name || '未知',
        price: data.quote?.price || 0,
        change: data.quote?.change || 0,
        changePercent: data.quote?.changePercent || 0,
        volume: data.quote?.volume || 0,
        amount: data.quote?.amount || 0,
        high: data.quote?.high || 0,
        low: data.quote?.low || 0,
      },
      fundamentals: {
        pe: data.financial?.pe || 0,
        pb: data.financial?.pb || 0,
        roe: data.financial?.roe || 0,
        grossMargin: data.financial?.grossMargin || 0,
        marketCap: data.financial?.marketCap || 0,
        revenue: data.financial?.revenue || 0,
        netProfit: data.financial?.netProfit || 0,
      },
      news: data.news.map(n => ({
        title: n.title,
        sentiment: n.sentiment || 'neutral',
        source: n.source,
        timestamp: n.timestamp,
      })),
      dataQuality: data.dataQuality,
      fetchedAt: data.fetchedAt,
    };
  }
}

export const dataResearcherAgent = DataResearcherAgent.getInstance();
