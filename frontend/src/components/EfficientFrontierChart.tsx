/**
 * Efficient Frontier Chart
 * Visualizes the feasible region and efficient frontier using recharts ScatterChart
 */
import { Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Legend, Line, ComposedChart } from 'recharts';
import type { EfficientFrontierPoint } from '../services/optimizer';

interface Props {
  frontierPoints: EfficientFrontierPoint[];
  randomPortfolios?: EfficientFrontierPoint[];
  width?: number;
  height?: number;
}

export default function EfficientFrontierChart({ 
  frontierPoints, 
  randomPortfolios = [],
  width = 600,
  height = 400 
}: Props) {
  
  // Find max Sharpe and min variance points
  const maxSharpePoint = frontierPoints.find(p => p.isMaxSharpe);
  const minVarPoint = frontierPoints.find(p => p.isMinVariance);
  
  // Format data for feasible region (random portfolios)
  const feasibleData = randomPortfolios.map(p => ({
    volatility: (p.volatility * 100).toFixed(2),
    return: (p.return * 100).toFixed(2),
    type: 'feasible',
  }));
  
  // Format data for efficient frontier (sorted by volatility)
  const frontierData = [...frontierPoints]
    .sort((a, b) => a.volatility - b.volatility)
    .map(p => ({
      volatility: (p.volatility * 100).toFixed(2),
      return: (p.return * 100).toFixed(2),
      type: p.isMaxSharpe ? 'maxSharpe' : p.isMinVariance ? 'minVariance' : 'frontier',
    }));
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    
    const data = payload[0]?.payload;
    if (!data) return null;
    
    return (
      <div className="bg-bg-secondary border border-border-color rounded-lg p-3 text-xs shadow-lg">
        <div className="font-medium mb-1">组合详情</div>
        <div className="text-text-muted">
          <div>波动率: <span className="text-text-primary font-mono">{data.volatility}%</span></div>
          <div>预期收益: <span className={`font-mono ${parseFloat(data.return) >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>{data.return}%</span></div>
          {data.type === 'maxSharpe' && (
            <div className="text-accent-primary mt-1">最大夏普组合</div>
          )}
          {data.type === 'minVariance' && (
            <div className="text-accent-primary mt-1">最小方差组合</div>
          )}
        </div>
      </div>
    );
  };
  
  if (frontierPoints.length === 0 && randomPortfolios.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-text-muted text-sm">
        暂无有效前沿数据
      </div>
    );
  }
  
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart 
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--border-color)" 
            opacity={0.3}
          />
          <XAxis
            type="number"
            dataKey="volatility"
            name="volatility"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickFormatter={(v) => `${v}%`}
            label={{ 
              value: '波动率 (σ)', 
              position: 'insideBottom', 
              offset: -10,
              style: { fontSize: 11, fill: 'var(--text-muted)' }
            }}
          />
          <YAxis
            type="number"
            dataKey="return"
            name="return"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickFormatter={(v) => `${v}%`}
            label={{ 
              value: '预期收益率 E[R]', 
              angle: -90, 
              position: 'insideLeft',
              style: { fontSize: 11, fill: 'var(--text-muted)' }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Feasible region (random portfolios) */}
          <Scatter
            name="可行组合"
            data={feasibleData}
            fill="var(--accent-primary)"
            fillOpacity={0.2}
            shape="circle"
          />
          
          {/* Efficient Frontier Line */}
          {frontierData.length > 1 && (
            <Line
              type="monotone"
              data={frontierData}
              dataKey="volatility"
              stroke="var(--accent-danger)"
              strokeWidth={2}
              dot={false}
              name="有效前沿"
              legendType="line"
            />
          )}
          
          {/* Scatter points on frontier */}
          <Scatter
            name="有效前沿"
            data={frontierData}
            fill="var(--accent-danger)"
            shape="circle"
          >
            {frontierData.map((entry, index) => (
              <circle
                key={`frontier-${index}`}
                r={entry.type === 'maxSharpe' || entry.type === 'minVariance' ? 6 : 3}
                fill={entry.type === 'maxSharpe' ? 'var(--accent-success)' : 
                      entry.type === 'minVariance' ? 'var(--accent-warning)' : 
                      'var(--accent-danger)'}
                stroke="var(--bg-primary)"
                strokeWidth={1}
              />
            ))}
          </Scatter>
          
          {/* Max Sharpe Point */}
          {maxSharpePoint && (
            <ReferenceDot
              x={(maxSharpePoint.volatility * 100).toFixed(2)}
              y={(maxSharpePoint.return * 100).toFixed(2)}
              r={8}
              fill="var(--accent-success)"
              stroke="var(--bg-primary)"
              strokeWidth={2}
              label={{
                value: '最大夏普',
                position: 'top',
                fontSize: 10,
                fill: 'var(--accent-success)',
              }}
            />
          )}
          
          {/* Min Variance Point */}
          {minVarPoint && (
            <ReferenceDot
              x={(minVarPoint.volatility * 100).toFixed(2)}
              y={(minVarPoint.return * 100).toFixed(2)}
              r={8}
              fill="var(--accent-warning)"
              stroke="var(--bg-primary)"
              strokeWidth={2}
              label={{
                value: '最小方差',
                position: 'bottom',
                fontSize: 10,
                fill: 'var(--accent-warning)',
              }}
            />
          )}
          
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
