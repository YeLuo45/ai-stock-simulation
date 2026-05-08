import { useState, useMemo } from 'react'
import { computeFactorCorrelationMatrix, type CorrelationResult } from '../services/factorEngine'
import type { FactorDefinition } from '../types'
import clsx from 'clsx'

interface Props {
  factors: FactorDefinition[]
  symbols: string[]
}

export default function FactorCorrelationHeatmap({ factors, symbols }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleFactor = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 10) next.add(id)
      return next
    })
  }

  const correlationResult: CorrelationResult | null = useMemo(() => {
    if (selectedIds.size < 2) return null
    const selectedFactors = factors.filter(f => selectedIds.has(f.id))
    return computeFactorCorrelationMatrix(symbols, selectedFactors)
  }, [selectedIds, factors, symbols])

  const getCellColor = (value: number): string => {
    if (value > 0.9) return 'bg-accent-danger'
    if (value > 0.6) return 'bg-accent-success/60'
    if (value > 0.3) return 'bg-accent-success/30'
    if (value > 0) return 'bg-accent-success/10'
    if (value > -0.3) return 'bg-accent-primary/10'
    if (value > -0.6) return 'bg-accent-primary/30'
    return 'bg-accent-primary/60'
  }

  const getTextColor = (value: number): string => {
    if (Math.abs(value) > 0.6) return 'text-white font-bold'
    return 'text-text-primary'
  }

  return (
    <div className="space-y-6">
      {/* Factor Selector */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <h3 className="font-semibold mb-3">选择因子 (2-10个)</h3>
        <div className="flex flex-wrap gap-2">
          {factors.map(factor => (
            <button
              key={factor.id}
              onClick={() => toggleFactor(factor.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                selectedIds.has(factor.id)
                  ? 'bg-accent-primary text-white border-accent-primary'
                  : 'bg-bg-tertiary/50 text-text-secondary border-border-color hover:border-accent-primary/50'
              )}
            >
              {factor.name_cn}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-2">已选择: {selectedIds.size} 个因子</p>
      </div>

      {/* Correlation Heatmap */}
      {correlationResult && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
          <h3 className="font-semibold mb-4">相关性矩阵</h3>

          {/* High correlation warning */}
          {correlationResult.matrix.some((row, i) =>
            row.some((val, j) => i !== j && val > 0.9)
          ) && (
            <div className="mb-4 p-3 bg-accent-danger/10 border border-accent-danger/30 rounded-lg">
              <p className="text-xs text-accent-danger">
                ⚠️ 检测到高相关性因子对 (|r| &gt; 0.9)，存在多重共线性风险，建议移除冗余因子
              </p>
            </div>
          )}

          {/* Heatmap grid */}
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header row */}
              <div className="flex">
                <div className="w-24 flex-shrink-0" />
                {correlationResult.factorIds.map((id) => {
                  const factor = factors.find(f => f.id === id)
                  return (
                    <div
                      key={id}
                      className="w-16 flex-shrink-0 text-[10px] text-text-muted text-center px-1 truncate"
                      title={factor?.name_cn || id}
                    >
                      {factor?.name_cn || id}
                    </div>
                  )
                })}
              </div>

              {/* Data rows */}
              {correlationResult.matrix.map((row, i) => {
                const rowFactorId = correlationResult.factorIds[i]
                const rowFactor = factors.find(f => f.id === rowFactorId)
                return (
                  <div key={i} className="flex">
                    <div
                      className="w-24 flex-shrink-0 text-[10px] text-text-muted text-right pr-2 py-0.5 truncate"
                      title={rowFactor?.name_cn || rowFactorId}
                    >
                      {rowFactor?.name_cn || rowFactorId}
                    </div>
                    {row.map((value, j) => (
                      <div
                        key={j}
                        className={clsx(
                          'w-16 flex-shrink-0 h-10 flex items-center justify-center text-xs transition-colors border border-transparent',
                          getCellColor(value),
                          getTextColor(value),
                          i === j && 'opacity-60'
                        )}
                        title={`${correlationResult.factorIds[i]} vs ${correlationResult.factorIds[j]}: ${value.toFixed(3)}`}
                      >
                        {value.toFixed(2)}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-accent-danger" />
              <span className="text-[10px] text-text-muted">高正相关 (&gt;0.9)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-accent-success/60" />
              <span className="text-[10px] text-text-muted">正相关</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-accent-primary/10" />
              <span className="text-[10px] text-text-muted">负相关</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-accent-primary/60" />
              <span className="text-[10px] text-text-muted">高负相关</span>
            </div>
          </div>
        </div>
      )}

      {selectedIds.size < 2 && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-12 text-center">
          <p className="text-text-muted">请选择至少2个因子以显示相关性矩阵</p>
        </div>
      )}
    </div>
  )
}
