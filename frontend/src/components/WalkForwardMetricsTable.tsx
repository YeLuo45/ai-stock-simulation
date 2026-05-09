/**
 * Walk-Forward IS vs OOS Comparison Table
 * Shows per-window metrics and overfitting indicator
 */

import type { WalkForwardResult } from '../types';
import { getOverfittingColor, getOverfittingLevel } from '../services/walkForwardEngine';

interface WalkForwardMetricsTableProps {
  result: WalkForwardResult;
}

export default function WalkForwardMetricsTable({ result }: WalkForwardMetricsTableProps) {
  const { windows, inSamplevsOOSRatio } = result;

  if (windows.length === 0) {
    return (
      <div className="text-center text-text-muted py-8">
        暂无滚动回测数据
      </div>
    );
  }

  const overfittingColor = getOverfittingColor(inSamplevsOOSRatio);
  const overfittingLevel = getOverfittingLevel(inSamplevsOOSRatio);

  const overfittingLabel = {
    severe: '严重过拟合',
    warning: '轻度过拟合',
    normal: '正常',
  }[overfittingLevel];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-color">
            <th className="text-left py-2 px-3 text-text-muted font-medium">窗口</th>
            <th className="text-left py-2 px-3 text-text-muted font-medium">训练期</th>
            <th className="text-left py-2 px-3 text-text-muted font-medium">测试期</th>
            <th className="text-right py-2 px-3 text-text-muted font-medium">IS收益率</th>
            <th className="text-right py-2 px-3 text-text-muted font-medium">OOS收益率</th>
            <th className="text-right py-2 px-3 text-text-muted font-medium">OOS Sharpe</th>
            <th className="text-right py-2 px-3 text-text-muted font-medium">最大回撤</th>
            <th className="text-center py-2 px-3 text-text-muted font-medium">过拟合程度</th>
          </tr>
        </thead>
        <tbody>
          {windows.map((window, idx) => {
            const isRatio = window.trainReturn !== 0 ? window.testReturn / window.trainReturn : 0;
            const rowColor = getOverfittingColor(isRatio);

            return (
              <tr
                key={idx}
                className="border-b border-border-color/50 hover:bg-bg-tertiary/50 transition-colors"
              >
                <td className="py-2 px-3 font-medium text-accent-primary">#{idx + 1}</td>
                <td className="py-2 px-3 text-text-muted text-xs">
                  {window.trainPeriod[0].slice(2)} ~ {window.trainPeriod[1].slice(2)}
                </td>
                <td className="py-2 px-3 text-text-muted text-xs">
                  {window.testPeriod[0].slice(2)} ~ {window.testPeriod[1].slice(2)}
                </td>
                <td className={`py-2 px-3 text-right font-mono ${
                  window.trainReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'
                }`}>
                  {window.trainReturn >= 0 ? '+' : ''}{window.trainReturn.toFixed(2)}%
                </td>
                <td className={`py-2 px-3 text-right font-mono ${
                  window.testReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'
                }`}>
                  {window.testReturn >= 0 ? '+' : ''}{window.testReturn.toFixed(2)}%
                </td>
                <td className="py-2 px-3 text-right font-mono text-accent-primary">
                  {window.metrics.sharpeRatio.toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-accent-danger">
                  -{window.metrics.maxDrawdown.toFixed(2)}%
                </td>
                <td className="py-2 px-3 text-center">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${rowColor}20`,
                      color: rowColor,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: rowColor }}
                    />
                    {isRatio < 0.5 ? '严重' : isRatio < 0.7 ? '轻度' : '正常'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary row */}
      <div className="mt-3 pt-3 border-t border-border-color">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-text-muted">IS/OOS收益比:</span>
            <span
              className="font-mono font-bold text-lg"
              style={{ color: overfittingColor }}
            >
              {inSamplevsOOSRatio.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
              style={{
                backgroundColor: `${overfittingColor}20`,
                color: overfittingColor,
              }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: overfittingColor }}
              />
              {overfittingLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
