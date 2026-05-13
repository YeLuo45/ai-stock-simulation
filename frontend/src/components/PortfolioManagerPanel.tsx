/**
 * PortfolioManagerPanel - Portfolio Management UI
 * Displays portfolio overview, positions, rebalancing directives, and risk controls
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getPaperTradeEngine,
  type PaperPosition,
} from '../agents/PaperTradeEngine';
import {
  PortfolioState,
  RebalanceDirective,
  RiskLimits,
  TargetPosition,
  rebalance,
  fromPaperPositions,
  getDefaultRiskLimits,
  calculatePortfolioStats,
  type PortfolioStats,
  type Position,
} from '../agents/PortfolioManagerAgent';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Target,
  ArrowUpDown,
} from 'lucide-react';
import clsx from 'clsx';

// localStorage key for risk limits persistence
const RISK_LIMITS_KEY = 'portfolio_risk_limits';

function formatMoney(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

// ============ Risk Limit Configurator ============
interface RiskLimitSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  warning?: boolean;
}

function RiskLimitSlider({ label, value, min, max, step, unit, onChange, warning }: RiskLimitSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-muted">{label}</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={e => onChange(Number(e.target.value))}
            className={clsx(
              'w-16 px-2 py-1 rounded text-sm font-mono text-right bg-bg-tertiary border',
              warning ? 'border-accent-danger/50 text-accent-danger' : 'border-border-color text-text-primary'
            )}
          />
          <span className="text-xs text-text-muted">{unit}</span>
        </div>
      </div>
      <div className="relative h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={clsx(
            'absolute left-0 top-0 h-full rounded-full transition-all',
            warning ? 'bg-accent-danger' : 'bg-accent-primary'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ============ Position Row ============
interface PositionRowProps {
  position: Position;
  targetWeight?: number;
  showTarget?: boolean;
}

function PositionRow({ position, targetWeight, showTarget }: PositionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const profitColor = position.profitLoss >= 0 ? 'text-red-500' : 'text-green-500';
  const weightBarPct = Math.min(position.weight, 100);

  return (
    <>
      <tr
        className="border-b border-border-color/50 hover:bg-bg-tertiary/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
            <div>
              <p className="font-medium text-sm text-text-primary">{position.code}</p>
              <p className="text-xs text-text-muted">{position.name}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
          {position.shares}
        </td>
        <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
          ¥{position.avgCost.toFixed(2)}
        </td>
        <td className="px-4 py-3 text-right text-sm font-mono text-text-primary font-medium">
          ¥{position.currentPrice.toFixed(2)}
        </td>
        <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
          ¥{formatMoney(position.marketValue)}
        </td>
        <td className={clsx('px-4 py-3 text-right text-sm font-mono font-medium', profitColor)}>
          {position.profitLoss >= 0 ? '+' : ''}¥{position.profitLoss.toFixed(2)}
          <br />
          <span className="text-xs opacity-75">{formatPct(position.profitLossPct)}</span>
        </td>
        <td className="px-4 py-4 w-32">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full',
                  position.weight > 30 ? 'bg-accent-danger' : position.weight > 20 ? 'bg-yellow-500' : 'bg-accent-primary'
                )}
                style={{ width: `${weightBarPct}%` }}
              />
            </div>
            <span className="text-xs font-mono text-text-muted w-12 text-right">
              {position.weight.toFixed(1)}%
            </span>
          </div>
        </td>
        {showTarget && targetWeight !== undefined && (
          <td className="px-4 py-3 w-32">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden relative">
                <div className="absolute left-0 top-0 h-full bg-accent-primary/40 rounded-full" style={{ width: `${Math.min(targetWeight, 100)}%` }} />
              </div>
              <span className="text-xs font-mono text-accent-primary w-12 text-right">
                {targetWeight.toFixed(1)}%
              </span>
            </div>
          </td>
        )}
      </tr>
      {expanded && (
        <tr className="border-b border-border-color/50 bg-bg-tertiary/20">
          <td colSpan={showTarget ? 8 : 7} className="px-8 py-3">
            <div className="grid grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-text-muted">持仓成本:</span>
                <span className="ml-2 font-mono text-text-secondary">¥{(position.shares * position.avgCost).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-text-muted">市值:</span>
                <span className="ml-2 font-mono text-text-secondary">¥{position.marketValue.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-text-muted">现价:</span>
                <span className="ml-2 font-mono text-text-secondary">¥{position.currentPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-text-muted">均价:</span>
                <span className="ml-2 font-mono text-text-secondary">¥{position.avgCost.toFixed(2)}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============ Directive Row ============
interface DirectiveRowProps {
  directive: RebalanceDirective;
  onExecute?: (d: RebalanceDirective) => void;
}

function DirectiveRow({ directive, onExecute }: DirectiveRowProps) {
  const urgencyColors = {
    HIGH: 'text-red-400 bg-red-500/10 border-red-500/30',
    MEDIUM: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    LOW: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  };
  const actionColors = {
    BUY: 'text-accent-success',
    SELL: 'text-accent-danger',
    CLEAR: 'text-orange-400',
  };

  return (
    <div className={clsx(
      'flex items-center justify-between p-3 rounded-lg border',
      urgencyColors[directive.urgency]
    )}>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className={clsx('font-mono font-bold text-sm', actionColors[directive.action])}>
            {directive.action}
          </span>
          <span className="font-medium text-sm text-text-primary">{directive.code}</span>
          <span className="text-sm text-text-muted">{directive.name}</span>
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
          <span>{directive.shares} 股</span>
          <span>¥{directive.price.toFixed(2)}</span>
          <span className="italic">{directive.reason}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={clsx(
          'px-2 py-0.5 rounded text-xs font-medium border',
          urgencyColors[directive.urgency]
        )}>
          {directive.urgency}
        </span>
        {onExecute && (
          <button
            onClick={() => onExecute(directive)}
            className="px-3 py-1 rounded text-xs font-medium bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20 transition-colors"
          >
            执行
          </button>
        )}
      </div>
    </div>
  );
}

// ============ Main Component ============
export default function PortfolioManagerPanel() {
  const [riskLimits, setRiskLimits] = useState<RiskLimits>(() => {
    try {
      const stored = localStorage.getItem(RISK_LIMITS_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return getDefaultRiskLimits();
  });
  const [showSettings, setShowSettings] = useState(false);
  const [directives, setDirectives] = useState<RebalanceDirective[]>([]);
  const [executedDirectives, setExecutedDirectives] = useState<RebalanceDirective[]>([]);
  const [targetPositions, setTargetPositions] = useState<TargetPosition[]>([]);
  const [portfolioState, setPortfolioState] = useState<PortfolioState | null>(null);
  const [stats, setStats] = useState<PortfolioStats | null>(null);

  const engine = getPaperTradeEngine();

  // Load portfolio state from PaperTradeEngine
  const refreshPortfolio = useCallback(() => {
    const snap = engine.getSnapshot('pm-panel');
    const totalValue = snap.balance + snap.positions.reduce((sum, p) => sum + p.marketValue, 0);
    const ps = fromPaperPositions(snap.positions as PaperPosition[], snap.balance, totalValue);
    setPortfolioState(ps);
    setStats(calculatePortfolioStats(ps));
  }, [engine]);

  useEffect(() => {
    refreshPortfolio();
    const interval = setInterval(refreshPortfolio, 3000);
    return () => clearInterval(interval);
  }, [refreshPortfolio]);

  // Persist risk limits
  useEffect(() => {
    localStorage.setItem(RISK_LIMITS_KEY, JSON.stringify(riskLimits));
  }, [riskLimits]);

  // Run rebalancing when target positions change
  useEffect(() => {
    if (!portfolioState || targetPositions.length === 0) return;
    const result = rebalance(targetPositions, portfolioState, riskLimits, 'PAPER');
    setDirectives(result.directives);
  }, [targetPositions, portfolioState, riskLimits]);

  // Simulate executing a directive
  const handleExecuteDirective = (directive: RebalanceDirective) => {
    engine.openOrder(directive.code, directive.name, directive.action === 'CLEAR' ? 'sell' : directive.action.toLowerCase() as 'buy' | 'sell', directive.shares, directive.price, 'pm-' + Date.now());
    setExecutedDirectives(prev => [...prev, { ...directive }]);
    setDirectives(prev => prev.filter(d => d !== directive));
    refreshPortfolio();
  };

  // Simulate adding a target position (demo)
  const handleAddTarget = (code: string, weight: number) => {
    setTargetPositions(prev => {
      const existing = prev.findIndex(t => t.code === code);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], weight };
        return updated;
      }
      return [...prev, { code, weight, confidence: 0.7 }];
    });
  };

  const riskViolations = useMemo(() => {
    if (!portfolioState) return [];
    const result = rebalance(targetPositions, portfolioState, riskLimits, 'PAPER');
    return result.riskResult.violations;
  }, [portfolioState, riskLimits, targetPositions]);

  const riskWarnings = useMemo(() => {
    if (!portfolioState) return [];
    const result = rebalance(targetPositions, portfolioState, riskLimits, 'PAPER');
    return result.riskResult.warnings;
  }, [portfolioState, riskLimits, targetPositions]);

  if (!portfolioState || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-accent-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* ========== Header ========== */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center">
            <BarChart3 className="text-accent-primary" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">组合管理</h2>
            <p className="text-xs text-text-muted">Kelly Criterion 仓位计算 · 风险限额管理</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshPortfolio}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-color text-text-muted hover:text-accent-primary hover:border-accent-primary/40 transition-colors text-sm"
          >
            <RefreshCw size={14} />
            刷新
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors',
              showSettings
                ? 'bg-accent-primary/10 border-accent-primary/40 text-accent-primary'
                : 'border-border-color text-text-muted hover:text-accent-primary hover:border-accent-primary/40'
            )}
          >
            <Settings2 size={14} />
            风控配置
          </button>
        </div>
      </div>

      {/* ========== Risk Limit Configurator ========== */}
      {showSettings && (
        <div className="bg-bg-tertiary/50 border border-border-color rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
            <Target size={14} className="text-accent-primary" />
            风控参数配置
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <RiskLimitSlider
              label="最大单股仓位"
              value={riskLimits.maxPositionWeight}
              min={5}
              max={50}
              step={5}
              unit="%"
              onChange={v => setRiskLimits(prev => ({ ...prev, maxPositionWeight: v }))}
              warning={stats.largestPosition && stats.largestPosition.weight > riskLimits.maxPositionWeight}
            />
            <RiskLimitSlider
              label="最大总仓位"
              value={riskLimits.maxTotalPosition}
              min={30}
              max={95}
              step={5}
              unit="%"
              onChange={v => setRiskLimits(prev => ({ ...prev, maxTotalPosition: v }))}
              warning={stats.totalExposure > riskLimits.maxTotalPosition}
            />
            <RiskLimitSlider
              label="止损线"
              value={Math.abs(riskLimits.stopLossPct)}
              min={3}
              max={20}
              step={1}
              unit="%"
              onChange={v => setRiskLimits(prev => ({ ...prev, stopLossPct: -v }))}
            />
            <RiskLimitSlider
              label="最大回撤"
              value={Math.abs(riskLimits.maxDrawdown)}
              min={5}
              max={30}
              step={1}
              unit="%"
              onChange={v => setRiskLimits(prev => ({ ...prev, maxDrawdown: -v }))}
            />
          </div>
        </div>
      )}

      {/* ========== Portfolio Overview ========== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className="text-accent-primary/60" />
            <span className="text-xs text-text-muted uppercase tracking-wider">总资产</span>
          </div>
          <p className="text-xl font-bold font-mono text-text-primary">¥{formatMoney(stats.totalValue)}</p>
        </div>
        <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className="text-accent-primary/60" />
            <span className="text-xs text-text-muted uppercase tracking-wider">可用现金</span>
          </div>
          <p className="text-xl font-bold font-mono text-accent-primary">¥{formatMoney(stats.cash)}</p>
          <p className="text-xs text-text-muted mt-1">{stats.cashRatio.toFixed(1)}%</p>
        </div>
        <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className="text-accent-primary/60" />
            <span className="text-xs text-text-muted uppercase tracking-wider">持仓市值</span>
          </div>
          <p className="text-xl font-bold font-mono text-text-primary">¥{formatMoney(stats.totalPositionValue)}</p>
          <p className="text-xs text-text-muted mt-1">{stats.totalExposure.toFixed(1)}%</p>
        </div>
        <div className={clsx(
          'bg-bg-secondary border rounded-xl p-4',
          stats.totalProfitLoss >= 0 ? 'border-red-500/30' : 'border-green-500/30'
        )}>
          <div className="flex items-center gap-2 mb-2">
            {stats.totalProfitLoss >= 0 ? <TrendingUp size={14} className="text-red-500/60" /> : <TrendingDown size={14} className="text-green-500/60" />}
            <span className="text-xs text-text-muted uppercase tracking-wider">总盈亏</span>
          </div>
          <p className={clsx('text-xl font-bold font-mono', stats.totalProfitLoss >= 0 ? 'text-red-500' : 'text-green-500')}>
            {stats.totalProfitLoss >= 0 ? '+' : ''}¥{formatMoney(stats.totalProfitLoss)}
          </p>
          <p className={clsx('text-xs mt-1', stats.totalProfitLoss >= 0 ? 'text-red-400' : 'text-green-400')}>
            {formatPct(stats.totalProfitLossPct)}
          </p>
        </div>
      </div>

      {/* ========== Risk Status Panel ========== */}
      {(riskViolations.length > 0 || riskWarnings.length > 0) && (
        <div className="space-y-2">
          {riskViolations.map((v, i) => (
            <div key={`v-${i}`} className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <XCircle size={16} className="shrink-0" />
              <span>{v}</span>
            </div>
          ))}
          {riskWarnings.map((w, i) => (
            <div key={`w-${i}`} className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {riskViolations.length === 0 && riskWarnings.length === 0 && stats.positionCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          <CheckCircle size={16} className="shrink-0" />
          <span>所有风险指标正常</span>
        </div>
      )}

      {/* ========== Positions Table ========== */}
      <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-color flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">持仓明细</h3>
          <span className="text-xs text-text-muted">{stats.positionCount} 只股票</span>
        </div>
        {stats.positionCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
              <BarChart3 size={20} className="text-text-muted" />
            </div>
            <p className="text-sm text-text-muted">暂无持仓</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-color bg-bg-tertiary/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">股票</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">持仓</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">成本价</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">现价</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">市值</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">盈亏</th>
                  <th className="text-left px-4 py-4 text-xs font-medium text-text-muted uppercase tracking-wider w-32">占比</th>
                  {targetPositions.length > 0 && (
                    <th className="text-left px-4 py-4 text-xs font-medium text-accent-primary uppercase tracking-wider w-32">目标</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {portfolioState.positions.map(pos => {
                  const target = targetPositions.find(t => t.code === pos.code);
                  return (
                    <PositionRow
                      key={pos.code}
                      position={pos}
                      targetWeight={target?.weight}
                      showTarget={targetPositions.length > 0}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========== Rebalance Directives ========== */}
      {directives.length > 0 && (
        <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-color flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <ArrowUpDown size={14} className="text-accent-primary" />
              调仓指令
            </h3>
            <span className="text-xs text-accent-primary">{directives.length} 条待执行</span>
          </div>
          <div className="p-4 space-y-2">
            {directives.map((d, i) => (
              <DirectiveRow key={`${d.code}-${i}`} directive={d} onExecute={handleExecuteDirective} />
            ))}
          </div>
        </div>
      )}

      {/* ========== Executed Directives ========== */}
      {executedDirectives.length > 0 && (
        <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-color flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-muted flex items-center gap-2">
              <CheckCircle size={14} />
              已执行指令
            </h3>
            <span className="text-xs text-text-muted">{executedDirectives.length} 条</span>
          </div>
          <div className="p-4 space-y-2">
            {executedDirectives.map((d, i) => (
              <div key={`ex-${i}`} className="flex items-center gap-2 p-3 rounded-lg bg-bg-tertiary/50 border border-border-color/50 text-text-muted text-sm opacity-60">
                <CheckCircle size={14} />
                <span className="font-mono">{d.action}</span>
                <span>{d.code}</span>
                <span>{d.shares} 股</span>
                <span className="italic">@ ¥{d.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== Target Position Simulator ========== */}
      <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
          <Target size={14} className="text-accent-primary" />
          目标仓位模拟（演示用）
        </h3>
        <div className="flex flex-wrap gap-2">
          {['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA'].map(code => {
            const existing = targetPositions.find(t => t.code === code);
            const weight = existing?.weight ?? 10;
            return (
              <div key={code} className="flex items-center gap-2 bg-bg-tertiary/50 rounded-lg px-3 py-2">
                <span className="text-sm font-mono text-text-primary">{code}</span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={weight}
                  onChange={e => handleAddTarget(code, Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-xs font-mono text-accent-primary w-10">{weight}%</span>
                {existing && (
                  <button
                    onClick={() => setTargetPositions(prev => prev.filter(t => t.code !== code))}
                    className="text-text-muted hover:text-accent-danger"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-text-muted mt-2">
          调整滑块模拟目标仓位，系统将自动计算调仓指令
        </p>
      </div>
    </div>
  );
}
