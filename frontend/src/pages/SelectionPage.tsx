import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { aiStockSelection, stockScreener } from '../services/api'
import { Bot, Search, TrendingUp, TrendingDown, Loader2, Star, Save, FolderOpen, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import type { StockInfo, SavedStrategy, FinancialCriteria, TechnicalCriteria, SentimentCriteria } from '../types'

const STRATEGIES_KEY = 'ai-stock-selection-strategies'

type Tab = 'financial' | 'technical' | 'sentiment'

function loadStrategies(): SavedStrategy[] {
  try {
    return JSON.parse(localStorage.getItem(STRATEGIES_KEY) || '[]')
  } catch { return [] }
}

function saveStrategies(strategies: SavedStrategy[]) {
  localStorage.setItem(STRATEGIES_KEY, JSON.stringify(strategies))
}

export default function SelectionPage() {
  const { selectedStocks, setSelectedStocks, aiReasoning, setAiReasoning, showNotification } = useStore()
  const [activeTab, setActiveTab] = useState<Tab>('financial')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [filtersApplied, setFiltersApplied] = useState<string[]>([])

  // Strategy state per tab
  const [financial, setFinancial] = useState<FinancialCriteria>({})
  const [technical, setTechnical] = useState<TechnicalCriteria>({})
  const [sentiment, setSentiment] = useState<SentimentCriteria>({})

  // Saved strategies
  const [strategies, setStrategies] = useState<SavedStrategy[]>(loadStrategies)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [strategyName, setStrategyName] = useState('')
  const [showLoadModal, setShowLoadModal] = useState(false)

  // AI search
  const [aiLoading, setAiLoading] = useState(false)

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
  }

  const handleScreener = async () => {
    setLoading(true)
    setSearched(true)
    try {
      const req: Parameters<typeof stockScreener>[0] = {}
      if (activeTab === 'financial') req.financial = financial
      else if (activeTab === 'technical') req.technical = technical
      else req.sentiment = sentiment

      const result = await stockScreener(req)
      setSelectedStocks(result.stocks)
      setFiltersApplied(result.filters_applied)
      setAiReasoning('')
    } catch (err: any) {
      showNotification('error', err?.message ?? '筛选失败，请重试')
      setSelectedStocks([])
      setFiltersApplied([])
    } finally {
      setLoading(false)
    }
  }

  const handleAiSearch = async () => {
    if (!query.trim()) return
    setAiLoading(true)
    setSearched(true)
    try {
      const result = await aiStockSelection({ query })
      setSelectedStocks(result.stocks)
      setAiReasoning(result.ai_reasoning)
      setFiltersApplied([])
    } catch (err: any) {
      showNotification('error', err?.message ?? '选股失败，请重试')
      setSelectedStocks([])
      setAiReasoning('')
    } finally {
      setAiLoading(false)
    }
  }

  const handleSaveStrategy = () => {
    if (!strategyName.trim()) {
      showNotification('error', '请输入策略名称')
      return
    }
    const newStrategy: SavedStrategy = {
      id: Date.now().toString(),
      name: strategyName,
      tab: activeTab,
      financial: activeTab === 'financial' ? financial : undefined,
      technical: activeTab === 'technical' ? technical : undefined,
      sentiment: activeTab === 'sentiment' ? sentiment : undefined,
      created_at: new Date().toISOString(),
    }
    const updated = [newStrategy, ...strategies]
    saveStrategies(updated)
    setStrategies(updated)
    setShowSaveModal(false)
    setStrategyName('')
    showNotification('success', '策略已保存')
  }

  const handleLoadStrategy = (s: SavedStrategy) => {
    setActiveTab(s.tab)
    if (s.financial) setFinancial(s.financial)
    if (s.technical) setTechnical(s.technical)
    if (s.sentiment) setSentiment(s.sentiment)
    setShowLoadModal(false)
    showNotification('info', `已加载策略: ${s.name}`)
  }

  const handleDeleteStrategy = (id: string) => {
    const updated = strategies.filter(s => s.id !== id)
    saveStrategies(updated)
    setStrategies(updated)
    showNotification('info', '策略已删除')
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'financial', label: '财务指标' },
    { key: 'technical', label: '技术面' },
    { key: 'sentiment', label: '消息面' },
  ]

  const exampleQueries = [
    'PE低于20的蓝筹股',
    '近一年涨幅超过50%的科技股',
    '低估值高股息股票',
    '科创板小市值股票',
  ]

  const hasAnyCriteria = () => {
    if (activeTab === 'financial') {
      const f = financial
      return f.min_pe || f.max_pe || f.min_roe || f.max_roe || f.min_pb || f.max_pb || f.min_market_cap || f.max_market_cap || f.dividend_yield_min
    }
    if (activeTab === 'technical') {
      const t = technical
      return t.ma_cross || t.rsi_above !== undefined || t.rsi_below !== undefined || t.macd_signal || t.volume_ratio_min
    }
    if (activeTab === 'sentiment') {
      const s = sentiment
      return s.news_positive !== undefined
    }
    return false
  }

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

      {/* Tab Navigation */}
      <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
        <div className="flex border-b border-border-color">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={clsx(
                'flex-1 px-4 py-3 text-sm font-medium transition-colors relative',
                activeTab === tab.key
                  ? 'text-accent-primary bg-accent-primary/5'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
              )}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Financial Tab */}
        {activeTab === 'financial' && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <NumberField label="最小PE" value={financial.min_pe} onChange={v => setFinancial(f => ({ ...f, min_pe: v }))} placeholder="0" />
              <NumberField label="最大PE" value={financial.max_pe} onChange={v => setFinancial(f => ({ ...f, max_pe: v }))} placeholder="100" />
              <NumberField label="最小ROE(%)" value={financial.min_roe} onChange={v => setFinancial(f => ({ ...f, min_roe: v }))} placeholder="0" />
              <NumberField label="最大ROE(%)" value={financial.max_roe} onChange={v => setFinancial(f => ({ ...f, max_roe: v }))} placeholder="100" />
              <NumberField label="最小PB" value={financial.min_pb} onChange={v => setFinancial(f => ({ ...f, min_pb: v }))} placeholder="0" />
              <NumberField label="最大PB" value={financial.max_pb} onChange={v => setFinancial(f => ({ ...f, max_pb: v }))} placeholder="20" />
              <NumberField label="最小市值(亿)" value={financial.min_market_cap} onChange={v => setFinancial(f => ({ ...f, min_market_cap: v }))} placeholder="0" />
              <NumberField label="最大市值(亿)" value={financial.max_market_cap} onChange={v => setFinancial(f => ({ ...f, max_market_cap: v }))} placeholder="10000" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleScreener}
                disabled={loading || !hasAnyCriteria()}
                className="px-5 py-2.5 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                开始筛选
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                disabled={!hasAnyCriteria()}
                className="px-5 py-2.5 bg-bg-tertiary text-text-primary font-medium rounded-lg hover:bg-border-color transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-border-color"
              >
                <Save size={16} />
                保存策略
              </button>
              <button
                onClick={() => setShowLoadModal(true)}
                className="px-5 py-2.5 bg-bg-tertiary text-text-primary font-medium rounded-lg hover:bg-border-color transition-colors flex items-center gap-2 border border-border-color"
              >
                <FolderOpen size={16} />
                加载策略
              </button>
            </div>
          </div>
        )}

        {/* Technical Tab */}
        {activeTab === 'technical' && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-text-muted">MA交叉信号</label>
                <select
                  value={technical.ma_cross || ''}
                  onChange={e => setTechnical(t => ({ ...t, ma_cross: e.target.value as 'golden' | 'death' | undefined || undefined }))}
                  className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
                >
                  <option value="">不限制</option>
                  <option value="golden">MA金叉（看涨）</option>
                  <option value="death">MA死叉（看跌）</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-text-muted">MACD信号</label>
                <select
                  value={technical.macd_signal || ''}
                  onChange={e => setTechnical(t => ({ ...t, macd_signal: e.target.value as 'golden' | 'death' | undefined || undefined }))}
                  className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
                >
                  <option value="">不限制</option>
                  <option value="golden">MACD金叉</option>
                  <option value="death">MACD死叉</option>
                </select>
              </div>
              <NumberField label="RSI大于" value={technical.rsi_above} onChange={v => setTechnical(t => ({ ...t, rsi_above: v }))} placeholder="不限制" />
              <NumberField label="RSI小于" value={technical.rsi_below} onChange={v => setTechnical(t => ({ ...t, rsi_below: v }))} placeholder="不限制" />
              <NumberField label="最小量比" value={technical.volume_ratio_min} onChange={v => setTechnical(t => ({ ...t, volume_ratio_min: v }))} placeholder="1.0" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleScreener}
                disabled={loading || !hasAnyCriteria()}
                className="px-5 py-2.5 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                开始筛选
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                disabled={!hasAnyCriteria()}
                className="px-5 py-2.5 bg-bg-tertiary text-text-primary font-medium rounded-lg hover:bg-border-color transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-border-color"
              >
                <Save size={16} />
                保存策略
              </button>
              <button
                onClick={() => setShowLoadModal(true)}
                className="px-5 py-2.5 bg-bg-tertiary text-text-primary font-medium rounded-lg hover:bg-border-color transition-colors flex items-center gap-2 border border-border-color"
              >
                <FolderOpen size={16} />
                加载策略
              </button>
            </div>
          </div>
        )}

        {/* Sentiment Tab */}
        {activeTab === 'sentiment' && (
          <div className="p-5 space-y-4">
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sentiment.news_positive || false}
                  onChange={e => setSentiment(s => ({ ...s, news_positive: e.target.checked }))}
                  className="w-4 h-4 rounded border-border-color text-accent-primary focus:ring-accent-primary bg-bg-tertiary"
                />
                <span className="text-sm text-text-primary">近期有正面消息或研报覆盖</span>
              </label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleScreener}
                disabled={loading || !hasAnyCriteria()}
                className="px-5 py-2.5 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                开始筛选
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                disabled={!hasAnyCriteria()}
                className="px-5 py-2.5 bg-bg-tertiary text-text-primary font-medium rounded-lg hover:bg-border-color transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-border-color"
              >
                <Save size={16} />
                保存策略
              </button>
              <button
                onClick={() => setShowLoadModal(true)}
                className="px-5 py-2.5 bg-bg-tertiary text-text-primary font-medium rounded-lg hover:bg-border-color transition-colors flex items-center gap-2 border border-border-color"
              >
                <FolderOpen size={16} />
                加载策略
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Search Section */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bot size={18} className="text-accent-secondary" />
          <h3 className="font-semibold">AI自然语言选股</h3>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
              placeholder="例如：帮我找PE低于20、近三年净利润增速超过20%的科技股"
              className="w-full bg-bg-tertiary border border-border-color rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
          </div>
          <button
            onClick={handleAiSearch}
            disabled={aiLoading || !query.trim()}
            className="px-6 py-3 bg-accent-secondary text-bg-primary font-medium rounded-lg hover:bg-accent-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {aiLoading ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
            AI分析
          </button>
        </div>
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

      {/* Filters Applied */}
      {filtersApplied.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text-muted text-xs">已应用筛选：</span>
          {filtersApplied.map(f => (
            <span key={f} className="px-2 py-0.5 bg-accent-primary/15 text-accent-primary rounded-full text-xs">
              {f}
            </span>
          ))}
          <button
            onClick={() => setFiltersApplied([])}
            className="text-text-muted hover:text-text-primary ml-1"
          >
            <X size={12} />
          </button>
        </div>
      )}

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
      {loading || aiLoading ? (
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

      {/* Save Strategy Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl border border-border-color p-6 w-96 space-y-4">
            <h3 className="font-semibold text-lg">保存策略</h3>
            <input
              type="text"
              value={strategyName}
              onChange={e => setStrategyName(e.target.value)}
              placeholder="输入策略名称"
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent-primary/50"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowSaveModal(false); setStrategyName('') }}
                className="px-4 py-2 text-sm text-text-muted hover:text-text-primary"
              >
                取消
              </button>
              <button
                onClick={handleSaveStrategy}
                className="px-5 py-2 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 text-sm"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Strategy Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl border border-border-color p-6 w-[28rem] max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">加载策略</h3>
              <button
                onClick={() => setShowLoadModal(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>
            {strategies.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-8">暂无保存的策略</p>
            ) : (
              <div className="space-y-2">
                {strategies.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-color/50">
                    <div className="flex-1 cursor-pointer" onClick={() => handleLoadStrategy(s)}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{s.name}</span>
                        <span className="px-2 py-0.5 bg-accent-primary/15 text-accent-primary rounded text-[10px]">
                          {tabs.find(t => t.key === s.tab)?.label}
                        </span>
                      </div>
                      <p className="text-text-muted text-xs mt-0.5">
                        {new Date(s.created_at).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteStrategy(s.id)}
                      className="p-2 text-text-muted hover:text-accent-danger transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Number input field component
function NumberField({ label, value, onChange, placeholder }: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder: string
}) {
  const [localVal, setLocalVal] = useState(value?.toString() ?? '')

  useEffect(() => {
    setLocalVal(value?.toString() ?? '')
  }, [value])

  const handleBlur = () => {
    const parsed = parseFloat(localVal)
    if (isNaN(parsed)) { onChange(undefined); setLocalVal('') }
    else { onChange(parsed); setLocalVal(parsed.toString()) }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-text-muted">{label}</label>
      <input
        type="number"
        value={localVal}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => e.key === 'Enter' && handleBlur()}
        placeholder={placeholder}
        className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
      />
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
            {stock.market_cap && <span>市值: {(stock.market_cap / 1e8).toFixed(0)}亿</span>}
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
