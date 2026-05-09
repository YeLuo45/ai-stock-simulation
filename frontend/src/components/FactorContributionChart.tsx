/**
 * FactorContributionChart - Factor contribution visualization
 * Stacked bar chart (daily contributions) + Pie chart (cumulative contribution)
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import type { ComposerBacktestResult } from '../services/factorComposer';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#ef4444',
  '#84cc16', '#f97316',
];

interface FactorContributionChartProps {
  result: ComposerBacktestResult;
  factorNames: Record<string, string>;
}

export default function FactorContributionChart({ result, factorNames }: FactorContributionChartProps) {
  const { daily_contributions, factor_contributions } = result;

  // Prepare stacked bar data (sample every N days to avoid overcrowding)
  const sampleRate = Math.max(1, Math.floor(daily_contributions.length / 60));
  const barData = daily_contributions
    .filter((_, i) => i % sampleRate === 0)
    .map(d => {
      const entry: Record<string, string | number> = { date: d.date };
      for (const [fid, contrib] of Object.entries(d.contributions)) {
        entry[fid] = contrib;
      }
      entry['total'] = d.total;
      return entry;
    });

  // Build stacked bar segments
  const factorIds = Object.keys(factor_contributions);
  const stackSegments = factorIds.map(fid => ({
    factorId: fid,
    name: factorNames[fid] || fid,
    data: barData.map(d => ({ date: d.date, value: d[fid] as number })),
  }));

  // Pie data - cumulative contributions
  const pieData = Object.entries(factor_contributions).map(([fid, pct], i) => ({
    name: factorNames[fid] || fid,
    value: Math.abs(pct),
    pct,
    color: COLORS[i % COLORS.length],
  }));

  const totalContrib = Object.values(factor_contributions).reduce((s, v) => s + Math.abs(v), 0);

  return (
    <div className="space-y-6">
      {/* Stacked Bar Chart - Daily Factor Contributions */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <h3 className="font-semibold mb-4">每日因子贡献度</h3>
        <p className="text-text-muted text-xs mb-4">每日各因子对组合收益的贡献（%）</p>
        {barData.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-8">暂无数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'currentColor' }}
                tickFormatter={v => String(v).slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'currentColor' }}
                tickFormatter={v => `${v.toFixed(1)}%`}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(3)}%`]}
                labelFormatter={l => String(l)}
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
              />
              {stackSegments.map((seg, i) => (
                <Bar
                  key={seg.factorId}
                  dataKey={seg.factorId}
                  name={seg.name}
                  stackId="contrib"
                  fill={COLORS[i % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-3">
          {stackSegments.map((seg, i) => (
            <div key={seg.factorId} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-text-secondary">{seg.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pie Chart - Cumulative Factor Contributions */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <h3 className="font-semibold mb-4">累计收益因子贡献占比</h3>
        <p className="text-text-muted text-xs mb-4">各因子对组合累计收益的贡献占比（%）</p>
        {pieData.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-8">暂无数据</div>
        ) : (
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, name: string) => {
                    const entry = pieData.find(p => p.name === name);
                    return [`${v.toFixed(1)}% (${entry?.pct.toFixed(1)}%)`, name];
                  }}
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend list */}
            <div className="flex-1 space-y-2">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-text-secondary truncate max-w-[120px]">{entry.name}</span>
                  </div>
                  <span className="font-mono text-text-primary ml-2">
                    {entry.pct >= 0 ? '+' : ''}{entry.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
              <div className="border-t border-border-color pt-2 mt-2 flex justify-between text-xs font-medium">
                <span className="text-text-muted">合计</span>
                <span className="font-mono">{totalContrib.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
