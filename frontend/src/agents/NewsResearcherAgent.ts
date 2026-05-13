// News Researcher Agent - Fetches and analyzes news for stocks
import type { NewsItem } from '../types/DataSource';
import { eastmoneyService } from '../services/EastmoneyService';

export class NewsResearcherAgent {
  private static instance: NewsResearcherAgent;

  private constructor() {}

  static getInstance(): NewsResearcherAgent {
    if (!NewsResearcherAgent.instance) {
      NewsResearcherAgent.instance = new NewsResearcherAgent();
    }
    return NewsResearcherAgent.instance;
  }

  /**
   * Main research method - fetch news for a stock
   */
  async research(stockCode: string, keyword?: string): Promise<NewsItem[]> {
    const allNews: NewsItem[] = [];

    try {
      // Fetch from Eastmoney
      const eastmoneyNews = await this.fetchEastmoneyNews(stockCode);
      allNews.push(...eastmoneyNews);
    } catch (err) {
      console.warn(`[NewsResearcher] Eastmoney news failed:`, err);
    }

    try {
      // Fetch from Sina (if keyword provided)
      if (keyword) {
        const sinaNews = await this.fetchSinaNews(stockCode, keyword);
        allNews.push(...sinaNews);
      }
    } catch (err) {
      console.warn(`[NewsResearcher] Sina news failed:`, err);
    }

    // Deduplicate by title
    const seen = new Set<string>();
    const uniqueNews = allNews.filter(item => {
      const normalized = item.title.trim();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });

    // Sort by timestamp descending
    uniqueNews.sort((a, b) => b.timestamp - a.timestamp);

    return uniqueNews.slice(0, 10); // Max 10 news items
  }

  /**
   * Fetch news from Eastmoney
   */
  async fetchEastmoneyNews(code: string): Promise<NewsItem[]> {
    try {
      return await eastmoneyService.fetchNews(code, 5);
    } catch (err) {
      console.warn(`[NewsResearcher] Eastmoney fetch failed:`, err);
      return this.getMockNews(code);
    }
  }

  /**
   * Fetch news from Sina
   */
  async fetchSinaNews(code: string, keyword?: string): Promise<NewsItem[]> {
    // Sina news API via CORS proxy
    const CORS_PROXY = 'https://corsproxy.io/?';
    const SINA_NEWS_URL = 'https://feed.mix.sina.com.cn/api/roll/get';

    try {
      const params = new URLSearchParams({
        page: '1',
        num: '5',
        callback: 'handleNews',
        cat: '1',
        node: 'stock',
      });

      if (keyword) {
        params.set('q', keyword);
      }

      const url = `${CORS_PROXY}${encodeURIComponent(`${SINA_NEWS_URL}?${params.toString()}`)}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return [];
      }

      const text = await response.text();
      // Sina returns JSONP format, try to parse
      let data;
      try {
        const jsonStr = text.replace(/^handleNews\(/, '').replace(/\)$/, '');
        data = JSON.parse(jsonStr);
      } catch {
        return [];
      }

      const list = data?.result?.data || [];
      return list.map((item: any, index: number) => ({
        id: `sina_${item.id || index}`,
        title: item.title || '无标题',
        summary: item.intro || item.wb_text || '',
        source: item.media_name || '新浪',
        url: item.url || `https://finance.sina.com.cn/stock/${item.stock_code || code}.shtml`,
        timestamp: item.ctime ? new Date(item.ctime).getTime() : Date.now(),
        sentiment: this.analyzeSentiment(item.title + ' ' + (item.intro || '')),
        relatedCodes: [code],
      }));
    } catch (err) {
      console.warn(`[NewsResearcher] Sina fetch failed:`, err);
      return [];
    }
  }

  /**
   * Analyze sentiment of news title/content
   */
  analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positive = [
      '涨', '升', '增长', '盈利', '突破', '利好', '增持', '买入',
      '看涨', '新高', '业绩', '增长', '合作', '中标', '突破'
    ];
    const negative = [
      '跌', '降', '亏损', '利空', '减持', '卖出', '看跌', '新低',
      '风险', '预警', '警示', '调查', '处罚', '违规', '诉讼'
    ];

    const lower = text.toLowerCase();
    let pos = 0, neg = 0;

    positive.forEach(w => {
      if (lower.includes(w)) pos++;
    });

    negative.forEach(w => {
      if (lower.includes(w)) neg++;
    });

    if (pos > neg) return 'positive';
    if (neg > pos) return 'negative';
    return 'neutral';
  }

  /**
   * Get mock news when all sources fail
   */
  private getMockNews(code: string): NewsItem[] {
    const mockTitles = [
      `${this.getStockName(code)}发布年度财报，营收同比增长15%`,
      `${this.getStockName(code)}宣布重大战略合作，行业地位巩固`,
      `券商看好${this.getStockName(code)}，维持增持评级`,
      `${this.getStockName(code)}股价波动加大，机构提示注意风险`,
      `机构调研${this.getStockName(code)}，关注新能源业务发展`,
    ];

    return mockTitles.slice(0, 5).map((title, i) => ({
      id: `mock_news_${code}_${i}`,
      title,
      summary: '该新闻为模拟数据，实际数据请检查网络连接或CORS代理状态。',
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

export const newsResearcherAgent = NewsResearcherAgent.getInstance();
