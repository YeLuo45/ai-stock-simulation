import { useState, useCallback } from 'react'
import { useStore } from '../store'
import StrategyComparison from '../components/StrategyComparison'
import { runMultiStrategyComparison } from '../services/api'
import type { StrategyCard, MultiStrategyComparisonResponse } from '../types'

export default function StrategyComparisonPage() {
  const { showNotification } = useStore()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<MultiStrategyComparisonResponse | null>(null)

  const handleCompare = useCallback(async (strategies: StrategyCard[]) => {
    setLoading(true)
    try {
      const enabledStrategies = strategies
        .filter(s => s.enabled)
        .map(s => ({
          id: s.id,
          name: s.name,
          shortPeriod: s.shortPeriod,
          longPeriod: s.longPeriod,
          color: s.color,
        }))

      if (enabledStrategies.length < 1) {
        showNotification('error', '请至少启用一个策略')
        return
      }

      const response = await runMultiStrategyComparison({
        symbol: '600519',
        startDate: '2023-01-01',
        endDate: '2024-12-31',
        initialCash: 1000000,
        strategies: enabledStrategies,
      })

      // Assign strategy_id from request to results
      const strategiesWithIds = response.strategies.map((r, i) => ({
        ...r,
        strategy_id: enabledStrategies[i]?.id || r.strategy_id,
      }))

      setResults({ ...response, strategies: strategiesWithIds })
      showNotification('success', '多策略对比完成')
    } catch (err: any) {
      showNotification('error', err?.message ?? '对比失败')
    } finally {
      setLoading(false)
    }
  }, [showNotification])

  return (
    <StrategyComparison
      onCompare={handleCompare}
      results={results}
      loading={loading}
    />
  )
}
