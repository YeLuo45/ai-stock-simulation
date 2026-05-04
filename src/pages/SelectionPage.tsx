import { useState } from 'react'
import { useStore } from '../store'
import { aiStockSelection } from '../services/api'
import { Bot, Search, TrendingUp, TrendingDown, Loader2, Star } from 'lucide-react'
import clsx from 'clsx'
import type { StockInfo } from '../types'

export default function SelectionPage() {
  const { selectedStocks, setSelectedStocks, aiReasoning, setAiReasoning, showNotification } = useStore()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setSearched(true)
    try {
      const result = await aiStockSelection({ query })
      setSelectedStocks(result.stocks)
      setAiReasoning(result.ai_reasoning)
    } catch (err: any) {
      showNotification('error', err?.message ?? '选股失败，请重试')
      setSelectedStocks([])
      setAiReasoning('')
    } finally {
      setLoading(false)
    }
  }

  const exampleQueries = [
    'PE低于20的蓝筹股',
    '近一年涨幅超过50%的科技股',
    '低估值高股息股票',
    '科创板小市值股票',
  ]

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent-secondary/20 flex items-center justify-center">
          <Bot size={22} className="text-accent-secondary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI智能选股</h1>
          <p className="text-text-muted text-sm">用自然语言描述您的选股条件，AI帮您筛选</p>
        </div>
      </div>

      {/* Search box */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="例如：帮我找PE低于20、近三年净利润增速超过20%的科技股"
              className="w-full bg-bg-tertiary border border-border-color rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
            AI分析
          </button>
        </div>

        {/* Example queries */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="text-text-muted text-sm">试试：</span>
          {exampleQueries.map((q) => (
            <button
              key={q}
              onClick={() => setQuery(q)}
              className="px-3 py-1 bg-bg-tertiary rounded-full text-xs text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* AI Reasoning */}
      {aiReasoning && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Bot size={16} className="text-accent-secondary" />
            AI分析
          </h3>
          <p className="text-text-secondary text-sm leading-relaxed">{aiReasoning}</p>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <Loader2 size={40} className="animate-spin mb-4 text-accent-primary" />
          <p>AI正在分析市场数据...</p>
        </div>
      ) : searched && selectedStocks.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <Search size={48} className="mx-auto mb-4 opacity-50" />
          <p>未找到符合条件的股票</p>
        </div>
      ) : selectedStocks.length > 0 ? (
        <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
          <div className="p-4 border-b border-border-color">
            <h3 className="font-semibold">筛选结果 ({selectedStocks.length}只)</h3>
          </div>
          <div className="divide-y divide-border-color/50">
            {selectedStocks.map((stock) => (
              <StockCard key={stock.symbol} stock={stock} />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-12 text-center">
          <Bot size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
          <p className="text-text-muted text-lg mb-2">输入选股条件开始AI选股</p>
          <p className="text-text-muted text-sm">例如：帮我找市值低于500亿、近三年净利润增速超过20%的科技股</p>
        </div>
      )}
    </div>
  )
}

function StockCard({ stock }: { stock: StockInfo }) {
  const isUp = stock.change_pct >= 0
  const companyName =
    stock.name && stock.name.trim() && stock.name !== stock.symbol
      ? stock.name
      : '公司名待补全'
  const marketLabel = stock.market?.trim() || '未知市场'

  return (
    <div className="p-4 hover:bg-bg-tertiary/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold">{stock.symbol}</span>
            <span className="text-text-secondary">公司名：{companyName}</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-accent-primary/15 text-accent-primary">
              {marketLabel}
            </span>
            {stock.change_pct > 20 && (
              <Star size={14} className="text-accent-warning fill-accent-warning" />
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            {stock.pe && <span>PE: {stock.pe.toFixed(1)}</span>}
            {stock.pb && <span>PB: {stock.pb.toFixed(2)}</span>}
            {stock.roe && <span>ROE: {stock.roe.toFixed(1)}%</span>}
            {stock.market_cap && <span>市值: {stock.market_cap.toFixed(0)}亿</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold">¥{stock.price.toFixed(2)}</div>
          <div className={clsx(
            'flex items-center justify-end gap-1 text-sm font-medium',
            isUp ? 'text-accent-success' : 'text-accent-danger'
          )}>
            {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {isUp ? '+' : ''}{stock.change_pct.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  )
}
