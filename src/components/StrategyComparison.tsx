import { useState, useMemo } from 'react'
import { BarChart2, GripVertical, Plus, Trash2, Copy } from 'lucide-react'
import {
  ComposedChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import clsx from 'clsx'
import type { StrategyCard, MultiStrategyComparisonResponse } from '../types'

const STRATEGY_COLORS = [
  '#00d4ff', // cyan
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // violet
]

const STRATEGY_COLOR_BG = [
  'rgba(0, 212, 255, 0.1)',
  'rgba(245, 158, 11, 0.1)',
  'rgba(16, 185, 129, 0.1)',
  'rgba(139, 92, 246, 0.1)',
]

function generateId() {
  return `strategy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

const DEFAULT_STRATEGIES: StrategyCard[] = [
  { id: generateId(), name: 'MA5/MA20', shortPeriod: 5, longPeriod: 20, color: STRATEGY_COLORS[0], enabled: true },
  { id: generateId(), name: 'MA10/MA30', shortPeriod: 10, longPeriod: 30, color: STRATEGY_COLORS[1], enabled: true },
]

interface StrategyComparisonProps {
  onCompare: (strategies: StrategyCard[]) => void
  results: MultiStrategyComparisonResponse | null
  loading: boolean
}

type SortKey = 'total_return' | 'annual_return' | 'max_drawdown' | 'sharpe_ratio' | 'win_rate' | 'profit_loss_ratio' | 'total_trades'

export default function StrategyComparison({ onCompare, results, loading }: StrategyComparisonProps) {
  const [strategies, setStrategies] = useState<StrategyCard[]>(DEFAULT_STRATEGIES)
  const [sortKey, setSortKey] = useState<SortKey>('total_return')
  const [sortAsc, setSortAsc] = useState(false)
  const [symbol, setSymbol] = useState('600519')
  const [startDate, setStartDate] = useState('2023-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')
  const [initialCash, setInitialCash] = useState(1000000)

  const handleAddStrategy = () => {
    if (strategies.length >= 4) return
    const usedColors = strategies.map(s => s.color)
    const nextColor = STRATEGY_COLORS.find(c => !usedColors.includes(c)) || STRATEGY_COLORS[0]
    const nextIndex = strategies.length + 1
    setStrategies(prev => [...prev, {
      id: generateId(),
      name: `MA${nextIndex * 5}/MA${nextIndex * 10}`,
      shortPeriod: nextIndex * 5,
      longPeriod: nextIndex * 10,
      color: nextColor,
      enabled: true,
    }])
  }

  const handleRemoveStrategy = (id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id))
  }

  const handleCopyStrategy = (strategy: StrategyCard) => {
    if (strategies.length >= 4) return
    const usedColors = strategies.map(s => s.color)
    const nextColor = STRATEGY_COLORS.find(c => !usedColors.includes(c)) || STRATEGY_COLORS[0]
    setStrategies(prev => [...prev, {
      ...strategy,
      id: generateId(),
      color: nextColor,
      name: strategy.name + ' (副本)',
    }])
  }

  const handleToggleStrategy = (id: string) => {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  const handleUpdateStrategy = (id: string, field: keyof StrategyCard, value: string | number | boolean) => {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const handleRunCompare = () => {
    onCompare(strategies)
  }

  const sortedResults = useMemo(() => {
    if (!results) return null
    const sorted = [...results.strategies].sort((a, b) => {
      const aVal = a[sortKey as keyof typeof a]
      const bVal = b[sortKey as keyof typeof b]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal
      }
      return 0
    })
    return sorted
  }, [results, sortKey, sortAsc])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const combinedEquityData = useMemo(() => {
    if (!results || !results.strategies.length) return []
    const dateMap = new Map<string, Record<string, string | number>>()
    for (const s of results.strategies) {
      for (const point of s.equity_curve) {
        if (!dateMap.has(point.date)) {
          dateMap.set(point.date, { date: point.date })
        }
        dateMap.get(point.date)![s.strategy_id] = point.value
      }
    }
    return Array.from(dateMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }, [results])

  const SortIndicator = ({ active, asc }: { active: boolean; asc: boolean }) => (
    <span className={clsx('ml-1', !active && 'opacity-30')}>
      {active ? (asc ? '↑' : '↓') : '↕'}
    </span>
  )

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
          <BarChart2 size={22} className="text-accent-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">多策略对比</h1>
          <p className="text-text-muted text-sm">对比不同MA周期策略的收益表现</p>
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">策略配置</h3>
          <div className="flex gap-2">
            <span className="text-text-muted text-xs py-1.5">{strategies.length}/4 策略</span>
            <button
              onClick={handleAddStrategy}
              disabled={strategies.length >= 4}
              className={clsx(
                "px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5",
                strategies.length >= 4
                  ? "border-border-color text-text-muted cursor-not-allowed opacity-50"
                  : "border-accent-primary/50 text-accent-primary hover:bg-accent-primary/10"
              )}
            >
              <Plus size={14} />
              添加策略
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {strategies.map((strategy, index) => (
            <div
              key={strategy.id}
              className="flex items-center gap-3 p-3 rounded-lg border transition-colors"
              style={{
                borderColor: strategy.enabled ? strategy.color + '40' : 'var(--border-color)',
                backgroundColor: strategy.enabled ? STRATEGY_COLOR_BG[index] : 'transparent',
              }}
            >
              <GripVertical size={16} className="text-text-muted opacity-50" />

              <button
                onClick={() => handleToggleStrategy(strategy.id)}
                className={clsx(
                  "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                  strategy.enabled ? 'opacity-100' : 'opacity-40'
                )}
                style={{
                  borderColor: strategy.color,
                  backgroundColor: strategy.enabled ? strategy.color : 'transparent',
                }}
              >
                {strategy.enabled && <span className="text-bg-primary text-xs">✓</span>}
              </button>

              <input
                type="text"
                value={strategy.name}
                onChange={(e) => handleUpdateStrategy(strategy.id, 'name', e.target.value)}
                className="w-32 bg-bg-tertiary border border-border-color rounded px-2 py-1 text-sm focus:outline-none focus:border-accent-primary/50"
                style={{ color: strategy.enabled ? strategy.color : 'var(--text-muted)' }}
              />

              <div className="flex items-center gap-1.5">
                <label className="text-text-muted text-xs">短期:</label>
                <input
                  type="number"
                  value={strategy.shortPeriod}
                  onChange={(e) => handleUpdateStrategy(strategy.id, 'shortPeriod', Number(e.target.value))}
                  className="w-16 bg-bg-tertiary border border-border-color rounded px-2 py-1 text-xs focus:outline-none focus:border-accent-primary/50"
                  disabled={!strategy.enabled}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-text-muted text-xs">长期:</label>
                <input
                  type="number"
                  value={strategy.longPeriod}
                  onChange={(e) => handleUpdateStrategy(strategy.id, 'longPeriod', Number(e.target.value))}
                  className="w-16 bg-bg-tertiary border border-border-color rounded px-2 py-1 text-xs focus:outline-none focus:border-accent-primary/50"
                  disabled={!strategy.enabled}
                />
              </div>

              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: strategy.color }}
              />

              <div className="flex-1" />

              <button
                onClick={() => handleCopyStrategy(strategy)}
                disabled={strategies.length >= 4}
                className="p-1.5 text-text-muted hover:text-accent-primary disabled:opacity-30"
                title="复制策略"
              >
                <Copy size={14} />
              </button>

              <button
                onClick={() => handleRemoveStrategy(strategy.id)}
                disabled={strategies.length <= 1}
                className="p-1.5 text-text-muted hover:text-accent-danger disabled:opacity-30"
                title="删除策略"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Common Settings */}
        <div className="mt-4 pt-4 border-t border-border-color">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-text-muted text-xs mb-1">股票代码</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
                placeholder="600519"
              />
            </div>
            <div>
              <label className="block text-text-muted text-xs mb-1">开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
              />
            </div>
            <div>
              <label className="block text-text-muted text-xs mb-1">结束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
              />
            </div>
            <div>
              <label className="block text-text-muted text-xs mb-1">初始资金</label>
              <input
                type="number"
                value={initialCash}
                onChange={(e) => setInitialCash(Number(e.target.value))}
                className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleRunCompare}
          disabled={loading || strategies.filter(s => s.enabled).length < 1}
          className="mt-4 px-6 py-3 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <span className="animate-spin">⟳</span>
          ) : (
            <BarChart2 size={18} />
          )}
          运行对比
        </button>
      </div>

      {/* Results */}
      {results && sortedResults && (
        <>
          {/* Equity Curve Comparison */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">收益率曲线对比</h3>
              <div className="flex items-center gap-4 text-xs">
                {strategies.filter(s => s.enabled).map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5" style={{ backgroundColor: s.color }} />
                    <span className="text-text-muted">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={combinedEquityData}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickFormatter={(v) => v.slice(0, 7)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(v: any, name: string) => {
                      const strategy = strategies.find(s => (s.strategy_id || s.id) === name)
                      return [`¥${v.toLocaleString()}`, strategy?.name || name]
                    }}
                  />
                  <ReferenceLine y={initialCash} stroke="#6b7280" strokeDasharray="3 3" label="基准" />
                  {strategies.filter(s => s.enabled).map(s => (
                    <Area
                      key={s.id}
                      type="monotone"
                      dataKey={s.strategy_id || s.id}
                      stroke={s.color}
                      fill={s.color}
                      fillOpacity={0.05}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: s.color }}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Indicator Comparison Table */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">指标对比</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-color">
                    <th className="text-left py-2 px-3 text-text-muted font-medium">策略</th>
                    <th
                      className="text-right py-2 px-3 text-text-muted font-medium cursor-pointer hover:text-accent-primary"
                      onClick={() => handleSort('total_return')}
                    >
                      总收益率<SortIndicator active={sortKey === 'total_return'} asc={sortAsc} />
                    </th>
                    <th
                      className="text-right py-2 px-3 text-text-muted font-medium cursor-pointer hover:text-accent-primary"
                      onClick={() => handleSort('annual_return')}
                    >
                      年化收益<SortIndicator active={sortKey === 'annual_return'} asc={sortAsc} />
                    </th>
                    <th
                      className="text-right py-2 px-3 text-text-muted font-medium cursor-pointer hover:text-accent-primary"
                      onClick={() => handleSort('max_drawdown')}
                    >
                      最大回撤<SortIndicator active={sortKey === 'max_drawdown'} asc={sortAsc} />
                    </th>
                    <th
                      className="text-right py-2 px-3 text-text-muted font-medium cursor-pointer hover:text-accent-primary"
                      onClick={() => handleSort('sharpe_ratio')}
                    >
                      夏普比率<SortIndicator active={sortKey === 'sharpe_ratio'} asc={sortAsc} />
                    </th>
                    <th
                      className="text-right py-2 px-3 text-text-muted font-medium cursor-pointer hover:text-accent-primary"
                      onClick={() => handleSort('win_rate')}
                    >
                      胜率<SortIndicator active={sortKey === 'win_rate'} asc={sortAsc} />
                    </th>
                    <th
                      className="text-right py-2 px-3 text-text-muted font-medium cursor-pointer hover:text-accent-primary"
                      onClick={() => handleSort('profit_loss_ratio')}
                    >
                      盈亏比<SortIndicator active={sortKey === 'profit_loss_ratio'} asc={sortAsc} />
                    </th>
                    <th
                      className="text-right py-2 px-3 text-text-muted font-medium cursor-pointer hover:text-accent-primary"
                      onClick={() => handleSort('total_trades')}
                    >
                      交易次数<SortIndicator active={sortKey === 'total_trades'} asc={sortAsc} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((result, index) => {
                    const strategy = strategies.find(s => s.strategy_id === result.strategy_id)
                    const isBest = index === 0
                    return (
                      <tr
                        key={result.strategy_id}
                        className={clsx(
                          "border-b border-border-color/50",
                          isBest && "bg-accent-primary/5"
                        )}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {isBest && <span className="text-xs px-1.5 py-0.5 rounded bg-accent-primary/20 text-accent-primary">最优</span>}
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: result.color }} />
                            <span className="font-medium">{strategy?.name || result.strategy_name}</span>
                          </div>
                        </td>
                        <td className={clsx("text-right py-3 px-3 font-medium", result.total_return >= 0 ? 'text-accent-success' : 'text-accent-danger')}>
                          {result.total_return >= 0 ? '+' : ''}{result.total_return.toFixed(2)}%
                        </td>
                        <td className={clsx("text-right py-3 px-3", result.annual_return >= 0 ? 'text-accent-success' : 'text-accent-danger')}>
                          {result.annual_return >= 0 ? '+' : ''}{result.annual_return.toFixed(2)}%
                        </td>
                        <td className="text-right py-3 px-3 text-accent-danger">
                          -{result.max_drawdown.toFixed(2)}%
                        </td>
                        <td className="text-right py-3 px-3 text-accent-primary">
                          {result.sharpe_ratio.toFixed(2)}
                        </td>
                        <td className="text-right py-3 px-3 text-accent-secondary">
                          {result.win_rate.toFixed(1)}%
                        </td>
                        <td className="text-right py-3 px-3 text-accent-warning">
                          {result.profit_loss_ratio.toFixed(2)}
                        </td>
                        <td className="text-right py-3 px-3 text-text-primary">
                          {result.total_trades}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
