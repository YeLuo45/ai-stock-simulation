/**
 * Optimizer Result Panel
 * Displays optimization results: weight bar chart + metrics cards + export
 */
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Download, TrendingUp, TrendingDown, Activity, Target, Percent, AlertTriangle } from 'lucide-react';
import type { OptimizationResult } from '../services/optimizer';

interface StockInfo {
  symbol: string;
  name: string;
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  weight: number;
}

interface Props {
  result: OptimizationResult | null;
  stocks: StockInfo[];
  riskContributions?: number[];
  onExport?: () => void;
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#64748b',
];

export default function OptimizerResultPanel({ 
  result, 
  stocks, 
  riskContributions = [],
  onExport 
}: Props) {
  
  if (!result || stocks.length === 0) {
    return (
      <div className="bg-bg-secondary rounded-xl p-6 border border-border-color text-center text-text-muted text-sm">
        暂无优化结果
      </div>
    );
  }
  
  const totalWeight = result.weights.reduce((a, b) => a + b, 0);
  
  // Prepare bar chart data for weights
  const weightData = stocks.map((stock, i) => ({
    symbol: stock.symbol,
    name: stock.name,
    weight: (result.weights[i] * 100).toFixed(1),
    value: result.weights[i] * 100,
    riskContribution: riskContributions[i] ? (riskContributions[i] * 100).toFixed(1) : '0',
    expectedReturn: stock.expectedReturn.toFixed(1),
    volatility: stock.volatility.toFixed(1),
    sharpe: stock.sharpe.toFixed(2),
  }));
  
  // Sort by weight descending
  weightData.sort((a, b) => b.value - a.value);
  
  const tooltipFormatter = (value: number, name: string) => {
    if (name === 'weight') return [`${value.toFixed(1)}%`, '权重'];
    if (name === 'riskContribution') return [`${value.toFixed(1)}%`, '风险贡献'];
    return [value, name];
  };
  
  const handleExport = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      stocks: stocks.map((s, i) => ({
        symbol: s.symbol,
        name: s.name,
        weight: result.weights[i],
        weightPct: (result.weights[i] * 100).toFixed(2) + '%',
        riskContribution: riskContributions[i] || 0,
      })),
      portfolio: {
        expectedReturn: (result.expectedReturn * 100).toFixed(2) + '%',
        volatility: (result.volatility * 100).toFixed(2) + '%',
        sharpeRatio: result.sharpeRatio.toFixed(3),
      },
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio_optimization_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    onExport?.();
  };
  
  return (
    <div className="space-y-4">
      {/* Metrics Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg-secondary rounded-xl p-4 border border-border-color text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            {result.expectedReturn >= 0 ? (
              <TrendingUp size={14} className="text-accent-success" />
            ) : (
              <TrendingDown size={14} className="text-accent-danger" />
            )}
            <span className="text-xs text-text-muted">预期年化收益</span>
          </div>
          <div className={`text-xl font-bold ${result.expectedReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
            {(result.expectedReturn * 100).toFixed(1)}%
          </div>
        </div>
        
        <div className="bg-bg-secondary rounded-xl p-4 border border-border-color text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Activity size={14} className="text-accent-warning" />
            <span className="text-xs text-text-muted">年化波动率</span>
          </div>
          <div className="text-xl font-bold text-accent-warning">
            {(result.volatility * 100).toFixed(1)}%
          </div>
        </div>
        
        <div className="bg-bg-secondary rounded-xl p-4 border border-border-color text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Target size={14} className="text-accent-primary" />
            <span className="text-xs text-text-muted">夏普比率</span>
          </div>
          <div className={`text-xl font-bold ${result.sharpeRatio >= 1 ? 'text-accent-success' : result.sharpeRatio >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
            {result.sharpeRatio.toFixed(2)}
          </div>
        </div>
      </div>
      
      {/* Weight Bar Chart */}
      <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Percent size={14} className="text-accent-primary" />
            优化权重分配
          </h4>
          <span className="text-xs text-text-muted">
            权重合计: {(totalWeight * 100).toFixed(1)}%
          </span>
        </div>
        
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={weightData} 
              layout="vertical"
              margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
              <XAxis 
                type="number" 
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
              />
              <YAxis 
                type="category" 
                dataKey="symbol" 
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                width={55}
              />
              <Tooltip 
                formatter={tooltipFormatter}
                labelFormatter={(label) => {
                  const item = weightData.find(d => d.symbol === label);
                  return `${item?.symbol} (${item?.name})`;
                }}
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
              />
              <Bar 
                dataKey="value" 
                name="权重" 
                radius={[0, 4, 4, 0]}
              >
                {weightData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    stroke="transparent"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Weight breakdown legend */}
        <div className="flex flex-wrap gap-2 mt-3">
          {weightData.filter(d => d.value > 0.1).map((item) => (
            <div 
              key={item.symbol}
              className="flex items-center gap-1.5 text-xs bg-bg-tertiary px-2 py-1 rounded"
            >
              <div 
                className="w-2 h-2 rounded-sm" 
                style={{ backgroundColor: COLORS[weightData.indexOf(item) % COLORS.length] }}
              />
              <span className="text-text-secondary">{item.symbol}</span>
              <span className="font-mono text-text-primary">{item.weight}%</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Risk Contribution */}
      {riskContributions.length > 0 && (
        <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle size={14} className="text-accent-warning" />
              风险贡献分布
            </h4>
          </div>
          
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={weightData}
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
                <XAxis 
                  dataKey="symbol" 
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, '风险贡献']}
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                />
                <ReferenceLine y={100 / stocks.length} stroke="var(--accent-primary)" strokeDasharray="3 3" label="等分线" />
                <Bar dataKey="riskContribution" fill="var(--accent-warning)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="text-xs text-text-muted mt-2 text-center">
            理想情况下每只股票风险贡献应相等（约 {(100 / stocks.length).toFixed(1)}%）
          </div>
        </div>
      )}
      
      {/* Export Button */}
      <button
        onClick={handleExport}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/30 rounded-lg text-sm text-accent-primary transition-colors"
      >
        <Download size={14} />
        导出优化结果
      </button>
    </div>
  );
}
