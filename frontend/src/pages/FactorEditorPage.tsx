import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import {
  getAllFactorDefinitions,
  screenFactors,
  runFactorBacktest,
  saveFactorPortfolio,
  getFactorPortfolios,
  deleteFactorPortfolio,
  saveCustomFactor,
  deleteCustomFactor,
} from '../services/factorEngine'
import type {
  FactorWeight,
  FactorPortfolio,
  SavedFactor,
  FactorScreenerResult,
  FactorBacktestResult,
  FactorCategory,
} from '../types'
import {
  Sliders,
  Plus,
  Trash2,
  Save,
  Play,
  TrendingUp,
  BarChart2,
  Target,
  Zap,
  DollarSign,
  BarChart3,
  Brain,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Star,
} from 'lucide-react'
import clsx from 'clsx'

const CATEGORY_LABELS: Record<FactorCategory, string> = {
  price: '价格类',
  technical: '技术指标',
  financial: '财务类',
  sentiment: '情绪类',
  custom: '自定义',
}

const CATEGORY_ICONS: Record<FactorCategory, React.ReactNode> = {
  price: <DollarSign size={14} />,
  technical: <BarChart2 size={14} />,
  financial: <TrendingUp size={14} />,
  sentiment: <Brain size={14} />,
  custom: <Zap size={14} />,
}

// Default stock symbols for screening
const DEFAULT_SYMBOLS = [
  '000001', '000002', '000004', '000005', '000006',
  '300750', '300751', '300752', '300753', '300754',
  '600519', '600520', '600521', '600522', '600523',
  '601318', '601319', '601320', '601321', '601322',
]

export default function FactorEditorPage() {
  const { showNotification } = useStore()

  const [activeTab, setActiveTab] = useState<'editor' | 'screener' | 'backtest' | 'portfolios'>('editor')

  // Factor definitions state
  const [editingFactor, setEditingFactor] = useState<SavedFactor | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Portfolio state
  const [factorWeights, setFactorWeights] = useState<FactorWeight[]>([])
  const [savedPortfolios, setSavedPortfolios] = useState<FactorPortfolio[]>([])
  const [portfolioName, setPortfolioName] = useState('')
  const [portfolioDesc, setPortfolioDesc] = useState('')

  // Screener state
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS)
  const [screenerResults, setScreenerResults] = useState<FactorScreenerResult[]>([])
  const [screening, setScreening] = useState(false)
  const [sortBy, setSortBy] = useState('composite_score')
  const [sortDesc, setSortDesc] = useState(true)

  // Backtest state
  const [backtestResult, setBacktestResult] = useState<FactorBacktestResult | null>(null)
  const [backtesting, setBacktesting] = useState(false)
  const [startDate, setStartDate] = useState('2025-01-01')
  const [endDate, setEndDate] = useState('2026-04-18')
  const [initialCash, setInitialCash] = useState(1000000)
  const [topN, setTopN] = useState(10)
  const [rebalanceDays, setRebalanceDays] = useState(5)

  // UI state
  const [expandedCategories, setExpandedCategories] = useState<Set<FactorCategory>>(new Set(['price', 'technical', 'financial', 'sentiment']))

  useEffect(() => {
    setSavedPortfolios(getFactorPortfolios())
  }, [])

  const toggleCategory = (cat: FactorCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const factorsByCategory = (cats: FactorCategory[]) => {
    const all = getAllFactorDefinitions()
    return cats
      .map(cat => ({ cat, factors: all.filter(f => f.category === cat) }))
      .filter(g => g.factors.length > 0)
  }

  // --- Factor Weight Management ---

  const toggleFactor = (factorId: string) => {
    setFactorWeights(prev => {
      const existing = prev.find(f => f.factor_id === factorId)
      if (existing) return prev.filter(f => f.factor_id !== factorId)
      return [...prev, { factor_id: factorId, weight: 0.5, direction: 'long' as const }]
    })
  }

  const updateWeight = (factorId: string, weight: number) => {
    setFactorWeights(prev =>
      prev.map(f => f.factor_id === factorId ? { ...f, weight } : f)
    )
  }

  const updateDirection = (factorId: string, direction: 'long' | 'short' | 'both') => {
    setFactorWeights(prev =>
      prev.map(f => f.factor_id === factorId ? { ...f, direction } : f)
    )
  }

  const selectedFactorIds = new Set(factorWeights.map(f => f.factor_id))

  // --- Portfolio Management ---

  const savePortfolio = () => {
    if (!portfolioName.trim()) {
      showNotification('error', '请输入组合名称')
      return
    }
    if (factorWeights.length === 0) {
      showNotification('error', '请先选择至少一个因子')
      return
    }
    const portfolio: FactorPortfolio = {
      id: Date.now().toString(),
      name: portfolioName,
      description: portfolioDesc,
      factors: factorWeights,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    saveFactorPortfolio(portfolio)
    setSavedPortfolios(getFactorPortfolios())
    showNotification('success', `因子组合"${portfolioName}"已保存`)
    setPortfolioName('')
    setPortfolioDesc('')
  }

  const loadPortfolio = (portfolio: FactorPortfolio) => {
    setFactorWeights(portfolio.factors)
    setPortfolioName(portfolio.name)
    setPortfolioDesc(portfolio.description || '')
    showNotification('info', `已加载因子组合: ${portfolio.name}`)
  }

  const removePortfolio = (id: string) => {
    deleteFactorPortfolio(id)
    setSavedPortfolios(getFactorPortfolios())
    showNotification('info', '组合已删除')
  }

  // --- Custom Factor Management ---

  const createNewFactor = () => {
    setEditingFactor({
      id: `custom_${Date.now()}`,
      name: '',
      name_cn: '',
      description: '',
      category: 'custom',
      formula: '',
      params: [],
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    setIsCreating(true)
  }

  const saveEditingFactor = () => {
    if (!editingFactor) return
    if (!editingFactor.name || !editingFactor.name_cn) {
      showNotification('error', '请填写因子名称和中文名')
      return
    }
    saveCustomFactor(editingFactor)
    setEditingFactor(null)
    setIsCreating(false)
    showNotification('success', '自定义因子已保存')
  }

  const removeCustomFactor = (id: string) => {
    deleteCustomFactor(id)
    showNotification('info', '自定义因子已删除')
  }

  // --- Screening ---

  const runScreening = useCallback(async () => {
    if (factorWeights.length === 0) {
      showNotification('error', '请先在因子编辑器中选择因子')
      return
    }
    setScreening(true)
    try {
      await new Promise(r => setTimeout(r, 800))
      const results = screenFactors({
        factors: factorWeights,
        symbols,
        sort_by: sortBy,
        sort_desc: sortDesc,
        limit: symbols.length,
      })
      setScreenerResults(results)
      showNotification('success', `筛选完成，共${results.length}只股票`)
    } catch (e: any) {
      showNotification('error', e?.message || '筛选失败')
    } finally {
      setScreening(false)
    }
  }, [factorWeights, symbols, sortBy, sortDesc, showNotification])

  // --- Backtesting ---

  const runBacktest = async () => {
    if (factorWeights.length === 0) {
      showNotification('error', '请先在因子编辑器中选择因子')
      return
    }
    setBacktesting(true)
    setBacktestResult(null)
    try {
      await new Promise(r => setTimeout(r, 1500))
      const result = runFactorBacktest({
        factors: factorWeights,
        symbols,
        start_date: startDate,
        end_date: endDate,
        initial_cash: initialCash,
        rebalance_interval: rebalanceDays,
        top_n: topN,
      })
      setBacktestResult(result)
      showNotification('success', '因子回测完成')
    } catch (e: any) {
      showNotification('error', e?.message || '回测失败')
    } finally {
      setBacktesting(false)
    }
  }

  const categories: FactorCategory[] = ['price', 'technical', 'financial', 'sentiment', 'custom']

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
          <Sliders size={22} className="text-accent-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">因子引擎</h1>
          <p className="text-text-muted text-sm">多因子选股模型构建与回测</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border-color pb-0">
        {[
          { key: 'editor', label: '因子编辑', icon: <Sliders size={16} /> },
          { key: 'screener', label: '因子筛选', icon: <Target size={16} /> },
          { key: 'backtest', label: '因子回测', icon: <BarChart3 size={16} /> },
          { key: 'portfolios', label: '我的组合', icon: <Star size={16} /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== Editor Tab ===== */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Factor List */}
          <div className="lg:col-span-2 bg-bg-secondary rounded-xl border border-border-color p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">因子库</h3>
              <button
                onClick={createNewFactor}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 text-accent-primary text-xs font-medium rounded-lg hover:bg-accent-primary/20 transition-colors"
              >
                <Plus size={14} />
                自定义因子
              </button>
            </div>

            <div className="space-y-3">
              {factorsByCategory(categories).map(({ cat, factors: catFactors }) => (
                <div key={cat} className="rounded-lg border border-border-color overflow-hidden">
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors text-sm font-medium"
                  >
                    {CATEGORY_ICONS[cat]}
                    <span>{CATEGORY_LABELS[cat]}</span>
                    <span className="text-text-muted text-xs">({catFactors.length})</span>
                    <span className="ml-auto">
                      {expandedCategories.has(cat) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>
                  {expandedCategories.has(cat) && (
                    <div className="divide-y divide-border-color">
                      {catFactors.map(factor => (
                        <div
                          key={factor.id}
                          className={clsx(
                            'flex items-center gap-3 px-4 py-2.5 hover:bg-bg-tertiary/30 transition-colors cursor-pointer',
                            selectedFactorIds.has(factor.id) && 'bg-accent-primary/5'
                          )}
                          onClick={() => toggleFactor(factor.id)}
                        >
                          <div className={clsx(
                            'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                            selectedFactorIds.has(factor.id)
                              ? 'bg-accent-primary border-accent-primary'
                              : 'border-border-color'
                          )}>
                            {selectedFactorIds.has(factor.id) && <Check size={12} className="text-bg-primary" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{factor.name_cn}</span>
                              <code className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded font-mono">{factor.name}</code>
                            </div>
                            <p className="text-xs text-text-muted truncate mt-0.5">{factor.description}</p>
                          </div>
                          {factor.id.startsWith('custom_') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeCustomFactor(factor.id) }}
                              className="p-1 text-text-muted hover:text-accent-danger transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Weight Panel */}
          <div className="space-y-4">
            {/* Selected factors weight config */}
            <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
              <h3 className="font-semibold mb-3">因子权重配置</h3>
              {factorWeights.length === 0 ? (
                <p className="text-text-muted text-sm">点击左侧因子添加进来</p>
              ) : (
                <div className="space-y-3">
                  {factorWeights.map(fw => {
                    const def = getAllFactorDefinitions().find(f => f.id === fw.factor_id)
                    return (
                      <div key={fw.factor_id} className="p-3 bg-bg-tertiary/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{def?.name_cn || fw.factor_id}</span>
                          <button
                            onClick={() => toggleFactor(fw.factor_id)}
                            className="p-1 text-text-muted hover:text-accent-danger"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        {/* Weight slider */}
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={fw.weight}
                            onChange={e => updateWeight(fw.factor_id, parseFloat(e.target.value))}
                            className="flex-1 h-1 bg-bg-tertiary rounded-full appearance-none cursor-pointer accent-accent-primary"
                          />
                          <span className="text-xs font-mono w-10 text-right">{(fw.weight * 100).toFixed(0)}%</span>
                        </div>
                        {/* Direction */}
                        <div className="flex gap-1">
                          {(['long', 'short', 'both'] as const).map(dir => (
                            <button
                              key={dir}
                              onClick={() => updateDirection(fw.factor_id, dir)}
                              className={clsx(
                                'flex-1 py-1 text-[10px] rounded transition-colors',
                                fw.direction === dir
                                  ? dir === 'long' ? 'bg-accent-success/20 text-accent-success'
                                  : dir === 'short' ? 'bg-accent-danger/20 text-accent-danger'
                                  : 'bg-accent-primary/20 text-accent-primary'
                                  : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
                              )}
                            >
                              {dir === 'long' ? '做多' : dir === 'short' ? '做空' : '双向'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Save Portfolio */}
            <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
              <h3 className="font-semibold mb-3">保存组合</h3>
              <input
                type="text"
                value={portfolioName}
                onChange={e => setPortfolioName(e.target.value)}
                placeholder="组合名称..."
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm mb-2 focus:outline-none focus:border-accent-primary/50"
              />
              <input
                type="text"
                value={portfolioDesc}
                onChange={e => setPortfolioDesc(e.target.value)}
                placeholder="组合描述(可选)..."
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm mb-3 focus:outline-none focus:border-accent-primary/50"
              />
              <button
                onClick={savePortfolio}
                disabled={factorWeights.length === 0}
                className="w-full py-2 bg-accent-primary text-bg-primary text-sm font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save size={14} />
                保存因子组合
              </button>
            </div>

            {/* Quick Stats */}
            <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
              <h3 className="font-semibold mb-3">配置统计</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-bg-tertiary/50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-accent-primary">{factorWeights.length}</div>
                  <div className="text-text-muted">已选因子</div>
                </div>
                <div className="p-3 bg-bg-tertiary/50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-accent-secondary">
                    {factorWeights.reduce((s, f) => s + f.weight, 0).toFixed(1)}
                  </div>
                  <div className="text-text-muted">总权重</div>
                </div>
                <div className="p-3 bg-bg-tertiary/50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-accent-success">
                    {factorWeights.filter(f => f.direction === 'long').length}
                  </div>
                  <div className="text-text-muted">做多因子</div>
                </div>
                <div className="p-3 bg-bg-tertiary/50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-accent-danger">
                    {factorWeights.filter(f => f.direction === 'short').length}
                  </div>
                  <div className="text-text-muted">做空因子</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Custom Factor Editor Modal ===== */}
      {editingFactor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{isCreating ? '新建自定义因子' : '编辑自定义因子'}</h3>
              <button onClick={() => { setEditingFactor(null); setIsCreating(false) }} className="p-1 text-text-muted hover:text-text-primary">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">因子标识 (英文)</label>
                <input
                  type="text"
                  value={editingFactor.name}
                  onChange={e => setEditingFactor({ ...editingFactor, name: e.target.value })}
                  placeholder="e.g. my_custom_factor"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm font-mono focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">因子名称 (中文)</label>
                <input
                  type="text"
                  value={editingFactor.name_cn}
                  onChange={e => setEditingFactor({ ...editingFactor, name_cn: e.target.value })}
                  placeholder="e.g. 我的自定义因子"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">描述</label>
                <input
                  type="text"
                  value={editingFactor.description}
                  onChange={e => setEditingFactor({ ...editingFactor, description: e.target.value })}
                  placeholder="因子描述..."
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">计算公式 (表达式)</label>
                <input
                  type="text"
                  value={editingFactor.formula}
                  onChange={e => setEditingFactor({ ...editingFactor, formula: e.target.value })}
                  placeholder="e.g. price_change_1d / volume_ratio"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm font-mono focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">分类</label>
                <select
                  value={editingFactor.category}
                  onChange={e => setEditingFactor({ ...editingFactor, category: e.target.value as FactorCategory })}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm focus:outline-none focus:border-accent-primary/50"
                >
                  <option value="price">价格类</option>
                  <option value="technical">技术指标</option>
                  <option value="financial">财务类</option>
                  <option value="sentiment">情绪类</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setEditingFactor(null); setIsCreating(false) }}
                className="flex-1 py-2 border border-border-color text-text-secondary text-sm rounded-lg hover:bg-bg-tertiary transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveEditingFactor}
                className="flex-1 py-2 bg-accent-primary text-bg-primary text-sm font-medium rounded-lg hover:bg-accent-primary/90 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Screener Tab ===== */}
      {activeTab === 'screener' && (
        <div className="space-y-6">
          {/* Config */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-4">筛选配置</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">股票池</label>
                <textarea
                  value={symbols.join('\n')}
                  onChange={e => setSymbols(e.target.value.split('\n').filter(s => s.trim()))}
                  rows={5}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-xs font-mono focus:outline-none focus:border-accent-primary/50 resize-none"
                  placeholder="每行一个股票代码"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">排序方式</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm focus:outline-none focus:border-accent-primary/50"
                >
                  <option value="composite_score">综合得分</option>
                  {factorWeights.map(fw => {
                    const def = getAllFactorDefinitions().find(f => f.id === fw.factor_id)
                    return (
                      <option key={fw.factor_id} value={fw.factor_id}>
                        {def?.name_cn || fw.factor_id}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">排序方向</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSortDesc(true)}
                    className={clsx('flex-1 py-2 text-sm rounded-lg border transition-colors', sortDesc ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-color text-text-secondary')}
                  >
                    降序 ↓
                  </button>
                  <button
                    onClick={() => setSortDesc(false)}
                    className={clsx('flex-1 py-2 text-sm rounded-lg border transition-colors', !sortDesc ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-color text-text-secondary')}
                  >
                    升序 ↑
                  </button>
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={runScreening}
                  disabled={screening || factorWeights.length === 0}
                  className="w-full py-2.5 bg-accent-primary text-bg-primary text-sm font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {screening ? <><div className="w-4 h-4 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" /> 筛选中...</> : <><Play size={14} /> 开始筛选</>}
                </button>
              </div>
            </div>
            <p className="text-text-muted text-xs mt-3">
              已选 {factorWeights.length} 个因子，{symbols.length} 只股票
            </p>
          </div>

          {/* Results Table */}
          {screenerResults.length > 0 && (
            <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
              <div className="p-4 border-b border-border-color">
                <h3 className="font-semibold">筛选结果</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-bg-tertiary/50 text-text-muted text-xs">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">排名</th>
                      <th className="px-4 py-2 text-left font-medium">代码</th>
                      <th className="px-4 py-2 text-left font-medium">综合得分</th>
                      {factorWeights.map(fw => {
                        const def = getAllFactorDefinitions().find(f => f.id === fw.factor_id)
                        return (
                          <th key={fw.factor_id} className="px-4 py-2 text-right font-medium" title={def?.description}>
                            {def?.name_cn}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {screenerResults.map((result, idx) => (
                      <tr key={result.symbol} className="hover:bg-bg-tertiary/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className={clsx(
                            'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                            idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                            idx === 1 ? 'bg-gray-400/20 text-gray-400' :
                            idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                            'text-text-muted'
                          )}>
                            {result.rank}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-medium">{result.symbol}</td>
                        <td className="px-4 py-2.5">
                          <span className={clsx(
                            'font-mono font-bold',
                            result.composite_score > 0.6 ? 'text-accent-success' :
                            result.composite_score < 0.4 ? 'text-accent-danger' :
                            'text-text-primary'
                          )}>
                            {result.composite_score.toFixed(4)}
                          </span>
                        </td>
                        {factorWeights.map(fw => {
                          const val = result.scores[fw.factor_id] ?? 0
                          return (
                            <td key={fw.factor_id} className="px-4 py-2.5 text-right">
                              <span className={clsx(
                                'font-mono text-xs',
                                val > 0.65 ? 'text-accent-success' :
                                val < 0.35 ? 'text-accent-danger' :
                                'text-text-secondary'
                              )}>
                                {val.toFixed(3)}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Backtest Tab ===== */}
      {activeTab === 'backtest' && (
        <div className="space-y-6">
          {/* Config */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-4">回测配置</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">开始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">结束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">初始资金</label>
                <input
                  type="number"
                  value={initialCash}
                  onChange={e => setInitialCash(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm font-mono focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">持仓数量 (Top N)</label>
                <input
                  type="number"
                  value={topN}
                  onChange={e => setTopN(Number(e.target.value))}
                  min={1}
                  max={50}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm font-mono focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">调仓周期 (天)</label>
                <input
                  type="number"
                  value={rebalanceDays}
                  onChange={e => setRebalanceDays(Number(e.target.value))}
                  min={1}
                  max={60}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm font-mono focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={runBacktest}
                  disabled={backtesting || factorWeights.length === 0}
                  className="w-full py-2.5 bg-accent-primary text-bg-primary text-sm font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {backtesting ? <><div className="w-4 h-4 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" /> 回测中...</> : <><Play size={14} /> 开始回测</>}
                </button>
              </div>
            </div>
            <p className="text-text-muted text-xs mt-3">
              已选 {factorWeights.length} 个因子，使用 {symbols.length} 只股票
            </p>
          </div>

          {/* Results */}
          {backtestResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: '总收益率', value: `${backtestResult.total_return >= 0 ? '+' : ''}${backtestResult.total_return.toFixed(2)}%`, className: backtestResult.total_return >= 0 ? 'text-accent-success' : 'text-accent-danger' },
                { label: '年化收益率', value: `${backtestResult.annual_return >= 0 ? '+' : ''}${backtestResult.annual_return.toFixed(2)}%`, className: backtestResult.annual_return >= 0 ? 'text-accent-success' : 'text-accent-danger' },
                { label: '最大回撤', value: `-${backtestResult.max_drawdown.toFixed(2)}%`, className: 'text-accent-danger' },
                { label: '夏普比率', value: backtestResult.sharpe_ratio.toFixed(2), className: 'text-accent-primary' },
                { label: '交易次数', value: backtestResult.total_trades.toString(), className: 'text-text-primary' },
                { label: '胜率', value: `${(backtestResult.win_rate * 100).toFixed(1)}%`, className: 'text-text-primary' },
                { label: '多头收益', value: `${backtestResult.long_return >= 0 ? '+' : ''}${backtestResult.long_return.toFixed(2)}%`, className: backtestResult.long_return >= 0 ? 'text-accent-success' : 'text-accent-danger' },
                { label: '空头收益', value: `${backtestResult.short_return >= 0 ? '+' : ''}${backtestResult.short_return.toFixed(2)}%`, className: backtestResult.short_return >= 0 ? 'text-accent-success' : 'text-accent-danger' },
              ].map((metric, i) => (
                <div key={i} className="bg-bg-secondary rounded-xl border border-border-color p-4 text-center">
                  <div className={clsx('text-xl font-bold font-mono', metric.className)}>{metric.value}</div>
                  <div className="text-xs text-text-muted mt-1">{metric.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Equity Curve Placeholder */}
          {backtestResult && (
            <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
              <h3 className="font-semibold mb-4">权益曲线</h3>
              <EquityCurveChart data={backtestResult.equity_curve} />
            </div>
          )}

          {/* Trades Table */}
          {backtestResult && backtestResult.trades.length > 0 && (
            <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
              <div className="p-4 border-b border-border-color">
                <h3 className="font-semibold">交易记录</h3>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-bg-tertiary/50 text-text-muted text-xs sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">日期</th>
                      <th className="px-4 py-2 text-left">股票</th>
                      <th className="px-4 py-2 text-left">操作</th>
                      <th className="px-4 py-2 text-right">价格</th>
                      <th className="px-4 py-2 text-left">原因</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {backtestResult.trades.slice(0, 50).map((trade, i) => (
                      <tr key={i} className="hover:bg-bg-tertiary/30">
                        <td className="px-4 py-2 text-text-muted text-xs">{trade.date}</td>
                        <td className="px-4 py-2 font-mono">{trade.symbol}</td>
                        <td className="px-4 py-2">
                          <span className={clsx(
                            'inline-block px-2 py-0.5 rounded text-xs font-medium',
                            trade.action === 'buy' ? 'bg-accent-success/10 text-accent-success' : 'bg-accent-danger/10 text-accent-danger'
                          )}>
                            {trade.action === 'buy' ? '买入' : '卖出'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">{trade.price.toFixed(2)}</td>
                        <td className="px-4 py-2 text-text-muted text-xs truncate max-w-xs">{trade.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Portfolios Tab ===== */}
      {activeTab === 'portfolios' && (
        <div className="space-y-6">
          {/* Saved portfolios */}
          {savedPortfolios.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedPortfolios.map(portfolio => (
                <div key={portfolio.id} className="bg-bg-secondary rounded-xl border border-border-color p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{portfolio.name}</h4>
                      {portfolio.description && (
                        <p className="text-xs text-text-muted mt-1">{portfolio.description}</p>
                      )}
                      <p className="text-[10px] text-text-muted mt-1">
                        {new Date(portfolio.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => removePortfolio(portfolio.id)}
                      className="p-1 text-text-muted hover:text-accent-danger transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {/* Factor list */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {portfolio.factors.map(fw => {
                      const def = getAllFactorDefinitions().find(f => f.id === fw.factor_id)
                      return (
                        <span
                          key={fw.factor_id}
                          className={clsx(
                            'inline-block px-2 py-0.5 rounded text-[10px] font-medium',
                            fw.direction === 'long' ? 'bg-accent-success/10 text-accent-success' :
                            fw.direction === 'short' ? 'bg-accent-danger/10 text-accent-danger' :
                            'bg-accent-primary/10 text-accent-primary'
                          )}
                        >
                          {def?.name_cn || fw.factor_id}: {(fw.weight * 100).toFixed(0)}%
                        </span>
                      )
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2 bg-bg-tertiary/50 rounded text-center">
                      <div className="font-bold text-accent-primary">{portfolio.factors.length}</div>
                      <div className="text-text-muted">因子数量</div>
                    </div>
                    <div className="p-2 bg-bg-tertiary/50 rounded text-center">
                      <div className="font-bold text-accent-secondary">
                        {portfolio.factors.reduce((s, f) => s + f.weight, 0).toFixed(1)}
                      </div>
                      <div className="text-text-muted">总权重</div>
                    </div>
                  </div>
                  <button
                    onClick={() => loadPortfolio(portfolio)}
                    className="w-full py-2 bg-accent-primary/10 text-accent-primary text-sm font-medium rounded-lg hover:bg-accent-primary/20 transition-colors"
                  >
                    加载此组合
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-bg-secondary rounded-xl border border-border-color p-12 text-center">
              <Star size={48} className="mx-auto text-text-muted/30 mb-4" />
              <p className="text-text-muted">暂无保存的因子组合</p>
              <p className="text-text-muted/60 text-sm mt-1">在因子编辑器中配置并保存</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Equity Curve Chart (ASCII/SVG) ----

function EquityCurveChart({ data }: { data: { date: string; value: number }[] }) {
  if (!data || data.length < 2) return <div className="text-text-muted text-sm">数据不足</div>

  const values = data.map(d => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || 1
  const width = 800
  const height = 200
  const padding = 30

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((d.value - minVal) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  // Area path
  const areaPath = `M ${padding},${height - padding} L ${points} L ${width - padding},${height - padding} Z`

  // Grid lines
  const gridLines = []
  for (let i = 0; i <= 4; i++) {
    const y = padding + (i / 4) * (height - padding * 2)
    const val = maxVal - (i / 4) * range
    gridLines.push(
      <g key={i}>
        <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,4" className="text-border-color" />
        <text x={padding - 5} y={y + 4} textAnchor="end" fontSize="10" className="fill-text-muted font-mono">
          {val.toFixed(0)}
        </text>
      </g>
    )
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px]" style={{ color: 'var(--accent-primary)' }}>
        {gridLines}
        <path d={areaPath} fill="url(#gradient)" opacity="0.15" />
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Start and end labels */}
        <text x={padding} y={height - 5} fontSize="10" className="fill-text-muted font-mono" textAnchor="start">
          {data[0].date}
        </text>
        <text x={width - padding} y={height - 5} fontSize="10" className="fill-text-muted font-mono" textAnchor="end">
          {data[data.length - 1].date}
        </text>
        {/* Start value */}
        <text x={padding} y={height - padding - 5} fontSize="10" className="fill-accent-primary font-mono" textAnchor="start">
          {data[0].value.toFixed(0)}
        </text>
        {/* End value */}
        <text x={width - padding} y={height - padding - 5} fontSize="10" className="fill-accent-primary font-mono" textAnchor="end">
          {data[data.length - 1].value.toFixed(0)}
        </text>
      </svg>
    </div>
  )
}
