import { useState, useEffect, useCallback } from 'react'
import { Star, TrendingUp, TrendingDown, Plus, X } from 'lucide-react'
import clsx from 'clsx'
import type { StockInfo } from '../types'
import { getRealtimeQuote } from '../services/yahooFinance'
import { useStore } from '../store'

// Default market stocks for add modal search
const MARKET_STOCKS: StockInfo[] = [
  { symbol: '600519', name: '贵州茅台', market: '上海', price: 1688.00, change_pct: -0.45, volume: 2345678 },
  { symbol: '000001', name: '平安银行', market: '深圳', price: 12.35, change_pct: 1.23, volume: 45678900 },
  { symbol: '000002', name: '万科A', market: '深圳', price: 8.92, change_pct: 2.34, volume: 34567890 },
  { symbol: '600036', name: '招商银行', market: '上海', price: 35.67, change_pct: 0.89, volume: 12345678 },
  { symbol: '000858', name: '五粮液', market: '深圳', price: 145.23, change_pct: -1.12, volume: 5678901 },
  { symbol: '688001', name: '华兴源创', market: '科创板', price: 28.45, change_pct: 3.45, volume: 1234567 },
  { symbol: '300750', name: '宁德时代', market: '创业板', price: 189.50, change_pct: 1.78, volume: 9876543 },
  { symbol: '601318', name: '中国平安', market: '上海', price: 45.23, change_pct: 0.56, volume: 8765432 },
  { symbol: '000333', name: '美的集团', market: '深圳', price: 62.80, change_pct: -0.78, volume: 6543210 },
  { symbol: '601888', name: '中国中免', market: '上海', price: 78.50, change_pct: 1.45, volume: 3456789 },
  { symbol: '300015', name: '爱尔眼科', market: '创业板', price: 28.90, change_pct: -2.15, volume: 4321567 },
  { symbol: '002594', name: '比亚迪', market: '深圳', price: 268.00, change_pct: 2.10, volume: 7654321 },
  { symbol: '600900', name: '长江电力', market: '上海', price: 28.30, change_pct: 0.35, volume: 2345678 },
  { symbol: '601398', name: '工商银行', market: '上海', price: 5.12, change_pct: -0.19, volume: 15678900 },
]

type TabType = 'follow' | 'gainers' | 'losers' | 'volume'

const STORAGE_KEY = 'my-stocks'

function getStoredStocks(): StockInfo[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // ignore
  }
  return [
    { symbol: '600519', name: '贵州茅台', market: '上海', price: 1688.00, change_pct: -0.45, volume: 2345678 },
    { symbol: '000001', name: '平安银行', market: '深圳', price: 12.35, change_pct: 1.23, volume: 45678900 },
    { symbol: '300750', name: '宁德时代', market: '创业板', price: 189.50, change_pct: 1.78, volume: 9876543 },
  ]
}

function saveStoredStocks(stocks: StockInfo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks))
}

export default function MarketPage() {
  const { selectedStocks: storeSelectedStocks } = useStore()
  const [activeTab, setActiveTab] = useState<TabType>('follow')
  const [followStocks, setFollowStocks] = useState<StockInfo[]>(getStoredStocks)
  const [marketStocks] = useState<StockInfo[]>(MARKET_STOCKS)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Real-time data states
  const [stockList, setStockList] = useState<any[]>([])
  const [, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [connected, setConnected] = useState(false)

  // Default stocks fallback
  const defaultStocks = [
    { symbol: '600519', name: '贵州茅台' },
    { symbol: '000001', name: '平安银行' },
    { symbol: '000002', name: '万科A' },
    { symbol: '600036', name: '招商银行' },
    { symbol: '300750', name: '宁德时代' },
    { symbol: '601318', name: '中国平安' },
    { symbol: '000333', name: '美的集团' },
    { symbol: '002594', name: '比亚迪' },
  ]

  // Fetch quotes from Yahoo Finance
  const fetchQuotes = useCallback(async () => {
    const stocksToFetch = storeSelectedStocks.length > 0
      ? storeSelectedStocks.map(s => ({ symbol: s.symbol, name: s.name }))
      : defaultStocks;

    try {
      const updates = await Promise.allSettled(
        stocksToFetch.map(async (s) => {
          const quote = await getRealtimeQuote(s.symbol);
          return {
            symbol: s.symbol,
            name: s.name,
            price: quote.price,
            change: quote.change,
            change_pct: quote.changePercent,
            volume: quote.volume,
          };
        })
      );

      const newStocks = updates
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);

      if (newStocks.length > 0) {
        setStockList(newStocks);
        setLastUpdate(new Date());
        setConnected(true);
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch quotes:', err);
      setConnected(false);
      setLoading(false);
    }
  }, [storeSelectedStocks]);

  // Save follow stocks to localStorage
  useEffect(() => {
    saveStoredStocks(followStocks)
  }, [followStocks])

  // Real-time data polling
  useEffect(() => {
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 5000); // 每5秒刷新
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  // Update follow stocks from stockList
  useEffect(() => {
    if (stockList.length > 0 && activeTab === 'follow') {
      setFollowStocks(prev => {
        const updated = prev.map(fs => {
          const real = stockList.find(s => s.symbol === fs.symbol);
          return real ? { ...fs, price: real.price, change_pct: real.change_pct, volume: real.volume } : fs;
        });
        // Add new stocks from storeSelectedStocks that aren't in prev
        storeSelectedStocks.forEach(ss => {
          if (!updated.find(u => u.symbol === ss.symbol)) {
            const real = stockList.find(s => s.symbol === ss.symbol);
            if (real) updated.push(real);
          }
        });
        return updated;
      });
    }
  }, [stockList, activeTab, storeSelectedStocks]);

  const getTabStocks = useCallback((): StockInfo[] => {
    if (activeTab === 'follow') {
      return followStocks;
    }
    // For gainers/losers/volume, use stockList if available, otherwise marketStocks
    const source = stockList.length > 0 ? stockList : marketStocks;
    switch (activeTab) {
      case 'gainers':
        return [...source].sort((a, b) => b.change_pct - a.change_pct).slice(0, 20)
      case 'losers':
        return [...source].sort((a, b) => a.change_pct - b.change_pct).slice(0, 20)
      case 'volume':
        return [...source].sort((a, b) => b.volume - a.volume).slice(0, 20)
      default:
        return followStocks
    }
  }, [activeTab, followStocks, marketStocks, stockList]);

  const handleAddToFollow = (stock: StockInfo) => {
    if (!followStocks.find(s => s.symbol === stock.symbol)) {
      setFollowStocks(prev => [...prev, stock])
    }
    setShowAddModal(false)
    setSearchQuery('')
  }

  const handleRemoveFromFollow = (symbol: string) => {
    setFollowStocks(prev => prev.filter(s => s.symbol !== symbol))
  }

  const filteredSearch = searchQuery
    ? MARKET_STOCKS.filter(s => 
        s.name.includes(searchQuery) || 
        s.symbol.includes(searchQuery)
      ).filter(s => !followStocks.find(f => f.symbol === s.symbol))
    : []

  const tabs: { key: TabType; label: string }[] = [
    { key: 'follow', label: '自选股' },
    { key: 'gainers', label: '涨幅榜' },
    { key: 'losers', label: '跌幅榜' },
    { key: 'volume', label: '成交额' },
  ]

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">实时行情</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors text-sm flex items-center gap-2"
        >
          <Plus size={16} />
          添加自选
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-color">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'px-4 py-2 text-sm font-medium transition-colors relative',
              activeTab === tab.key
                ? 'text-accent-primary'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Stock table */}
      <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted border-b border-border-color text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-4 font-medium">股票</th>
                <th className="text-right py-3 px-4 font-medium">现价</th>
                <th className="text-right py-3 px-4 font-medium">涨跌幅</th>
                <th className="text-right py-3 px-4 font-medium">成交量</th>
                {activeTab === 'follow' && <th className="text-right py-3 px-4 font-medium">操作</th>}
              </tr>
            </thead>
            <tbody>
              {getTabStocks().length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'follow' ? 5 : 4} className="text-center py-12 text-text-muted">
                    {activeTab === 'follow' ? (
                      <div>
                        <Star size={48} className="mx-auto mb-3 opacity-50" />
                        <p>暂无自选股</p>
                        <button
                          onClick={() => setShowAddModal(true)}
                          className="mt-3 text-accent-primary hover:underline text-sm"
                        >
                          添加自选
                        </button>
                      </div>
                    ) : (
                      '暂无数据'
                    )}
                  </td>
                </tr>
              ) : (
                getTabStocks().map((stock) => (
                  <tr
                    key={stock.symbol}
                    className="border-b border-border-color/50 hover:bg-bg-tertiary/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {activeTab === 'follow' && (
                          <button
                            onClick={() => handleRemoveFromFollow(stock.symbol)}
                            className="text-accent-warning hover:text-accent-warning/80"
                          >
                            <Star size={16} fill="currentColor" />
                          </button>
                        )}
                        <div>
                          <div className="font-mono font-medium">{stock.symbol}</div>
                          <div className="text-text-muted text-xs">{stock.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 font-mono">
                      <span className={clsx(
                        stock.change_pct >= 0 ? 'text-accent-success' : 'text-accent-danger'
                      )}>
                        ¥{stock.price.toFixed(2)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className={clsx(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs font-medium',
                        stock.change_pct >= 0
                          ? 'bg-accent-success/20 text-accent-success'
                          : 'bg-accent-danger/20 text-accent-danger'
                      )}>
                        {stock.change_pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-text-secondary">
                      {formatVolume(stock.volume)}
                    </td>
                    {activeTab === 'follow' && (
                      <td className="text-right py-3 px-4">
                        <button
                          onClick={() => handleRemoveFromFollow(stock.symbol)}
                          className="text-text-muted hover:text-accent-danger transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time indicator */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-accent-success' : 'bg-accent-danger'}`} />
        {connected ? `实时行情 · ${lastUpdate?.toLocaleTimeString() ?? ''}` : '连接失败'}
      </div>

      {/* Add stock modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-bg-secondary rounded-xl border border-border-color p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">添加自选股</h3>
              <button onClick={() => setShowAddModal(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            <input
              type="text"
              placeholder="搜索股票代码或名称..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm focus:outline-none focus:border-accent-primary"
            />
            <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
              {filteredSearch.length === 0 && searchQuery && (
                <div className="text-center py-4 text-text-muted text-sm">未找到相关股票</div>
              )}
              {filteredSearch.map(stock => (
                <div
                  key={stock.symbol}
                  className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg hover:bg-bg-tertiary/80 cursor-pointer"
                  onClick={() => handleAddToFollow(stock)}
                >
                  <div>
                    <div className="font-mono font-medium">{stock.symbol}</div>
                    <div className="text-text-muted text-xs">{stock.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">¥{stock.price.toFixed(2)}</div>
                    <div className={clsx(
                      'text-xs font-mono',
                      stock.change_pct >= 0 ? 'text-accent-success' : 'text-accent-danger'
                    )}>
                      {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
              {!searchQuery && (
                <div className="text-center py-4 text-text-muted text-sm">
                  输入股票代码或名称搜索
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatVolume(vol: number): string {
  if (vol >= 100000000) {
    return (vol / 100000000).toFixed(2) + '亿'
  } else if (vol >= 10000) {
    return (vol / 10000).toFixed(2) + '万'
  }
  return vol.toString()
}
