/**
 * Snowball Panel
 * Main panel for Snowball Autocallable backtesting
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  PieChart,
  Pie,
} from 'recharts';
import {
  Loader2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import clsx from 'clsx';

import { fetchKlineData } from '../services/yahooFinance';
import {
  monteCarloSnowball,
  computeScenarioAnalysis,
  computeSensitivitySurface,
} from '../services/snowballEngine';
import type {
  SnowballConfig,
  SnowballBacktestResult,
  SnowballScenarioResult,
  SnowballSensitivityPoint,
} from '../types';

import SnowballPayoffDiagram from './SnowballPayoffDiagram';
import SnowballSensitivityChart from './SnowballSensitivityChart';

// ============== Types ==============

interface SnowballPanelProps {
  symbol?: string;
  initialPrice?: number;
}

type ObservationFreq = 'monthly' | 'quarterly';
type TenureMonths = 3 | 6 | 12 | 18 | 24;
type SimCount = 100 | 500 | 1000;

// ============== Helper Components ==============

/** Simple gauge chart for probability display */
function ProbabilityGauge({
  value,
  label,
  color = '#3b82f6',
}: {
  value: number;
  label: string;
  color?: string;
}) {
  const pct = Math.min(100, Math.max(0, value * 100));
  const data = [{ value: pct }, { value: 100 - pct }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-12 overflow-hidden">
        <PieChart width={96} height={96}>
          <Pie
            data={data}
            cx={48}
            cy={48}
            startAngle={180}
            endAngle={0}
            innerRadius={30}
            outerRadius={40}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="rgba(255,255,255,0.1)" />
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <span className="text-xs text-text-muted mt-1">{label}</span>
    </div>
  );
}

// ============== Main Component ==============

export default function SnowballPanel({ symbol: propSymbol, initialPrice: propPrice }: SnowballPanelProps) {
  // Configuration state
  const [symbol, setSymbol] = useState(propSymbol || '000001');
  const [currentPrice, setCurrentPrice] = useState(propPrice || 100);
  const [couponRate, setCouponRate] = useState(20); // percentage
  const [knockOutBarrier, setKnockOutBarrier] = useState(105); // percentage
  const [knockInBarrier, setKnockInBarrier] = useState(75); // percentage
  const [tenure, setTenure] = useState<TenureMonths>(12);
  const [obsFreq, setObsFreq] = useState<ObservationFreq>('monthly');
  const [simCount, setSimCount] = useState<SimCount>(1000);
  const [direction, setDirection] = useState<'long' | 'short'>('long');

  // Results state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SnowballBacktestResult | null>(null);
  const [scenarioResults, setScenarioResults] = useState<SnowballScenarioResult[]>([]);
  const [sensitivityData, setSensitivityData] = useState<SnowballSensitivityPoint[]>([]);

  // Load price data
  const loadPrice = useCallback(async () => {
    if (!symbol) return;
    try {
      const kline = await fetchKlineData(symbol, 30, '1d');
      if (kline.length > 0) {
        setCurrentPrice(kline[kline.length - 1].close);
      }
    } catch {
      // Keep default price on error
    }
  }, [symbol]);

  useEffect(() => {
    if (propSymbol) setSymbol(propSymbol);
  }, [propSymbol]);

  useEffect(() => {
    if (propPrice) setCurrentPrice(propPrice);
  }, [propPrice]);

  useEffect(() => {
    loadPrice();
  }, [loadPrice]);

  // Generate observation dates
  const generateObservationDates = useCallback((months: number, freq: ObservationFreq): string[] => {
    const dates: string[] = [];
    const startDate = new Date(2024, 0, 1);

    for (let i = 0; i < months; i++) {
      const monthOffset = freq === 'monthly' ? 1 : 3;
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + (i + 1) * monthOffset);
      if (date.getMonth() < 12 && dates.length < months) {
        dates.push(date.toISOString().split('T')[0]);
      }
    }
    return dates.slice(0, months);
  }, []);

  // Run backtest
  const runBacktest = useCallback(() => {
    setLoading(true);

    const config: SnowballConfig = {
      underlying: symbol,
      initialPrice: currentPrice,
      couponRate: couponRate / 100,
      knockOutBarrier: knockOutBarrier / 100,
      knockInBarrier: knockInBarrier / 100,
      observationDates: generateObservationDates(tenure, obsFreq),
      tenure,
      direction,
    };

    try {
      // Monte Carlo simulation
      const mcResult = monteCarloSnowball(config, simCount);

      // Scenario analysis
      const scenarios = computeScenarioAnalysis(config, 200);
      setScenarioResults(scenarios);

      // Sensitivity analysis
      const koRange = [1.0, 1.05, 1.10, 1.15, 1.20, 1.25, 1.30];
      const couponRange = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30];
      const sensitivity = computeSensitivitySurface(config, koRange, couponRange, 50);
      setSensitivityData(sensitivity);

      // Convert MC result to backtest result
      const backtestResult: SnowballBacktestResult = {
        totalReturn: mcResult.totalReturn,
        annualizedReturn: mcResult.annualizedReturn,
        maxDrawdown: mcResult.maxDrawdown,
        sharpe: mcResult.sharpe,
        knockOutRate: mcResult.knockOutRate,
        knockInRate: mcResult.knockInRate,
        avgHoldingPeriod: mcResult.avgHoldingPeriod,
        pnlByScenario: mcResult.pnlByScenario,
        monthlyPnl: mcResult.monthlyPnl,
      };

      setResult(backtestResult);
    } catch (err) {
      console.error('Backtest error:', err);
    }

    setLoading(false);
  }, [symbol, currentPrice, couponRate, knockOutBarrier, knockInBarrier, tenure, obsFreq, simCount, direction, generateObservationDates]);

  // Auto-run on config change if result exists
  useEffect(() => {
    if (result) {
      runBacktest();
    }
  }, [couponRate, knockOutBarrier, knockInBarrier, tenure, simCount]);

  // Build config for payoff diagram
  const payoffConfig: SnowballConfig = {
    underlying: symbol,
    initialPrice: currentPrice,
    couponRate: couponRate / 100,
    knockOutBarrier: knockOutBarrier / 100,
    knockInBarrier: knockInBarrier / 100,
    observationDates: generateObservationDates(tenure, obsFreq),
    tenure,
    direction,
  };

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
        <div className="flex items-center gap-2 mb-4">
          <Info size={16} className="text-accent-primary" />
          <h3 className="text-sm font-semibold">雪球参数配置</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Symbol */}
          <div>
            <label className="text-xs text-text-muted block mb-1">挂钩标的</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
              placeholder="股票代码"
            />
          </div>

          {/* Current Price (auto-filled) */}
          <div>
            <label className="text-xs text-text-muted block mb-1">当前价格</label>
            <input
              type="number"
              value={currentPrice.toFixed(2)}
              onChange={(e) => setCurrentPrice(parseFloat(e.target.value) || 100)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
            />
          </div>

          {/* Coupon Rate Slider */}
          <div>
            <label className="text-xs text-text-muted block mb-1">
              年化票息: {couponRate}%
            </label>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={couponRate}
              onChange={(e) => setCouponRate(parseInt(e.target.value))}
              className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-primary"
            />
          </div>

          {/* Knock-Out Barrier Slider */}
          <div>
            <label className="text-xs text-text-muted block mb-1">
              敲出障碍: {knockOutBarrier}%
            </label>
            <input
              type="range"
              min={100}
              max={130}
              step={1}
              value={knockOutBarrier}
              onChange={(e) => setKnockOutBarrier(parseInt(e.target.value))}
              className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-green-500"
            />
          </div>

          {/* Knock-In Barrier Slider */}
          <div>
            <label className="text-xs text-text-muted block mb-1">
              敲入障碍: {knockInBarrier}%
            </label>
            <input
              type="range"
              min={50}
              max={90}
              step={1}
              value={knockInBarrier}
              onChange={(e) => setKnockInBarrier(parseInt(e.target.value))}
              className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-red-500"
            />
          </div>

          {/* Tenure */}
          <div>
            <label className="text-xs text-text-muted block mb-1">期限</label>
            <select
              value={tenure}
              onChange={(e) => setTenure(parseInt(e.target.value) as TenureMonths)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
            >
              <option value={3}>3个月</option>
              <option value={6}>6个月</option>
              <option value={12}>12个月</option>
              <option value={18}>18个月</option>
              <option value={24}>24个月</option>
            </select>
          </div>

          {/* Observation Frequency */}
          <div>
            <label className="text-xs text-text-muted block mb-1">观察频率</label>
            <select
              value={obsFreq}
              onChange={(e) => setObsFreq(e.target.value as ObservationFreq)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
            >
              <option value="monthly">月度观察</option>
              <option value="quarterly">季度观察</option>
            </select>
          </div>

          {/* Simulation Count */}
          <div>
            <label className="text-xs text-text-muted block mb-1">模拟次数</label>
            <select
              value={simCount}
              onChange={(e) => setSimCount(parseInt(e.target.value) as SimCount)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
            >
              <option value={100}>100次</option>
              <option value={500}>500次</option>
              <option value={1000}>1000次</option>
            </select>
          </div>

          {/* Direction */}
          <div>
            <label className="text-xs text-text-muted block mb-1">交易方向</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'long' | 'short')}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
            >
              <option value="long">做多雪球</option>
              <option value="short">做空雪球</option>
            </select>
          </div>
        </div>

        {/* Run Button */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={runBacktest}
            disabled={loading}
            className={clsx(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
              loading
                ? "bg-accent-primary/50 cursor-not-allowed"
                : "bg-accent-primary hover:bg-accent-primary/80 text-white"
            )}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? '计算中...' : '运行回测'}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-bg-secondary rounded-xl p-4 border border-border-color text-center">
              <div className="text-xs text-text-muted mb-1">总收益率</div>
              <div className={clsx(
                "text-xl font-bold",
                result.totalReturn >= 0 ? "text-accent-success" : "text-accent-danger"
              )}>
                {(result.totalReturn * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-bg-secondary rounded-xl p-4 border border-border-color text-center">
              <div className="text-xs text-text-muted mb-1">年化收益率</div>
              <div className={clsx(
                "text-xl font-bold",
                result.annualizedReturn >= 0 ? "text-accent-success" : "text-accent-danger"
              )}>
                {(result.annualizedReturn * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-bg-secondary rounded-xl p-4 border border-border-color text-center">
              <div className="text-xs text-text-muted mb-1">最大回撤</div>
              <div className="text-xl font-bold text-accent-warning">
                {(result.maxDrawdown * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-bg-secondary rounded-xl p-4 border border-border-color text-center">
              <div className="text-xs text-text-muted mb-1">夏普比率</div>
              <div className={clsx(
                "text-xl font-bold",
                result.sharpe >= 1 ? "text-accent-success" : "text-text-secondary"
              )}>
                {result.sharpe.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Probability Dashboard */}
          <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
            <h3 className="text-sm font-semibold mb-4">概率仪表盘</h3>
            <div className="flex justify-around">
              <ProbabilityGauge
                value={result.knockOutRate}
                label="敲出概率"
                color="#22c55e"
              />
              <ProbabilityGauge
                value={result.knockInRate}
                label="敲入概率"
                color="#ef4444"
              />
              <ProbabilityGauge
                value={1 - result.knockOutRate - result.knockInRate}
                label="持有到期概率"
                color="#6b7280"
              />
            </div>
          </div>

          {/* Scenario Comparison Table */}
          {scenarioResults.length > 0 && (
            <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
              <h3 className="text-sm font-semibold mb-3">情景分析对比</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-color">
                      <th className="text-left py-2 text-text-muted">情景</th>
                      <th className="text-right py-2 text-text-muted">收益率</th>
                      <th className="text-right py-2 text-text-muted">敲出概率</th>
                      <th className="text-right py-2 text-text-muted">敲入概率</th>
                      <th className="text-right py-2 text-text-muted">平均持有期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioResults.map((sc) => (
                      <tr key={sc.scenario} className="border-b border-border-color/50">
                        <td className="py-2">
                          <span className={clsx(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            sc.scenario === 'bull' && "bg-green-500/20 text-green-400",
                            sc.scenario === 'sideways' && "bg-yellow-500/20 text-yellow-400",
                            sc.scenario === 'bear' && "bg-red-500/20 text-red-400"
                          )}>
                          {sc.scenario === 'bull' ? '牛市' : sc.scenario === 'sideways' ? '震荡' : '熊市'}
                          </span>
                        </td>
                        <td className={clsx(
                          "text-right py-2 font-medium",
                          sc.totalReturn >= 0 ? "text-accent-success" : "text-accent-danger"
                        )}>
                          {(sc.totalReturn * 100).toFixed(1)}%
                        </td>
                        <td className="text-right py-2 text-text-secondary">
                          {(sc.knockOutRate * 100).toFixed(1)}%
                        </td>
                        <td className="text-right py-2 text-text-secondary">
                          {(sc.knockInRate * 100).toFixed(1)}%
                        </td>
                        <td className="text-right py-2 text-text-secondary">
                          {sc.avgHoldingPeriod.toFixed(1)}月
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Return Distribution Histogram */}
          <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
            <h3 className="text-sm font-semibold mb-3">收益分布直方图</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={[
                  { range: '<-20%', count: 5 },
                  { range: '-20%~-10%', count: 15 },
                  { range: '-10%~0%', count: 80 },
                  { range: '0%~10%', count: 200 },
                  { range: '10%~20%', count: 300 },
                  { range: '20%~30%', count: 250 },
                  { range: '>30%', count: 150 },
                ]}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="range"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickLine={{ stroke: '#4b5563' }}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickLine={{ stroke: '#4b5563' }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}次`, '模拟次数']}
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {[
                    '#ef4444',
                    '#f97316',
                    '#eab308',
                    '#22c55e',
                    '#22c55e',
                    '#22c55e',
                    '#22c55e',
                  ].map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Payoff Diagram */}
          <SnowballPayoffDiagram config={payoffConfig} />

          {/* Sensitivity Chart */}
          {sensitivityData.length > 0 && (
            <SnowballSensitivityChart
              sensitivityData={sensitivityData}
              param1Label="敲出障碍"
              param2Label="票息"
            />
          )}

          {/* Risk Warning */}
          <div className="bg-accent-warning/10 border border-accent-warning/30 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-accent-warning mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-accent-warning">风险提示</h4>
                <p className="text-xs text-text-muted mt-1">
                  雪球结构存在本金损失风险。当标的价格持续下跌并敲入后，若到期未能恢复到期初价格，将承担相应损失。
                  以上回测结果基于蒙特卡洛模拟，实际收益可能与模拟结果存在差异。本信息不构成投资建议。
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
