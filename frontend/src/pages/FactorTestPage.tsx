/**
 * Factor Testing Page - Test quantitative factors and visualize their distribution with histograms
 * Features: Factor configuration, batch backtesting, histogram of returns by factor quantile, navigation integration
 */
import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { runBatchBacktest } from '../services/api'
import { DEFAULT_STOCKS } from '../services/storage'
import { BarChart2, Play, Loader2, Download, BarChart3, Info, TrendingUp, TrendingDown } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'
import clsx from 'clsx'

// Factor definitions
interface FactorDef {
  key: string
  label: string
  description: string
  min: number
  max: number
  step: number
  unit: string
  isPercent?: boolean
}

const FACTOR_DEFS: FactorDef[] = [
  { key: 'pe', label: '市盈率 P/E', description: '股票价格与每股收益的比值', min: 0, max: 100, step: 5, unit: '' },
  { key: 'pb', label: '市净率 P/B', description: '股票价格与每股净资产的比值', min: 0, max: 20, step: 1, unit: '' },
  { key: 'roe', label: '净资产收益率 ROE', description: '净利润与平均股东权益的比值', min: 0, max: 50, step: 2.5, unit: '%', isPercent: true },
  { key: 'revenue_growth', label: '营收增长率', description: '营业收入同比增长率', min: -30, max: 100, step: 10, unit: '%', isPercent: true },
  { key: 'profit_growth', label: '利润增长率', description: '净利润同比增长率', min: -50, max: 200, step: 20, unit: '%', isPercent: true },
  { key: 'gross_margin', label: '毛利率', description: '毛利与营业收入的比值', min: 0, max: 80, step: 5, unit: '%', isPercent: true },
  { key: 'volume_ratio', label: '量比', description: '当日成交量与过去5日平均成交量的比值', min: 0.5, max: 5, step: 0.5, unit: 'x' },
  { key: 'turnover', label: '换手率', description: '日成交金额与流通市值的比值', min: 0, max: 20, step: 1, unit: '%', isPercent: true },
]

// Generate mock stock data with factors
function generateMockFactorData() {
  return DEFAULT_STOCKS.slice(0, 20).map(stock => {
    const pe = parseFloat((Math.random() * 60 + 5).toFixed(2))
    const pb = parseFloat((Math.random() * 8 + 0.5).toFixed(2))
    const roe = parseFloat((Math.random() * 25 + 2).toFixed(2))
    const revenue_growth = parseFloat((Math.random() * 80 - 20).toFixed(2))
    const profit_growth = parseFloat((Math.random() * 150 - 30).toFixed(2))
    const gross_margin = parseFloat((Math.random() * 60 + 10).toFixed(2))
    const volume_ratio = parseFloat((Math.random() * 3 + 0.3).toFixed(2))
    const turnover = parseFloat((Math.random() * 8 + 0.5).toFixed(2))

    return {
      symbol: stock.symbol,
      name: stock.name,
      price: stock.price,
      factors: { pe, pb, roe, revenue_growth, profit_growth, gross_margin, volume_ratio, turnover },
      // Simulated return based on factor values
      backtestReturn: parseFloat((
        (roe / 20) * 10 +
        (revenue_growth / 50) * 5 +
        (profit_growth / 80) * 5 +
        (gross_margin / 40) * 3 +
        Math.random() * 20 - 10
      ).toFixed(2)),
    }
  })
}

type FactorKey = typeof FACTOR_DEFS[number]['key']

interface FactorRangeConfig {
  min: number
  max: number
  step: number
}

export default function FactorTestPage() {
  const { showNotification, stockPools, activePoolId, setActivePoolId } = useStore()

  // Factor config
  const [selectedFactor, setSelectedFactor] = useState<FactorKey>('pe')
  const [factorRange, setFactorRange] = useState<FactorRangeConfig>({ min: 0, max: 50, step: 5 })
  const [numQuantiles, setNumQuantiles] = useState(5)
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])

  // Results
  const [running, setRunning] = useState(false)
  const [histogramData, setHistogramData] = useState<Array<{
    quantile: string
    avgReturn: number
    count: number
    minReturn: number
    maxReturn: number
  }>>([])
  const [summaryStats, setSummaryStats] = useState<{
    bestQuantile: string
    worstQuantile: string
    avgReturnAll: number
    factorCorr: number
  } | null>(null)

  // Available symbols from pools
  const availableSymbols = useMemo(() => {
    const poolStocks = stockPools.flatMap(p => p.stocks)
    if (poolStocks.length > 0) return poolStocks
    return DEFAULT_STOCKS.slice(0, 20)
  }, [stockPools])

  const handleImportFromPool = () => {
    if (stockPools.length === 0) {
      showNotification('info', '暂无股票池，请先添加股票到股票池')
      return
    }
    const pool = stockPools.find(p => p.id === activePoolId) || stockPools[0]
    setActivePoolId(pool.id)
    const syms = pool.stocks.map(s => s.symbol)
    setSelectedSymbols(syms)
    showNotification('info', `已从 ${pool.name} 导入 ${syms.length} 只股票`)
  }

  const toggleSymbol = (sym: string) => {
    setSelectedSymbols(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    )
  }

  const handleRunTest = async () => {
    const syms = selectedSymbols.length > 0 ? selectedSymbols : availableSymbols.slice(0, 10).map(s => s.symbol)
    if (syms.length === 0) {
      showNotification('error', '请先选择股票')
      return
    }

    setRunning(true)
    setHistogramData([])
    setSummaryStats(null)

    try {
      // Run batch backtest to get real return data
      const result = await runBatchBacktest({
        symbols: syms,
        start_date: '2024-01-01',
        end_date: '2025-12-31',
        initial_cash: 1_000_000,
        strategy_type: 'mean_reversion',
        onProgress: () => {},
      })

      // Map backtest results to symbols
      const returnMap = new Map(result.results.map(r => [r.symbol, r.total_return]))

      // Generate mock factor data for symbols without real backtest
      const mockData = generateMockFactorData()
      const allData = mockData.map(m => ({
        ...m,
        backtestReturn: returnMap.get(m.symbol) ?? m.backtestReturn,
      }))

      // Compute factor quantiles
      const sortedByFactor = [...allData].sort((a, b) => {
        const fa = a.factors[selectedFactor as keyof typeof a.factors] as number
        const fb = b.factors[selectedFactor as keyof typeof b.factors] as number
        return fa - fb
      })

      const quantileSize = Math.max(1, Math.floor(sortedByFactor.length / numQuantiles))
      const quantiles: typeof histogramData = []

      for (let i = 0; i < numQuantiles; i++) {
        const slice = sortedByFactor.slice(i * quantileSize, (i + 1) * quantileSize)
        if (slice.length === 0) continue

        const returns = slice.map(s => s.backtestReturn)
        const avg = returns.reduce((a, b) => a + b, 0) / returns.length
        const min = Math.min(...returns)
        const max = Math.max(...returns)

        // Get factor range label
        const firstFactor = slice[0].factors[selectedFactor as keyof typeof slice[0]['factors']] as number
        const lastFactor = slice[slice.length - 1].factors[selectedFactor as keyof typeof slice[0]['factors']] as number

        quantiles.push({
          quantile: `Q${i + 1}\n${firstFactor.toFixed(1)}-${lastFactor.toFixed(1)}`,
          avgReturn: parseFloat(avg.toFixed(2)),
          count: slice.length,
          minReturn: parseFloat(min.toFixed(2)),
          maxReturn: parseFloat(max.toFixed(2)),
        })
      }

      setHistogramData(quantiles)

      // Compute summary stats
      const allReturns = allData.map(d => d.backtestReturn)
      const avgAll = allReturns.reduce((a, b) => a + b, 0) / allReturns.length
      const best = quantiles.reduce((best, q) => q.avgReturn > best.avgReturn ? q : best, quantiles[0])
      const worst = quantiles.reduce((worst, q) => q.avgReturn < worst.avgReturn ? q : worst, quantiles[0])

      // Compute simple correlation between factor value and return
      const factorVals = allData.map(d => d.factors[selectedFactor as keyof typeof d.factors] as number)
      const corr = computeCorrelation(factorVals, allReturns)

      setSummaryStats({
        bestQuantile: best.quantile.split('\n')[0],
        worstQuantile: worst.quantile.split('\n')[0],
        avgReturnAll: parseFloat(avgAll.toFixed(2)),
        factorCorr: parseFloat(corr.toFixed(3)),
      })

      showNotification('success', `因子测试完成，分析了 ${syms.length} 只股票`)
    } catch (e: unknown) {
      showNotification('error', '因子测试失败')
      console.error(e)
    } finally {
      setRunning(false)
    }
  }

  const handleExportCSV = () => {
    if (histogramData.length === 0) return
    const rows = [
      ['分位', '平均收益率(%)', '样本数', '最小收益率(%)', '最大收益率(%)'],
      ...histogramData.map(d => [d.quantile.replace('\n', ' '), d.avgReturn, d.count, d.minReturn, d.maxReturn]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `factor_test_${selectedFactor}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showNotification('success', 'CSV 已下载')
  }

  const currentFactorDef = FACTOR_DEFS.find(f => f.key === selectedFactor)!

  const getBarColor = (value: number) => {
    if (value >= 0) return '#22c55e'
    return '#ef4444'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="bg-bg-secondary rounded-xl p-6 border border-border-color">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
            <BarChart3 size={22} className="text-accent-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">因子测试</h1>
            <p className="text-text-muted text-sm">测试不同因子对收益率的影响，生成直方图分布</p>
          </div>
        </div>
      </div>

      {/* Factor Configuration */}
      <div className="bg-bg-secondary rounded-xl p-5 border border-border-color">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-accent-primary" />
          因子选择与配置
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Factor selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-text-muted text-xs mb-2">选择因子</label>
              <div className="grid grid-cols-2 gap-2">
                {FACTOR_DEFS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setSelectedFactor(f.key as FactorKey)}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left',
                      selectedFactor === f.key
                        ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                        : 'bg-bg-tertiary border-border-color text-text-secondary hover:text-text-primary hover:border-accent-primary/50'
                    )}
                  >
                    <div className="font-medium">{f.label}</div>
                    <div className="text-[10px] opacity-60 mt-0.5">{f.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Factor info */}
            <div className="bg-bg-tertiary rounded-lg p-3 border border-border-color/50">
              <div className="flex items-center gap-2 mb-1">
                <Info size={12} className="text-accent-secondary" />
                <span className="text-xs font-medium text-accent-secondary">{currentFactorDef.label}</span>
              </div>
              <p className="text-xs text-text-muted">{currentFactorDef.description}</p>
            </div>
          </div>

          {/* Right: Config */}
          <div className="space-y-4">
            {/* Range config */}
            <div>
              <label className="block text-text-muted text-xs mb-2">
                因子范围 ({currentFactorDef.unit || ''})
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-text-muted">最小值</label>
                  <input
                    type="number"
                    value={factorRange.min}
                    onChange={e => setFactorRange(r => ({ ...r, min: parseFloat(e.target.value) || 0 }))}
                    step={currentFactorDef.step}
                    className="w-full bg-bg-tertiary border border-border-color rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent-primary/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted">最大值</label>
                  <input
                    type="number"
                    value={factorRange.max}
                    onChange={e => setFactorRange(r => ({ ...r, max: parseFloat(e.target.value) || 0 }))}
                    step={currentFactorDef.step}
                    className="w-full bg-bg-tertiary border border-border-color rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent-primary/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted">步长</label>
                  <input
                    type="number"
                    value={factorRange.step}
                    onChange={e => setFactorRange(r => ({ ...r, step: parseFloat(e.target.value) || 1 }))}
                    step={currentFactorDef.step}
                    className="w-full bg-bg-tertiary border border-border-color rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent-primary/50"
                  />
                </div>
              </div>
            </div>

            {/* Quantile count */}
            <div>
              <label className="block text-text-muted text-xs mb-2">分组数量（分位数）</label>
              <div className="flex gap-2">
                {[3, 5, 7, 10].map(n => (
                  <button
                    key={n}
                    onClick={() => setNumQuantiles(n)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      numQuantiles === n
                        ? 'bg-accent-primary text-bg-primary border-accent-primary'
                        : 'bg-bg-tertiary border-border-color text-text-secondary hover:border-accent-primary/50'
                    )}
                  >
                    {n} 组
                  </button>
                ))}
              </div>
            </div>

            {/* Symbol selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-text-muted text-xs">选择股票</label>
                <button
                  onClick={handleImportFromPool}
                  className="text-xs text-accent-secondary hover:underline"
                >
                  从股票池导入
                </button>
              </div>
              <div className="bg-bg-tertiary rounded-lg border border-border-color p-2 max-h-32 overflow-y-auto">
                {availableSymbols.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-2">暂无股票</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {availableSymbols.map(s => (
                      <button
                        key={s.symbol}
                        onClick={() => toggleSymbol(s.symbol)}
                        className={clsx(
                          'px-2 py-1 rounded text-[10px] font-mono border transition-all',
                          selectedSymbols.includes(s.symbol)
                            ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                            : 'bg-bg-secondary border-border-color text-text-muted hover:border-accent-primary/50'
                        )}
                      >
                        {s.symbol}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedSymbols.length > 0 && (
                <p className="text-[10px] text-text-muted mt-1">
                  已选择 {selectedSymbols.length} 只股票
                </p>
              )}
            </div>

            {/* Run button */}
            <button
              onClick={handleRunTest}
              disabled={running}
              className="w-full px-6 py-3 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,212,255,0.3)]"
            >
              {running ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              {running ? '测试中...' : '运行因子测试'}
            </button>
          </div>
        </div>
      </div>

      {/* Histogram Results */}
      {histogramData.length > 0 && (
        <>
          {/* Summary stats */}
          {summaryStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<TrendingUp size={16} className="text-accent-success" />}
                label="最佳分位"
                value={summaryStats.bestQuantile}
                sub={`收益率 ${histogramData.find(q => q.quantile.startsWith(summaryStats.bestQuantile))?.avgReturn ?? 0}%`}
                valueClass="text-accent-success"
              />
              <StatCard
                icon={<TrendingDown size={16} className="text-accent-danger" />}
                label="最差分位"
                value={summaryStats.worstQuantile}
                sub={`收益率 ${histogramData.find(q => q.quantile.startsWith(summaryStats.worstQuantile))?.avgReturn ?? 0}%`}
                valueClass="text-accent-danger"
              />
              <StatCard
                icon={<BarChart2 size={16} className="text-accent-primary" />}
                label="平均收益率"
                value={`${summaryStats.avgReturnAll >= 0 ? '+' : ''}${summaryStats.avgReturnAll}%`}
                sub={`因子: ${currentFactorDef.label}`}
                valueClass={summaryStats.avgReturnAll >= 0 ? 'text-accent-success' : 'text-accent-danger'}
              />
              <StatCard
                icon={<BarChart3 size={16} className="text-accent-secondary" />}
                label="因子相关性"
                value={summaryStats.factorCorr >= 0 ? `+${summaryStats.factorCorr}` : `${summaryStats.factorCorr}`}
                sub={summaryStats.factorCorr > 0 ? '正相关' : summaryStats.factorCorr < 0 ? '负相关' : '无相关'}
                valueClass={summaryStats.factorCorr > 0 ? 'text-accent-success' : summaryStats.factorCorr < 0 ? 'text-accent-danger' : 'text-text-primary'}
              />
            </div>
          )}

          {/* Histogram */}
          <div className="bg-bg-secondary rounded-xl p-5 border border-border-color">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <BarChart3 size={16} className="text-accent-primary" />
                  收益率分布直方图
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  按 {currentFactorDef.label} 分 {numQuantiles} 组后的平均收益率分布
                </p>
              </div>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1 px-3 py-1.5 bg-bg-tertiary border border-border-color rounded-lg text-xs hover:border-accent-primary/50 transition-colors"
              >
                <Download size={12} />
                导出CSV
              </button>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis
                    dataKey="quantile"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={{ stroke: '#374151' }}
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={(v: number) => `${v}%`}
                    tickLine={false}
                    axisLine={{ stroke: '#374151' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string, props: any) => {
                      if (name === 'avgReturn') {
                        const d = props.payload
                        return [
                          <span key="return" className={d.avgReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'}>
                            平均收益: {d.avgReturn >= 0 ? '+' : ''}{d.avgReturn.toFixed(2)}%
                          </span>,
                          ''
                        ]
                      }
                      return [value, name]
                    }}
                    labelFormatter={(label: string) => `分位: ${label.replace('\n', ' ')}`}
                  />
                  <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />
                  <Bar dataKey="avgReturn" name="avgReturn" radius={[4, 4, 0, 0]}>
                    {histogramData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.avgReturn)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend / explanation */}
            <div className="mt-4 flex items-center gap-4 text-xs text-text-muted">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-accent-success" />
                <span>正收益分位</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-accent-danger" />
                <span>负收益分位</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Info size={12} />
                <span>柱状图高度表示该分位内的平均收益率</span>
              </div>
            </div>
          </div>

          {/* Detail table */}
          <div className="bg-bg-secondary rounded-xl p-5 border border-border-color">
            <h3 className="font-semibold mb-4">分位详情</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-color">
                    <th className="text-left px-3 py-2 text-text-muted font-medium text-xs">分位</th>
                    <th className="text-right px-3 py-2 text-text-muted font-medium text-xs">因子范围</th>
                    <th className="text-right px-3 py-2 text-text-muted font-medium text-xs">平均收益率</th>
                    <th className="text-right px-3 py-2 text-text-muted font-medium text-xs">最小收益率</th>
                    <th className="text-right px-3 py-2 text-text-muted font-medium text-xs">最大收益率</th>
                    <th className="text-right px-3 py-2 text-text-muted font-medium text-xs">样本数</th>
                  </tr>
                </thead>
                <tbody>
                  {histogramData.map((row, idx) => {
                    const [, range] = row.quantile.split('\n')
                    return (
                      <tr key={idx} className="border-b border-border-color/30 last:border-0 hover:bg-bg-tertiary/50 transition-colors">
                        <td className="px-3 py-2">
                          <span className={clsx(
                            'font-medium',
                            row.avgReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'
                          )}>
                            {row.quantile.split('\n')[0]}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2 font-mono text-text-secondary text-xs">{range}</td>
                        <td className={clsx(
                          'text-right px-3 py-2 font-mono font-bold',
                          row.avgReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'
                        )}>
                          {row.avgReturn >= 0 ? '+' : ''}{row.avgReturn.toFixed(2)}%
                        </td>
                        <td className="text-right px-3 py-2 font-mono text-accent-danger text-xs">
                          {row.minReturn.toFixed(2)}%
                        </td>
                        <td className="text-right px-3 py-2 font-mono text-accent-success text-xs">
                          +{row.maxReturn.toFixed(2)}%
                        </td>
                        <td className="text-right px-3 py-2 font-mono text-text-muted text-xs">
                          {row.count}只
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

      {/* Empty state */}
      {!running && histogramData.length === 0 && (
        <div className="bg-bg-secondary rounded-xl p-12 text-center border border-border-color">
          <BarChart3 size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
          <p className="text-text-secondary font-medium mb-1">因子测试</p>
          <p className="text-text-muted text-sm mt-2">选择因子和股票范围，点击运行开始因子测试分析</p>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
  valueClass = 'text-text-primary',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
      <div className="flex items-center gap-2 mb-2 text-text-muted text-xs">
        {icon}
        {label}
      </div>
      <div className={clsx('font-mono text-xl font-bold', valueClass)}>{value}</div>
      {sub && <div className="text-xs text-text-muted mt-1">{sub}</div>}
    </div>
  )
}

// Simple Pearson correlation coefficient
function computeCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0
  const n = x.length
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n
  const num = x.reduce((s, xi, i) => s + (xi - meanX) * (y[i] - meanY), 0)
  const denX = Math.sqrt(x.reduce((s, xi) => s + (xi - meanX) ** 2, 0))
  const denY = Math.sqrt(y.reduce((s, yi) => s + (yi - meanY) ** 2, 0))
  if (denX === 0 || denY === 0) return 0
  return num / (denX * denY)
}
