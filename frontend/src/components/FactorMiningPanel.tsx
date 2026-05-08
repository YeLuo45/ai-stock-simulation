import { useState } from 'react'
import { useStore } from '../store'
import { mineFactors, saveCustomFactor } from '../services/factorEngine'
import { generatePriceHistory, type OHLCV } from '../services/indicators'
import type { FactorDefinition } from '../types'
import { Sparkles, Plus, BarChart2, TrendingUp, Activity, Calendar } from 'lucide-react'
import clsx from 'clsx'
import type { MiningMethod } from '../services/factorEngine'

const MINING_METHODS: { key: MiningMethod; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    key: 'rolling_correlation',
    label: '滚动相关',
    icon: <Activity size={16} />,
    desc: '价格序列与技术指标的相关性',
  },
  {
    key: 'volatility_change',
    label: '波动率变化',
    icon: <BarChart2 size={16} />,
    desc: '不同窗口期波动率的比率',
  },
  {
    key: 'price_volume_divergence',
    label: '价量背离',
    icon: <TrendingUp size={16} />,
    desc: '价格创新高但量能未跟随',
  },
  {
    key: 'ma_dispersion',
    label: '均线分散度',
    icon: <Sparkles size={16} />,
    desc: '多条均线之间的离散程度',
  },
  {
    key: 'seasonality',
    label: '季节性',
    icon: <Calendar size={16} />,
    desc: '月度/周度周期效应',
  },
]

interface Props {
  onFactorAdded?: () => void
}

export default function FactorMiningPanel({ onFactorAdded }: Props) {
  const { showNotification } = useStore()
  const [minedFactors, setMinedFactors] = useState<FactorDefinition[]>([])
  const [mining, setMining] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const handleMine = async (_method: MiningMethod) => {
    setMining(true)
    try {
      await new Promise(r => setTimeout(r, 600))
      const basePrice = 50 + Math.random() * 100
      const history: OHLCV[] = generatePriceHistory(basePrice, 120)
      const factors = mineFactors(history)
      setMinedFactors(prev => {
        const existing = new Set(prev.map(f => f.id))
        const newFactors = factors.filter(f => !existing.has(f.id))
        return [...prev, ...newFactors]
      })
      showNotification('success', `挖掘完成，发现 ${factors.length} 个候选因子`)
    } catch (e: unknown) {
      showNotification('error', (e as Error)?.message || '挖掘失败')
    } finally {
      setMining(false)
    }
  }

  const handleAddToLibrary = (factor: FactorDefinition) => {
    const savedFactor = {
      id: factor.id,
      name: factor.name,
      name_cn: factor.name_cn,
      description: factor.description,
      category: factor.category,
      formula: factor.formula || '',
      params: factor.params || [],
      tags: ['挖掘'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    saveCustomFactor(savedFactor as Parameters<typeof saveCustomFactor>[0])
    setAddedIds(prev => new Set([...prev, factor.id]))
    onFactorAdded?.()
    showNotification('success', `因子"${factor.name_cn}"已添加到因子库`)
  }

  return (
    <div className="space-y-6">
      {/* Mining Methods */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <h3 className="font-semibold mb-4">因子挖掘方法</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MINING_METHODS.map(method => (
            <button
              key={method.key}
              onClick={() => handleMine(method.key)}
              disabled={mining}
              className={clsx(
                'flex items-start gap-3 p-4 rounded-xl border transition-all text-left',
                'hover:border-accent-primary/50 hover:bg-accent-primary/5',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'border-border-color bg-bg-tertiary/30'
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center text-accent-primary flex-shrink-0">
                {method.icon}
              </div>
              <div>
                <div className="font-medium text-sm">{method.label}</div>
                <div className="text-xs text-text-muted mt-0.5">{method.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Mining Results */}
      {minedFactors.length > 0 && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">挖掘结果 ({minedFactors.length})</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {minedFactors.map(factor => (
              <div
                key={factor.id}
                className="p-4 rounded-xl border border-border-color bg-bg-tertiary/30 hover:border-accent-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm">{factor.name_cn}</div>
                    <code className="text-[10px] text-text-muted font-mono">{factor.name}</code>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-accent-primary/10 text-accent-primary">
                    候选
                  </span>
                </div>
                <p className="text-xs text-text-muted mb-3">{factor.description}</p>
                <div className="flex items-center gap-2 text-[10px] text-text-muted mb-3">
                  <span>norm: [{factor.norm_min}, {factor.norm_max}]</span>
                </div>
                {addedIds.has(factor.id) ? (
                  <div className="w-full py-1.5 text-center text-xs text-accent-success bg-accent-success/10 rounded-lg">
                    已添加
                  </div>
                ) : (
                  <button
                    onClick={() => handleAddToLibrary(factor)}
                    className="w-full py-1.5 bg-accent-primary/10 text-accent-primary text-xs font-medium rounded-lg hover:bg-accent-primary/20 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={12} />
                    添加到因子库
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {minedFactors.length === 0 && !mining && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-12 text-center">
          <Sparkles size={48} className="mx-auto text-text-muted/30 mb-4" />
          <p className="text-text-muted">点击上方按钮开始因子挖掘</p>
          <p className="text-text-muted/60 text-sm mt-1">从价格/成交量数据中自动发现新因子</p>
        </div>
      )}
    </div>
  )
}
