/**
 * Drawdown Comparison Chart
 * Compares drawdown curves before and after optimization using recharts
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  Legend,
} from 'recharts';
import type { DrawdownOptimizationResult } from '../types';

interface DrawdownComparisonChartProps {
  result: DrawdownOptimizationResult;
  dates?: string[];
  width?: number;
  height?: number;
}

export default function DrawdownComparisonChart({
  result,
  dates = [],
  width = 800,
  height = 400,
}: DrawdownComparisonChartProps) {
  const { beforeDrawdown, afterDrawdown, beforeRollingMaxDD, afterRollingMaxDD } = result;

  // Generate dates if not provided
  const chartDates = dates.length > 0
    ? dates
    : beforeDrawdown.map((_, i) => `Day ${i + 1}`);

  // Prepare chart data
  const chartData = chartDates.map((date, i) => ({
    date,
    before: beforeDrawdown[i] * 100, // Convert to percentage
    after: afterDrawdown[i] * 100,
  }));

  // Find max drawdown points
  const beforeMinIdx = beforeDrawdown.indexOf(Math.min(...beforeDrawdown));
  const afterMinIdx = afterDrawdown.indexOf(Math.min(...afterDrawdown));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-bg-secondary border border-border-color rounded-lg p-3 text-xs shadow-lg">
        <div className="font-medium mb-2">{label}</div>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-0.5"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-text-muted">{entry.name}:</span>
              <span className={`font-mono font-medium ${
                entry.value < 0 ? 'text-red-400' : 'text-accent-success'
              }`}>
                {entry.value.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (beforeDrawdown.length === 0 && afterDrawdown.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-muted text-sm"
        style={{ width, height }}
      >
        暂无回撤数据
      </div>
    );
  }

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-color)"
            opacity={0.3}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={{ stroke: 'var(--border-color)' }}
            axisLine={{ stroke: 'var(--border-color)' }}
            interval="preserveStartEnd"
            label={{
              value: '时间',
              position: 'insideBottom',
              offset: -10,
              style: { fontSize: 11, fill: 'var(--text-muted)' },
            }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={{ stroke: 'var(--border-color)' }}
            axisLine={{ stroke: 'var(--border-color)' }}
            tickFormatter={(v) => `${v}%`}
            domain={['auto', 0]}
            label={{
              value: '回撤 (%)',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 11, fill: 'var(--text-muted)' },
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Reference line at 0 */}
          <ReferenceLine
            y={0}
            stroke="var(--text-muted)"
            strokeOpacity={0.5}
            strokeDasharray="5 5"
          />

          {/* Reference lines for drawdown thresholds */}
          {beforeRollingMaxDD && (
            <ReferenceLine
              y={-beforeRollingMaxDD * 100}
              stroke="#ef4444"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{
                value: `优化前 MaxDD: ${(beforeRollingMaxDD * 100).toFixed(1)}%`,
                position: 'right',
                fontSize: 9,
                fill: '#ef4444',
              }}
            />
          )}
          {afterRollingMaxDD && (
            <ReferenceLine
              y={-afterRollingMaxDD * 100}
              stroke="#22c55e"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{
                value: `优化后 MaxDD: ${(afterRollingMaxDD * 100).toFixed(1)}%`,
                position: 'right',
                fontSize: 9,
                fill: '#22c55e',
              }}
            />
          )}

          {/* Before optimization drawdown line */}
          {beforeDrawdown.length > 0 && (
            <Line
              type="monotone"
              dataKey="before"
              name="优化前"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{
                r: 4,
                fill: '#ef4444',
                stroke: 'var(--bg-primary)',
                strokeWidth: 2,
              }}
            />
          )}

          {/* After optimization drawdown line */}
          {afterDrawdown.length > 0 && (
            <Line
              type="monotone"
              dataKey="after"
              name="优化后"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: '#22c55e',
                stroke: 'var(--bg-primary)',
                strokeWidth: 2,
              }}
            />
          )}

          {/* Mark max drawdown points */}
          {beforeDrawdown.length > 0 && beforeMinIdx >= 0 && (
            <ReferenceDot
              x={chartData[beforeMinIdx]?.date}
              y={beforeDrawdown[beforeMinIdx] * 100}
              r={6}
              fill="#ef4444"
              stroke="var(--bg-primary)"
              strokeWidth={2}
            />
          )}
          {afterDrawdown.length > 0 && afterMinIdx >= 0 && (
            <ReferenceDot
              x={chartData[afterMinIdx]?.date}
              y={afterDrawdown[afterMinIdx] * 100}
              r={6}
              fill="#22c55e"
              stroke="var(--bg-primary)"
              strokeWidth={2}
            />
          )}

          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => (
              <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
            )}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
