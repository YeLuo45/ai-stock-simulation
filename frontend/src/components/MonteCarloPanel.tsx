/**
 * MonteCarloPanel - UI for Monte Carlo Simulation of Stock Price Paths
 */
import { useState } from 'react';
import { runMonteCarlo, type MCConfig, type MCResult } from '../agents/MonteCarloEngine';
import {
  Play,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Brain,
  RefreshCw,
  Database,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import clsx from 'clsx';

const NUM_SIMULATIONS_OPTIONS = [
  { value: 1000, label: '1,000 次' },
  { value: 5000, label: '5,000 次' },
  { value: 10000, label: '10,000 次' },
];

const HOLDING_PERIOD_OPTIONS = [
  { value: 7, label: '7 天' },
  { value: 14, label: '14 天' },
  { value: 30, label: '30 天' },
  { value: 60, label: '60 天' },
];

const CONFIDENCE_OPTIONS = [
  { value: 0.95, label: '95%' },
  { value: 0.99, label: '99%' },
];

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  className?: string;
  subtext?: string;
}

function StatCard({ label, value, icon, className = 'text-text-primary', subtext }: StatCardProps) {
  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
      <div className="flex items-center gap-2 mb-2 text-text-muted text-xs">
        {icon}
        {label}
      </div>
      <div className={clsx('font-mono text-xl font-bold', className)}>{value}</div>
      {subtext && <div className="text-text-muted text-xs mt-1">{subtext}</div>}
    </div>
  );
}

export default function MonteCarloPanel() {
  const [symbol, setSymbol] = useState('AAPL');
  const [entryPrice, setEntryPrice] = useState('');
  const [historicalVol, setHistoricalVol] = useState('');
  const [numSimulations, setNumSimulations] = useState(5000);
  const [holdingPeriodDays, setHoldingPeriodDays] = useState(30);
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MCResult | null>(null);

  const handleLoadFromMemory = () => {
    try {
      const data = localStorage.getItem('agent_outcome_queue');
      if (!data) return;
      const outcomes = JSON.parse(data);
      if (!Array.isArray(outcomes) || outcomes.length === 0) return;

      // Find the most recent entry for this symbol
      const symbolUpper = symbol.toUpperCase();
      const match = [...outcomes]
        .reverse()
        .find((o: any) => o.symbol?.toUpperCase() === symbolUpper || o.stock_code?.toUpperCase() === symbolUpper);

      if (match) {
        if (match.entry_price) setEntryPrice(String(match.entry_price));
        if (match.volatility) setHistoricalVol(String(match.volatility));
        else if (match.historical_vol) setHistoricalVol(String(match.historical_vol));
      }
    } catch {
      // ignore parse errors
    }
  };

  const handleRun = () => {
    const price = parseFloat(entryPrice);
    const vol = parseFloat(historicalVol) / 100; // Convert percentage to decimal

    if (isNaN(price) || price <= 0) {
      alert('请输入有效的入场价格');
      return;
    }
    if (isNaN(vol) || vol <= 0) {
      alert('请输入有效的年化波动率（%）');
      return;
    }

    setIsRunning(true);

    // Run in a mini-timeout to allow UI to update
    setTimeout(() => {
      try {
        const config: MCConfig = {
          symbol: symbol.toUpperCase(),
          numSimulations,
          holdingPeriodDays,
          confidenceLevel,
        };
        const mcResult = runMonteCarlo(config, price, vol);
        setResult(mcResult);
      } finally {
        setIsRunning(false);
      }
    }, 50);
  };

  // Prepare histogram data from simulation returns
  const prepareHistogramData = (returns: number[], bins: number = 50) => {
    if (returns.length === 0) return [];
    const min = Math.min(...returns);
    const max = Math.max(...returns);
    const binWidth = (max - min) / bins;
    const buckets: { range: string; count: number; pct: number; isVaR: boolean; isMean: boolean }[] = [];

    for (let i = 0; i < bins; i++) {
      const lo = min + i * binWidth;
      const hi = min + (i + 1) * binWidth;
      const count = returns.filter((r) => r >= lo && (i === bins - 1 ? r <= hi : r < hi)).length;
      buckets.push({
        range: `${(lo * 100).toFixed(1)}%`,
        count,
        pct: (count / returns.length) * 100,
        isVaR: false,
        isMean: false,
      });
    }

    return buckets;
  };

  const histogramData = result ? prepareHistogramData(result.simulationReturns) : [];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
          <BarChart3 size={22} className="text-accent-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Monte Carlo 模拟</h1>
          <p className="text-text-muted text-sm">基于几何布朗运动的价格路径模拟</p>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <h3 className="font-semibold mb-4">模拟参数</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-text-muted text-xs mb-1">股票代码</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs mb-1">入场价格 (¥)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="150.00"
                step="0.01"
                className="flex-1 w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
              />
              <button
                onClick={handleLoadFromMemory}
                title="从记忆加载"
                className="px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg hover:border-accent-primary/50 transition-colors"
              >
                <Database size={16} className="text-text-muted" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-text-muted text-xs mb-1">年化波动率 (%)</label>
            <input
              type="number"
              value={historicalVol}
              onChange={(e) => setHistoricalVol(e.target.value)}
              placeholder="25"
              step="0.1"
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs mb-1">模拟次数</label>
            <select
              value={numSimulations}
              onChange={(e) => setNumSimulations(Number(e.target.value))}
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            >
              {NUM_SIMULATIONS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-text-muted text-xs mb-1">持有期</label>
            <select
              value={holdingPeriodDays}
              onChange={(e) => setHoldingPeriodDays(Number(e.target.value))}
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            >
              {HOLDING_PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-text-muted text-xs mb-1">置信水平</label>
            <select
              value={confidenceLevel}
              onChange={(e) => setConfidenceLevel(Number(e.target.value))}
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            >
              {CONFIDENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={isRunning}
          className="mt-4 px-6 py-3 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isRunning ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : (
            <Play size={18} />
          )}
          运行模拟
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              label="均值收益"
              value={`${result.meanReturn >= 0 ? '+' : ''}${(result.meanReturn * 100).toFixed(2)}%`}
              icon={<TrendingUp size={14} />}
              className={result.meanReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'}
            />
            <StatCard
              label="中位数收益"
              value={`${result.medianReturn >= 0 ? '+' : ''}${(result.medianReturn * 100).toFixed(2)}%`}
              icon={<TrendingUp size={14} />}
              className={result.medianReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'}
            />
            <StatCard
              label="标准差"
              value={`${(result.stdDev * 100).toFixed(2)}%`}
              icon={<BarChart3 size={14} />}
              className="text-text-primary"
            />
            <StatCard
              label={`VaR (${(result.config.confidenceLevel * 100).toFixed(0)}%)`}
              value={`-${(result.var * 100).toFixed(2)}%`}
              icon={<AlertTriangle size={14} />}
              className="text-accent-danger"
              subtext="最大潜在损失"
            />
            <StatCard
              label={`CVaR (${(result.config.confidenceLevel * 100).toFixed(0)}%)`}
              value={`-${(result.cvar * 100).toFixed(2)}%`}
              icon={<AlertTriangle size={14} />}
              className="text-accent-danger"
              subtext="极端损失均值"
            />
            <StatCard
              label="亏损概率"
              value={`${(result.probLoss * 100).toFixed(1)}%`}
              icon={<Brain size={14} />}
              className={result.probLoss > 0.3 ? 'text-accent-danger' : result.probLoss > 0.1 ? 'text-yellow-500' : 'text-accent-success'}
            />
          </div>

          {/* Percentiles */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-4">收益分位数</h3>
            <div className="grid grid-cols-5 gap-4 text-center">
              {[
                { label: 'P5', value: result.percentiles.p5 },
                { label: 'P25', value: result.percentiles.p25 },
                { label: 'P50', value: result.percentiles.p50 },
                { label: 'P75', value: result.percentiles.p75 },
                { label: 'P95', value: result.percentiles.p95 },
              ].map(({ label, value }) => (
                <div key={label} className="bg-bg-tertiary rounded-lg p-3">
                  <div className="text-text-muted text-xs mb-1">{label}</div>
                  <div className={clsx(
                    'font-mono font-bold text-sm',
                    value >= 0 ? 'text-accent-success' : 'text-accent-danger'
                  )}>
                    {value >= 0 ? '+' : ''}{(value * 100).toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-text-muted text-xs flex justify-between px-2">
              <span>最小: {result.minReturn >= 0 ? '+' : ''}{(result.minReturn * 100).toFixed(2)}%</span>
              <span>最大: {result.maxReturn >= 0 ? '+' : ''}{(result.maxReturn * 100).toFixed(2)}%</span>
            </div>
          </div>

          {/* Histogram */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
            <h3 className="font-semibold mb-4">收益分布直方图</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    interval={Math.floor(histogramData.length / 6)}
                    label={{ value: '收益', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#6b7280' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                    label={{ value: '频数占比', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(v: any) => [`${v.toFixed(2)}%`, '频数占比']}
                    labelFormatter={(l) => `收益: ${l}`}
                  />
                  {/* Mean line */}
                  <ReferenceLine
                    x={`${(result.meanReturn * 100).toFixed(1)}%`}
                    stroke="#00d4ff"
                    strokeWidth={2}
                    label={{ value: '均值', position: 'top', fontSize: 10, fill: '#00d4ff' }}
                  />
                  {/* VaR line */}
                  <ReferenceLine
                    x={`${(-result.var * 100).toFixed(1)}%`}
                    stroke="#ff4444"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{ value: 'VaR', position: 'top', fontSize: 10, fill: '#ff4444' }}
                  />
                  <Bar dataKey="pct" name="频数占比" maxBarSize={20}>
                    {histogramData.map((entry, index) => {
                      const retVal = parseFloat(entry.range.replace('%', '')) / 100;
                      let fill = '#4f46e5';
                      if (retVal <= -result.var) fill = '#dc2626';
                      else if (retVal < 0) fill = '#f59e0b';
                      else if (retVal > result.meanReturn) fill = '#10b981';
                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-3 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-600"></span> 超过 VaR
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-500"></span> 负收益
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-emerald-500"></span> 超均值
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-indigo-600"></span> 其他
              </span>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-12 text-center">
          <BarChart3 size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
          <p className="text-text-muted text-lg mb-2">配置参数开始 Monte Carlo 模拟</p>
          <p className="text-text-muted text-sm">基于几何布朗运动模型模拟未来价格路径，评估风险</p>
        </div>
      )}
    </div>
  );
}
