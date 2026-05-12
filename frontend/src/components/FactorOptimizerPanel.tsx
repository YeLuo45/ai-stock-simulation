/**
 * FactorOptimizerPanel - UI for Factor Weight Auto-Optimization
 */
import { useState, useEffect, useCallback } from 'react';
import {
  runOptimization,
  getOptimizationResults,
  getBestWeights,
  clearBestWeights,
  getTotalGridCombinations,
  type OptimizationResult,
  type FactorConfig,
} from '../agents/FactorOptimizer';
import { getAllFactorDefinitions, BUILTIN_FACTORS } from '../services/factorEngine';
import { useStore } from '../store';
import type { FactorDefinition } from '../types';
import {
  Play,
  Settings2,
  BarChart3,
  TrendingUp,
  Target,
  Award,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const OBJECTIVE_OPTIONS = [
  { value: 'sharpe', label: '夏普比率 (Sharpe Ratio)', icon: <TrendingUp size={14} /> },
  { value: 'return', label: '总收益率 (Total Return)', icon: <BarChart3 size={14} /> },
  { value: 'winrate', label: '胜率 (Win Rate)', icon: <Target size={14} /> },
] as const;

const METHOD_OPTIONS = [
  { value: 'grid', label: '网格搜索 (Grid Search)', description: '遍历所有离散组合，精准但耗时' },
  { value: 'random', label: '随机搜索 (Random Search)', description: '随机采样指定次数，更快' },
] as const;

const DEFAULT_SYMBOLS = [
  '000001', '000002', '000004', '000005', '000006',
  '300750', '300751', '300752', '300753', '300754',
  '600519', '600520', '600521', '600522', '600523',
  '601318', '601319', '601320', '601321', '601322',
];

export default function FactorOptimizerPanel() {
  const { showNotification } = useStore();

  // Configuration state
  const [method, setMethod] = useState<'grid' | 'random'>('grid');
  const [objective, setObjective] = useState<'sharpe' | 'return' | 'winrate'>('sharpe');
  const [symbolsInput, setSymbolsInput] = useState(DEFAULT_SYMBOLS.join(', '));
  const [trials, setTrials] = useState(100);

  // Factor selection state
  const [selectedFactors, setSelectedFactors] = useState<FactorConfig[]>([]);

  // Optimization state
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentResult, setCurrentResult] = useState<OptimizationResult | null>(null);
  const [historyResults, setHistoryResults] = useState<OptimizationResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history on mount
  useEffect(() => {
    setHistoryResults(getOptimizationResults());
  }, []);

  // Get all available factors
  const allFactors = getAllFactorDefinitions();

  // Toggle factor selection
  const toggleFactor = useCallback((factor: FactorDefinition) => {
    setSelectedFactors(prev => {
      const existing = prev.find(f => f.factor_id === factor.id);
      if (existing) {
        return prev.filter(f => f.factor_id !== factor.id);
      }
      return [
        ...prev,
        {
          factor_id: factor.id,
          weight: 0.5,
          direction: 'long',
          enabled: true,
        },
      ];
    });
  }, []);

  // Update factor direction
  const updateFactorDirection = useCallback((factorId: string, direction: 'long' | 'short') => {
    setSelectedFactors(prev =>
      prev.map(f => (f.factor_id === factorId ? { ...f, direction } : f))
    );
  }, []);

  // Calculate trials info
  const getTrialsInfo = useCallback(() => {
    const enabledCount = selectedFactors.filter(f => f.enabled).length;
    if (enabledCount === 0) return 0;
    if (method === 'grid') {
      return getTotalGridCombinations(enabledCount);
    }
    return trials;
  }, [method, selectedFactors, trials]);

  // Run optimization
  const handleRunOptimization = async () => {
    if (selectedFactors.length === 0) {
      showNotification('error', '请先选择至少一个因子');
      return;
    }

    const symbols = symbolsInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (symbols.length === 0) {
      showNotification('error', '请输入至少一个股票代码');
      return;
    }

    setIsRunning(true);
    setProgress({ current: 0, total: getTrialsInfo() });
    setCurrentResult(null);

    try {
      const result = await runOptimization({
        symbols,
        factors: selectedFactors,
        method,
        objective,
        trials,
        onProgress: (current, total) => {
          setProgress({ current, total });
        },
      });

      setCurrentResult(result);
      setHistoryResults(getOptimizationResults());
      showNotification('success', '优化完成！');
    } catch (err) {
      showNotification('error', `优化失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Apply best weights
  const handleApplyWeights = () => {
    if (!currentResult) return;
    // Save to best weights storage
    const bestWeights = currentResult.topWeights;
    // Convert to FactorWeight and store in factorEngine
    const { saveBestWeights: saveBW } = require('../agents/FactorOptimizer');
    saveBW(bestWeights);
    showNotification('success', '已应用最优权重到当前因子组合');
  };

  // Load from history
  const handleLoadFromHistory = (result: OptimizationResult) => {
    setCurrentResult(result);
    setSelectedFactors(result.topWeights);
    showNotification('info', '已加载历史优化结果');
  };

  // Clear best weights
  const handleClearBest = () => {
    clearBestWeights();
    showNotification('info', '已清除最优权重');
  };

  const enabledCount = selectedFactors.filter(f => f.enabled).length;
  const trialsInfo = getTrialsInfo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            因子权重自动优化
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            通过网格搜索或随机搜索自动寻找最优因子权重组合
          </p>
        </div>
        {currentResult && (
          <button
            onClick={handleApplyWeights}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <CheckCircle2 size={16} />
            应用为当前权重
          </button>
        )}
      </div>

      {/* Configuration Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 size={18} className="text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">优化配置</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              优化方法
            </label>
            <div className="space-y-2">
              {METHOD_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                    ${method === opt.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="method"
                    value={opt.value}
                    checked={method === opt.value}
                    onChange={() => setMethod(opt.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-white">
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {opt.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Objective Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              优化目标
            </label>
            <div className="space-y-2">
              {OBJECTIVE_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                    ${objective === opt.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="objective"
                    value={opt.value}
                    checked={objective === opt.value}
                    onChange={() => setObjective(opt.value)}
                  />
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                    {opt.icon}
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Symbols Input */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            候选股票 (逗号分隔)
          </label>
          <input
            type="text"
            value={symbolsInput}
            onChange={e => setSymbolsInput(e.target.value)}
            placeholder="000001, 000002, 600519, ..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Trials info */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {method === 'grid' ? (
              <>网格搜索组合数: <span className="font-mono font-medium">{trialsInfo.toLocaleString()}</span></>
            ) : (
              <>
                随机搜索次数:{' '}
                <input
                  type="number"
                  value={trials}
                  onChange={e => setTrials(Math.max(10, parseInt(e.target.value) || 100))}
                  min={10}
                  max={10000}
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </>
            )}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            已选因子: <span className="font-medium">{enabledCount}</span> 个
          </div>
        </div>
      </div>

      {/* Factor Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">选择待优化因子</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
          {allFactors.map(factor => {
            const selected = selectedFactors.find(f => f.factor_id === factor.id);
            return (
              <label
                key={factor.id}
                className={`
                  flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm
                  ${selected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }
                `}
              >
                <input
                  type="checkbox"
                  checked={!!selected}
                  onChange={() => toggleFactor(factor)}
                  className="rounded"
                />
                <span className="truncate text-gray-900 dark:text-white" title={factor.name_cn}>
                  {factor.name_cn}
                </span>
              </label>
            );
          })}
        </div>

        {/* Selected factors direction */}
        {selectedFactors.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              因子方向设置
            </div>
            <div className="space-y-2">
              {selectedFactors.map(f => {
                const factorDef = allFactors.find(def => def.id === f.factor_id);
                return (
                  <div key={f.factor_id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-32 truncate">
                      {factorDef?.name_cn || f.factor_id}
                    </span>
                    <div className="flex gap-1">
                      {(['long', 'short'] as const).map(dir => (
                        <button
                          key={dir}
                          onClick={() => updateFactorDirection(f.factor_id, dir)}
                          className={`
                            px-3 py-1 text-xs rounded-full transition-colors
                            ${f.direction === dir
                              ? dir === 'long'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }
                          `}
                        >
                          {dir === 'long' ? '做多' : '做空'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Run Button */}
      <button
        onClick={handleRunOptimization}
        disabled={isRunning || enabledCount === 0}
        className={`
          w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all
          ${isRunning || enabledCount === 0
            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30'
          }
        `}
      >
        {isRunning ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            优化中... {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
          </>
        ) : (
          <>
            <Play size={18} />
            开始优化
          </>
        )}
      </button>

      {/* Progress Bar */}
      {isRunning && progress.total > 0 && (
        <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-indigo-500 transition-all duration-100"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      )}

      {/* Current Result */}
      {currentResult && !isRunning && (
        <ResultCard
          result={currentResult}
          onApply={handleApplyWeights}
        />
      )}

      {/* History Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-white">历史优化结果</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({historyResults.length})
            </span>
          </div>
          {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showHistory && (
          <div className="px-4 pb-4 space-y-3">
            {historyResults.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                暂无历史记录
              </p>
            ) : (
              historyResults.map(result => (
                <HistoryItem
                  key={result.id}
                  result={result}
                  onLoad={() => handleLoadFromHistory(result)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Result Card Component ----

function ResultCard({
  result,
  onApply,
}: {
  result: OptimizationResult;
  onApply: () => void;
}) {
  const metricCards = [
    {
      label: '夏普比率',
      value: result.metrics.sharpeRatio.toFixed(3),
      icon: <TrendingUp size={16} />,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: '总收益率',
      value: `${result.metrics.totalReturn.toFixed(2)}%`,
      icon: <BarChart3 size={16} />,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: '胜率',
      value: `${(result.metrics.winRate * 100).toFixed(1)}%`,
      icon: <Target size={16} />,
      color: 'text-purple-600',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      label: '最大回撤',
      value: `${result.metrics.maxDrawdown.toFixed(2)}%`,
      icon: <Award size={16} />,
      color: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-green-600" />
          <h3 className="font-medium text-gray-900 dark:text-white">优化结果</h3>
          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500">
            {result.method === 'grid' ? '网格搜索' : '随机搜索'}
          </span>
          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500">
            {result.trials.toLocaleString()} 次
          </span>
        </div>
        <button
          onClick={onApply}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <CheckCircle2 size={14} />
          应用
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {metricCards.map(card => (
          <div key={card.label} className={`${card.bg} rounded-lg p-3`}>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span className={card.color}>{card.icon}</span>
              {card.label}
            </div>
            <div className={`text-lg font-bold ${card.color}`}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Weights Table */}
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        最优权重
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">
                因子
              </th>
              <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">
                权重
              </th>
              <th className="text-center py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">
                方向
              </th>
            </tr>
          </thead>
          <tbody>
            {result.topWeights.map(w => (
              <tr key={w.factor_id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 px-3 text-gray-900 dark:text-white">
                  {w.factor_id}
                </td>
                <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                  {(w.weight * 100).toFixed(1)}%
                </td>
                <td className="py-2 px-3 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs ${
                      w.direction === 'long'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {w.direction === 'long' ? '做多' : '做空'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- History Item Component ----

function HistoryItem({
  result,
  onLoad,
}: {
  result: OptimizationResult;
  onLoad: () => void;
}) {
  const date = new Date(result.createdAt);
  const dateStr = date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded">
            {result.method === 'grid' ? '网格' : '随机'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {OBJECTIVE_OPTIONS.find(o => o.value === result.objective)?.label.split(' ')[0]}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {dateStr}
          </span>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="text-gray-600 dark:text-gray-300">
            夏普 <span className="font-mono">{result.metrics.sharpeRatio.toFixed(2)}</span>
          </span>
          <span className="text-gray-600 dark:text-gray-300">
            收益 <span className="font-mono">{result.metrics.totalReturn.toFixed(1)}%</span>
          </span>
        </div>
      </div>
      <button
        onClick={onLoad}
        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
      >
        <RotateCcw size={12} />
        加载
      </button>
    </div>
  );
}
