/**
 * Rebalance Suggestion Component
 * Shows recommended portfolio rebalancing based on risk parity
 */
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { RebalanceItem } from '../services/positionAnalytics';

interface Props {
  suggestions: RebalanceItem[];
}

function ActionBadge({ action }: { action: 'buy' | 'sell' | 'hold' }) {
  const config = {
    buy: { label: '买入', class: 'text-accent-success bg-accent-success/10 border-accent-success/30' },
    sell: { label: '卖出', class: 'text-accent-danger bg-accent-danger/10 border-accent-danger/30' },
    hold: { label: '持有', class: 'text-text-muted bg-bg-tertiary border-border-color' },
  };
  const c = config[action];
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${c.class}`}>
      {c.label}
    </span>
  );
}

export default function RebalanceSuggestion({ suggestions }: Props) {
  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle size={32} className="text-text-muted mb-2" />
        <p className="text-text-secondary font-medium">暂无调仓建议</p>
        <p className="text-xs text-text-muted mt-1">持仓为空或数据不足</p>
      </div>
    );
  }

  const totalChange = suggestions.reduce((sum, s) => sum + Math.abs(s.change), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-2 p-3 bg-bg-tertiary rounded-lg border border-border-color">
        <CheckCircle2 size={16} className="text-accent-success" />
        <span className="text-sm text-text-secondary">
          基于风险平价模型，建议调整{' '}
          <span className="font-mono font-bold text-accent-primary">
            {suggestions.filter(s => s.action !== 'hold').length}
          </span>{' '}
          只标的，总调整幅度{' '}
          <span className="font-mono font-bold text-accent-warning">
            {totalChange.toFixed(1)}%
          </span>
        </span>
      </div>

      {/* Suggestion Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-color">
              <th className="text-left py-2 px-2 text-xs font-medium text-text-muted">标的</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-text-muted">当前权重</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-text-muted">建议权重</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-text-muted">调整</th>
              <th className="text-center py-2 px-2 text-xs font-medium text-text-muted">操作</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((item) => (
              <tr key={item.symbol} className="border-b border-border-color/50 hover:bg-bg-tertiary/30">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{item.symbol}</span>
                    <span className="text-xs text-text-muted">{item.name}</span>
                  </div>
                </td>
                <td className="text-right py-3 px-2 font-mono text-text-secondary">
                  {item.currentWeight.toFixed(1)}%
                </td>
                <td className="text-right py-3 px-2 font-mono font-medium text-text-primary">
                  {item.targetWeight.toFixed(1)}%
                </td>
                <td className="text-right py-3 px-2">
                  <div className="flex items-center justify-end gap-1">
                    {item.action === 'buy' && <TrendingUp size={12} className="text-accent-success" />}
                    {item.action === 'sell' && <TrendingDown size={12} className="text-accent-danger" />}
                    {item.action === 'hold' && <Minus size={12} className="text-text-muted" />}
                    <span className={`font-mono text-xs ${
                      item.change > 0 ? 'text-accent-success' : item.change < 0 ? 'text-accent-danger' : 'text-text-muted'
                    }`}>
                      {item.change > 0 ? '+' : ''}{item.change.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="text-center py-3 px-2">
                  <ActionBadge action={item.action} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-2 text-xs text-text-muted">
        <div className="flex items-center gap-1">
          <TrendingUp size={12} className="text-accent-success" />
          <span>加仓</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingDown size={12} className="text-accent-danger" />
          <span>减仓</span>
        </div>
        <div className="flex items-center gap-1">
          <Minus size={12} />
          <span>持有</span>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-accent-warning/5 border border-accent-warning/20 rounded-lg">
        <AlertTriangle size={14} className="text-accent-warning shrink-0 mt-0.5" />
        <p className="text-xs text-text-muted">
          风险提示：以上建议基于历史数据和量化模型计算，实际执行前请结合市场环境和个人风险承受能力综合判断。
        </p>
      </div>
    </div>
  );
}
