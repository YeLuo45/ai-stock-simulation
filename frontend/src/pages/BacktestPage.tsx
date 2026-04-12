import { useState } from 'react'
import { useStore } from '../store'
import { runBacktest, getBacktestResults, explainBacktest } from '../services/api'
import { BarChart2, Play, Loader2, TrendingUp, TrendingDown, Target, Zap } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import clsx from 'clsx'
import type { BacktestResponse } from '../types'

export default function BacktestPage() {
  const { showNotification } = useStore()
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<BacktestResponse | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [strategyName, setStrategyName] = useState('')
  const [startDate, setStartDate] = useState('2023-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')
  const [initialCash, setInitialCash] = useState(1000000)

  const handleRun = async () => {
    setRunning(true)
    try {
      const result = await runBacktest({
        strategy_name: strategyName || 'MA交叉策略',
        start_date: startDate,
        end_date: endDate,
        initial_cash: initialCash,
        params: {},
      })
      setResults(result)
      // Refresh history
      const historyData = await getBacktestResults()
      setHistory(historyData)
    } catch (err: any) {
      showNotification('error', err?.message ?? '回测失败')
    } finally {
      setRunning(false)
    }
  }

  const handleExplain = async () => {
    if (!results) return
    try {
      const explanation = await explainBacktest(results.strategy_name, results)
      showNotification('info', explanation.explanation ?? '解读完成')
    } catch (err) {
      showNotification('error', '解读失败')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
          <BarChart2 size={22} className="text-accent-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">策略回测</h1>
          <p className="text-text-muted text-sm">用历史数据验证您的交易策略</p>
        </div>
      </div>

      {/* Strategy config */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <h3 className="font-semibold mb-4">策略参数</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-text-muted text-xs mb-1">策略名称</label>
            <input
              type="text"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="MA交叉策略"
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
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
        <button
          onClick={handleRun}
          disabled={running}
          className="mt-4 px-6 py-3 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {running ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
          运行回测
        </button>
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard
              label="总收益率"
              value={`${results.total_return >= 0 ? '+' : ''}${results.total_return.toFixed(2)}%`}
              className={results.total_return >= 0 ? 'text-accent-success' : 'text-accent-danger'}
              icon={results.total_return >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            />
            <MetricCard
              label="年化收益"
              value={`${results.annual_return >= 0 ? '+' : ''}${results.annual_return.toFixed(2)}%`}
              className={results.annual_return >= 0 ? 'text-accent-success' : 'text-accent-danger'}
              icon={<Zap size={16} />}
            />
            <MetricCard
              label="最大回撤"
              value={`${results.max_drawdown.toFixed(2)}%`}
              className="text-accent-danger"
              icon={<TrendingDown size={16} />}
            />
            <MetricCard
              label="夏普比率"
              value={results.sharpe_ratio.toFixed(2)}
              className="text-accent-primary"
              icon={<Target size={16} />}
            />
            <MetricCard
              label="胜率"
              value={`${results.win_rate.toFixed(1)}%`}
              className="text-accent-secondary"
              icon={<Target size={16} />}
            />
            <MetricCard
              label="交易次数"
              value={results.total_trades.toString()}
              className="text-text-primary"
              icon={<BarChart2 size={16} />}
            />
          </div>

          {/* Equity curve */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">资金曲线</h3>
              <button
                onClick={handleExplain}
                className="text-sm text-accent-primary hover:underline"
              >
                AI解读
              </button>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results.equity_curve}>
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
                    formatter={(v: any) => [`¥${v.toLocaleString()}`, '资金']}
                  />
                  <ReferenceLine y={initialCash} stroke="#6b7280" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#00d4ff"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
          <h3 className="font-semibold mb-4">历史回测</h3>
          <div className="space-y-3">
            {history.slice(0, 5).map((h) => {
              const r = typeof h.results === 'object' ? h.results : {}
              return (
                <div key={h.id} className="flex items-center justify-between py-2 border-b border-border-color/50 last:border-0">
                  <div>
                    <span className="font-medium">{h.strategy_name}</span>
                    <span className="text-text-muted text-xs ml-2">
                      {new Date(h.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className={clsx(
                    'font-mono font-medium',
                    r.total_return >= 0 ? 'text-accent-success' : 'text-accent-danger'
                  )}>
                    {r.total_return >= 0 ? '+' : ''}{r.total_return?.toFixed(2) ?? 0}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!results && history.length === 0 && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-12 text-center">
          <BarChart2 size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
          <p className="text-text-muted text-lg mb-2">配置策略参数开始回测</p>
          <p className="text-text-muted text-sm">回测将使用历史行情数据验证策略有效性</p>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon,
  className = 'text-text-primary',
}: {
  label: string
  value: string
  icon: React.ReactNode
  className?: string
}) {
  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
      <div className="flex items-center gap-2 mb-2 text-text-muted text-xs">
        {icon}
        {label}
      </div>
      <div className={clsx('font-mono text-xl font-bold', className)}>{value}</div>
    </div>
  )
}
