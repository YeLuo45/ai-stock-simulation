import { useState, useCallback } from 'react'
import { useStore } from '../store'
import { runBacktest, getBacktestResults, explainBacktest, type BacktestIndicator } from '../services/api'
import { BarChart2, Play, Loader2, TrendingUp, TrendingDown, Target, Zap, Trash2, Settings2, PieChart, Download } from 'lucide-react'
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell, ComposedChart, Area, AreaChart
} from 'recharts'
import clsx from 'clsx'
import type { BacktestResponse } from '../types'
import KLineChart from '../components/KLineChart'
import { exportBacktestToCSV } from '../services/export'

// Indicator presets
const INDICATOR_PRESETS: Record<string, BacktestIndicator> = {
  MA5: { type: 'MA', enabled: true, params: { period: 5 } },
  MA10: { type: 'MA', enabled: true, params: { period: 10 } },
  MA20: { type: 'MA', enabled: true, params: { period: 20 } },
  MA60: { type: 'MA', enabled: false, params: { period: 60 } },
  RSI: { type: 'RSI', enabled: true, params: { period: 14, overbought: 70, oversold: 30 } },
  MACD: { type: 'MACD', enabled: true, params: { fast: 12, slow: 26, signal: 9 } },
  KDJ: { type: 'KDJ', enabled: false, params: { period: 9, k: 3, d: 3 } },
  BOLL: { type: 'BOLL', enabled: false, params: { period: 20, std: 2 } },
}

export default function BacktestPage() {
  const { showNotification } = useStore()
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<BacktestResponse | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [strategyName, setStrategyName] = useState('')
  const [startDate, setStartDate] = useState('2023-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')
  const [initialCash, setInitialCash] = useState(1000000)
  
  // Custom indicators UI
  const [indicators, setIndicators] = useState<BacktestIndicator[]>([
    { ...INDICATOR_PRESETS.MA5 },
    { ...INDICATOR_PRESETS.MA10 },
    { ...INDICATOR_PRESETS.RSI },
    { ...INDICATOR_PRESETS.MACD },
  ])
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false)
  
  // Optimization mode
  const [optimizationMode, setOptimizationMode] = useState(false)
  const [optimizationParams, setOptimizationParams] = useState<Record<string, [number, number, number]>>({
    'MA.period': [5, 60, 5],
    'RSI.period': [7, 21, 2],
    'RSI.overbought': [60, 80, 5],
    'RSI.oversold': [20, 40, 5],
  })

  const toggleIndicator = useCallback((type: string) => {
    setIndicators(prev => prev.map(ind => 
      ind.type === type ? { ...ind, enabled: !ind.enabled } : ind
    ))
  }, [])

  const updateIndicatorParam = useCallback((type: string, param: string, value: number) => {
    setIndicators(prev => prev.map(ind => 
      ind.type === type ? { ...ind, params: { ...ind.params, [param]: value } } : ind
    ))
  }, [])

  const addIndicator = useCallback((presetKey: string) => {
    const preset = INDICATOR_PRESETS[presetKey]
    if (preset && !indicators.find(i => i.type === preset.type)) {
      setIndicators(prev => [...prev, { ...preset }])
    }
  }, [indicators])

  const removeIndicator = useCallback((type: string) => {
    setIndicators(prev => prev.filter(ind => ind.type !== type))
  }, [])

  const handleRun = async () => {
    setRunning(true)
    try {
      const result = await runBacktest({
        strategy_name: strategyName || '自定义策略',
        symbols: ['600519'], // 默认使用贵州茅台
        start_date: startDate,
        end_date: endDate,
        initial_cash: initialCash,
        params: { indicators, optimizationMode, optimizationParams },
      })
      setResults(result)
      const historyData = await getBacktestResults()
      setHistory(historyData)
    } catch (err: any) {
      showNotification('error', err?.message ?? '回测失败')
    } finally {
      setRunning(false)
    }
  }

  const handleExportCSV = () => {
    if (results) {
      exportBacktestToCSV(results)
      showNotification('success', '报告已导出')
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

  const equityColor = results ? (results.total_return >= 0 ? '#10b981' : '#ef4444') : '#00d4ff'
  const drawdownColor = '#ef4444'

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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">策略参数</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
              className={clsx(
                "px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5",
                showIndicatorPanel 
                  ? "bg-accent-primary/20 border-accent-primary text-accent-primary"
                  : "border-border-color text-text-muted hover:border-accent-primary/50"
              )}
            >
              <Settings2 size={14} />
              指标参数
            </button>
            <button
              onClick={() => setOptimizationMode(!optimizationMode)}
              className={clsx(
                "px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5",
                optimizationMode
                  ? "bg-accent-secondary/20 border-accent-secondary text-accent-secondary"
                  : "border-border-color text-text-muted hover:border-accent-secondary/50"
              )}
            >
              <Zap size={14} />
              参数优化
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-text-muted text-xs mb-1">策略名称</label>
            <input
              type="text"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="自定义策略"
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

        {/* Custom Indicators Panel */}
        {showIndicatorPanel && (
          <div className="mt-4 p-4 bg-bg-tertiary rounded-lg border border-border-color">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">技术指标配置</span>
              <div className="flex gap-1">
                {Object.keys(INDICATOR_PRESETS).map(key => {
                  const preset = INDICATOR_PRESETS[key]
                  const isAdded = indicators.some(i => i.type === preset.type)
                  return (
                    <button
                      key={key}
                      onClick={() => addIndicator(key)}
                      disabled={isAdded}
                      className={clsx(
                        "px-2 py-1 text-xs rounded border",
                        isAdded 
                          ? "border-border-color text-text-muted cursor-not-allowed opacity-50"
                          : "border-accent-primary/50 text-accent-primary hover:bg-accent-primary/10"
                      )}
                    >
                      +{key}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-3">
              {indicators.map(indicator => (
                <div key={indicator.type} className="flex items-center gap-3 p-2 bg-bg-secondary rounded-lg">
                  <div className="flex items-center gap-2 w-28">
                    <button
                      onClick={() => toggleIndicator(indicator.type)}
                      className={clsx(
                        "w-4 h-4 rounded border flex items-center justify-center",
                        indicator.enabled 
                          ? "bg-accent-primary border-accent-primary"
                          : "border-border-color"
                      )}
                    >
                      {indicator.enabled && <span className="text-bg-primary text-xs">✓</span>}
                    </button>
                    <span className="text-sm font-medium">{indicator.type}</span>
                    <button
                      onClick={() => removeIndicator(indicator.type)}
                      className="text-text-muted hover:text-accent-danger"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="flex-1 flex gap-2">
                    {Object.entries(indicator.params).map(([param, value]) => (
                      <div key={param} className="flex items-center gap-1">
                        <label className="text-text-muted text-xs">{param}:</label>
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => updateIndicatorParam(indicator.type, param, Number(e.target.value))}
                          className="w-16 bg-bg-tertiary border border-border-color rounded px-2 py-1 text-xs focus:outline-none focus:border-accent-primary/50"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optimization Panel */}
        {optimizationMode && (
          <div className="mt-4 p-4 bg-bg-tertiary rounded-lg border border-border-color">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">参数优化范围</span>
              <span className="text-text-muted text-xs">格式: 最小值, 最大值, 步长</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(optimizationParams).map(([key, [min, max, step]]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="text-text-muted text-xs w-20 truncate">{key}</span>
                  <input
                    type="number"
                    value={min}
                    onChange={(e) => setOptimizationParams(prev => ({ 
                      ...prev, [key]: [Number(e.target.value), max, step] 
                    }))}
                    className="w-14 bg-bg-secondary border border-border-color rounded px-1.5 py-1 text-xs focus:outline-none"
                    placeholder="最小"
                  />
                  <input
                    type="number"
                    value={max}
                    onChange={(e) => setOptimizationParams(prev => ({ 
                      ...prev, [key]: [min, Number(e.target.value), step] 
                    }))}
                    className="w-14 bg-bg-secondary border border-border-color rounded px-1.5 py-1 text-xs focus:outline-none"
                    placeholder="最大"
                  />
                  <input
                    type="number"
                    value={step}
                    onChange={(e) => setOptimizationParams(prev => ({ 
                      ...prev, [key]: [min, max, Number(e.target.value)] 
                    }))}
                    className="w-12 bg-bg-secondary border border-border-color rounded px-1.5 py-1 text-xs focus:outline-none"
                    placeholder="步长"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={running}
          className="mt-4 px-6 py-3 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {running ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
          {optimizationMode ? '运行参数优化' : '运行回测'}
        </button>
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <MetricCard
              label="总收益率"
              value={`${results.total_return >= 0 ? '+' : ''}${results.total_return.toFixed(2)}%`}
              className={results.total_return >= 0 ? 'text-accent-success' : 'text-accent-danger'}
              icon={results.total_return >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            />
            <MetricCard
              label="年化收益"
              value={`${results.annual_return >= 0 ? '+' : ''}${results.annual_return.toFixed(2)}%`}
              className={results.annual_return >= 0 ? 'text-accent-success' : 'text-accent-danger'}
              icon={<Zap size={14} />}
            />
            <MetricCard
              label="最大回撤"
              value={`${results.max_drawdown.toFixed(2)}%`}
              className="text-accent-danger"
              icon={<TrendingDown size={14} />}
            />
            <MetricCard
              label="夏普比率"
              value={results.sharpe_ratio.toFixed(2)}
              className="text-accent-primary"
              icon={<Target size={14} />}
            />
            <MetricCard
              label="胜率"
              value={`${results.win_rate.toFixed(1)}%`}
              className="text-accent-secondary"
              icon={<Target size={14} />}
            />
            <MetricCard
              label="盈亏比"
              value={results.profit_loss_ratio.toFixed(2)}
              className="text-accent-warning"
              icon={<PieChart size={14} />}
            />
            <MetricCard
              label="交易次数"
              value={results.total_trades.toString()}
              className="text-text-primary"
              icon={<BarChart2 size={14} />}
            />
          </div>

          {/* K线图 */}
          {results.kline_data && results.kline_data.length > 0 && (
            <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
              <KLineChart data={results.kline_data} symbol="600519" height={350} />
            </div>
          )}

          {/* Equity Curve + Benchmark */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">资金曲线</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 text-xs rounded-lg border border-accent-primary/50 text-accent-primary hover:bg-accent-primary/10 flex items-center gap-1.5"
                >
                  <Download size={14} />
                  导出CSV
                </button>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-accent-primary" />
                    <span className="text-text-muted">策略收益</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-text-muted opacity-50" style={{ borderStyle: 'dashed' }} />
                    <span className="text-text-muted">基准线</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={results.equity_curve}>
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
                  <ReferenceLine y={initialCash} stroke="#6b7280" strokeDasharray="3 3" label="基准" />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={equityColor}
                    fill={equityColor}
                    fillOpacity={0.1}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: equityColor }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Drawdown Chart */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-4">回撤分析</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={results.drawdown_curve}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickFormatter={(v) => v.slice(0, 7)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(v: any, name: string) => [
                      name === 'drawdown' ? `${v.toFixed(2)}%` : `¥${v.toLocaleString()}`,
                      name === 'drawdown' ? '回撤' : '资金'
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="drawdown"
                    stroke={drawdownColor}
                    fill={drawdownColor}
                    fillOpacity={0.2}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Returns + Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly Returns */}
            <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
              <h3 className="font-semibold mb-4">月度收益</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.monthly_returns}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(v: any) => [`${v.toFixed(2)}%`, '月收益']}
                    />
                    <ReferenceLine y={0} stroke="#374151" />
                    <Bar dataKey="return_pct" radius={[4, 4, 0, 0]}>
                      {results.monthly_returns.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.return_pct >= 0 ? '#10b981' : '#ef4444'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Return Distribution */}
            <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
              <h3 className="font-semibold mb-4">收益分布</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.return_distribution} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <YAxis 
                      type="category" 
                      dataKey="range" 
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(v: any, _: any, props: any) => [
                        `${v}次 (${props.payload.percentage}%)`, 
                        '交易次数'
                      ]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {results.return_distribution.map((entry, index) => {
                        const isPositive = entry.range.includes("0%~") || entry.range.includes(">10%");
                        return <Cell key={`cell-${index}`} fill={isPositive ? '#10b981' : '#ef4444'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Trade Log */}
          {results.trades && results.trades.length > 0 && (
            <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">交易记录</h3>
                <button
                  onClick={handleExplain}
                  className="text-sm text-accent-primary hover:underline"
                >
                  AI解读
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-muted border-b border-border-color">
                      <th className="text-left py-2 px-3 font-normal">日期</th>
                      <th className="text-left py-2 px-3 font-normal">标的</th>
                      <th className="text-left py-2 px-3 font-normal">类型</th>
                      <th className="text-right py-2 px-3 font-normal">价格</th>
                      <th className="text-right py-2 px-3 font-normal">数量</th>
                      <th className="text-right py-2 px-3 font-normal">金额</th>
                      <th className="text-right py-2 px-3 font-normal">盈亏</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.trades.slice(0, 10).map((trade, idx) => (
                      <tr key={idx} className="border-b border-border-color/50 last:border-0">
                        <td className="py-2 px-3 text-text-muted">{trade.date}</td>
                        <td className="py-2 px-3 font-mono">{trade.symbol}</td>
                        <td className="py-2 px-3">
                          <span className={clsx(
                            "px-1.5 py-0.5 rounded text-xs",
                            trade.type === 'buy' ? 'bg-accent-success/20 text-accent-success' : 'bg-accent-danger/20 text-accent-danger'
                          )}>
                            {trade.type === 'buy' ? '买入' : '卖出'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">¥{trade.price.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono">{trade.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono">¥{trade.amount.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {trade.profit !== undefined && (
                            <span className={trade.profit >= 0 ? 'text-accent-success' : 'text-accent-danger'}>
                              {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(0)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {results.trades.length > 10 && (
                  <p className="text-text-muted text-xs text-center mt-2">
                    还有 {results.trades.length - 10} 条记录...
                  </p>
                )}
              </div>
            </div>
          )}
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
    <div className="bg-bg-secondary rounded-xl border border-border-color p-3">
      <div className="flex items-center gap-1.5 mb-1.5 text-text-muted text-xs">
        {icon}
        {label}
      </div>
      <div className={clsx('font-mono text-lg font-bold', className)}>{value}</div>
    </div>
  )
}
