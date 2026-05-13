// Data Research Panel - UI Component for displaying real-time market data
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { StockQuote, FinancialData, NewsItem, DataSourceStatus } from '../types/DataSource';
import { dataSourceRegistry } from '../services/DataSourceRegistry';
import { dataResearcherAgent } from '../agents/DataResearcherAgent';
import { newsResearcherAgent } from '../agents/NewsResearcherAgent';

interface DataResearchPanelProps {
  stockCode?: string;
  stockName?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // ms, default 30000 (30s)
}

export const DataResearchPanel: React.FC<DataResearchPanelProps> = ({
  stockCode = '600519',
  stockName = '贵州茅台',
  autoRefresh = false,
  refreshInterval = 30000,
}) => {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [financial, setFinancial] = useState<FinancialData | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [sourceStatus, setSourceStatus] = useState<DataSourceStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [dataQuality, setDataQuality] = useState<{ score: number; issues: string[] }>({ score: 100, issues: [] });

  const fetchData = useCallback(async () => {
    if (!stockCode) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [quoteResult, financialResult, newsResult] = await Promise.all([
        dataResearcherAgent.research(stockCode, ['quote']),
        dataResearcherAgent.research(stockCode, ['financial']),
        newsResearcherAgent.research(stockCode),
      ]);

      setQuote(quoteResult.quote || null);
      setFinancial(financialResult.financial || null);
      setNews(newsResult);
      setDataQuality(quoteResult.dataQuality);
      setLastUpdate(Date.now());
      setSourceStatus(dataSourceRegistry.getAllSourceStatus());
    } catch (err) {
      console.error('[DataResearchPanel] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [stockCode]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  // Format timestamp
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Format number
  const formatNum = (n: number, decimals: number = 2) => {
    if (n === undefined || n === null || isNaN(n)) return '-';
    return n.toFixed(decimals);
  };

  // Format volume
  const formatVolume = (v: number) => {
    if (!v) return '-';
    if (v >= 100000000) return (v / 100000000).toFixed(2) + '亿';
    if (v >= 10000) return (v / 10000).toFixed(2) + '万';
    return v.toString();
  };

  // Get sentiment badge
  const getSentimentBadge = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">利好</span>;
      case 'negative':
        return <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700">利空</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">中性</span>;
    }
  };

  // Get connection status icon
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'stale':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  // Get price change icon
  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg">实时数据研究</h3>
          <span className="text-sm text-gray-500">
            {stockName}({stockCode})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-gray-500">数据源状态:</span>
        {sourceStatus.map(s => (
          <div key={s.source} className="flex items-center gap-1">
            {getStatusIcon(s.status)}
            <span className={s.status === 'connected' ? 'text-green-600' : s.status === 'error' ? 'text-red-600' : 'text-gray-500'}>
              {s.source}
            </span>
            {s.latency && <span className="text-gray-400">({s.latency}ms)</span>}
          </div>
        ))}
        {lastUpdate && (
          <span className="ml-auto text-gray-400">
            更新: {formatTime(lastUpdate)}
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Quote Card */}
      {quote && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">行情数据</h4>
            <div className="flex items-center gap-2 text-sm">
              {getChangeIcon(quote.change)}
              <span className={quote.change >= 0 ? 'text-red-600' : 'text-green-600'}>
                {quote.change >= 0 ? '+' : ''}{formatNum(quote.change)}
                ({quote.change >= 0 ? '+' : ''}{formatNum(quote.changePercent)}%)
              </span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500">最新价</div>
              <div className="text-xl font-semibold">{formatNum(quote.price)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">今开</div>
              <div className="text-lg">{formatNum(quote.open)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">最高</div>
              <div className="text-lg text-red-600">{formatNum(quote.high)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">最低</div>
              <div className="text-lg text-green-600">{formatNum(quote.low)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">成交量</div>
              <div className="text-lg">{formatVolume(quote.volume)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">成交额</div>
              <div className="text-lg">{formatVolume(quote.amount)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">昨收</div>
              <div className="text-lg">{formatNum(quote.close)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">数据质量</div>
              <div className={`text-lg ${dataQuality.score >= 80 ? 'text-green-600' : dataQuality.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {dataQuality.score}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Financial Card */}
      {financial && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium mb-3">财务指标</h4>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500">市盈率(PE)</div>
              <div className="text-lg">{formatNum(financial.pe)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">市净率(PB)</div>
              <div className="text-lg">{formatNum(financial.pb)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">ROE</div>
              <div className="text-lg">{formatNum(financial.roe)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">毛利率</div>
              <div className="text-lg">{formatNum(financial.grossMargin)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">总市值</div>
              <div className="text-lg">{formatVolume(financial.marketCap)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">流通市值</div>
              <div className="text-lg">{formatVolume(financial.floatCap)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">营业收入</div>
              <div className="text-lg">{formatVolume(financial.revenue)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">净利润</div>
              <div className="text-lg">{formatVolume(financial.netProfit)}</div>
            </div>
          </div>
        </div>
      )}

      {/* News List */}
      {news.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">最新新闻</h4>
          <div className="space-y-2">
            {news.slice(0, 5).map((item) => (
              <div key={item.id} className="p-3 bg-gray-50 rounded hover:bg-gray-100 transition">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:text-blue-600 line-clamp-2"
                  >
                    {item.title}
                  </a>
                  {item.sentiment && getSentimentBadge(item.sentiment)}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{item.source}</span>
                  <span>{formatTime(item.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Quality Issues */}
      {dataQuality.issues.length > 0 && (
        <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
          <strong>数据质量问题:</strong> {dataQuality.issues.join('; ')}
        </div>
      )}

      {/* No Data State */}
      {!quote && !loading && !error && (
        <div className="text-center py-8 text-gray-500">
          暂无数据，请输入股票代码
        </div>
      )}
    </div>
  );
};

export default DataResearchPanel;
