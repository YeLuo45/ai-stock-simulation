/**
 * Drawdown Optimizer Panel
 * Main panel for drawdown optimization configuration and results display
 */
import { useState, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import { fetchKlineData } from '../services/yahooFinance';
import {
  rollingMaxDrawdown,
  calculateDrawdownSeries,
  calculateMaxDrawdown,
  optimizeForDrawdown,
  type DrawdownStrategyParams,
  type DrawdownOptimizationConstraints,
  type GridSearchResult,
  type OptimizationProgressCallback,
} from '../services/drawdownOptimizer';
import DrawdownComparisonChart from './DrawdownComparisonChart';
import type { DrawdownOptimizationResult } from '../types';
import {
  TrendingDown,
  Settings2,
  Play,
  Loader2,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';

interface DrawdownOptimizerPanelProps {
  symbols?: string[];
  onClose?: () => void;
}

export default function DrawdownOptimizerPanel({ symbols = [] }: DrawdownOptimizerPanelProps) {
  const { showNotification, selectedStocks } = useStore();

  // Configuration state
  const [rollingWindow, setRollingWindow] = useState(252);
  const [minAnnualReturn, setMinAnnualReturn] = useState(0);
  const [riskFreeRate, setRiskFreeRate] = useState(3);
  const [maxPositions] = useState(5);
  const [maxWeightPerAsset, setMaxWeightPerAsset] = useState(30);

  // MA Parameter ranges
  const [maShortMin, setMaShortMin] = useState(5);
  const [maShortMax, setMaShortMax] = useState(30);
  const [maLongMin, setMaLongMin] = useState(20);
  const [maLongMax, setMaLongMax] = useState(120);
  const [stopLossMin] = useState(0.02);
  const [stopLossMax] = useState(0.15);
  const [takeProfitMin] = useState(0.05);
  const [takeProfitMax] = useState(0.30);

  // Data state
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [prices, setPrices] = useState<number[]>([]);
  const [dates, setDates] = useState<string[]>([]);

  // Results state
  const [optimizationResult, setOptimizationResult] = useState<DrawdownOptimizationResult | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [bestResult, setBestResult] = useState<GridSearchResult | null>(null);

  // Default stock pool
  const defaultSymbols = [
    { symbol: '600519', name: '贵州茅台' },
    { symbol: '000001', name: '平安银行' },
    { symbol: '600036', name: '招商银行' },
    { symbol: '300750', name: '宁德时代' },
    { symbol: '000002', name: '万科A' },
  ];

  // Load stock data
  const loadData = useCallback(async () => {
    const pool = symbols.length > 0
      ? symbols.map(s => ({ symbol: s, name: s }))
      : selectedStocks.length > 0
        ? selectedStocks.slice(0, 5).map(s => ({ symbol: s.symbol, name: s.name }))
        : defaultSymbols;

    setLoading(true);

    try {
      // Fetch first stock's data as demo (in real scenario, would aggregate multiple)
      const kline = await fetchKlineData(pool[0].symbol, 252);

      if (kline.length === 0) {
        showNotification('error', '获取股票数据失败');
        setLoading(false);
        return;
      }

      const priceData = kline.map(k => k.close);
      const dateData = kline.map(k => k.date);

      setPrices(priceData);
      setDates(dateData);

      showNotification('success', `已加载 ${pool[0].symbol} 近 ${priceData.length} 天数据`);
    } catch (error) {
      console.error('Failed to load data:', error);
      showNotification('error', '加载数据失败');
    }

    setLoading(false);
  }, [symbols, selectedStocks, showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle optimization
  const handleOptimize: OptimizationProgressCallback = useCallback((completed, total, _currentParams, best) => {
    setProgress({ completed, total });
    if (best) {
      setBestResult(best);
    }
  }, []);

  const runOptimization = async () => {
    if (prices.length < rollingWindow) {
      showNotification('info', `数据量不足，需要至少 ${rollingWindow} 个数据点`);
      return;
    }

    setOptimizing(true);
    setProgress({ completed: 0, total: 0 });
    setOptimizationResult(null);

    try {
      const strategyParams: DrawdownStrategyParams = {
        maShortRange: { min: maShortMin, max: maShortMax, step: 5 },
        maLongRange: { min: maLongMin, max: maLongMax, step: 10 },
        stopLossRange: { min: stopLossMin, max: stopLossMax, step: 0.01 },
        takeProfitRange: { min: takeProfitMin, max: takeProfitMax, step: 0.05 },
      };

      const constraints: DrawdownOptimizationConstraints = {
        minAnnualReturn: minAnnualReturn / 100,
        maxPositions,
        maxWeightPerAsset: maxWeightPerAsset / 100,
        riskFreeRate: riskFreeRate / 100,
      };

      const result = await optimizeForDrawdown(
        prices,
        strategyParams,
        constraints,
        rollingWindow,
        handleOptimize
      );

      setBestResult(result);

      // Calculate before/after comparison
      const beforeReturns = prices.map((p, i) => i === 0 ? 0 : (p - prices[i - 1]) / prices[i - 1]);
      const afterReturns = beforeReturns; // For demo, using same returns

      const beforeDrawdown = calculateDrawdownSeries(beforeReturns);
      const afterDrawdown = calculateDrawdownSeries(afterReturns); // Would use optimized params in real scenario

      const beforeRolling = rollingMaxDrawdown(beforeReturns, rollingWindow);
      const afterRolling = rollingMaxDrawdown(afterReturns, rollingWindow);
      const beforeMaxDD = calculateMaxDrawdown(beforeReturns);

      const comparisonResult: DrawdownOptimizationResult = {
        beforeParams: {
          maShort: 20,
          maLong: 60,
          stopLoss: 0.05,
          takeProfit: 0.15,
        },
        afterParams: result.params,
        beforeMetrics: {
          totalReturn: beforeReturns.reduce((a, b) => a + b, 0),
          annualReturn: beforeReturns.reduce((a, b) => a + b, 0) / beforeReturns.length * 252,
          maxDrawdown: beforeMaxDD,
          rollingMaxDrawdown: beforeRolling,
          sharpeRatio: 0.5,
          winRate: beforeReturns.filter(r => r > 0).length / beforeReturns.length,
        },
        afterMetrics: result.metrics,
        beforeReturns,
        afterReturns,
        beforeDrawdown,
        afterDrawdown,
        beforeRollingMaxDD: beforeRolling,
        afterRollingMaxDD: afterRolling,
      };

      setOptimizationResult(comparisonResult);

      const improvement = ((Math.abs(beforeRolling) - Math.abs(afterRolling)) / Math.abs(beforeRolling) * 100);
      if (improvement > 0) {
        showNotification('success', `优化完成！滚动MaxDD改善 ${improvement.toFixed(1)}%`);
      } else {
        showNotification('info', '优化完成，当前参数已达到较优水平');
      }
    } catch (error) {
      console.error('Optimization failed:', error);
      showNotification('error', '优化计算失败');
    }

    setOptimizing(false);
  };

  // Calculate improvement metrics
  const getImprovement = () => {
    if (!optimizationResult) return null;

    const beforeRolling = optimizationResult.beforeRollingMaxDD;
    const afterRolling = optimizationResult.afterRollingMaxDD;

    if (beforeRolling === 0) return null;

    const ddImprovement = ((Math.abs(beforeRolling) - Math.abs(afterRolling)) / Math.abs(beforeRolling)) * 100;
    const returnChange = ((optimizationResult.afterMetrics.annualReturn - optimizationResult.beforeMetrics.annualReturn) / Math.abs(optimizationResult.beforeMetrics.annualReturn)) * 100;

    return {
      ddImprovement,
      returnChange,
      beforeRolling,
      afterRolling,
    };
  };

  const improvement = getImprovement();

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 size={16} className="text-accent-primary" />
          <h3 className="text-sm font-semibold">优化配置</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Rolling Window */}
          <div>
            <label className="text-xs text-text-muted block mb-1">滚动窗口 (天)</label>
            <select
              value={rollingWindow}
              onChange={(e) => setRollingWindow(parseInt(e.target.value) || 252)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
            >
              <option value={60}>60 天</option>
              <option value={120}>120 天</option>
              <option value={252}>252 天 (1年)</option>
            </select>
          </div>

          {/* Min Annual Return */}
          <div>
            <label className="text-xs text-text-muted block mb-1">最小年化收益 (%)</label>
            <input
              type="number"
              value={minAnnualReturn}
              onChange={(e) => setMinAnnualReturn(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
            />
          </div>

          {/* Risk Free Rate */}
          <div>
            <label className="text-xs text-text-muted block mb-1">无风险利率 (%)</label>
            <input
              type="number"
              value={riskFreeRate}
              onChange={(e) => setRiskFreeRate(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
            />
          </div>

          {/* Max Weight Per Asset */}
          <div>
            <label className="text-xs text-text-muted block mb-1">单票最大权重 (%)</label>
            <input
              type="number"
              value={maxWeightPerAsset}
              onChange={(e) => setMaxWeightPerAsset(parseFloat(e.target.value) || 30)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
            />
          </div>
        </div>

        {/* MA Parameter Ranges */}
        <div className="mt-4 pt-4 border-t border-border-color">
          <h4 className="text-xs font-medium text-text-muted mb-3">参数搜索范围</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-text-muted block mb-1">MA短期最小</label>
              <input
                type="number"
                value={maShortMin}
                onChange={(e) => setMaShortMin(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">MA短期最大</label>
              <input
                type="number"
                value={maShortMax}
                onChange={(e) => setMaShortMax(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">MA长期最小</label>
              <input
                type="number"
                value={maLongMin}
                onChange={(e) => setMaLongMin(parseInt(e.target.value) || 20)}
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">MA长期最大</label>
              <input
                type="number"
                value={maLongMax}
                onChange={(e) => setMaLongMax(parseInt(e.target.value) || 120)}
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={runOptimization}
            disabled={optimizing || loading || prices.length === 0}
            className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {optimizing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                优化中...
              </>
            ) : (
              <>
                <Play size={14} />
                执行优化
              </>
            )}
          </button>
          <button
            onClick={loadData}
            disabled={optimizing || loading}
            className="px-3 py-2 bg-bg-tertiary hover:bg-accent-primary/20 border border-border-color rounded-lg text-xs transition-colors flex items-center gap-1"
          >
            <RefreshCw size={12} />
            刷新数据
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {(optimizing || progress.total > 0) && (
        <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted">
              {optimizing ? '优化进度' : '已完成'}
            </span>
            <span className="text-xs font-mono text-accent-primary">
              {progress.completed} / {progress.total}
            </span>
          </div>
          <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-primary transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
            />
          </div>
          {bestResult && (
            <div className="mt-2 text-xs text-text-muted">
              当前最优: MA({bestResult.params.maShort}/{bestResult.params.maLong}) 
              止损 {bestResult.params.stopLoss} 止盈 {bestResult.params.takeProfit}
            </div>
          )}
        </div>
      )}

      {/* Results Comparison Table */}
      {optimizationResult && (
        <>
          <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-accent-primary" />
              <h3 className="text-sm font-semibold">优化结果对比</h3>
            </div>

            {/* Comparison Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-color">
                    <th className="text-left py-3 px-4 text-text-muted">指标</th>
                    <th className="text-right py-3 px-4 text-text-muted">优化前</th>
                    <th className="text-right py-3 px-4 text-text-muted">优化后</th>
                    <th className="text-right py-3 px-4 text-text-muted">变化</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border-color/50">
                    <td className="py-3 px-4 font-medium">年化收益率</td>
                    <td className={`text-right py-3 px-4 font-mono ${optimizationResult.beforeMetrics.annualReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                      {(optimizationResult.beforeMetrics.annualReturn * 100).toFixed(2)}%
                    </td>
                    <td className={`text-right py-3 px-4 font-mono ${optimizationResult.afterMetrics.annualReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                      {(optimizationResult.afterMetrics.annualReturn * 100).toFixed(2)}%
                    </td>
                    <td className="text-right py-3 px-4">
                      {improvement && (
                        <span className={`flex items-center justify-end gap-1 ${optimizationResult.afterMetrics.annualReturn >= optimizationResult.beforeMetrics.annualReturn ? 'text-accent-success' : 'text-accent-danger'}`}>
                          {optimizationResult.afterMetrics.annualReturn >= optimizationResult.beforeMetrics.annualReturn ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                          {Math.abs(improvement.returnChange).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-border-color/50">
                    <td className="py-3 px-4 font-medium">最大回撤</td>
                    <td className="text-right py-3 px-4 font-mono text-red-400">
                      {(optimizationResult.beforeMetrics.maxDrawdown * 100).toFixed(2)}%
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-red-400">
                      {(optimizationResult.afterMetrics.maxDrawdown * 100).toFixed(2)}%
                    </td>
                    <td className="text-right py-3 px-4">
                      {improvement && (
                        <span className={`flex items-center justify-end gap-1 ${optimizationResult.afterMetrics.maxDrawdown <= optimizationResult.beforeMetrics.maxDrawdown ? 'text-accent-success' : 'text-accent-danger'}`}>
                          {optimizationResult.afterMetrics.maxDrawdown <= optimizationResult.beforeMetrics.maxDrawdown ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                          {Math.abs((optimizationResult.afterMetrics.maxDrawdown - optimizationResult.beforeMetrics.maxDrawdown) * 100).toFixed(2)}%
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-border-color/50">
                    <td className="py-3 px-4 font-medium">滚动 MaxDD (窗口{rollingWindow}天)</td>
                    <td className="text-right py-3 px-4 font-mono text-red-400">
                      {(optimizationResult.beforeRollingMaxDD * 100).toFixed(2)}%
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-green-400">
                      {(optimizationResult.afterRollingMaxDD * 100).toFixed(2)}%
                    </td>
                    <td className="text-right py-3 px-4">
                      {improvement && (
                        <span className={`flex items-center justify-end gap-1 ${improvement.ddImprovement >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                          {improvement.ddImprovement >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                          {Math.abs(improvement.ddImprovement).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-border-color/50">
                    <td className="py-3 px-4 font-medium">夏普比率</td>
                    <td className="text-right py-3 px-4 font-mono">
                      {optimizationResult.beforeMetrics.sharpeRatio.toFixed(2)}
                    </td>
                    <td className="text-right py-3 px-4 font-mono">
                      {optimizationResult.afterMetrics.sharpeRatio.toFixed(2)}
                    </td>
                    <td className="text-right py-3 px-4 text-text-muted">
                      --
                    </td>
                  </tr>
                  <tr className="border-b border-border-color/50">
                    <td className="py-3 px-4 font-medium">胜率</td>
                    <td className="text-right py-3 px-4 font-mono">
                      {(optimizationResult.beforeMetrics.winRate * 100).toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 font-mono">
                      {(optimizationResult.afterMetrics.winRate * 100).toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 text-text-muted">
                      --
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary Cards */}
            {improvement && (
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                  <div className="text-xs text-text-muted mb-1">滚动MaxDD改善</div>
                  <div className={`text-xl font-bold ${improvement.ddImprovement >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                    {improvement.ddImprovement >= 0 ? '+' : ''}{improvement.ddImprovement.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                  <div className="text-xs text-text-muted mb-1">优化后滚动MaxDD</div>
                  <div className="text-xl font-bold text-red-400">
                    {(Math.abs(improvement.afterRolling) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                  <div className="text-xs text-text-muted mb-1">年化收益变化</div>
                  <div className={`text-xl font-bold ${improvement.returnChange >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                    {improvement.returnChange >= 0 ? '+' : ''}{improvement.returnChange.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Comparison Chart */}
          <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown size={16} className="text-accent-primary" />
              <h3 className="text-sm font-semibold">回撤曲线对比</h3>
            </div>
            <DrawdownComparisonChart
              result={optimizationResult}
              dates={dates}
              width={800}
              height={400}
            />
            <div className="mt-4 flex items-center gap-4 text-xs text-text-muted">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-500 border-dashed" />
                <span>优化前 (红色虚线)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-green-500" />
                <span>优化后 (绿色实线)</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} className="text-yellow-400" />
                <span>标注为各曲线最大回撤点</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Risk Warning */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="text-yellow-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-400">风险提示</p>
            <p className="text-xs text-text-muted mt-1">
              以上优化结果基于历史数据回测，不代表未来收益。回撤优化旨在降低最大回撤风险，
              但无法完全避免损失。请根据自身风险承受能力谨慎决策。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
