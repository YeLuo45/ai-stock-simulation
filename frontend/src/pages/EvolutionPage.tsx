import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import type { AppliedStrategy, StrategyParams } from '../types'
import {
  Play, X, TrendingUp, TrendingDown, BarChart2, Target, RotateCcw,
  Dna, Zap, Award, Rocket
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend
} from 'recharts'
import clsx from 'clsx'

// ---- Types ----
export interface GAConfig {
  population_size: number
  generations: number
  crossover_rate: number
  mutation_rate: number
  elite_count: number
}

export interface GAParamRange {
  min: number
  max: number
  step: number
}

export interface GAOptimizationRequest {
  symbol: string
  config: GAConfig
  ma_short_range: GAParamRange
  ma_long_range: GAParamRange
  stop_loss_range: GAParamRange
  take_profit_range: GAParamRange
  position_range: GAParamRange
}

export interface GAIndividual {
  chromosome: {
    ma_short: number
    ma_long: number
    stop_loss: number
    take_profit: number
    position: number
  }
  fitness: number
  total_return: number
  annual_return: number
  sharpe_ratio: number
  max_drawdown: number
  win_rate: number
  total_trades: number
}

export interface GAGenerationResult {
  generation: number
  best_fitness: number
  avg_fitness: number
  worst_fitness: number
  best_individual: GAIndividual
  population: GAIndividual[]
}

export interface GAEvolutionResult {
  batch_id: string
  generations: GAGenerationResult[]
  best_solution: GAIndividual
  total_evaluations: number
}

// ---- Mock GA engine (pure JS) ----
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function mutate(value: number, min: number, max: number, rate: number): number {
  if (Math.random() < rate) {
    const delta = (max - min) * 0.1 * (Math.random() - 0.5)
    return Math.max(min, Math.min(max, value + delta))
  }
  return value
}

function crossover(a: number, b: number, rate: number): number {
  return Math.random() < rate ? (a + b) / 2 + (Math.random() - 0.5) * Math.abs(a - b) * 0.5 : a
}

function randomChromosome(
  maShortRange: GAParamRange,
  maLongRange: GAParamRange,
  stopLossRange: GAParamRange,
  takeProfitRange: GAParamRange,
  positionRange: GAParamRange
) {
  return {
    ma_short: Math.round(rand(maShortRange.min, maShortRange.max) / maShortRange.step) * maShortRange.step,
    ma_long: Math.round(rand(maLongRange.min, maLongRange.max) / maLongRange.step) * maLongRange.step,
    stop_loss: Math.round(rand(stopLossRange.min, stopLossRange.max) / stopLossRange.step) * stopLossRange.step,
    take_profit: Math.round(rand(takeProfitRange.min, takeProfitRange.max) / takeProfitRange.step) * takeProfitRange.step,
    position: Math.round(rand(positionRange.min, positionRange.max) / positionRange.step) * positionRange.step,
  }
}

function fitnessFunction(ind: GAIndividual): number {
  // Multi-objective fitness: return = total_return * 0.4, sharpe * 0.3, (100 - max_drawdown) * 0.2, win_rate * 0.1
  const returnScore = Math.max(0, ind.total_return) * 0.4
  const sharpeScore = Math.max(0, ind.sharpe_ratio) * 10 * 0.3
  const drawdownScore = Math.max(0, 100 - ind.max_drawdown) * 0.2
  const winScore = ind.win_rate * 100 * 0.1
  return returnScore + sharpeScore + drawdownScore + winScore
}

function simulateBacktest(chromosome: {
  ma_short: number
  ma_long: number
  stop_loss: number
  take_profit: number
  position: number
}): GAIndividual {
  // Simulate backtest result based on chromosome
  const baseReturn = rand(-20, 40)
  const maEfficiency = 1 - Math.abs(chromosome.ma_short - chromosome.ma_long) / 100
  const stopEfficiency = chromosome.stop_loss < chromosome.take_profit ? 1.2 : 0.8
  const total_return = baseReturn * maEfficiency * stopEfficiency + rand(-5, 5)
  const annual_return = total_return * rand(0.8, 1.2)
  const max_drawdown = Math.abs(rand(5, 25) - total_return * 0.3)
  const sharpe_ratio = rand(-0.5, 2.5)
  const win_rate = rand(0.3, 0.75)
  const total_trades = Math.floor(rand(10, 100))

  return {
    chromosome,
    fitness: 0,
    total_return,
    annual_return,
    max_drawdown,
    sharpe_ratio,
    win_rate,
    total_trades,
  }
}

function runGAEvolution(
  request: GAOptimizationRequest,
  onGeneration: (gen: GAGenerationResult) => void,
  abortSignal: { aborted: boolean }
): GAEvolutionResult {
  const { config, ma_short_range, ma_long_range, stop_loss_range, take_profit_range, position_range } = request

  // Initialize population
  let population: GAIndividual[] = []
  for (let i = 0; i < config.population_size; i++) {
    let chrom = randomChromosome(ma_short_range, ma_long_range, stop_loss_range, take_profit_range, position_range)
    // Ensure ma_short < ma_long
    if (chrom.ma_short >= chrom.ma_long) {
      chrom.ma_short = Math.max(ma_short_range.min, chrom.ma_long - 5)
      chrom.ma_long = chrom.ma_long > chrom.ma_short + 5 ? chrom.ma_long : chrom.ma_long + 5
    }
    const ind = simulateBacktest(chrom)
    ind.fitness = fitnessFunction(ind)
    population.push(ind)
  }

  const allGenerations: GAGenerationResult[] = []
  let bestSolution = population.reduce((best, p) => p.fitness > best.fitness ? p : best)

  for (let gen = 0; gen < config.generations; gen++) {
    if (abortSignal.aborted) break

    // Sort by fitness
    population.sort((a, b) => b.fitness - a.fitness)

    const best = population[0]
    const avg = population.reduce((s, p) => s + p.fitness, 0) / population.length
    const worst = population[population.length - 1]

    const genResult: GAGenerationResult = {
      generation: gen,
      best_fitness: best.fitness,
      avg_fitness: avg,
      worst_fitness: worst.fitness,
      best_individual: { ...best },
      population: population.map(p => ({ ...p, chromosome: { ...p.chromosome } })),
    }
    allGenerations.push(genResult)
    onGeneration(genResult)

    if (best.fitness > bestSolution.fitness) {
      bestSolution = { ...best }
    }

    // Selection - elitism
    const elite = population.slice(0, config.elite_count)

    // Generate next generation
    const newPopulation: GAIndividual[] = [...elite]

    while (newPopulation.length < config.population_size) {
      // Tournament selection
      const pick = (arr: GAIndividual[]) => arr[Math.floor(Math.random() * arr.length)]
      const parent1 = pick(population)
      const parent2 = pick(population)

      // Crossover
      const childChrom = {
        ma_short: crossover(parent1.chromosome.ma_short, parent2.chromosome.ma_short, config.crossover_rate),
        ma_long: crossover(parent1.chromosome.ma_long, parent2.chromosome.ma_long, config.crossover_rate),
        stop_loss: crossover(parent1.chromosome.stop_loss, parent2.chromosome.stop_loss, config.crossover_rate),
        take_profit: crossover(parent1.chromosome.take_profit, parent2.chromosome.take_profit, config.crossover_rate),
        position: crossover(parent1.chromosome.position, parent2.chromosome.position, config.crossover_rate),
      }

      // Mutation
      childChrom.ma_short = Math.round(mutate(childChrom.ma_short, ma_short_range.min, ma_short_range.max, config.mutation_rate) / ma_short_range.step) * ma_short_range.step
      childChrom.ma_long = Math.round(mutate(childChrom.ma_long, ma_long_range.min, ma_long_range.max, config.mutation_rate) / ma_long_range.step) * ma_long_range.step
      childChrom.stop_loss = Math.round(mutate(childChrom.stop_loss, stop_loss_range.min, stop_loss_range.max, config.mutation_rate) / stop_loss_range.step) * stop_loss_range.step
      childChrom.take_profit = Math.round(mutate(childChrom.take_profit, take_profit_range.min, take_profit_range.max, config.mutation_rate) / take_profit_range.step) * take_profit_range.step
      childChrom.position = Math.round(mutate(childChrom.position, position_range.min, position_range.max, config.mutation_rate) / position_range.step) * position_range.step

      // Ensure ma_short < ma_long
      if (childChrom.ma_short >= childChrom.ma_long) {
        childChrom.ma_short = Math.max(ma_short_range.min, childChrom.ma_long - 5)
      }

      const child = simulateBacktest(childChrom)
      child.fitness = fitnessFunction(child)
      newPopulation.push(child)
    }

    population = newPopulation
  }

  return {
    batch_id: `ga-${Date.now()}`,
    generations: allGenerations,
    best_solution: bestSolution,
    total_evaluations: config.population_size * config.generations,
  }
}

// ---- Component ----
export default function EvolutionPage() {
  const { showNotification, selectedStocks, applyStrategy } = useStore()

  // GA Config
  const [gaConfig, setGaConfig] = useState<GAConfig>({
    population_size: 30,
    generations: 50,
    crossover_rate: 0.8,
    mutation_rate: 0.15,
    elite_count: 3,
  })

  // Parameter ranges (similar to OptimizePage)
  const [maShortRange, setMaShortRange] = useState<GAParamRange>({ min: 3, max: 20, step: 1 })
  const [maLongRange, setMaLongRange] = useState<GAParamRange>({ min: 20, max: 60, step: 5 })
  const [stopLossRange, setStopLossRange] = useState<GAParamRange>({ min: 0.02, max: 0.10, step: 0.02 })
  const [takeProfitRange, setTakeProfitRange] = useState<GAParamRange>({ min: 0.05, max: 0.25, step: 0.05 })
  const [positionRange, setPositionRange] = useState<GAParamRange>({ min: 0.1, max: 1.0, step: 0.1 })

  // Execution state
  const [running, setRunning] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState<string>('000001')
  const [generationResults, setGenerationResults] = useState<GAGenerationResult[]>([])
  const [finalResult, setFinalResult] = useState<GAEvolutionResult | null>(null)
  const [currentGen, setCurrentGen] = useState(0)
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const abortRef = useRef({ aborted: false })

  const handleStart = useCallback(() => {
    setRunning(true)
    setGenerationResults([])
    setFinalResult(null)
    setCurrentGen(0)
    abortRef.current.aborted = false

    const request: GAOptimizationRequest = {
      symbol: selectedSymbol,
      config: gaConfig,
      ma_short_range: maShortRange,
      ma_long_range: maLongRange,
      stop_loss_range: stopLossRange,
      take_profit_range: takeProfitRange,
      position_range: positionRange,
    }

    // Run GA in a pseudo-async way using setTimeout to allow UI updates
    setTimeout(() => {
      try {
        const result = runGAEvolution(request, (genResult) => {
          setGenerationResults(prev => [...prev, genResult])
          setCurrentGen(genResult.generation)
        }, abortRef.current)

        setFinalResult(result)
        setRunning(false)
        if (!abortRef.current.aborted) {
          showNotification('success', `进化完成！最优解: 收益率 ${result.best_solution.total_return.toFixed(1)}%, 夏普 ${result.best_solution.sharpe_ratio.toFixed(2)}`)
        }
      } catch (e) {
        setRunning(false)
        showNotification('error', '进化过程出错')
      }
    }, 100)
  }, [selectedSymbol, gaConfig, maShortRange, maLongRange, stopLossRange, takeProfitRange, positionRange, showNotification])

  const handleCancel = () => {
    abortRef.current.aborted = true
    setRunning(false)
    showNotification('info', '进化已取消')
  }

  const handleApplyStrategy = () => {
    if (!finalResult) return
    // Convert GAIndividual chromosome to StrategyParams
    const params: StrategyParams = {
      ma_fast: finalResult.best_solution.chromosome.ma_short,
      ma_slow: finalResult.best_solution.chromosome.ma_long,
      rsi_oversold: 30, // default values for RSI since GA doesn't optimize them
      rsi_overbought: 70,
      bb_std: 2.0, // default
      volume_threshold: 1.5, // default
    }
    const strategy: AppliedStrategy = {
      id: `evo-${Date.now()}`,
      timestamp: Date.now(),
      fitness: finalResult.best_solution.fitness,
      params,
      source: 'evolution',
    }
    applyStrategy(strategy)
    showNotification('success', '最优策略已应用到模拟交易')
    setShowApplyConfirm(false)
  }

  const handleShowApplyConfirm = () => {
    if (!finalResult) return
    setShowApplyConfirm(true)
  }

  const progressPct = gaConfig.generations > 0
    ? Math.round((currentGen / gaConfig.generations) * 100)
    : 0

  // Convergence chart data
  const chartData = generationResults.map(g => ({
    generation: g.generation,
    best_fitness: g.best_fitness,
    avg_fitness: g.avg_fitness,
    worst_fitness: g.worst_fitness,
  }))

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
          <Dna size={22} className="text-accent-primary" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">遗传算法优化</h1>
            {selectedStocks.length > 0 && (
              <span className="text-xs text-accent-primary">已选{selectedStocks.length}只股票</span>
            )}
          </div>
          <p className="text-text-muted text-sm">基于遗传算法的策略参数全局优化</p>
        </div>
      </div>

      {/* Stock Selector */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <div className="flex items-center gap-3 mb-4">
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="px-3 py-1.5 bg-bg-tertiary border border-border-color rounded-lg text-sm focus:outline-none focus:border-accent-primary"
          >
            {selectedStocks.length > 0 ? (
              selectedStocks.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} - {s.name}
                </option>
              ))
            ) : (
              <>
                <option value="000001">000001 - 平安银行</option>
                <option value="000002">000002 - 万科A</option>
                <option value="300750">300750 - 宁德时代</option>
                <option value="600519">600519 - 贵州茅台</option>
                <option value="601318">601318 - 中国平安</option>
              </>
            )}
          </select>
        </div>

        {/* GA Parameters */}
        <h3 className="font-semibold mb-4">遗传算法参数</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <ParamField
            label="种群大小"
            value={gaConfig.population_size}
            onChange={v => setGaConfig(c => ({ ...c, population_size: v }))}
            min={10} max={100} step={5}
            hint="每代个体数量"
          />
          <ParamField
            label="进化代数"
            value={gaConfig.generations}
            onChange={v => setGaConfig(c => ({ ...c, generations: v }))}
            min={10} max={200} step={10}
            hint="最大迭代次数"
          />
          <ParamField
            label="交叉率"
            value={gaConfig.crossover_rate}
            onChange={v => setGaConfig(c => ({ ...c, crossover_rate: v }))}
            min={0.1} max={1.0} step={0.05}
            hint="染色体交叉概率"
            isPercent
          />
          <ParamField
            label="变异率"
            value={gaConfig.mutation_rate}
            onChange={v => setGaConfig(c => ({ ...c, mutation_rate: v }))}
            min={0.01} max={0.5} step={0.01}
            hint="基因突变概率"
            isPercent
          />
          <ParamField
            label="精英数量"
            value={gaConfig.elite_count}
            onChange={v => setGaConfig(c => ({ ...c, elite_count: v }))}
            min={1} max={10} step={1}
            hint="保留最优个体数"
          />
        </div>

        {/* Parameter Ranges */}
        <h3 className="font-semibold mb-4 mt-6">参数搜索空间</h3>
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

        {/* Start/Cancel */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-text-muted text-sm">
            搜索空间约{' '}
            <span className="text-accent-primary font-mono font-bold">
              {estimateSearchSpace(gaConfig, maShortRange, maLongRange, stopLossRange, takeProfitRange, positionRange).toLocaleString()}
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
                开始进化
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

      {/* Progress */}
      {running && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">
              进化进度 ({currentGen} / {gaConfig.generations})
            </span>
            <span className="text-sm text-accent-primary font-mono">{progressPct}%</span>
          </div>
          <div className="w-full bg-bg-tertiary rounded-full h-3 mb-2">
            <div
              className="bg-accent-primary h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {generationResults.length > 0 && (
            <div className="text-text-muted text-xs font-mono mt-2">
              当前最优: 适应度={generationResults[generationResults.length - 1]?.best_fitness.toFixed(2)},{' '}
              收益率={generationResults[generationResults.length - 1]?.best_individual.total_return.toFixed(1)}%
            </div>
          )}
        </div>
      )}

      {/* Convergence Curve */}
      {(generationResults.length > 0 || finalResult) && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">收敛曲线</h3>
            {finalResult && (
              <span className="text-xs text-text-muted">
                评估次数: {finalResult.total_evaluations}
              </span>
            )}
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <XAxis
                  dataKey="generation"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(v) => `G${v}`}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(v: any, name: string) => {
                    const labels: Record<string, string> = {
                      best_fitness: '最优适应度',
                      avg_fitness: '平均适应度',
                      worst_fitness: '最差适应度',
                    }
                    return [v.toFixed(3), labels[name] || name]
                  }}
                  labelFormatter={(label) => `第 ${label} 代`}
                />
                <Legend
                  formatter={(value: string) => {
                    const labels: Record<string, string> = {
                      best_fitness: '最优适应度',
                      avg_fitness: '平均适应度',
                      worst_fitness: '最差适应度',
                    }
                    return labels[value] || value
                  }}
                />
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="best_fitness"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="best_fitness"
                />
                <Line
                  type="monotone"
                  dataKey="avg_fitness"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 4"
                  name="avg_fitness"
                />
                <Line
                  type="monotone"
                  dataKey="worst_fitness"
                  stroke="#ef4444"
                  strokeWidth={1}
                  dot={false}
                  name="worst_fitness"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-accent-success rounded" /> 最优适应度 - 持续上升表示收敛
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-blue-500 rounded" style={{ borderTop: '2px dashed #3b82f6' }} /> 平均适应度
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-accent-danger rounded" /> 最差适应度
            </span>
          </div>
        </div>
      )}

      {/* Best Solution */}
      {finalResult && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} className="text-yellow-500" />
            <h3 className="font-semibold">最优解</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Chromosome */}
            <div className="bg-bg-tertiary rounded-xl p-4">
              <h4 className="text-xs text-text-muted mb-3">染色体 (最优参数组合)</h4>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-text-muted">MA_short</span>
                  <span className="font-medium">{finalResult.best_solution.chromosome.ma_short}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">MA_long</span>
                  <span className="font-medium">{finalResult.best_solution.chromosome.ma_long}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">止损</span>
                  <span className="font-medium">{(finalResult.best_solution.chromosome.stop_loss * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">止盈</span>
                  <span className="font-medium">{(finalResult.best_solution.chromosome.take_profit * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">仓位</span>
                  <span className="font-medium">{(finalResult.best_solution.chromosome.position * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Fitness */}
            <div className="bg-bg-tertiary rounded-xl p-4">
              <h4 className="text-xs text-text-muted mb-3">适应度指标</h4>
              <div className="grid grid-cols-2 gap-3">
                <FitnessCard
                  icon={<TrendingUp size={14} />}
                  label="总收益率"
                  value={`${finalResult.best_solution.total_return >= 0 ? '+' : ''}${finalResult.best_solution.total_return.toFixed(1)}%`}
                  className={finalResult.best_solution.total_return >= 0 ? 'text-accent-success' : 'text-accent-danger'}
                />
                <FitnessCard
                  icon={<Zap size={14} />}
                  label="年化收益"
                  value={`${finalResult.best_solution.annual_return >= 0 ? '+' : ''}${finalResult.best_solution.annual_return.toFixed(1)}%`}
                  className={finalResult.best_solution.annual_return >= 0 ? 'text-accent-success' : 'text-accent-danger'}
                />
                <FitnessCard
                  icon={<TrendingDown size={14} />}
                  label="最大回撤"
                  value={`${finalResult.best_solution.max_drawdown.toFixed(1)}%`}
                  className="text-accent-danger"
                />
                <FitnessCard
                  icon={<Target size={14} />}
                  label="夏普比率"
                  value={finalResult.best_solution.sharpe_ratio.toFixed(2)}
                  className={finalResult.best_solution.sharpe_ratio >= 1 ? 'text-accent-success' : 'text-text-primary'}
                />
                <FitnessCard
                  icon={<BarChart2 size={14} />}
                  label="交易次数"
                  value={finalResult.best_solution.total_trades.toString()}
                  className="text-text-primary"
                />
                <FitnessCard
                  icon={<Award size={14} />}
                  label="适应度"
                  value={finalResult.best_solution.fitness.toFixed(2)}
                  className="text-yellow-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              showNotification('success', '已应用遗传算法最优参数')
              localStorage.setItem('appliedGAParams', JSON.stringify(finalResult!.best_solution.chromosome))
              window.location.hash = '#backtest'
            }}
            className="mt-4 w-full px-4 py-3 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            应用此参数到回测
          </button>

          <button
            onClick={handleShowApplyConfirm}
            className="mt-3 w-full px-4 py-3 bg-accent-success/10 text-accent-success border border-accent-success/30 font-medium rounded-lg hover:bg-accent-success/20 transition-colors flex items-center justify-center gap-2"
          >
            <Rocket size={16} />
            应用最优策略到模拟交易
          </button>
        </div>
      )}

      {/* Apply Strategy Confirmation Modal */}
      {showApplyConfirm && finalResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-secondary border border-border-color rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent-success/20 flex items-center justify-center">
                <Rocket size={20} className="text-accent-success" />
              </div>
              <div>
                <h3 className="font-bold text-lg">应用最优策略</h3>
                <p className="text-text-muted text-xs">确认将最优参数同步到模拟交易</p>
              </div>
            </div>

            <div className="bg-bg-tertiary rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-text-muted text-sm">适应度</span>
                <span className="text-accent-success font-mono font-bold">{finalResult.best_solution.fitness.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted text-sm">总收益率</span>
                <span className="text-text-primary font-mono">{finalResult.best_solution.total_return.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted text-sm">夏普比率</span>
                <span className="text-text-primary font-mono">{finalResult.best_solution.sharpe_ratio.toFixed(2)}</span>
              </div>
              <div className="border-t border-border-color/50 pt-2 mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">MA_fast</span>
                  <span className="text-text-secondary font-mono">{finalResult.best_solution.chromosome.ma_short}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">MA_slow</span>
                  <span className="text-text-secondary font-mono">{finalResult.best_solution.chromosome.ma_long}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">止损</span>
                  <span className="text-text-secondary font-mono">{(finalResult.best_solution.chromosome.stop_loss * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">止盈</span>
                  <span className="text-text-secondary font-mono">{(finalResult.best_solution.chromosome.take_profit * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowApplyConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-bg-tertiary border border-border-color text-text-secondary rounded-lg hover:bg-bg-tertiary/80 transition-colors text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleApplyStrategy}
                className="flex-1 px-4 py-2.5 bg-accent-success text-white rounded-lg hover:bg-accent-success/90 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <Rocket size={14} />
                确认应用
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!running && generationResults.length === 0 && !finalResult && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-12 text-center">
          <Dna size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
          <p className="text-text-muted text-lg mb-2">配置遗传算法参数开始优化</p>
          <p className="text-text-muted text-sm">遗传算法通过模拟自然选择过程搜索全局最优参数组合</p>
        </div>
      )}
    </div>
  )
}

// ---- Sub-components ----

function ParamField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  isPercent = false,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  hint?: string
  isPercent?: boolean
}) {
  return (
    <div>
      <label className="block text-text-muted text-xs mb-1" title={hint}>
        {label} {isPercent && <span className="text-[10px]">(%)</span>}
      </label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className="w-full bg-bg-tertiary border border-border-color rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent-primary/50"
      />
    </div>
  )
}

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
  value: GAParamRange
  onChange: (v: GAParamRange) => void
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

function FitnessCard({
  icon,
  label,
  value,
  className = 'text-text-primary',
}: {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-muted">{icon}</span>
      <span className="text-text-muted text-xs">{label}</span>
      <span className={clsx('font-mono font-medium text-sm ml-auto', className)}>{value}</span>
    </div>
  )
}

function estimateSearchSpace(
  _gaConfig: GAConfig,
  maShort: GAParamRange,
  maLong: GAParamRange,
  stopLoss: GAParamRange,
  takeProfit: GAParamRange,
  position: GAParamRange
): number {
  const count = (r: GAParamRange) => Math.max(1, Math.ceil((r.max - r.min) / r.step) + 1)
  const maShortCount = count(maShort)
  const maLongCount = count(maLong)
  const validMACount = maShortCount * maLongCount - Math.ceil(maLongCount * (maLongCount + 1) / 2)
  return validMACount * count(stopLoss) * count(takeProfit) * count(position)
}
