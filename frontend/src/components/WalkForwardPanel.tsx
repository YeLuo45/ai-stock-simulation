/**
 * Walk-Forward Analysis Panel
 * Main panel for configuring and running walk-forward analysis
 */

import React, { useState } from 'react';
import { useStore } from '../store';
import {
  runWalkForward,
  generateWalkForwardDemoData,
  DEFAULT_WALKFORWARD_CONFIG,
} from '../services/walkForwardEngine';
import type { WalkForwardConfig, WalkForwardResult } from '../types';
import WalkForwardChart from './WalkForwardChart';
import WalkForwardMetricsTable from './WalkForwardMetricsTable';
import { Play, Loader2, Download, RefreshCw } from 'lucide-react';

interface WalkForwardPanelProps {
  strategyName?: string;
  strategyParams?: Record<string, unknown>;
}

const WINDOW_SIZE_OPTIONS = [252, 504, 756, 1008];
const STEP_SIZE_OPTIONS = [21, 42, 63];
const TRAIN_RATIO_OPTIONS = [0.5, 0.6, 0.7, 0.8, 0.9];

export default function WalkForwardPanel({
  strategyName = '均线回归策略',
  strategyParams = {},
}: WalkForwardPanelProps) {
  const { showNotification } = useStore();

  // Configuration state
  const [windowSize, setWindowSize] = useState(DEFAULT_WALKFORWARD_CONFIG.windowSize);
  const [trainRatio, setTrainRatio] = useState(DEFAULT_WALKFORWARD_CONFIG.trainRatio);
  const [stepSize, setStepSize] = useState(DEFAULT_WALKFORWARD_CONFIG.stepSize);

  // Result state
  const [result, setResult] = useState<WalkForwardResult | null>(null);
  const [running, setRunning] = useState(false);

  // Load config from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('walkforward_config');
    if (saved) {
      try {
        const config = JSON.parse(saved) as WalkForwardConfig;
        setWindowSize(config.windowSize);
        setTrainRatio(config.trainRatio);
        setStepSize(config.stepSize);
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  // Save config to localStorage on change
  const saveConfig = (cfg: WalkForwardConfig) => {
    localStorage.setItem('walkforward_config', JSON.stringify(cfg));
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const config: WalkForwardConfig = {
        windowSize,
        trainRatio,
        stepSize,
        rebalanceInterval: 5,
        minSamples: 60,
      };
      saveConfig(config);

      // Generate demo data (in production, this would use real historical data)
      const data = generateWalkForwardDemoData(1200);

      // Run walk-forward analysis
      const walkForwardResult = runWalkForward(
        config,
        strategyParams,
        data,
        strategyName,
        1000000
      );

      setResult(walkForwardResult);
      showNotification('success', `滚动回测完成，共 ${walkForwardResult.windows.length} 个窗口`);
    } catch (err: any) {
      showNotification('error', err?.message ?? '滚动回测失败');
    } finally {
      setRunning(false);
    }
  };

  const handleExportCSV = () => {
    if (!result) return;

    const headers = [
      '窗口',
      '训练期开始',
      '训练期结束',
      '测试期开始',
      '测试期结束',
      'IS收益率(%)',
      'OOS收益率(%)',
      'OOS夏普比率',
      'OOS最大回撤(%)',
      'OOS胜率(%)',
      '交易次数',
    ];

    const rows = result.windows.map((w, idx) => [
      idx + 1,
      w.trainPeriod[0],
      w.trainPeriod[1],
      w.testPeriod[0],
      w.testPeriod[1],
      w.trainReturn.toFixed(2),
      w.testReturn.toFixed(2),
      w.metrics.sharpeRatio.toFixed(2),
      w.metrics.maxDrawdown.toFixed(2),
      (w.metrics.winRate * 100).toFixed(1),
      w.metrics.totalTrades,
    ]);

    const csv = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `walkforward_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setWindowSize(DEFAULT_WALKFORWARD_CONFIG.windowSize);
    setTrainRatio(DEFAULT_WALKFORWARD_CONFIG.trainRatio);
    setStepSize(DEFAULT_WALKFORWARD_CONFIG.stepSize);
    setResult(null);
    localStorage.removeItem('walkforward_config');
  };

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <h3 className="font-semibold mb-4">滚动回测配置</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Window Size */}
          <div>
            <label className="block text-text-muted text-xs mb-2">
              窗口大小（天）
            </label>
            <div className="flex flex-wrap gap-2">
              {WINDOW_SIZE_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setWindowSize(opt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    windowSize === opt
                      ? 'bg-accent-primary text-bg-primary'
                      : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="text-xs text-text-muted mt-1">
              当前: {windowSize} 天 ({Math.floor(windowSize * trainRatio)} 天训练 + {windowSize - Math.floor(windowSize * trainRatio)} 天测试)
            </div>
          </div>

          {/* Step Size */}
          <div>
            <label className="block text-text-muted text-xs mb-2">
              滚动步长（天）
            </label>
            <div className="flex flex-wrap gap-2">
              {STEP_SIZE_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setStepSize(opt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    stepSize === opt
                      ? 'bg-accent-primary text-bg-primary'
                      : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="text-xs text-text-muted mt-1">
              当前: {stepSize} 天
            </div>
          </div>

          {/* Train Ratio */}
          <div>
            <label className="block text-text-muted text-xs mb-2">
              训练集比例
            </label>
            <div className="flex flex-wrap gap-2">
              {TRAIN_RATIO_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setTrainRatio(opt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    trainRatio === opt
                      ? 'bg-accent-primary text-bg-primary'
                      : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="text-xs text-text-muted mt-1">
              当前: {(trainRatio * 100).toFixed(0)}% ({(windowSize * trainRatio).toFixed(0)}天)
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleRun}
            disabled={running}
            className="px-5 py-2.5 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? '运行中...' : '开始滚动回测'}
          </button>
          <button
            onClick={handleReset}
            disabled={running}
            className="px-4 py-2 bg-bg-tertiary text-text-muted font-medium rounded-lg hover:text-text-primary hover:bg-bg-tertiary/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={14} />
            重置
          </button>
          {result && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-accent-secondary text-bg-primary font-medium rounded-lg hover:bg-accent-secondary/90 transition-colors flex items-center gap-2"
            >
              <Download size={14} />
              导出CSV
            </button>
          )}
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <>
          {/* Aggregate Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetricCard
              label="平均OOS收益"
              value={`${result.aggregateMetrics.avgOOSReturn >= 0 ? '+' : ''}${result.aggregateMetrics.avgOOSReturn.toFixed(2)}%`}
              className={result.aggregateMetrics.avgOOSReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'}
            />
            <MetricCard
              label="平均OOS夏普"
              value={result.aggregateMetrics.avgOOSSharpe.toFixed(2)}
              className="text-accent-primary"
            />
            <MetricCard
              label="胜率"
              value={`${(result.aggregateMetrics.winRate * 100).toFixed(0)}%`}
              className="text-accent-secondary"
            />
            <MetricCard
              label="最大回撤"
              value={`-${result.aggregateMetrics.maxDrawdown.toFixed(2)}%`}
              className="text-accent-danger"
            />
            <MetricCard
              label="OOS稳定性"
              value={result.aggregateMetrics.oosScore.toFixed(2)}
              className={result.aggregateMetrics.oosScore >= 0.7 ? 'text-accent-success' : result.aggregateMetrics.oosScore >= 0.5 ? 'text-yellow-500' : 'text-accent-danger'}
            />
          </div>

          {/* Walk-Forward Chart */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-4">滚动回测曲线</h3>
            <WalkForwardChart result={result} initialCash={1000000} />
          </div>

          {/* IS vs OOS Table */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-4">IS vs OOS 对比表</h3>
            <WalkForwardMetricsTable result={result} />
          </div>
        </>
      )}

      {/* Empty State */}
      {!result && !running && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-accent-primary/10 flex items-center justify-center mx-auto mb-4">
            <Play size={32} className="text-accent-primary" />
          </div>
          <p className="text-text-muted text-lg mb-2">配置滚动回测参数</p>
          <p className="text-text-muted text-sm">
            选择窗口大小和步长，点击「开始滚动回测」运行分析
          </p>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  className = 'text-text-primary',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
      <div className="text-text-muted text-xs mb-1">{label}</div>
      <div className={`font-mono text-xl font-bold ${className}`}>{value}</div>
    </div>
  );
}
