/**
 * OptimizationPanel - Strategy parameter optimization panel
 * Collapsible panel within BacktestPage with heatmap visualization and top results
 */
import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Play, Check, Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import HeatmapChart, { type HeatmapCell } from './HeatmapChart';

interface OptimizationResult {
  params: Record<string, number>;
  total_return: number;
  annual_return?: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  profit_loss_ratio: number;
  total_trades: number;
}

interface OptimizationPanelProps {
  optimizationParams: Record<string, [number, number, number]>;
  onParamsChange: (params: Record<string, [number, number, number]>) => void;
  onRunOptimization: () => Promise<void>;
  optimizationResults: OptimizationResult[] | null;
  isRunning: boolean;
  onApplyBestParams: (shortPeriod: number, longPeriod: number) => void;
  shortPeriod?: number;
  longPeriod?: number;
}

export default function OptimizationPanel({
  optimizationParams,
  onParamsChange,
  onRunOptimization,
  optimizationResults,
  isRunning,
  onApplyBestParams,
  shortPeriod = 5,
  longPeriod = 20,
}: OptimizationPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);

  // Convert optimization results to heatmap format
  const heatmapData: HeatmapCell[] = optimizationResults
    ? optimizationResults.map((r) => ({
        shortPeriod: r.params['MA.short'] || r.params['MA.period'] || shortPeriod,
        longPeriod: r.params['MA.long'] || longPeriod,
        total_return: r.total_return,
        annual_return: r.annual_return,
        sharpe_ratio: r.sharpe_ratio,
        max_drawdown: r.max_drawdown,
        win_rate: r.win_rate,
        profit_loss_ratio: r.profit_loss_ratio,
        total_trades: r.total_trades,
      }))
    : [];

  // Top 5 results
  const top5Results = optimizationResults?.slice(0, 5) || [];

  const handleCellClick = useCallback((cell: HeatmapCell) => {
    setSelectedCell(cell);
  }, []);

  const handleApplySelected = useCallback(() => {
    if (selectedCell) {
      onApplyBestParams(selectedCell.shortPeriod, selectedCell.longPeriod);
    }
  }, [selectedCell, onApplyBestParams]);

  const handleApplyBest = useCallback(() => {
    if (top5Results.length > 0) {
      const best = top5Results[0];
      const short = best.params['MA.short'] || best.params['MA.period'] || shortPeriod;
      const long = best.params['MA.long'] || longPeriod;
      onApplyBestParams(short, long);
    }
  }, [top5Results, onApplyBestParams, shortPeriod, longPeriod]);

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">参数优化</h3>
          {optimizationResults && (
            <span className="text-xs text-text-muted">
              ({optimizationResults.length} 组参数)
            </span>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-bg-tertiary rounded transition-colors"
        >
          {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="space-y-4">
          {/* Parameter Range Inputs */}
          <div className="p-4 bg-bg-tertiary rounded-lg border border-border-color">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">参数范围设置</span>
              <span className="text-text-muted text-xs">格式: 最小值, 最大值, 步长</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(optimizationParams).map(([key, [min, max, step]]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="text-text-muted text-xs w-20 truncate">{key}</span>
                  <input
                    type="number"
                    value={min}
                    onChange={(e) =>
                      onParamsChange({
                        ...optimizationParams,
                        [key]: [Number(e.target.value), max, step],
                      })
                    }
                    className="w-14 bg-bg-secondary border border-border-color rounded px-1.5 py-1 text-xs focus:outline-none focus:border-accent-primary/50"
                    placeholder="最小"
                  />
                  <input
                    type="number"
                    value={max}
                    onChange={(e) =>
                      onParamsChange({
                        ...optimizationParams,
                        [key]: [min, Number(e.target.value), step],
                      })
                    }
                    className="w-14 bg-bg-secondary border border-border-color rounded px-1.5 py-1 text-xs focus:outline-none focus:border-accent-primary/50"
                    placeholder="最大"
                  />
                  <input
                    type="number"
                    value={step}
                    onChange={(e) =>
                      onParamsChange({
                        ...optimizationParams,
                        [key]: [min, max, Number(e.target.value)],
                      })
                    }
                    className="w-12 bg-bg-secondary border border-border-color rounded px-1.5 py-1 text-xs focus:outline-none focus:border-accent-primary/50"
                    placeholder="步长"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={onRunOptimization}
            disabled={isRunning}
            className={clsx(
              'w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
              isRunning
                ? 'bg-accent-primary/50 text-bg-primary cursor-not-allowed'
                : 'bg-accent-primary text-bg-primary hover:bg-accent-primary/90'
            )}
          >
            {isRunning ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                优化中...
              </>
            ) : (
              <>
                <Play size={18} />
                运行参数优化
              </>
            )}
          </button>

          {/* Results Section */}
          {optimizationResults && optimizationResults.length > 0 && (
            <>
              {/* Heatmap */}
              <div className="p-4 bg-bg-tertiary rounded-lg border border-border-color">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">收益热力图</span>
                  {selectedCell && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">
                        已选择: MA{selectedCell.shortPeriod}/{selectedCell.longPeriod}
                      </span>
                      <button
                        onClick={() => setSelectedCell(null)}
                        className="p-0.5 hover:bg-bg-secondary rounded"
                      >
                        <X size={14} className="text-text-muted" />
                      </button>
                    </div>
                  )}
                </div>
                <HeatmapChart
                  data={heatmapData}
                  onCellClick={handleCellClick}
                  cellSize={50}
                />
              </div>

              {/* Top 5 Results Table */}
              <div className="p-4 bg-bg-tertiary rounded-lg border border-border-color">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Top 5 参数组合</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-muted border-b border-border-color">
                        <th className="text-left py-2 px-2 font-normal">参数</th>
                        <th className="text-right py-2 px-2 font-normal">总收益</th>
                        <th className="text-right py-2 px-2 font-normal">年化</th>
                        <th className="text-right py-2 px-2 font-normal">最大回撤</th>
                        <th className="text-right py-2 px-2 font-normal">夏普</th>
                        <th className="text-right py-2 px-2 font-normal">胜率</th>
                        <th className="text-right py-2 px-2 font-normal">盈亏比</th>
                        <th className="text-right py-2 px-2 font-normal">交易次数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top5Results.map((result, idx) => {
                        const short = result.params['MA.short'] || result.params['MA.period'] || shortPeriod;
                        const long = result.params['MA.long'] || longPeriod;
                        const isSelected =
                          selectedCell?.shortPeriod === short && selectedCell?.longPeriod === long;

                        return (
                          <tr
                            key={idx}
                            className={clsx(
                              'border-b border-border-color/50 cursor-pointer transition-colors',
                              isSelected
                                ? 'bg-accent-primary/10'
                                : 'hover:bg-bg-secondary'
                            )}
                            onClick={() =>
                              handleCellClick({
                                shortPeriod: short,
                                longPeriod: long,
                                total_return: result.total_return,
                                annual_return: result.annual_return,
                                sharpe_ratio: result.sharpe_ratio,
                                max_drawdown: result.max_drawdown,
                                win_rate: result.win_rate,
                                profit_loss_ratio: result.profit_loss_ratio,
                                total_trades: result.total_trades,
                              })
                            }
                          >
                            <td className="py-2 px-2 font-medium">
                              MA{short}/{long}
                            </td>
                            <td
                              className={clsx(
                                'py-2 px-2 text-right font-mono',
                                result.total_return >= 0 ? 'text-accent-success' : 'text-accent-danger'
                              )}
                            >
                              {result.total_return >= 0 ? '+' : ''}
                              {result.total_return.toFixed(2)}%
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-text-muted">
                              {result.annual_return !== undefined
                                ? `${result.annual_return >= 0 ? '+' : ''}${result.annual_return.toFixed(2)}%`
                                : '-'}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-accent-danger">
                              {result.max_drawdown.toFixed(2)}%
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-accent-primary">
                              {result.sharpe_ratio.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-accent-secondary">
                              {result.win_rate.toFixed(1)}%
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-accent-warning">
                              {result.profit_loss_ratio.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                              {result.total_trades}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Apply Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleApplyBest}
                  disabled={top5Results.length === 0}
                  className={clsx(
                    'flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
                    top5Results.length === 0
                      ? 'bg-accent-secondary/50 text-bg-primary cursor-not-allowed'
                      : 'bg-accent-secondary text-bg-primary hover:bg-accent-secondary/90'
                  )}
                >
                  <Check size={16} />
                  应用最优参数
                </button>
                <button
                  onClick={handleApplySelected}
                  disabled={!selectedCell}
                  className={clsx(
                    'flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
                    !selectedCell
                      ? 'bg-bg-tertiary text-text-muted cursor-not-allowed border border-border-color'
                      : 'bg-bg-tertiary text-text-primary hover:bg-bg-tertiary/80 border border-border-color'
                  )}
                >
                  <Check size={16} />
                  应用选中参数
                </button>
              </div>
            </>
          )}

          {/* Empty State */}
          {optimizationResults && optimizationResults.length === 0 && (
            <div className="text-center py-8 text-text-muted">
              未找到有效的参数组合
            </div>
          )}
        </div>
      )}
    </div>
  );
}
