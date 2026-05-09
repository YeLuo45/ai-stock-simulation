/**
 * Walk-Forward Rolling Backtest Chart
 * Displays equity curves for each test window with different colors
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { WalkForwardResult } from '../types';

interface WalkForwardChartProps {
  result: WalkForwardResult;
  initialCash?: number;
}

const WINDOW_COLORS = [
  '#00d4ff', // cyan
  '#f97316', // orange
  '#a855f7', // purple
  '#22c55e', // green
  '#ec4899', // pink
  '#eab308', // yellow
  '#6366f1', // indigo
  '#14b8a6', // teal
];

export default function WalkForwardChart({ result, initialCash = 1000000 }: WalkForwardChartProps) {
  const { windows } = result;

  // Build combined OOS chart data: stitch all test windows together
  // Track global index for x-axis
  const combinedData: Array<{
    globalIndex: number;
    windowIndex: number;
    return: number;
    value: number;
  }> = [];

  let globalIndex = 0;
  windows.forEach((window, wIdx) => {
    window.testEquityCurve.forEach((value) => {
      combinedData.push({
        globalIndex,
        windowIndex: wIdx,
        value,
        return: ((value - initialCash) / initialCash) * 100,
      });
      globalIndex++;
    });
  });

  if (combinedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        暂无滚动回测数据
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-bg-tertiary border border-border-color rounded-lg p-3 text-sm">
          <div className="text-text-muted mb-1">窗口 #{data.windowIndex + 1}</div>
          <div className="text-text-primary font-mono">
            收益: <span className={data.return >= 0 ? 'text-accent-success' : 'text-accent-danger'}>
              {data.return >= 0 ? '+' : ''}{data.return.toFixed(2)}%
            </span>
          </div>
          <div className="text-text-primary font-mono">
            资金: ¥{data.value.toLocaleString()}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={combinedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="globalIndex"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickFormatter={(v) => {
              const window = windows.find((w, idx) => {
                let start = 0;
                for (let i = 0; i < idx; i++) start += windows[i].testEquityCurve.length;
                return v >= start && v < start + w.testEquityCurve.length;
              });
              return window ? window.testPeriod[0].slice(2) : '';
            }}
            interval={Math.floor(combinedData.length / 8)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />

          {/* Stacked Areas for each window with different colors */}
          {windows.map((window, idx) => {
            const color = WINDOW_COLORS[idx % WINDOW_COLORS.length];
            const startIdx = windows.slice(0, idx).reduce((s, w) => s + w.testEquityCurve.length, 0);
            const segment = combinedData.slice(startIdx, startIdx + window.testEquityCurve.length);

            return (
              <Area
                key={idx}
                type="monotone"
                data={segment}
                dataKey="return"
                stroke={color}
                fill={color}
                fillOpacity={0.15}
                dot={false}
                activeDot={{ r: 4, fill: color }}
                name={`窗口${idx + 1}: ${window.testReturn >= 0 ? '+' : ''}${window.testReturn.toFixed(1)}%`}
                connectNulls
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {windows.map((window, idx) => {
          const color = WINDOW_COLORS[idx % WINDOW_COLORS.length];
          return (
            <div key={idx} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-text-muted">
                #{idx + 1} {window.testPeriod[0].slice(2)}~{window.testPeriod[1].slice(2)}
              </span>
              <span className="font-mono font-medium" style={{ color }}>
                {window.testReturn >= 0 ? '+' : ''}{window.testReturn.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
