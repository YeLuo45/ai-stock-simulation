import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import {
  startOptimization,
  getOptimizationProgress,
  getOptimizationResults,
  cancelOptimization,
} from '../services/api'
import {
  OptimizeRequest,
  OptimizeResponse,
  OptimizeProgress,
  OptimizeResultsResponse,
  OptimizeResultItem,
  HeatmapPoint,
  ScatterPoint,
  ParameterRange,
} from '../types'
import { Settings2, Play, X, CheckCircle2, TrendingUp, TrendingDown, BarChart2, Target, Zap, RotateCcw } from 'lucide-react'
import clsx from 'clsx'

const DEFAULT_RANGE: ParameterRange = { min: 0, max: 0, step: 0.01 }

export default function OptimizePage() {
  const { showNotification } = useStore()

  // Grid config state
  const [maShortRange, setMaShortRange] = useState<ParameterRange>({ min: 3, max: 20, step: 1 })
  const [maLongRange, setMaLongRange] = useState<ParameterRange>({ min: 20, max: 60, step: 5 })
  const [stopLossRange, setStopLossRange] = useState<ParameterRange>({ min: 0.02, max: 0.10, step: 0.02 })
  const [takeProfitRange, setTakeProfitRange] = useState<ParameterRange>({ min: 0.05, max: 0.25, step: 0.05 })
  const [positionRange, setPositionRange] = useState<ParameterRange>({ min: 0.1, max: 1.0, step: 0.1 })

  // Execution state
  const [running, setRunning] = useState(false)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [progress, setProgress] = useState<OptimizeProgress | null>(null)
  const [results, setResults] = useState<OptimizeResultsResponse | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startPoll = useCallback((bid: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const prog = await getOptimizationProgress(bid)
        setProgress(prog)
        if (prog.status !== 'running') {
          // Completed or cancelled - fetch final results
          const res = await getOptimizationResults(bid)
          setResults(res)
          setRunning(false)
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch (e) {
        console.error('Poll error', e)
      }
    }, 1000)
  }, [])

  const handleStart = async () => {
    const req: OptimizeRequest = {
      strategy_name: 'MA交叉策略',
      ma_short_range: maShortRange,
      ma_long_range: maLongRange,
      stop_loss_range: stopLossRange,
      take_profit_range: takeProfitRange,
      position_range: positionRange,
    }
    try {
      const res: OptimizeResponse = await startOptimization(req)
      setBatchId(res.batch_id)
      setRunning(true)
      setProgress(null)
      setResults(null)
      startPoll(res.batch_id)
      showNotification('info', `优化已启动，共${res.total_combinations}种参数组合`)
    } catch (e: any) {
      showNotification('error', e?.message ?? '启动优化失败')
    }
  }

  const handleCancel = async () => {
    if (!batchId) return
    try {
      await cancelOptimization(batchId)
      showNotification('info', '优化已取消')
    } catch (e: any) {
      showNotification('error', e?.message ?? '取消失败')
    }
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const progressPct = progress
    ? Math.round((progress.completed_combinations / Math.max(progress.total_combinations, 1)) * 100)
    : 0

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
          <Settings2 size={22} className="text-accent-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">策略参数优化</h1>
          <p className="text-text-muted text-sm">网格搜索最优参数组合</p>
        </div>
      </div>

      {/* Parameter Grid Config */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <h3 className="font-semibold mb-4">参数网格配置</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <ParamRangeField
            label="MA Short"
            value={maShortRange}
            onChange={setMaShortRange}
            min={1} max={50} stepDefault={1}
            hint="短期均线周期"
          />
          <ParamRangeField
            label="MA Long"
            value={maLongRange}
            onChange={setMaLongRange}
            min={10} max={200} stepDefault={5}
            hint="长期均线周期"
          />
          <ParamRangeField
            label="止损"
            value={stopLossRange}
            onChange={setStopLossRange}
            min={0.01} max={0.3} stepDefault={0.01}
            hint="止损比例"
            isPercent
          />
          <ParamRangeField
            label="止盈"
            value={takeProfitRange}
            onChange={setTakeProfitRange}
            min={0.01} max={0.5} stepDefault={0.05}
            hint="止盈比例"
            isPercent
          />
          <ParamRangeField
            label="仓位"
            value={positionRange}
            onChange={setPositionRange}
            min={0.05} max={1.0} stepDefault={0.1}
            hint="仓位比例"
            isPercent
          />
        </div>

        {/* Total combinations info */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-text-muted text-sm">
            共{' '}
            <span className="text-accent-primary font-mono font-bold">
              {estimateCombinations(maShortRange, maLongRange, stopLossRange, takeProfitRange, positionRange)}
            </span>{' '}
            种组合
          </span>
          <div className="flex gap-3">
            {!running ? (
              <button
                onClick={handleStart}
                className="px-6 py-3 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors flex items-center gap-2"
              >
                <Play size={18} />
                开始优化
              </button>
            ) : (
              <button
                onClick={handleCancel}
                className="px-6 py-3 bg-accent-danger text-white font-medium rounded-lg hover:bg-accent-danger/90 transition-colors flex items-center gap-2"
              >
                <X size={18} />
                取消
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {running && progress && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">
              优化进度 ({progress.completed_combinations} / {progress.total_combinations})
            </span>
            <span className="text-sm text-accent-primary font-mono">{progressPct}%</span>
          </div>
          <div className="w-full bg-bg-tertiary rounded-full h-3 mb-2">
            <div
              className="bg-accent-primary h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {progress.current_combo && (
            <div className="text-text-muted text-xs font-mono">
              当前: MA_short={progress.current_combo.ma_short}, MA_long={progress.current_combo.ma_long},{' '}
              止损={progress.current_combo.stop_loss}, 止盈={progress.current_combo.take_profit}, 仓位={progress.current_combo.position}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {results && (
        <>
          {/* Top3 Cards */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-4">Top 3 最优参数</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {results.top3.map((item, idx) => (
                <Top3Card key={idx} item={item} rank={idx + 1} onApply={() => handleApplyParams(item)} />
              ))}
            </div>
          </div>

          {/* Heatmap */}
          {results.heatmap_data.length > 0 && (
            <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
              <h3 className="font-semibold mb-4">收益率热力图 (MA_short × MA_long)</h3>
              <Heatmap data={results.heatmap_data} />
            </div>
          )}

          {/* Scatter Plot */}
          {results.scatter_data.length > 0 && (
            <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
              <h3 className="font-semibold mb-4">风险收益分布 (最大回撤 vs 收益率)</h3>
              <ScatterPlot data={results.scatter_data} />
            </div>
          )}
        </>
      )}
    </div>
  )

  function handleApplyParams(item: OptimizeResultItem) {
    // Navigate to backtest page with these params
    showNotification('success', `已应用最优参数: MA_short=${item.params.ma_short}, MA_long=${item.params.ma_long}, 止损=${item.params.stop_loss}, 止盈=${item.params.take_profit}, 仓位=${item.params.position}`)
    // Could also store in localStorage or global state for backtest page to pick up
    localStorage.setItem('appliedBestParams', JSON.stringify(item.params))
    window.location.hash = '#backtest'
  }
}

// ---- Sub-components ----

function ParamRangeField({
  label,
  value,
  onChange,
  min,
  max,
  stepDefault,
  hint,
  isPercent = false,
}: {
  label: string
  value: ParameterRange
  onChange: (v: ParameterRange) => void
  min: number
  max: number
  stepDefault: number
  hint?: string
  isPercent?: boolean
}) {
  const update = (field: 'min' | 'max' | 'step', val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    onChange({ ...value, [field]: num })
  }

  return (
    <div>
      <label className="block text-text-muted text-xs mb-1" title={hint}>
        {label} {isPercent && <span className="text-[10px]">(%)</span>}
      </label>
      <div className="flex gap-1 items-center">
        <input
          type="number"
          value={value.min}
          onChange={e => update('min', e.target.value)}
          min={min}
          max={max}
          step={stepDefault}
          className="w-full bg-bg-tertiary border border-border-color rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent-primary/50"
          placeholder="min"
        />
        <span className="text-text-muted text-xs">~</span>
        <input
          type="number"
          value={value.max}
          onChange={e => update('max', e.target.value)}
          min={min}
          max={max}
          step={stepDefault}
          className="w-full bg-bg-tertiary border border-border-color rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent-primary/50"
          placeholder="max"
        />
      </div>
      <div className="mt-1">
        <input
          type="number"
          value={value.step}
          onChange={e => update('step', e.target.value)}
          min={stepDefault}
          max={max}
          step={stepDefault}
          className="w-full bg-bg-tertiary border border-border-color rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-accent-primary/50"
          placeholder="step"
        />
      </div>
    </div>
  )
}

function Top3Card({ item, rank, onApply }: { item: OptimizeResultItem; rank: number; onApply: () => void }) {
  const medals = ['🥇', '🥈', '🥉']
  const { params, metrics } = item
  return (
    <div className={clsx(
      'rounded-xl border p-4 relative',
      rank === 1 ? 'border-yellow-500/50 bg-yellow-500/5' :
      rank === 2 ? 'border-gray-400/30 bg-gray-400/5' :
      'border-border-color bg-bg-tertiary/50'
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg">{medals[rank - 1]}</span>
        <span className={clsx(
          'font-mono font-bold text-lg',
          metrics.total_return >= 0 ? 'text-accent-success' : 'text-accent-danger'
        )}>
          {metrics.total_return >= 0 ? '+' : ''}{metrics.total_return.toFixed(1)}%
        </span>
      </div>
      <div className="space-y-1 text-xs font-mono mb-4">
        <div className="flex justify-between">
          <span className="text-text-muted">MA_short</span>
          <span>{params.ma_short}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">MA_long</span>
          <span>{params.ma_long}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">止损</span>
          <span>{(params.stop_loss * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">止盈</span>
          <span>{(params.take_profit * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">仓位</span>
          <span>{(params.position * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <MetricBadge icon={<TrendingUp size={12} />} label="年化" value={`${metrics.annual_return >= 0 ? '+' : ''}${metrics.annual_return.toFixed(1)}%`} className={metrics.annual_return >= 0 ? 'text-accent-success' : 'text-accent-danger'} />
        <MetricBadge icon={<TrendingDown size={12} />} label="最大回撤" value={`${metrics.max_drawdown.toFixed(1)}%`} className="text-accent-danger" />
        <MetricBadge icon={<Target size={12} />} label="夏普比率" value={metrics.sharpe_ratio.toFixed(2)} className="text-accent-primary" />
        <MetricBadge icon={<BarChart2 size={12} />} label="交易次数" value={metrics.total_trades.toString()} className="text-text-primary" />
      </div>
      <button
        onClick={onApply}
        className="w-full mt-2 px-3 py-2 bg-accent-primary text-bg-primary text-xs font-medium rounded-lg hover:bg-accent-primary/90 transition-colors flex items-center justify-center gap-1"
      >
        <RotateCcw size={12} />
        应用此参数
      </button>
    </div>
  )
}

function MetricBadge({ icon, label, value, className = 'text-text-primary' }: {
  icon: React.ReactNode; label: string; value: string; className?: string
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-text-muted">{icon}</span>
      <span className="text-text-muted">{label}:</span>
      <span className={clsx('font-mono font-medium', className)}>{value}</span>
    </div>
  )
}

function Heatmap({ data }: { data: HeatmapPoint[] }) {
  if (!data.length) return <div className="text-text-muted text-sm">暂无热力图数据</div>

  // Build grid: X=ma_short, Y=ma_long
  const xVals = [...new Set(data.map(d => d.ma_short))].sort((a, b) => a - b)
  const yVals = [...new Set(data.map(d => d.ma_long))].sort((a, b) => a - b)

  const minRet = Math.min(...data.map(d => d.total_return))
  const maxRet = Math.max(...data.map(d => d.total_return))

  const getColor = (ret: number) => {
    if (maxRet === minRet) return 'bg-neutral-400'
    const t = (ret - minRet) / (maxRet - minRet)
    if (ret >= 0) {
      // green: 0 -> 255
      const g = Math.round(255)
      const r = Math.round(255 * (1 - t * 0.5))
      const b = Math.round(255 * (1 - t))
      return `rgb(${r},${g},${b})`
    } else {
      // red
      const r = Math.round(255)
      const g = Math.round(255 * (1 - (Math.abs(ret) / Math.abs(minRet))) * 0.3)
      const b = Math.round(255 * (1 - (Math.abs(ret) / Math.abs(minRet))) * 0.3)
      return `rgb(${r},${g},${b})`
    }
  }

  const retMap = new Map(data.map(d => [`${d.ma_short}-${d.ma_long}`, d.total_return]))

  const cellSize = 36
  const gap = 2

  return (
    <div>
      <div className="flex" style={{ paddingLeft: '40px' }}>
        {xVals.map(x => (
          <div key={x} className="text-xs text-text-muted font-mono text-center" style={{ width: cellSize, marginRight: gap }}>
            {x}
          </div>
        ))}
      </div>
      <div className="flex items-center">
        {/* Y labels */}
        <div className="flex flex-col" style={{ gap }}>
          {yVals.map(y => (
            <div key={y} className="text-xs text-text-muted font-mono text-right pr-2" style={{ height: cellSize, lineHeight: `${cellSize}px` }}>
              {y}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${xVals.length}, ${cellSize}px)` }}>
          {yVals.map(y => xVals.map(x => {
            const ret = retMap.get(`${x}-${y}`)
            return (
              <div
                key={`${x}-${y}`}
                title={ret !== undefined ? `${x}/${y}: ${ret.toFixed(1)}%` : 'N/A'}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: ret !== undefined ? getColor(ret) : '#1f2937',
                  borderRadius: '2px',
                  cursor: 'default',
                }}
              />
            )
          }))}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-xs text-text-muted">
        <span>收益率:</span>
        <div className="flex items-center gap-1">
          <div className="w-6 h-3 rounded" style={{ background: getColor(minRet) }} />
          <span>{minRet.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-3 rounded" style={{ background: getColor((minRet + maxRet) / 2) }} />
          <span>{((minRet + maxRet) / 2).toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-3 rounded" style={{ background: getColor(maxRet) }} />
          <span>{maxRet.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}

function ScatterPlot({ data }: { data: ScatterPoint[] }) {
  if (!data.length) return <div className="text-text-muted text-sm">暂无散点数据</div>

  const width = 500
  const height = 300
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }

  const xMin = Math.min(...data.map(d => d.max_drawdown))
  const xMax = Math.max(...data.map(d => d.max_drawdown))
  const yMin = Math.min(...data.map(d => d.total_return))
  const yMax = Math.max(...data.map(d => d.total_return))

  const toX = (dd: number) =>
    padding.left + ((dd - xMin) / Math.max(xMax - xMin, 0.001)) * (width - padding.left - padding.right)
  const toY = (ret: number) =>
    height - padding.bottom - ((ret - yMin) / Math.max(yMax - yMin, 0.001)) * (height - padding.top - padding.bottom)

  // X axis ticks
  const xTicks = 5
  const xTickVals = Array.from({ length: xTicks }, (_, i) => xMin + (xMax - xMin) * (i / (xTicks - 1)))

  // Y axis ticks
  const yTicks = 5
  const yTickVals = Array.from({ length: yTicks }, (_, i) => yMin + (yMax - yMin) * (i / (yTicks - 1)))

  return (
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height}>
        {/* Grid lines */}
        {yTickVals.map(v => (
          <line
            key={v}
            x1={padding.left}
            y1={toY(v)}
            x2={width - padding.right}
            y2={toY(v)}
            stroke="#374151"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ))}
        {xTickVals.map(v => (
          <line
            key={v}
            x1={toX(v)}
            y1={padding.top}
            x2={toX(v)}
            y2={height - padding.bottom}
            stroke="#374151"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ))}

        {/* Axes */}
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#6b7280" strokeWidth={1} />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#6b7280" strokeWidth={1} />

        {/* X labels */}
        {xTickVals.map(v => (
          <text key={v} x={toX(v)} y={height - padding.bottom + 16} textAnchor="middle" fontSize={10} fill="#6b7280">
            {v.toFixed(1)}%
          </text>
        ))}

        {/* Y labels */}
        {yTickVals.map(v => (
          <text key={v} x={padding.left - 8} y={toY(v) + 4} textAnchor="end" fontSize={10} fill="#6b7280">
            {v.toFixed(1)}%
          </text>
        ))}

        {/* Axis titles */}
        <text x={width / 2} y={height - 4} textAnchor="middle" fontSize={11} fill="#9ca3af">
          最大回撤 (%)
        </text>
        <text x={12} y={height / 2} textAnchor="middle" fontSize={11} fill="#9ca3af" transform={`rotate(-90, 12, ${height / 2})`}>
          收益率 (%)
        </text>

        {/* Dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={toX(d.max_drawdown)}
            cy={toY(d.total_return)}
            r={6}
            fill={d.total_return >= 0 ? '#10b981' : '#ef4444'}
            fillOpacity={0.7}
            stroke="#fff"
            strokeWidth={1}
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="absolute top-2 right-2 flex gap-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-accent-success opacity-70" /> 正收益
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-accent-danger opacity-70" /> 负收益
        </span>
      </div>
    </div>
  )
}

function estimateCombinations(
  maShort: ParameterRange,
  maLong: ParameterRange,
  stopLoss: ParameterRange,
  takeProfit: ParameterRange,
  position: ParameterRange,
): number {
  const count = (r: ParameterRange) => Math.max(1, Math.ceil((r.max - r.min) / r.step) + 1)
  return count(maShort) * count(maLong) * count(stopLoss) * count(takeProfit) * count(position)
}
