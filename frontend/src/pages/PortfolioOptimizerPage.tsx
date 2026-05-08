import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { fetchKlineData } from '../services/yahooFinance';
import { BarChart2, Loader2, PieChart, Target, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface StockReturn {
  symbol: string;
  name: string;
  weight: number;
  expectedReturn: number;
  volatility: number;
  sharpe: number;
}

export default function PortfolioOptimizerPage() {
  const { selectedStocks, showNotification } = useStore();
  const [loading, setLoading] = useState(false);
  const [stocks, setStocks] = useState<StockReturn[]>([]);
  const [targetReturn, setTargetReturn] = useState(10); // 目标年化收益 %
  const [riskFreeRate, setRiskFreeRate] = useState(3);  // 无风险利率 %
  
  // 默认股票池（当自选股为空时）
  const defaultStocks = [
    { symbol: '600519', name: '贵州茅台' },
    { symbol: '000001', name: '平安银行' },
    { symbol: '600036', name: '招商银行' },
    { symbol: '300750', name: '宁德时代' },
    { symbol: '000002', name: '万科A' },
  ];

  // 加载股票数据
  const loadStocks = useCallback(async () => {
    const pool = selectedStocks.length > 0 
      ? selectedStocks.slice(0, 8).map(s => ({ symbol: s.symbol, name: s.name }))
      : defaultStocks;
    
    setLoading(true);
    
    try {
      const results = await Promise.allSettled(
        pool.map(async (s) => {
          const kline = await fetchKlineData(s.symbol, 252);
          // 计算年化收益和波动率
          const returns = kline.map((k, i) => {
            if (i === 0) return 0;
            return (k.close - kline[i - 1].close) / kline[i - 1].close;
          }).slice(1);
          
          const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
          const expectedReturn = avgReturn * 252 * 100; // 年化
          
          const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
          const volatility = Math.sqrt(variance * 252) * 100; // 年化波动率
          
          const sharpe = (expectedReturn - riskFreeRate) / volatility;
          
          return { symbol: s.symbol, name: s.name, weight: 0, expectedReturn, volatility, sharpe };
        })
      );
      
      const valid = results
        .filter((r): r is PromiseFulfilledResult<StockReturn> => r.status === 'fulfilled')
        .map(r => r.value);
      
      setStocks(valid);
      setLoading(false);
    } catch {
      showNotification('error', '加载股票数据失败');
      setLoading(false);
    }
  }, [selectedStocks, riskFreeRate, showNotification]);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  // 简单的等权重优化
  const handleEqualWeight = () => {
    if (stocks.length === 0) return;
    const w = 100 / stocks.length;
    setStocks(s => s.map(stock => ({ ...stock, weight: w })));
    showNotification('success', '已设为等权重分配');
  };

  // 基于风险平价优化（简化版）
  const handleRiskParity = () => {
    if (stocks.length === 0) return;
    const totalInverseVol = stocks.reduce((sum, s) => sum + 1 / s.volatility, 0);
    setStocks(s => s.map(stock => ({
      ...stock,
      weight: (1 / stock.volatility / totalInverseVol) * 100,
    })));
    showNotification('success', '已设为风险平价组合');
  };

  // 基于最大夏普优化（简化版）
  const handleMaxSharpe = () => {
    if (stocks.length === 0) return;
    const maxSharpeStock = stocks.reduce((best, s) => s.sharpe > best.sharpe ? s : best);
    setStocks(s => s.map(stock => ({
      ...stock,
      weight: stock.symbol === maxSharpeStock.symbol ? 100 : 0,
    })));
    showNotification('success', '已设为最大夏普比率组合');
  };

  // 基于目标收益优化（简化版）
  const handleTargetReturn = () => {
    if (stocks.length === 0) return;
    // 找到目标收益附近的股票，给正收益股票分配权重
    const positive = stocks.filter(s => s.expectedReturn >= targetReturn);
    if (positive.length === 0) {
      showNotification('info', '无可满足目标收益的股票');
      return;
    }
    const w = 100 / positive.length;
    setStocks(s => s.map(stock => ({
      ...stock,
      weight: positive.some(p => p.symbol === stock.symbol) ? w : 0,
    })));
    showNotification('success', `已设为目标收益 ${targetReturn}% 组合`);
  };

  // 计算组合指标
  const portfolioReturn = stocks.reduce((sum, s) => sum + (s.weight / 100) * s.expectedReturn, 0);
  const portfolioVol = Math.sqrt(
    stocks.reduce((sum, s) => sum + Math.pow(s.weight / 100 * s.volatility, 2), 0)
  );
  const portfolioSharpe = portfolioVol > 0 ? (portfolioReturn - riskFreeRate) / portfolioVol : 0;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <PieChart size={24} className="text-accent-primary" />
        <div>
          <h1 className="text-2xl font-bold">组合优化器</h1>
          <p className="text-sm text-text-muted">基于 Mean-Variance 的资产配置建议</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-accent-primary" />
          <span className="ml-3 text-text-muted">正在加载股票数据...</span>
        </div>
      ) : (
        <>
          {/* 参数设置 */}
          <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
            <div className="flex items-center gap-2 mb-3">
              <Target size={16} className="text-accent-warning" />
              <h3 className="text-sm font-semibold">优化参数</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-text-muted block mb-1">目标年化收益 (%)</label>
                <input
                  type="number"
                  value={targetReturn}
                  onChange={(e) => setTargetReturn(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">无风险利率 (%)</label>
                <input
                  type="number"
                  value={riskFreeRate}
                  onChange={(e) => setRiskFreeRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* 优化策略按钮 */}
          <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={16} className="text-accent-primary" />
              <h3 className="text-sm font-semibold">优化策略</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={handleEqualWeight}
                className="px-3 py-2 bg-bg-tertiary hover:bg-accent-primary/20 border border-border-color rounded-lg text-xs transition-colors"
              >
                等权重
              </button>
              <button
                onClick={handleRiskParity}
                className="px-3 py-2 bg-bg-tertiary hover:bg-accent-primary/20 border border-border-color rounded-lg text-xs transition-colors"
              >
                风险平价
              </button>
              <button
                onClick={handleMaxSharpe}
                className="px-3 py-2 bg-bg-tertiary hover:bg-accent-primary/20 border border-border-color rounded-lg text-xs transition-colors"
              >
                最大夏普
              </button>
              <button
                onClick={handleTargetReturn}
                className="px-3 py-2 bg-bg-tertiary hover:bg-accent-primary/20 border border-border-color rounded-lg text-xs transition-colors"
              >
                目标收益
              </button>
            </div>
          </div>

          {/* 个股数据表格 */}
          <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">股票池 ({stocks.length})</h3>
              <button
                onClick={loadStocks}
                className="text-xs text-accent-primary hover:underline"
              >
                刷新数据
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-color">
                    <th className="text-left py-2 text-text-muted">股票</th>
                    <th className="text-right py-2 text-text-muted">年化收益</th>
                    <th className="text-right py-2 text-text-muted">波动率</th>
                    <th className="text-right py-2 text-text-muted">夏普比率</th>
                    <th className="text-right py-2 text-text-muted">建议权重</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock) => (
                    <tr key={stock.symbol} className="border-b border-border-color/50">
                      <td className="py-2">
                        <span className="font-medium">{stock.symbol}</span>
                        <span className="text-text-muted ml-1">{stock.name}</span>
                      </td>
                      <td className={`text-right py-2 ${stock.expectedReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                        {stock.expectedReturn.toFixed(1)}%
                      </td>
                      <td className="text-right py-2 text-accent-warning">
                        {stock.volatility.toFixed(1)}%
                      </td>
                      <td className={`text-right py-2 ${stock.sharpe >= 1 ? 'text-accent-primary' : 'text-text-muted'}`}>
                        {stock.sharpe.toFixed(2)}
                      </td>
                      <td className="text-right py-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={stock.weight.toFixed(1)}
                          onChange={(e) => {
                            const w = parseFloat(e.target.value) || 0;
                            setStocks(s => s.map(st => st.symbol === stock.symbol ? { ...st, weight: w } : st));
                          }}
                          className="w-16 px-2 py-1 bg-bg-tertiary border border-border-color rounded text-right"
                        />
                        <span className="ml-1">%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 组合汇总 */}
          <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} className="text-accent-success" />
              <h3 className="text-sm font-semibold">组合汇总</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                <div className="text-xs text-text-muted mb-1">组合年化收益</div>
                <div className={`text-xl font-bold ${portfolioReturn >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                  {portfolioReturn.toFixed(1)}%
                </div>
              </div>
              <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                <div className="text-xs text-text-muted mb-1">组合波动率</div>
                <div className="text-xl font-bold text-accent-warning">
                  {portfolioVol.toFixed(1)}%
                </div>
              </div>
              <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                <div className="text-xs text-text-muted mb-1">组合夏普比率</div>
                <div className={`text-xl font-bold ${portfolioSharpe >= 1 ? 'text-accent-success' : portfolioSharpe >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                  {portfolioSharpe.toFixed(2)}
                </div>
              </div>
            </div>

            {stocks.some(s => s.weight > 0) && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={12} className="text-accent-warning" />
                  <span className="text-xs text-text-muted">风险提示：以上为历史数据回测结果，不构成投资建议。</span>
                </div>
                <div className="h-3 bg-bg-tertiary rounded-full overflow-hidden flex">
                  {stocks.filter(s => s.weight > 0).map((stock) => (
                    <div
                      key={stock.symbol}
                      className="bg-accent-primary/80 hover:bg-accent-primary transition-colors"
                      style={{ width: `${stock.weight}%` }}
                      title={`${stock.symbol} ${stock.name}: ${stock.weight.toFixed(1)}%`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {stocks.filter(s => s.weight > 0).map((stock) => (
                    <span key={stock.symbol} className="text-xs bg-bg-tertiary px-2 py-1 rounded">
                      {stock.symbol} {stock.weight.toFixed(1)}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
