import { useState, useMemo } from 'react'
import { useStore } from '../store'
import {
  generatePriceHistory,
  trendFollowingBacktest,
  meanReversionBacktest,
  rsiBacktest,
  macdTrendBacktest,
} from '../services/indicators'
import type { BacktestResult, BacktestTrade, MonthlyStat } from '../types'
import {
  BarChart3, Play, Loader2, X, ChevronUp, ChevronDown,
  TrendingUp, TrendingDown, Target, Zap, BarChart2
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend
} from 'recharts'
import clsx from 'clsx'

const PRESET_STRATEGIES = [
  { id: 'ma', label: 'MA双均线', desc: '均线金叉死叉趋势跟踪', fn: 'trendFollowing' },
  { id: 'rsi', label: 'RSI均值回归', desc: 'RSI超买超卖反转策略', fn: 'rsiBacktest' },
  { id: 'boll', label: '布林带突破', desc: '布林带通道突破策略', fn: 'meanReversion' },
  { id: 'macd', label: 'MACD交叉', desc: 'MACD金叉死叉趋势策略', fn: 'macdTrend' },
  { id: 'hybrid', label: '混合策略', desc: '多指标综合判断', fn: 'hybrid' },
]

const STRATEGY_FNS: Record<string, (history: any[], cash: number, params?: any) => any> = {
  trendFollowing: (h, c) => trendFollowingBacktest(h, c, { ma_short: 5, ma_long: 20 }),
  rsiBacktest: (h, c) => rsiBacktest(h, c, { rsi_period: 14, oversold: 30, overbought: 70 }),
  meanReversion: (h, c) => meanReversionBacktest(h, c, { sell_threshold: 0.02, buy_threshold: -0.02 }),
  macdTrend: (h, c) => macdTrendBacktest(h, c, { macd_fast: 12, macd_slow: 26, macd_signal: 9 }),
  hybrid: (h, c) => {
    // Combine MACD + RSI signals
    const macd = macdTrendBacktest(h, c, { macd_fast: 12, macd_slow: 26, macd_signal: 9 })
    const rsi = rsiBacktest(h, c, { rsi_period: 14, oversold: 30, overbought: 70 })
    // Pick whichever has better total return
    return macd.total_return >= rsi.total_return ? macd : rsi
  },
}

// Map raw indicator result to BacktestResult
function mapToBacktestResult(raw: any, strategyName: string): BacktestResult {
  // Calculate profit/loss ratio
  const trades = raw.trades || []
  let totalWin = 0, totalLoss = 0
  let winCount = 0, lossCount = 0
  for (let i = 0; i < trades.length; i += 2) {
    if (i + 1 < trades.length) {
      const buy = trades[i]
      const sell = trades[i + 1]
      const pnl = (sell.price - buy.price) * buy.quantity
      if (pnl > 0) { totalWin += pnl; winCount++ }
      else { totalLoss += Math.abs(pnl); lossCount++ }
    }
  }
  const profitLossRatio = totalLoss > 0 ? (totalWin / totalLoss) : (totalWin > 0 ? totalWin : 0)

  // Monthly stats
  const monthlyMap = new Map<string, { count: number; startVal: number; endVal: number }>()
  for (const pt of raw.equity_curve || []) {
    const month = pt.date.slice(0, 7)
    if (!monthlyMap.has(month)) monthlyMap.set(month, { count: 0, startVal: 0, endVal: 0 })
    const entry = monthlyMap.get(month)!
    if (entry.count === 0) entry.startVal = pt.value
    entry.endVal = pt.value
    entry.count++
  }
  const monthlyStats: MonthlyStat[] = []
  let prevEnd = raw.equity_curve?.[0]?.value || 0
  const sortedMonths = [...monthlyMap.keys()].sort()
  for (const month of sortedMonths) {
    const entry = monthlyMap.get(month)!
    const monthlyReturn = prevEnd > 0 ? ((entry.endVal - prevEnd) / prevEnd) * 100 : 0
    monthlyStats.push({ month, return: monthlyReturn })
    prevEnd = entry.endVal
  }

  // Trade log
  const tradeLog: BacktestTrade[] = trades.map((t: any) => ({
    date: t.date,
    type: t.action,
    symbol: 'AAPL',
    price: t.price,
    quantity: 100,
    pnl: 0,
  }))

  return {
    strategyName,
    annualReturn: raw.annual_return || 0,
    sharpeRatio: raw.sharpe_ratio || 0,
    maxDrawdown: raw.max_drawdown || 0,
    winRate: (raw.win_rate || 0) * 100,
    profitLossRatio,
    totalTrades: trades.length,
    equityCurve: raw.equity_curve || [],
    monthlyStats,
    tradeLog,
  }
}

// Compute buy-and-hold benchmark equity curve
function computeBuyAndHold(history: any[], initialCash: number): { date: string; value: number }[] {
  if (!history.length) return []
  const firstPrice = history[0].close
  const shares = Math.floor(initialCash / firstPrice)
  return history.map(h => ({ date: h.date, value: shares * h.close }))
}

const CHART_COLORS = ['#00d4ff', '#ff6b6b', '#ffd93d', '#6bcb77', '#9b59b6']

type SortKey = 'annualReturn' | 'sharpeRatio' | 'maxDrawdown' | 'winRate' | 'profitLossRatio' | 'totalTrades'

export default function BacktestComparePage() {
  const { showNotification } = useStore()
  const [selectedIds, setSelectedIds] = useState<string[]>(['ma', 'rsi'])
  const [startDate, setStartDate] = useState('2023-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')
  const [initialCash, setInitialCash] = useState(1000000)
  const [commissionFee, setCommissionFee] = useState(0.0003)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<BacktestResult[]>([])
  const [benchmarkCurve, setBenchmarkCurve] = useState<{ date: string; value: number }[]>([])
  const [selectedResult, setSelectedResult] = useState<BacktestResult | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('annualReturn')
  const [sortAsc, setSortAsc] = useState(false)

  const toggleStrategy = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id)
      if (prev.length >= 5) {
        showNotification('info', '最多选择5个策略')
        return prev
      }
      return [...prev, id]
    })
  }

  const handleRun = async () => {
    if (selectedIds.length === 0) {
      showNotification('error', '请至少选择一个策略')
      return
    }
    setRunning(true)
    setResults([])
    setBenchmarkCurve([])

    try {
      // Generate history data for a single representative stock
      const basePrice = 150
      const days = Math.max(60, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))
      const history = generatePriceHistory(basePrice, days)

      const selectedStrategies = PRESET_STRATEGIES.filter(s => selectedIds.includes(s.id))

      const rawResults = await Promise.all(
        selectedStrategies.map(s => {
          const fn = STRATEGY_FNS[s.fn]
          return fn(history, initialCash)
        })
      )

      const mapped: BacktestResult[] = rawResults.map((r, i) =>
        mapToBacktestResult(r, selectedStrategies[i].label)
      )

      // Compute benchmark
      const benchmark = computeBuyAndHold(history, initialCash)

      setResults(mapped)
      setBenchmarkCurve(benchmark)
      showNotification('success', `回测完成，共${mapped.length}个策略`)
    } catch (err: any) {
      showNotification('error', err?.message ?? '回测失败')
    } finally {
      setRunning(false)
    }
  }

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const aVal = a[sortKey] as number
      const bVal = b[sortKey] as number
      if (sortKey === 'maxDrawdown') {
        return sortAsc ? aVal - bVal : bVal - aVal
      }
      return sortAsc ? aVal - bVal : bVal - aVal
    })
  }, [results, sortKey, sortAsc])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp size={12} className="opacity-0" />
    return sortAsc ? <ChevronUp size={12} className="text-accent-primary" /> : <ChevronDown size={12} className="text-accent-primary" />
  }

  // Prepare chart data - merge all equity curves + benchmark into one dataset by date
  const chartData = useMemo(() => {
    if (!results.length) return []
    const dateMap = new Map<string, Record<string, number>>()
    for (const r of results) {
      for (const pt of r.equityCurve) {
        if (!dateMap.has(pt.date)) dateMap.set(pt.date, {})
        dateMap.get(pt.date)![r.strategyName] = pt.value
      }
    }
    if (benchmarkCurve.length) {
      for (const pt of benchmarkCurve) {
        if (!dateMap.has(pt.date)) dateMap.set(pt.date, {})
        dateMap.get(pt.date)!['基准(买入持有)'] = pt.value
      }
    }
    return [...dateMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, vals]) => ({ date, ...vals }))
  }, [results, benchmarkCurve])

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
          <BarChart3 size={22} className="text-accent-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">多策略回测对比</h1>
          <p className="text-text-muted text-sm">同时运行最多5个策略，直观对比绩效差异</p>
        </div>
      </div>

      {/* Strategy Selector */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <h3 className="font-semibold mb-3">选择策略（最多5个）</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {PRESET_STRATEGIES.map(s => {
            const isSelected = selectedIds.includes(s.id)
            return (
              <button
                key={s.id}
                onClick={() => toggleStrategy(s.id)}
                className={clsx(
                  'relative p-3 rounded-lg border text-left transition-all',
                  isSelected
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-border-color bg-bg-tertiary hover:border-accent-primary/50'
                )}
              >
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-primary rounded-full flex items-center justify-center">
                    <span className="text-[10px] text-bg-primary font-bold">✓</span>
                  </div>
                )}
                <div className="font-medium text-sm">{s.label}</div>
                <div className="text-text-muted text-xs mt-1">{s.desc}</div>
              </button>
            )
          })}
        </div>
        <div className="mt-2 text-xs text-text-muted">
          已选 {selectedIds.length}/5 个策略
        </div>
      </div>

      {/* Unified Params */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <h3 className="font-semibold mb-4">统一回测参数</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-text-muted text-xs mb-1">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs mb-1">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs mb-1">初始资金</label>
            <input
              type="number"
              value={initialCash}
              onChange={e => setInitialCash(Number(e.target.value))}
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs mb-1">手续费率</label>
            <input
              type="number"
              step="0.0001"
              value={commissionFee}
              onChange={e => setCommissionFee(Number(e.target.value))}
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>
        </div>
        <button
          onClick={handleRun}
          disabled={running || selectedIds.length === 0}
          className="mt-4 px-6 py-3 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {running ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
          {running ? '回测中...' : '开始回测'}
        </button>
      </div>

      {/* Results */}
      {sortedResults.length > 0 && (
        <>
          {/* Comparison Table */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-4">绩效对比</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-color">
                    <th className="text-left py-2 pr-4 text-text-muted font-medium">策略</th>
                    <th className="text-right py-2 px-2 text-text-muted font-medium cursor-pointer select-none" onClick={() => handleSort('annualReturn')}>
                      <span className="flex items-center justify-end gap-1">年化收益 <SortIcon k="annualReturn" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-text-muted font-medium cursor-pointer select-none" onClick={() => handleSort('sharpeRatio')}>
                      <span className="flex items-center justify-end gap-1">夏普比率 <SortIcon k="sharpeRatio" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-text-muted font-medium cursor-pointer select-none" onClick={() => handleSort('maxDrawdown')}>
                      <span className="flex items-center justify-end gap-1">最大回撤 <SortIcon k="maxDrawdown" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-text-muted font-medium cursor-pointer select-none" onClick={() => handleSort('winRate')}>
                      <span className="flex items-center justify-end gap-1">胜率 <SortIcon k="winRate" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-text-muted font-medium cursor-pointer select-none" onClick={() => handleSort('profitLossRatio')}>
                      <span className="flex items-center justify-end gap-1">盈亏比 <SortIcon k="profitLossRatio" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-text-muted font-medium cursor-pointer select-none" onClick={() => handleSort('totalTrades')}>
                      <span className="flex items-center justify-end gap-1">交易次数 <SortIcon k="totalTrades" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((r, idx) => {
                    const isBest = idx === 0
                    const isWorst = idx === sortedResults.length - 1
                    return (
                      <tr
                        key={r.strategyName}
                        className="border-b border-border-color/50 hover:bg-bg-tertiary cursor-pointer transition-colors"
                        onClick={() => setSelectedResult(r)}
                      >
                        <td className="py-3 pr-4">
                          <span className={clsx('font-medium', isBest && 'text-accent-primary')}>{r.strategyName}</span>
                        </td>
                        <td className={clsx('text-right py-3 px-2 font-mono', isBest ? 'text-accent-success font-bold' : isWorst ? 'text-accent-danger' : 'text-text-primary')}>
                          {r.annualReturn >= 0 ? '+' : ''}{r.annualReturn.toFixed(2)}%
                        </td>
                        <td className={clsx('text-right py-3 px-2 font-mono', isBest ? 'text-accent-primary font-bold' : 'text-text-primary')}>
                          {r.sharpeRatio.toFixed(2)}
                        </td>
                        <td className={clsx('text-right py-3 px-2 font-mono', isWorst ? 'text-accent-danger font-bold' : 'text-text-primary')}>
                          -{r.maxDrawdown.toFixed(2)}%
                        </td>
                        <td className={clsx('text-right py-3 px-2 font-mono', isBest ? 'text-accent-secondary font-bold' : 'text-text-primary')}>
                          {r.winRate.toFixed(1)}%
                        </td>
                        <td className="text-right py-3 px-2 font-mono text-text-primary">
                          {r.profitLossRatio.toFixed(2)}
                        </td>
                        <td className="text-right py-3 px-2 font-mono text-text-primary">
                          {r.totalTrades}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Equity Curve Comparison */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-4">资金曲线对比</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickFormatter={v => v.slice(0, 7)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickFormatter={v => `¥${(v / 10000).toFixed(0)}万`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(v: any, name: string) => [`¥${v?.toLocaleString() ?? v}`, name]}
                  />
                  <ReferenceLine y={initialCash} stroke="#6b7280" strokeDasharray="3 3" label={{ value: '基准线', position: 'insideTopRight', fontSize: 10, fill: '#6b7280' }} />
                  {sortedResults.map((r, i) => (
                    <Line
                      key={r.strategyName}
                      type="monotone"
                      dataKey={r.strategyName}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                  {benchmarkCurve.length > 0 && (
                    <Line
                      type="monotone"
                      dataKey="基准(买入持有)"
                      stroke="#6b7280"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  )}
                  <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    formatter={(value) => <span className="text-text-secondary">{value}</span>}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!running && sortedResults.length === 0 && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-12 text-center">
          <BarChart3 size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
          <p className="text-text-muted text-lg mb-2">选择策略并设置参数开始回测</p>
          <p className="text-text-muted text-sm">最多同时对比5个策略的绩效表现</p>
        </div>
      )}

      {/* Detail Report Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-bg-secondary border-b border-border-color px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{selectedResult.strategyName} — 详细报告</h2>
                <p className="text-text-muted text-sm">点击外部或关闭按钮退出</p>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 px-6 py-4 border-b border-border-color">
              <MetricCard label="年化收益" value={`${selectedResult.annualReturn >= 0 ? '+' : ''}${selectedResult.annualReturn.toFixed(2)}%`} icon={<TrendingUp size={14} />} className={selectedResult.annualReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'} />
              <MetricCard label="夏普比率" value={selectedResult.sharpeRatio.toFixed(2)} icon={<Target size={14} />} className="text-accent-primary" />
              <MetricCard label="最大回撤" value={`-${selectedResult.maxDrawdown.toFixed(2)}%`} icon={<TrendingDown size={14} />} className="text-accent-danger" />
              <MetricCard label="胜率" value={`${selectedResult.winRate.toFixed(1)}%`} icon={<Target size={14} />} className="text-accent-secondary" />
              <MetricCard label="盈亏比" value={selectedResult.profitLossRatio.toFixed(2)} icon={<Zap size={14} />} className="text-text-primary" />
              <MetricCard label="交易次数" value={selectedResult.totalTrades.toString()} icon={<BarChart2 size={14} />} className="text-text-primary" />
            </div>

            {/* Monthly Stats */}
            {selectedResult.monthlyStats.length > 0 && (
              <div className="px-6 py-4 border-b border-border-color">
                <h3 className="font-semibold mb-3">月度收益统计</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                  {selectedResult.monthlyStats.map(ms => (
                    <div key={ms.month} className="bg-bg-tertiary rounded-lg p-2 text-center">
                      <div className="text-text-muted text-xs">{ms.month}</div>
                      <div className={clsx('font-mono text-sm font-medium', ms.return >= 0 ? 'text-accent-success' : 'text-accent-danger')}>
                        {ms.return >= 0 ? '+' : ''}{ms.return.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trade Log */}
            {selectedResult.tradeLog.length > 0 && (
              <div className="px-6 py-4">
                <h3 className="font-semibold mb-3">交易明细（共{selectedResult.tradeLog.length}笔）</h3>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-bg-secondary">
                      <tr className="border-b border-border-color">
                        <th className="text-left py-2 pr-4 text-text-muted">日期</th>
                        <th className="text-left py-2 px-2 text-text-muted">操作</th>
                        <th className="text-right py-2 px-2 text-text-muted">价格</th>
                        <th className="text-right py-2 px-2 text-text-muted">数量</th>
                        <th className="text-right py-2 px-2 text-text-muted">盈亏</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedResult.tradeLog.map((t, i) => (
                        <tr key={i} className="border-b border-border-color/30">
                          <td className="py-2 pr-4">{t.date}</td>
                          <td className="py-2 px-2">
                            <span className={clsx('font-medium', t.type === 'buy' ? 'text-accent-success' : 'text-accent-danger')}>
                              {t.type === 'buy' ? '买入' : '卖出'}
                            </span>
                          </td>
                          <td className="text-right py-2 px-2 font-mono">{t.price.toFixed(2)}</td>
                          <td className="text-right py-2 px-2 font-mono">{t.quantity}</td>
                          <td className={clsx('text-right py-2 px-2 font-mono', t.pnl >= 0 ? 'text-accent-success' : 'text-accent-danger')}>
                            {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  label, value, icon, className = 'text-text-primary'
}: {
  label: string; value: string; icon: React.ReactNode; className?: string
}) {
  return (
    <div className="bg-bg-tertiary rounded-lg p-3 text-center">
      <div className="flex items-center justify-center gap-1 mb-1 text-text-muted text-xs">
        {icon}
        {label}
      </div>
      <div className={clsx('font-mono text-lg font-bold', className)}>{value}</div>
    </div>
  )
}
