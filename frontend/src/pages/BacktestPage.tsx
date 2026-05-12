import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { runBacktest, getBacktestResults, explainBacktest } from '../services/api'
import { BarChart2, Play, Loader2, TrendingUp, TrendingDown, Target, Zap, Download, FileText } from 'lucide-react'
import { toCSV, downloadCSV } from '../utils/export'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import clsx from 'clsx'
import type { BacktestResponse } from '../types'
import WalkForwardPanel from '../components/WalkForwardPanel'
import MonteCarloPanel from '../components/MonteCarloPanel'

type BacktestTab = 'backtest' | 'walkforward' | 'montecarlo'

export default function BacktestPage() {
  const { showNotification } = useStore()
  const [activeTab, setActiveTab] = useState<BacktestTab>('backtest')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<BacktestResponse | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [strategyName, setStrategyName] = useState('')
  const [startDate, setStartDate] = useState('2023-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')
  const [initialCash, setInitialCash] = useState(1000000)
  const [reportMode, setReportMode] = useState(false)

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

  const handleGenerateReport = () => {
    if (!results) return
    setReportMode(true)
  }

  // Manage body background and hidden elements when in report mode
  useEffect(() => {
    if (!reportMode) return

    // Delay to ensure React has rendered the report div
    const timer = setTimeout(() => {
      // Find the report element (contains "print:block" class)
      const reportEl = document.querySelector('[class*="print:block"]') as HTMLElement | null

      if (!reportEl) return

      // Collect all elements to hide (everything except the report and its ancestors)
      const toRestore: Array<{ el: HTMLElement; display: string }> = []

      // Get all ancestors of the report element (for restoration later)
      const ancestors = new Set<Element>()
      let el: Element | null = reportEl.parentElement
      while (el) {
        ancestors.add(el)
        el = el.parentElement
      }

      // Hide body children that are NOT ancestors of the report
      document.body.querySelectorAll(':scope > *').forEach(child => {
        if (!ancestors.has(child)) {
          const htmlEl = child as HTMLElement
          toRestore.push({ el: htmlEl, display: htmlEl.style.display })
          htmlEl.style.display = 'none'
        }
      })

      // Force white background for print
      const origBg = document.body.style.background
      document.body.style.background = 'white'

      window.print()

      // Restore when print dialog closes (via afterprint event)
      const restore = () => {
        toRestore.forEach(({ el: e, display }) => {
          e.style.display = display
        })
        document.body.style.background = origBg
      }

      const afterPrintHandler = () => {
        restore()
        window.removeEventListener('afterprint', afterPrintHandler)
      }
      window.addEventListener('afterprint', afterPrintHandler)

      // Fallback: also restore on cancel (setTimeout as backup)
      const fallbackTimer = setTimeout(() => {
        window.removeEventListener('afterprint', afterPrintHandler)
        restore()
      }, 3000)

      return () => {
        clearTimeout(fallbackTimer)
        window.removeEventListener('afterprint', afterPrintHandler)
        restore()
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [reportMode])

  const handleExportEquityCSV = () => {
    if (!results) return
    const data = results.equity_curve.map((p: { date: string; value: number }) => ({
      日期: p.date,
      账户价值: p.value.toFixed(2),
    }))
    const csv = toCSV(data, [
      { key: '日期' as any, header: '日期' },
      { key: '账户价值' as any, header: '账户价值' },
    ])
    downloadCSV(csv, `equity_${Date.now()}.csv`)
  }

  const handleExportTradesCSV = () => {
    if (!results) return
    const data = (results as any).trades?.map((t: any) => ({
      日期: t.date || '',
      股票: t.symbol || t.stock_code || '',
      股票名称: t.name || '',
      操作: t.type === 'buy' ? '买入' : '卖出',
      价格: t.price?.toFixed(2) || '',
      数量: t.quantity || '',
      金额: t.price && t.quantity ? (t.price * t.quantity).toFixed(2) : '',
    })) || []
    const csv = toCSV(data, [
      { key: '日期' as any, header: '日期' },
      { key: '股票' as any, header: '股票代码' },
      { key: '股票名称' as any, header: '股票名称' },
      { key: '操作' as any, header: '操作' },
      { key: '价格' as any, header: '价格' },
      { key: '数量' as any, header: '数量' },
      { key: '金额' as any, header: '金额' },
    ])
    downloadCSV(csv, `trades_${Date.now()}.csv`)
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

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 bg-bg-tertiary rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('backtest')}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'backtest'
              ? 'bg-accent-primary text-bg-primary'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          标准回测
        </button>
        <button
          onClick={() => setActiveTab('walkforward')}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'walkforward'
              ? 'bg-accent-primary text-bg-primary'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          滚动回测
        </button>
        <button
          onClick={() => setActiveTab('montecarlo')}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'montecarlo'
              ? 'bg-accent-primary text-bg-primary'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          Monte Carlo
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'montecarlo' ? (
        <MonteCarloPanel />
      ) : activeTab === 'walkforward' ? (
        <WalkForwardPanel
          strategyName={strategyName || '均线回归策略'}
          strategyParams={{}}
        />
      ) : (
        <>
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportEquityCSV}
                      className="flex items-center gap-1 px-3 py-1.5 bg-accent-primary text-bg-primary rounded-lg text-xs hover:bg-accent-primary/90 transition-colors"
                      title="导出资金曲线CSV"
                    >
                      <Download size={12} />
                      资金曲线
                    </button>
                    <button
                      onClick={handleExportTradesCSV}
                      className="flex items-center gap-1 px-3 py-1.5 bg-accent-secondary text-bg-primary rounded-lg text-xs hover:bg-accent-secondary/90 transition-colors"
                      title="导出交易记录CSV"
                    >
                      <Download size={12} />
                      交易记录
                    </button>
                    <button
                      onClick={handleExplain}
                      className="text-sm text-accent-primary hover:underline"
                    >
                      AI解读
                    </button>
                    <button
                      onClick={handleGenerateReport}
                      className="flex items-center gap-1.5 px-4 py-2 bg-accent-secondary text-bg-primary font-medium rounded-lg hover:bg-accent-secondary/90 transition-colors text-sm"
                    >
                      <FileText size={16} />
                      生成报告
                    </button>
                  </div>
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
                  const r = typeof h.results === 'object' ? h.results : {};
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

          {/* Report Mode */}
          {reportMode && results && (
            <div className="print:!block print:bg-white print:p-8">
              {/* Report header */}
              <div className="text-center border-b border-gray-300 pb-4 mb-6 print:border-black">
                <h1 className="text-2xl font-bold print:text-black">量化回测报告</h1>
                <p className="text-sm text-text-muted print:text-black mt-1">
                  {results.strategy_name} · {new Date().toLocaleDateString('zh-CN')} 生成
                </p>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: '总收益率', value: `${(results.total_return * 100).toFixed(2)}%`, color: results.total_return >= 0 ? 'text-green-600' : 'text-red-600' },
                  { label: '年化收益率', value: `${(results.annual_return * 100).toFixed(2)}%`, color: results.annual_return >= 0 ? 'text-green-600' : 'text-red-600' },
                  { label: '最大回撤', value: `${(results.max_drawdown * 100).toFixed(2)}%`, color: 'text-red-600' },
                  { label: '夏普比率', value: results.sharpe_ratio.toFixed(2), color: 'text-blue-600' },
                  { label: '胜率', value: `${(results.win_rate * 100).toFixed(1)}%`, color: 'text-blue-600' },
                  { label: '总交易次数', value: String(results.total_trades), color: 'text-black' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 print:bg-gray-100 rounded-lg p-3 text-center border border-gray-200 print:border-black">
                    <div className="text-xs text-gray-500 print:text-black mb-1">{item.label}</div>
                    <div className={`text-lg font-bold ${item.color} print:text-black`}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Equity curve */}
              <div className="mb-6">
                <h2 className="text-base font-semibold mb-3 print:text-black border-b border-gray-200 print:border-black pb-2">资金曲线</h2>
                <div className="h-48 print:h-40">
                  <LineChart data={results.equity_curve} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </div>
              </div>

              {/* Trades summary */}
              {(results as any).trades && (results as any).trades.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-base font-semibold mb-3 print:text-black border-b border-gray-200 print:border-black pb-2">交易记录</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs print:text-black">
                      <thead>
                        <tr className="border-b border-gray-200 print:border-black">
                          <th className="text-left py-1">日期</th>
                          <th className="text-left py-1">股票</th>
                          <th className="text-left py-1">操作</th>
                          <th className="text-right py-1">价格</th>
                          <th className="text-right py-1">数量</th>
                          <th className="text-right py-1">金额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(results as any).trades.slice(0, 50).map((t: any, i: number) => (
                          <tr key={i} className="border-b border-gray-100 print:border-black">
                            <td className="py-1">{t.date || '-'}</td>
                            <td className="py-1">{t.symbol || t.stock_code || '-'}</td>
                            <td className="py-1">
                              <span className={t.type === 'buy' ? 'text-green-600' : 'text-red-600'}>
                                {t.type === 'buy' ? '买入' : '卖出'}
                              </span>
                            </td>
                            <td className="text-right py-1">{t.price?.toFixed(2) ?? '-'}</td>
                            <td className="text-right py-1">{t.quantity ?? '-'}</td>
                            <td className="text-right py-1">
                              {t.price && t.quantity ? (t.price * t.quantity).toFixed(2) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(results as any).trades.length > 50 && (
                      <p className="text-xs text-text-muted mt-2 print:text-black">（显示前50条，共{(results as any).trades.length}条）</p>
                    )}
                  </div>
                </div>
              )}

              {/* Report footer */}
              <div className="text-center text-xs text-text-muted print:text-black mt-8 pt-4 border-t border-gray-200 print:border-black">
                由 ai-stock-simulation 生成 · {new Date().toLocaleString('zh-CN')}
              </div>

              {/* Close button (not printed) */}
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setReportMode(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm print:hidden"
                >
                  关闭报告
                </button>
              </div>
            </div>
          )}
        </>
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
