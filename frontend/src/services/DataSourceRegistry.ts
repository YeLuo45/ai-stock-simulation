// Data Source Registry - Manages multiple data sources with caching and failover
import type { StockQuote, FinancialData, NewsItem, DataSourceStatus, CacheEntry, DataType } from '../types/DataSource';
import { eastmoneyService } from './EastmoneyService';
import { akshareService } from './AKShareService';

const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

interface RegistryConfig {
  sources: Array<{
    id: string;
    name: string;
    type: 'eastmoney' | 'akshare' | 'mock';
    enabled: boolean;
    priority: number;
  }>;
  cacheTTL: number;
}

export class DataSourceRegistry {
  private static instance: DataSourceRegistry;

  // Cache: key -> { data, timestamp, ttl }
  private cache: Map<string, CacheEntry<any>> = new Map();

  // Source status tracking
  private sourceStatus: Map<string, DataSourceStatus> = new Map();

  // Configuration
  private config: RegistryConfig = {
    sources: [
      { id: 'eastmoney', name: '东方财富', type: 'eastmoney', enabled: true, priority: 1 },
      { id: 'akshare', name: 'AKShare', type: 'akshare', enabled: true, priority: 2 },
      { id: 'mock', name: '模拟数据', type: 'mock', enabled: true, priority: 99 },
    ],
    cacheTTL: CACHE_TTL,
  };

  private constructor() {
    // Initialize status for all sources
    this.config.sources.forEach(s => {
      this.sourceStatus.set(s.id, {
        source: s.name,
        status: 'disabled',
      });
    });
  }

  static getInstance(): DataSourceRegistry {
    if (!DataSourceRegistry.instance) {
      DataSourceRegistry.instance = new DataSourceRegistry();
    }
    return DataSourceRegistry.instance;
  }

  /**
   * Get quote with automatic source failover and caching
   */
  async getQuote(code: string): Promise<StockQuote | null> {
    const cacheKey = `quote_${code}`;

    // Check cache first
    const cached = this.getCached<StockQuote>(cacheKey);
    if (cached) {
      return cached;
    }

    // Try sources in priority order
    const sortedSources = [...this.config.sources]
      .filter(s => s.enabled)
      .sort((a, b) => a.priority - b.priority);

    let lastError: Error | null = null;

    for (const source of sortedSources) {
      try {
        const startTime = Date.now();
        let quote: StockQuote | null = null;

        if (source.type === 'eastmoney') {
          quote = await eastmoneyService.fetchQuote(code);
        } else if (source.type === 'akshare') {
          quote = await akshareService.fetchQuote(code);
        } else {
          // Mock - use Eastmoney's mock as fallback
          quote = await eastmoneyService.fetchQuote(code);
        }

        const latency = Date.now() - startTime;

        if (quote) {
          this.updateSourceStatus(source.id, 'connected', latency);
          this.setCache(cacheKey, quote);
          return quote;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.updateSourceStatus(source.id, 'error', undefined, lastError.message);
        console.warn(`[Registry] ${source.name} failed for ${code}:`, err);
      }
    }

    // All sources failed - try to return cached stale data
    const staleData = this.getCached<StockQuote>(cacheKey, true);
    if (staleData) {
      this.config.sources.forEach(s => {
        const status = this.sourceStatus.get(s.id);
        if (status) status.status = 'stale';
      });
      return staleData;
    }

    console.error(`[Registry] All sources failed for ${code}:`, lastError);
    return null;
  }

  /**
   * Get financial data with caching and failover
   */
  async getFinancial(code: string): Promise<FinancialData | null> {
    const cacheKey = `financial_${code}`;

    const cached = this.getCached<FinancialData>(cacheKey);
    if (cached) return cached;

    const sortedSources = [...this.config.sources]
      .filter(s => s.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const source of sortedSources) {
      try {
        const startTime = Date.now();
        let financial: FinancialData | null = null;

        if (source.type === 'eastmoney') {
          financial = await eastmoneyService.fetchFinancial(code);
        } else if (source.type === 'akshare') {
          financial = await akshareService.fetchFinancial(code);
        }

        const latency = Date.now() - startTime;

        if (financial) {
          this.updateSourceStatus(source.id, 'connected', latency);
          this.setCache(cacheKey, financial);
          return financial;
        }
      } catch (err) {
        this.updateSourceStatus(source.id, 'error', undefined, err instanceof Error ? err.message : String(err));
        console.warn(`[Registry] ${source.name} financial failed for ${code}:`, err);
      }
    }

    const staleData = this.getCached<FinancialData>(cacheKey, true);
    if (staleData) return staleData;

    return null;
  }

  /**
   * Get news with caching and failover
   */
  async getNews(code: string, limit: number = 5): Promise<NewsItem[]> {
    const cacheKey = `news_${code}_${limit}`;

    const cached = this.getCached<NewsItem[]>(cacheKey);
    if (cached) return cached;

    try {
      const news = await eastmoneyService.fetchNews(code, limit);
      if (news && news.length > 0) {
        this.setCache(cacheKey, news);
        this.updateSourceStatus('eastmoney', 'connected');
        return news;
      }
    } catch (err) {
      this.updateSourceStatus('eastmoney', 'error', undefined, err instanceof Error ? err.message : String(err));
    }

    // Try mock news as fallback
    return this.getMockNews(code, limit);
  }

  /**
   * Clear cache for a specific code or all
   */
  clearCache(code?: string): void {
    if (code) {
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.includes(code)) keysToDelete.push(key);
      });
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get all source statuses
   */
  getAllSourceStatus(): DataSourceStatus[] {
    return Array.from(this.sourceStatus.values());
  }

  /**
   * Get specific source status
   */
  getSourceStatus(sourceId: string): DataSourceStatus | undefined {
    return this.sourceStatus.get(sourceId);
  }

  /**
   * Enable/disable a source
   */
  setSourceEnabled(sourceId: string, enabled: boolean): void {
    const source = this.config.sources.find(s => s.id === sourceId);
    if (source) {
      source.enabled = enabled;
      this.updateSourceStatus(sourceId, enabled ? 'connected' : 'disabled');
    }
  }

  // Private helpers

  private getCached<T>(key: string, allowStale: boolean = false): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
      if (!allowStale) {
        return null;
      }
      // Mark as stale but return data
    }

    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL,
    });
  }

  private updateSourceStatus(
    sourceId: string,
    status: DataSourceStatus['status'],
    latency?: number,
    error?: string
  ): void {
    const current = this.sourceStatus.get(sourceId);
    if (current) {
      current.status = status;
      current.lastFetch = Date.now();
      if (latency !== undefined) current.latency = latency;
      if (error) current.error = error;
    } else {
      this.sourceStatus.set(sourceId, {
        source: sourceId,
        status,
        lastFetch: Date.now(),
        latency,
        error,
      });
    }
  }

  private getMockNews(code: string, limit: number): NewsItem[] {
    const mockTitles = [
      `${this.getStockName(code)}发布年度财报，营收同比增长`,
      `${this.getStockName(code)}宣布重大战略合作`,
      `券商看好${this.getStockName(code)}，维持增持评级`,
      `${this.getStockName(code)}股价波动加大，注意风险`,
      `机构调研${this.getStockName(code)}，关注业务发展`,
    ];

    return mockTitles.slice(0, limit).map((title, i) => ({
      id: `mock_news_${code}_${i}`,
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

export const dataSourceRegistry = DataSourceRegistry.getInstance();
