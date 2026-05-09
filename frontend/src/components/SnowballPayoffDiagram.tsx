/**
 * Snowball Payoff Diagram
 * Shows payoff structure under different price scenarios
 */

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { SnowballConfig } from '../types';
import { computePayoffDiagram } from '../services/snowballEngine';

interface SnowballPayoffDiagramProps {
  config: SnowballConfig;
  height?: number;
}

export default function SnowballPayoffDiagram({
  config,
  height = 350,
}: SnowballPayoffDiagramProps) {
  const priceRatios = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0, 1.03, 1.05, 1.08, 1.10, 1.15, 1.20];
  const payoffData = computePayoffDiagram(config, priceRatios);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-bg-secondary border border-border-color rounded-lg p-3 shadow-lg">
          <p className="text-xs text-text-muted mb-1">
            标的价格比例: {(data.priceRatio * 100).toFixed(0)}%
          </p>
          <p className={`text-sm font-semibold ${data.payoff >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
            收益率: {(data.payoff * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-text-muted mt-1">
            事件: {data.event}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
      <h3 className="text-sm font-semibold mb-3">雪球收益结构图</h3>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={payoffData}
          margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="priceRatio"
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={{ stroke: '#4b5563' }}
          />
          <YAxis
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={{ stroke: '#4b5563' }}
            domain={[-1, 0.5]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
            formatter={(value: string) => value === 'payoff' ? '收益' : value}
          />
          {/* Knock-out barrier reference line */}
          <ReferenceLine
            x={config.knockOutBarrier}
            stroke="#22c55e"
            strokeDasharray="5 3"
            label={{ value: `敲出 ${(config.knockOutBarrier * 100).toFixed(0)}%`, fill: '#22c55e', fontSize: 10 }}
          />
          {/* Knock-in barrier reference line */}
          <ReferenceLine
            x={config.knockInBarrier}
            stroke="#ef4444"
            strokeDasharray="5 3"
            label={{ value: `敲入 ${(config.knockInBarrier * 100).toFixed(0)}%`, fill: '#ef4444', fontSize: 10 }}
          />
          {/* Initial price reference line */}
          <ReferenceLine
            x={1.0}
            stroke="#6b7280"
            strokeDasharray="3 3"
            label={{ value: '期初价', fill: '#6b7280', fontSize: 10 }}
          />
          <Bar
            dataKey="payoff"
            fill="#3b82f6"
            opacity={0.7}
            radius={[2, 2, 0, 0]}
          />
          <Line
            type="stepAfter"
            dataKey="payoff"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
          <span className="text-text-muted">敲出障碍</span>
          <span className="text-text-secondary">{(config.knockOutBarrier * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
          <span className="text-text-muted">敲入障碍</span>
          <span className="text-text-secondary">{(config.knockInBarrier * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-500 rounded-sm"></div>
          <span className="text-text-muted">年化票息</span>
          <span className="text-text-secondary">{(config.couponRate * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}
