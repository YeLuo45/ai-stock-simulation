/**
 * Position Risk Card
 * Displays single stock risk metrics with color coding
 */
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3 } from 'lucide-react';
import type { PositionRisk } from '../services/positionAnalytics';

interface Props {
  risk: PositionRisk;
  compact?: boolean;
}

function getRiskLevel(value: number, thresholds: { green: number; yellow: number }, inverted?: boolean): 'green' | 'yellow' | 'red' {
  if (inverted) {
    // For negative metrics like maxDrawdown
    if (value < thresholds.yellow) return 'green';
    if (value < thresholds.green) return 'yellow';
    return 'red';
  }
  if (value <= thresholds.green) return 'green';
  if (value <= thresholds.yellow) return 'yellow';
  return 'red';
}

function RiskBadge({ label, value, unit, level, icon }: {
  label: string;
  value: number;
  unit: string;
  level: 'green' | 'yellow' | 'red';
  icon: React.ReactNode;
}) {
  const colors = {
    green: 'text-accent-success bg-accent-success/10 border-accent-success/30',
    yellow: 'text-accent-warning bg-accent-warning/10 border-accent-warning/30',
    red: 'text-accent-danger bg-accent-danger/10 border-accent-danger/30',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colors[level]}`}>
      <span className="opacity-60">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs opacity-70">{label}</p>
        <p className="font-mono font-bold text-sm">
          {value.toFixed(2)}{unit}
        </p>
      </div>
    </div>
  );
}

export default function PositionRiskCard({ risk, compact = false }: Props) {
  const betaLevel = getRiskLevel(risk.beta, { green: 1.0, yellow: 1.5 });
  const volLevel = getRiskLevel(risk.volatility, { green: 0.2, yellow: 0.35 });
  const varLevel = getRiskLevel(risk.var95, { green: 0.15, yellow: 0.25 });
  const ddLevel = getRiskLevel(risk.maxDrawdown, { green: 0.1, yellow: 0.2 }, true); // inverted

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text-primary">{risk.symbol}</span>
        <span className="text-xs text-text-muted">{risk.name}</span>
        <div className="flex gap-1 ml-auto">
          <span className={`text-xs px-1.5 py-0.5 rounded border ${
            betaLevel === 'green' ? 'bg-accent-success/10 text-accent-success border-accent-success/30' :
            betaLevel === 'yellow' ? 'bg-accent-warning/10 text-accent-warning border-accent-warning/30' :
            'bg-accent-danger/10 text-accent-danger border-accent-danger/30'
          }`}>
            β {risk.beta.toFixed(2)}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${
            volLevel === 'green' ? 'bg-accent-success/10 text-accent-success border-accent-success/30' :
            volLevel === 'yellow' ? 'bg-accent-warning/10 text-accent-warning border-accent-warning/30' :
            'bg-accent-danger/10 text-accent-danger border-accent-danger/30'
          }`}>
            σ {risk.volatility.toFixed(1)}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-tertiary rounded-xl p-4 border border-border-color">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-medium text-text-primary text-sm">{risk.symbol}</p>
          <p className="text-xs text-text-muted">{risk.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">权重</p>
          <p className="font-mono font-bold text-accent-primary">
            {(risk.weight * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Risk Metrics Grid */}
      <div className="grid grid-cols-2 gap-2">
        <RiskBadge
          label="BETA"
          value={risk.beta}
          unit=""
          level={betaLevel}
          icon={<BarChart3 size={12} />}
        />
        <RiskBadge
          label="波动率"
          value={risk.volatility * 100}
          unit="%"
          level={volLevel}
          icon={<TrendingUp size={12} />}
        />
        <RiskBadge
          label="VaR (95%)"
          value={risk.var95 * 100}
          unit="%"
          level={varLevel}
          icon={<AlertTriangle size={12} />}
        />
        <RiskBadge
          label="最大回撤"
          value={risk.maxDrawdown * 100}
          unit="%"
          level={ddLevel}
          icon={<TrendingDown size={12} />}
        />
      </div>

      {/* Risk interpretation */}
      <div className="mt-3 pt-3 border-t border-border-color/50">
        <p className="text-xs text-text-muted">
          {risk.beta > 1.2
            ? '高β标的，波动大于市场'
            : risk.beta < 0.8
            ? '低β标的，波动小于市场'
            : '接近市场波动水平'}
          {risk.volatility > 0.3 ? ' · 高波动风险' : ''}
          {risk.maxDrawdown > 0.15 ? ' · 回撤较大' : ''}
        </p>
      </div>
    </div>
  );
}
