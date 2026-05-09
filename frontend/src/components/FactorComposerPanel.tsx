/**
 * FactorComposerPanel - Portfolio configuration UI
 * Factor selection, weight configuration, parameter settings, and backtest trigger
 */
import { useState, useCallback } from 'react';
import { useStore } from '../store';
import {
  getAllFactorDefinitions,
} from '../services/factorEngine';
import {
  backtestPortfolio,
  applyWeightStrategy,
  type WeightStrategy,
  type ComposerBacktestResult,
} from '../services/factorComposer';
import type {
  FactorWeight,
  FactorPortfolio,
  FactorCategory,
} from '../types';
import {
  Play,
  BarChart2,
  DollarSign,
  TrendingUp,
  Brain,
  Zap,
  ChevronDown,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import FactorContributionChart from './FactorContributionChart';

const CATEGORY_LABELS: Record<FactorCategory, string> = {
  price: '价格类',
  technical: '技术指标',
  financial: '财务类',
  sentiment: '情绪类',
  custom: '自定义',
};

const CATEGORY_ICONS: Record<FactorCategory, React.ReactNode> = {
  price: <DollarSign size={14} />,
  technical: <BarChart2 size={14} />,
  financial: <TrendingUp size={14} />,
  sentiment: <Brain size={14} />,
  custom: <Zap size={14} />,
};

interface FactorComposerPanelProps {
  portfolio?: FactorPortfolio;
  onBacktest?: (result: ComposerBacktestResult) => void;
  defaultSymbols?: string[];
}

const DEFAULT_SYMBOLS = [
  '000001', '000002', '300750', '600519', '601318',
  '000858', '002594', '688981', '300001', '600036',
];

const WEIGHT_STRATEGY_OPTIONS: { value: WeightStrategy; label: string; desc: string }[] = [
  { value: 'manual', label: '手动权重', desc: '手动设置各因子权重' },
  { value: 'equal', label: '等权重', desc: '各因子权重相等 (1/N)' },
  { value: 'ic_weighted', label: 'IC加权', desc: '根据历史IC/IR自动分配' },
  { value: 'risk_parity', label: '风险平价', desc: '各因子对组合风险贡献相等' },
];

export default function FactorComposerPanel({ portfolio, onBacktest, defaultSymbols }: FactorComposerPanelProps) {
  const { showNotification } = useStore();

  // Factor selection
  const [selectedFactorWeights, setSelectedFactorWeights] = useState<FactorWeight[]>(
    portfolio?.factors ?? []
  );
  const [portfolioName, setPortfolioName] = useState(portfolio?.name ?? '');
  const [portfolioDesc, setPortfolioDesc] = useState(portfolio?.description ?? '');

  // Parameters
  const [symbols, setSymbols] = useState<string[]>(defaultSymbols ?? DEFAULT_SYMBOLS);
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2026-04-18');
  const [initialCash, setInitialCash] = useState(1000000);
  const [topN, setTopN] = useState(10);
  const [rebalanceInterval, setRebalanceInterval] = useState(5);
  const [weightStrategy, setWeightStrategy] = useState<WeightStrategy>('equal');

  // Backtest result
  const [backtestResult, setBacktestResult] = useState<ComposerBacktestResult | null>(null);
  const [backtesting, setBacktesting] = useState(false);

  // UI state
  const [expandedCategories, setExpandedCategories] = useState<Set<FactorCategory>>(
    new Set(['price', 'technical', 'financial', 'sentiment'])
  );

  const allFactors = getAllFactorDefinitions();
  const selectedFactorIds = new Set(selectedFactorWeights.map(f => f.factor_id));

  const factorsByCategory = (cats: FactorCategory[]) =>
    cats
      .map(cat => ({ cat, factors: allFactors.filter(f => f.category === cat) }))
      .filter(g => g.factors.length > 0);

  const toggleCategory = (cat: FactorCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleFactor = (factorId: string) => {
    setSelectedFactorWeights(prev => {
      const existing = prev.find(f => f.factor_id === factorId);
      if (existing) return prev.filter(f => f.factor_id !== factorId);
      return [...prev, { factor_id: factorId, weight: 0.5, direction: 'long' }];
    });
  };

  const updateWeight = (factorId: string, weight: number) => {
    setSelectedFactorWeights(prev =>
      prev.map(f => f.factor_id === factorId ? { ...f, weight } : f)
    );
  };

  const updateDirection = (factorId: string, direction: 'long' | 'short' | 'both') => {
    setSelectedFactorWeights(prev =>
      prev.map(f => f.factor_id === factorId ? { ...f, direction } : f)
    );
  };

  const applyStrategy = (strategy: WeightStrategy) => {
    setWeightStrategy(strategy);
    if (strategy !== 'manual' && selectedFactorWeights.length > 0) {
      const newWeights = applyWeightStrategy(selectedFactorWeights, strategy);
      setSelectedFactorWeights(newWeights);
    }
  };

  const runBacktest = useCallback(async () => {
    if (selectedFactorWeights.length === 0) {
      showNotification('error', '请先选择至少一个因子');
      return;
    }

    const p: FactorPortfolio = {
      id: portfolio?.id ?? Date.now().toString(),
      name: portfolioName || '未命名组合',
      description: portfolioDesc,
      factors: selectedFactorWeights,
      created_at: portfolio?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setBacktesting(true);
    setBacktestResult(null);

    try {
      await new Promise(r => setTimeout(r, 1500));
      const result = backtestPortfolio({
        portfolio: p,
        symbols,
        startDate,
        endDate,
        initialCash,
        rebalanceInterval,
        topN,
        weightStrategy,
      });
      setBacktestResult(result);
      onBacktest?.(result);
      showNotification('success', '组合回测完成');
    } catch (e: any) {
      showNotification('error', e?.message || '回测失败');
    } finally {
      setBacktesting(false);
    }
  }, [selectedFactorWeights, portfolioName, portfolioDesc, symbols, startDate, endDate,
      initialCash, rebalanceInterval, topN, weightStrategy, portfolio, showNotification, onBacktest]);

  // Build factor name map
  const factorNameMap: Record<string, string> = {};
  for (const f of allFactors) {
    factorNameMap[f.id] = f.name_cn;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Factor Selection */}
        <div className="lg:col-span-2 bg-bg-secondary rounded-xl border border-border-color p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">因子池</h3>
            <span className="text-xs text-text-muted">
              已选 {selectedFactorWeights.length} 个因子
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {factorsByCategory(['price', 'technical', 'financial', 'sentiment', 'custom']).map(({ cat, factors: catFactors }) => (
              <div key={cat} className="rounded-lg border border-border-color overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors text-sm font-medium"
                >
                  {CATEGORY_ICONS[cat]}
                  <span>{CATEGORY_LABELS[cat]}</span>
                  <span className="text-text-muted text-xs">({catFactors.length})</span>
                  <span className="ml-auto">
                    {expandedCategories.has(cat) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
                {expandedCategories.has(cat) && (
                  <div className="divide-y divide-border-color">
                    {catFactors.map(factor => (
                      <div
                        key={factor.id}
                        className={clsx(
                          'flex items-center gap-3 px-4 py-2.5 hover:bg-bg-tertiary/30 transition-colors cursor-pointer',
                          selectedFactorIds.has(factor.id) && 'bg-accent-primary/5'
                        )}
                        onClick={() => toggleFactor(factor.id)}
                      >
                        <div className={clsx(
                          'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                          selectedFactorIds.has(factor.id)
                            ? 'bg-accent-primary border-accent-primary'
                            : 'border-border-color'
                        )}>
                          {selectedFactorIds.has(factor.id) && <Check size={12} className="text-bg-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{factor.name_cn}</span>
                            <code className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded font-mono">
                              {factor.name}
                            </code>
                          </div>
                          <p className="text-xs text-text-muted truncate mt-0.5">{factor.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Configuration */}
        <div className="space-y-4">
          {/* Portfolio Info */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-3">组合信息</h3>
            <input
              type="text"
              value={portfolioName}
              onChange={e => setPortfolioName(e.target.value)}
              placeholder="组合名称..."
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm mb-2 focus:outline-none focus:border-accent-primary/50"
            />
            <input
              type="text"
              value={portfolioDesc}
              onChange={e => setPortfolioDesc(e.target.value)}
              placeholder="组合描述(可选)..."
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>

          {/* Weight Configuration */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-3">权重配置</h3>
            {/* Weight Strategy */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {WEIGHT_STRATEGY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => applyStrategy(opt.value)}
                  className={clsx(
                    'p-2 rounded-lg text-xs border transition-colors text-left',
                    weightStrategy === opt.value
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                      : 'border-border-color text-text-secondary hover:border-accent-primary/50'
                  )}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Factor weight sliders */}
            {selectedFactorWeights.length === 0 ? (
              <p className="text-text-muted text-sm">点击左侧因子添加并配置权重</p>
            ) : (
              <div className="space-y-3 max-h-[240px] overflow-y-auto">
                {selectedFactorWeights.map(fw => {
                  const def = allFactors.find(f => f.id === fw.factor_id);
                  return (
                    <div key={fw.factor_id} className="p-3 bg-bg-tertiary/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{def?.name_cn || fw.factor_id}</span>
                        <button
                          onClick={() => toggleFactor(fw.factor_id)}
                          className="p-1 text-text-muted hover:text-accent-danger"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      {weightStrategy === 'manual' && (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={fw.weight}
                              onChange={e => updateWeight(fw.factor_id, parseFloat(e.target.value))}
                              className="flex-1 h-1 bg-bg-tertiary rounded-full appearance-none cursor-pointer accent-accent-primary"
                            />
                            <span className="text-xs font-mono w-10 text-right">
                              {(fw.weight * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {(['long', 'short', 'both'] as const).map(dir => (
                              <button
                                key={dir}
                                onClick={() => updateDirection(fw.factor_id, dir)}
                                className={clsx(
                                  'flex-1 py-1 text-[10px] rounded transition-colors',
                                  fw.direction === dir
                                    ? dir === 'long' ? 'bg-accent-success/20 text-accent-success'
                                    : dir === 'short' ? 'bg-accent-danger/20 text-accent-danger'
                                    : 'bg-accent-primary/20 text-accent-primary'
                                    : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
                                )}
                              >
                                {dir === 'long' ? '做多' : dir === 'short' ? '做空' : '双向'}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      {weightStrategy !== 'manual' && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-muted">
                            {fw.direction === 'long' ? '做多' : fw.direction === 'short' ? '做空' : '双向'}
                          </span>
                          <span className="text-xs font-mono text-accent-primary">
                            {(fw.weight * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Backtest Parameters */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-3">回测参数</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">开始日期</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-color rounded-lg text-xs focus:outline-none focus:border-accent-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">结束日期</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-color rounded-lg text-xs focus:outline-none focus:border-accent-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">初始资金</label>
                <input
                  type="number"
                  value={initialCash}
                  onChange={e => setInitialCash(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-color rounded-lg text-xs font-mono focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">持仓数 (Top N)</label>
                  <input
                    type="number"
                    value={topN}
                    onChange={e => setTopN(Number(e.target.value))}
                    min={1} max={50}
                    className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-color rounded-lg text-xs font-mono focus:outline-none focus:border-accent-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">调仓周期 (天)</label>
                  <input
                    type="number"
                    value={rebalanceInterval}
                    onChange={e => setRebalanceInterval(Number(e.target.value))}
                    min={1} max={60}
                    className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-color rounded-lg text-xs font-mono focus:outline-none focus:border-accent-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">股票池 (逗号分隔)</label>
                <textarea
                  value={symbols.join(',')}
                  onChange={e => setSymbols(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  rows={2}
                  className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-color rounded-lg text-xs font-mono focus:outline-none focus:border-accent-primary/50 resize-none"
                />
              </div>
            </div>

            <button
              onClick={runBacktest}
              disabled={backtesting || selectedFactorWeights.length === 0}
              className="w-full mt-4 py-2.5 bg-accent-primary text-bg-primary text-sm font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {backtesting ? (
                <>
                  <div className="w-4 h-4 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" />
                  回测中...
                </>
              ) : (
                <>
                  <Play size={14} />
                  启动组合回测
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Backtest Results */}
      {backtestResult && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: '总收益率', value: `${backtestResult.total_return >= 0 ? '+' : ''}${backtestResult.total_return.toFixed(2)}%`, className: backtestResult.total_return >= 0 ? 'text-accent-success' : 'text-accent-danger' },
              { label: '年化收益率', value: `${backtestResult.annual_return >= 0 ? '+' : ''}${backtestResult.annual_return.toFixed(2)}%`, className: backtestResult.annual_return >= 0 ? 'text-accent-success' : 'text-accent-danger' },
              { label: '最大回撤', value: `-${backtestResult.max_drawdown.toFixed(2)}%`, className: 'text-accent-danger' },
              { label: '夏普比率', value: backtestResult.sharpe_ratio.toFixed(2), className: 'text-accent-primary' },
              { label: '交易次数', value: backtestResult.total_trades.toString(), className: 'text-text-primary' },
              { label: '胜率', value: `${(backtestResult.win_rate * 100).toFixed(1)}%`, className: 'text-text-primary' },
              { label: '多头收益', value: `${backtestResult.long_return >= 0 ? '+' : ''}${backtestResult.long_return.toFixed(2)}%`, className: backtestResult.long_return >= 0 ? 'text-accent-success' : 'text-accent-danger' },
              { label: '空头收益', value: `${backtestResult.short_return >= 0 ? '+' : ''}${backtestResult.short_return.toFixed(2)}%`, className: backtestResult.short_return >= 0 ? 'text-accent-success' : 'text-accent-danger' },
            ].map((metric, i) => (
              <div key={i} className="bg-bg-secondary rounded-xl border border-border-color p-3 text-center">
                <div className={clsx('text-lg font-bold font-mono', metric.className)}>{metric.value}</div>
                <div className="text-[10px] text-text-muted mt-0.5">{metric.label}</div>
              </div>
            ))}
          </div>

          {/* Equity Curve */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-4">权益曲线</h3>
            <EquityCurveDisplay data={backtestResult.equity_curve} />
          </div>

          {/* Factor Contribution Charts */}
          <FactorContributionChart result={backtestResult} factorNames={factorNameMap} />
        </div>
      )}
    </div>
  );
}

// Inline equity curve SVG chart
function EquityCurveDisplay({ data }: { data: { date: string; value: number }[] }) {
  if (!data || data.length < 2) return <div className="text-text-muted text-sm">数据不足</div>;

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const width = 800;
  const height = 200;
  const padding = 30;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.value - minVal) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaPath = `M ${padding},${height - padding} L ${points} L ${width - padding},${height - padding} Z`;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px]" style={{ color: 'var(--accent-primary)' }}>
        <defs>
          <linearGradient id="eq-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {Array.from({ length: 5 }, (_, i) => {
          const y = padding + (i / 4) * (height - padding * 2);
          const val = maxVal - (i / 4) * range;
          return (
            <g key={i}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,4" opacity="0.3" />
              <text x={padding - 5} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">
                {val.toFixed(0)}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#eq-gradient)" />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <text x={padding} y={height - 5} fontSize="10" fill="currentColor" opacity="0.6" textAnchor="start">
          {data[0].date}
        </text>
        <text x={width - padding} y={height - 5} fontSize="10" fill="currentColor" opacity="0.6" textAnchor="end">
          {data[data.length - 1].date}
        </text>
        <text x={padding} y={height - padding - 5} fontSize="10" fill="currentColor" fontWeight="bold" textAnchor="start">
          {data[0].value.toFixed(0)}
        </text>
        <text x={width - padding} y={height - padding - 5} fontSize="10" fill="currentColor" fontWeight="bold" textAnchor="end">
          {data[data.length - 1].value.toFixed(0)}
        </text>
      </svg>
    </div>
  );
}
