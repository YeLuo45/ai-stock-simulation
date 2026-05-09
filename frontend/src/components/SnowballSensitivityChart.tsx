/**
 * Snowball Sensitivity Chart
 * Heatmap showing returns across different parameter combinations
 */

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import type { SnowballSensitivityPoint } from '../types';

interface SnowballSensitivityChartProps {
  sensitivityData: SnowballSensitivityPoint[];
  param1Label?: string;
  param2Label?: string;
  height?: number;
}

export default function SnowballSensitivityChart({
  sensitivityData,
  param1Label = '敲出障碍',
  param2Label = '票息',
  height = 350,
}: SnowballSensitivityChartProps) {
  // Transform data for heatmap visualization
  const param1Values = [...new Set(sensitivityData.map(d => d.param1))].sort((a, b) => a - b);
  const param2Values = [...new Set(sensitivityData.map(d => d.param2))].sort((a, b) => a - b);

  const chartData = sensitivityData.map(d => ({
    ...d,
    param1Label: `${(d.param1 * 100).toFixed(0)}%`,
    param2Label: `${(d.param2 * 100).toFixed(0)}%`,
    returnPct: d.return * 100,
  }));

  // Find min/max for color scale
  const returns = sensitivityData.map(d => d.return);
  const minReturn = Math.min(...returns);
  const maxReturn = Math.max(...returns);
  const range = maxReturn - minReturn || 1;

  const getColor = (returnValue: number): string => {
    const normalized = (returnValue - minReturn) / range;
    if (normalized > 0.6) return '#22c55e'; // green
    if (normalized > 0.3) return '#84cc16'; // lime
    if (normalized > 0) return '#eab308'; // yellow
    if (normalized > -0.3) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  // Simple bar chart for sensitivity analysis
  if (param1Values.length > 1 && param2Values.length === 1) {
    // 1D sensitivity: param1 vs return
    return (
      <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
        <h3 className="text-sm font-semibold mb-3">敏感性分析: {param1Label} vs 收益</h3>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={param1Values.map(p1 => {
              const point = sensitivityData.find(d => d.param1 === p1);
              return {
                param: `${(p1 * 100).toFixed(0)}%`,
                return: point ? point.return : 0,
              };
            })}
            margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="param"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={{ stroke: '#4b5563' }}
            />
            <YAxis
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={{ stroke: '#4b5563' }}
            />
            <Tooltip
              formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, '收益']}
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: 12,
              }}
            />
            <Bar dataKey="return" radius={[4, 4, 0, 0]}>
              {param1Values.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getColor(sensitivityData[index]?.return || 0)}
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs">
          <span className="text-text-muted">收益:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
            <span>低</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
            <span>高</span>
          </div>
        </div>
      </div>
    );
  }

  // 2D sensitivity heatmap (simplified as bar chart)
  return (
    <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
      <h3 className="text-sm font-semibold mb-3">
        敏感性热力图: {param1Label} vs {param2Label}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="param1Label"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={{ stroke: '#4b5563' }}
          />
          <YAxis
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={{ stroke: '#4b5563' }}
          />
          <Tooltip
            formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, '收益']}
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              fontSize: 12,
            }}
          />
          <Bar dataKey="return" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getColor(entry.return)}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center justify-center gap-2 text-xs">
        <span className="text-text-muted">收益:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
          <span>低</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
          <span>高</span>
        </div>
      </div>
    </div>
  );
}
