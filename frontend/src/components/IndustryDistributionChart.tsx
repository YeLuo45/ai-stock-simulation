/**
 * Industry Distribution Chart
 * Pie chart showing portfolio allocation by industry
 */
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { Position } from '../types';
import { aggregateByIndustry } from '../services/positionAnalytics';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#64748b',
];

interface Props {
  positions: Position[];
  onSectorClick?: (industry: string) => void;
}

export default function IndustryDistributionChart({ positions, onSectorClick }: Props) {
  const data = aggregateByIndustry(positions);
  const totalValue = positions.reduce((sum, p) => sum + p.market_value, 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        暂无持仓数据
      </div>
    );
  }

  const chartData = data.map((item, idx) => ({
    name: item.industry,
    value: item.value,
    count: item.count,
    pct: totalValue > 0 ? (item.value / totalValue * 100).toFixed(1) : '0',
    fill: COLORS[idx % COLORS.length],
  }));

  const tooltipFormatter = (value: number, name: string) => {
    const item = chartData.find(d => d.value === value);
    return [`¥${value.toLocaleString()} (${item?.pct}%)`, name];
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            onClick={(_, idx) => onSectorClick?.(chartData[idx].name)}
            style={{ cursor: onSectorClick ? 'pointer' : 'default' }}
          >
            {chartData.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.fill} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            formatter={tooltipFormatter}
            contentStyle={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend
            formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value}</span>}
            wrapperStyle={{ fontSize: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
