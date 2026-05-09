/**
 * Position Analytics Panel
 * Main panel with 4 sub-tabs: Structure / PnL Attribution / Risk Metrics / Rebalance
 */
import { useState, useEffect } from 'react';
import { useStore } from '../store';
import {
  computePositionRisk,
  computePortfolioRisk,
  computePnLContribution,
  computeRiskParityWeights,
  aggregateByIndustry,
  aggregateByMarketCap,
  calculateHHI,
  calculateTop5Concentration,
  getIndustry,
  type PositionRisk,
  type PortfolioRisk,
  type ContributionItem,
  type RebalanceItem,
} from '../services/positionAnalytics';
import IndustryDistributionChart from './IndustryDistributionChart';
import PositionRiskCard from './PositionRiskCard';
import RebalanceSuggestion from './RebalanceSuggestion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';
import { PieChart as PieChartIcon, BarChart3, ShieldAlert, ArrowUpDown, Loader2, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

type TabKey = 'structure' | 'pnl' | 'risk' | 'rebalance';

const TABS = [
  { key: 'structure' as TabKey, label: '结构分析', icon: <PieChartIcon size={14} /> },
  { key: 'pnl' as TabKey, label: 'PnL归因', icon: <BarChart3 size={14} /> },
  { key: 'risk' as TabKey, label: '风险指标', icon: <ShieldAlert size={14} /> },
  { key: 'rebalance' as TabKey, label: '调仓建议', icon: <ArrowUpDown size={14} /> },
];

// Market cap tier labels
const TIER_LABELS: Record<string, string> = {
  small: '<100亿',
  mid: '100-500亿',
  large: '500-1000亿',
  mega: '>1000亿',
};

const TIER_COLORS: Record<string, string> = {
  small: '#64748b',
  mid: '#6366f1',
  large: '#8b5cf6',
  mega: '#ec4899',
};

export default function PositionAnalyticsPanel() {
  const { portfolio } = useStore();
  const [tab, setTab] = useState<TabKey>('structure');
  const [loading, setLoading] = useState(false);
  const [positionRisks, setPositionRisks] = useState<PositionRisk[]>([]);
  const [portfolioRisk, setPortfolioRisk] = useState<PortfolioRisk | null>(null);
  const [contributions, setContributions] = useState<ContributionItem[]>([]);
  const [rebalanceItems, setRebalanceItems] = useState<RebalanceItem[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  // Load risk metrics when positions change
  useEffect(() => {
    if (!portfolio || portfolio.positions.length === 0) {
      setPositionRisks([]);
      setPortfolioRisk(null);
      setContributions([]);
      setRebalanceItems([]);
      return;
    }

    const loadRiskData = async () => {
      setLoading(true);
      try {
        const totalValue = portfolio.total_market_value;
        const positions = portfolio.positions;

        // Compute position risks in parallel
        const risks = await Promise.all(
          positions.map(pos => computePositionRisk(pos, totalValue))
        );
        setPositionRisks(risks);

        // Portfolio risk
        const pRisk = computePortfolioRisk(risks);
        setPortfolioRisk(pRisk);

        // PnL contributions
        const totalReturn = portfolio.total_profit_loss_pct / 100;
        const contrib = computePnLContribution(positions, totalReturn, totalValue);
        setContributions(contrib);

        // Rebalance suggestions
        const rebal = computeRiskParityWeights(risks);
        setRebalanceItems(rebal);
      } catch (e) {
        console.error('Failed to compute risk metrics:', e);
      } finally {
        setLoading(false);
      }
    };

    loadRiskData();
  }, [portfolio]);

  const positions = portfolio?.positions ?? [];
  const totalValue = portfolio?.total_market_value ?? 0;

  // Concentration metrics
  const hhi = calculateHHI(positions, totalValue);
  const top5 = calculateTop5Concentration(positions, totalValue);
  const industryData = aggregateByIndustry(positions);
  const marketCapData = aggregateByMarketCap(positions);

  // Industry drill-down
  const industryStocks = selectedIndustry
    ? positions.filter(p => getIndustry(p.symbol) === selectedIndustry)
    : null;

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <PieChartIcon size={48} className="text-text-muted mb-4" />
        <p className="text-text-secondary font-medium mb-1">暂无持仓数据</p>
        <p className="text-xs text-text-muted">先买入股票后再进行持仓分析</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab Bar */}
      <div className="flex border-b border-border-color">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all',
              tab === t.key
                ? 'border-accent-primary text-accent-primary bg-accent-primary/5'
                : 'border-transparent text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/30'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-accent-primary mr-2" />
          <span className="text-text-muted text-sm">正在计算风险指标...</span>
        </div>
      )}

      {/* Tab Content */}
      {!loading && (
        <div className="pt-2">
          {/* ===== Structure Tab ===== */}
          {tab === 'structure' && (
            <div className="space-y-6">
              {/* Concentration Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">前5大持仓集中度</p>
                  <p className="text-2xl font-bold text-accent-primary">{(top5 * 100).toFixed(1)}%</p>
                  <p className="text-xs text-text-muted mt-1">HHI: {(hhi * 100).toFixed(1)}</p>
                </div>
                <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">持仓数量</p>
                  <p className="text-2xl font-bold text-accent-primary">{positions.length}</p>
                  <p className="text-xs text-text-muted mt-1">{industryData.length} 个行业</p>
                </div>
              </div>

              {/* Industry Distribution */}
              <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3">行业分布</h3>
                <IndustryDistributionChart
                  positions={positions}
                  onSectorClick={setSelectedIndustry}
                />
                {selectedIndustry && (
                  <div className="mt-3 p-3 bg-bg-tertiary rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-accent-primary">{selectedIndustry}</p>
                      <button
                        onClick={() => setSelectedIndustry(null)}
                        className="text-xs text-text-muted hover:text-text-secondary"
                      >
                        返回全部
                      </button>
                    </div>
                    <div className="space-y-1">
                      {industryStocks?.map(p => (
                        <div key={p.symbol} className="flex justify-between text-xs">
                          <span className="text-text-secondary">{p.symbol} {p.name}</span>
                          <span className="font-mono">¥{p.market_value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Market Cap Distribution */}
              <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3">市值分布</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={marketCapData.map(d => ({
                        name: TIER_LABELS[d.tier] || d.tier,
                        value: d.value,
                        count: d.count,
                        fill: TIER_COLORS[d.tier] || '#6366f1',
                      }))}
                      layout="vertical"
                    >
                      <XAxis type="number" tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [`¥${value.toLocaleString()}`, '市值']}
                        contentStyle={{
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {marketCapData.map((entry, idx) => (
                          <Cell key={idx} fill={TIER_COLORS[entry.tier] || '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ===== PnL Tab ===== */}
          {tab === 'pnl' && (
            <div className="space-y-6">
              {/* Contribution Chart */}
              <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3">收益贡献度</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...contributions].sort((a, b) => b.contribution - a.contribution)}
                      layout="vertical"
                    >
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="symbol"
                        width={60}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, '贡献度']}
                        contentStyle={{
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                        {contributions.map((c, idx) => (
                          <Cell
                            key={idx}
                            fill={c.contribution >= 0 ? '#22c55e' : '#ef4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* PnL Detail Table */}
              <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border-color">
                  <h3 className="text-sm font-semibold">收益明细</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-color">
                        <th className="text-left py-2 px-4 text-xs font-medium text-text-muted">标的</th>
                        <th className="text-right py-2 px-4 text-xs font-medium text-text-muted">持仓市值</th>
                        <th className="text-right py-2 px-4 text-xs font-medium text-text-muted">收益率</th>
                        <th className="text-right py-2 px-4 text-xs font-medium text-text-muted">贡献度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...contributions].sort((a, b) => b.contribution - a.contribution).map(c => (
                        <tr key={c.symbol} className="border-b border-border-color/50 hover:bg-bg-tertiary/30">
                          <td className="py-2 px-4">
                            <span className="font-medium">{c.symbol}</span>
                            <span className="text-xs text-text-muted ml-1">{c.name}</span>
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-text-secondary">
                            ¥{c.weight.toLocaleString()}
                          </td>
                          <td className={clsx(
                            'text-right py-2 px-4 font-mono font-medium',
                            c.return >= 0 ? 'text-accent-success' : 'text-accent-danger'
                          )}>
                            {(c.return >= 0 ? '+' : '')}{(c.return * 100).toFixed(2)}%
                          </td>
                          <td className={clsx(
                            'text-right py-2 px-4 font-mono font-medium',
                            c.contribution >= 0 ? 'text-accent-success' : 'text-accent-danger'
                          )}>
                            {(c.contribution >= 0 ? '+' : '')}{(c.contribution * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===== Risk Tab ===== */}
          {tab === 'risk' && (
            <div className="space-y-6">
              {/* Portfolio Summary */}
              {portfolioRisk && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-bg-secondary border border-border-color rounded-xl p-4 text-center">
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-1">组合BETA</p>
                    <p className={clsx(
                      'text-2xl font-bold font-mono',
                      portfolioRisk.beta > 1.2 ? 'text-accent-danger' :
                      portfolioRisk.beta < 0.8 ? 'text-accent-success' : 'text-accent-primary'
                    )}>
                      {portfolioRisk.beta.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-bg-secondary border border-border-color rounded-xl p-4 text-center">
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-1">组合波动率</p>
                    <p className="text-2xl font-bold font-mono text-accent-warning">
                      {(portfolioRisk.volatility * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-bg-secondary border border-border-color rounded-xl p-4 text-center">
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-1">组合VaR (95%)</p>
                    <p className="text-2xl font-bold font-mono text-accent-danger">
                      {(portfolioRisk.var95 * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}

              {/* Position Risk Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {positionRisks.map(risk => (
                  <PositionRiskCard key={risk.symbol} risk={risk} />
                ))}
              </div>
            </div>
          )}

          {/* ===== Rebalance Tab ===== */}
          {tab === 'rebalance' && (
            <div className="space-y-4">
              <RebalanceSuggestion suggestions={rebalanceItems} />

              {/* Alternative: Mean-Variance optimization display */}
              <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-accent-primary" />
                  均值-方差优化建议
                </h3>
                <p className="text-xs text-text-muted mb-3">
                  基于历史收益和波动率的马科维茨组合优化，点击参考 PortfolioOptimizerPage 获取详细配置
                </p>
                <div className="space-y-2">
                  {rebalanceItems.filter(r => r.action !== 'hold').map(item => (
                    <div key={item.symbol} className="flex items-center justify-between p-2 bg-bg-tertiary rounded-lg">
                      <span className="text-sm font-medium">{item.symbol}</span>
                      <span className="text-xs text-text-muted">建议权重: {item.targetWeight.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
