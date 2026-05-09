import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../store';
import { fetchKlineData } from '../services/yahooFinance';
import {
  meanVarianceOptimize,
  riskParityOptimize,
  computeEfficientFrontier,
  generateRandomPortfolios,
  computeCovarianceMatrix,
  type OptimizationConstraints,
  type OptimizationResult,
  type EfficientFrontierPoint,
} from '../services/optimizer';
import EfficientFrontierChart from '../components/EfficientFrontierChart';
import OptimizerResultPanel from '../components/OptimizerResultPanel';
import DrawdownOptimizerPanel from '../components/DrawdownOptimizerPanel';
import { Loader2, PieChart, AlertTriangle, CheckCircle2, Settings2, Import, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import clsx from 'clsx';

interface StockReturn {
  symbol: string;
  name: string;
  weight: number;
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  returns: number[];
}

type OptimizationTarget = 'max_sharpe' | 'min_variance' | 'risk_parity';
type OptimizerTab = 'weights' | 'frontier' | 'drawdown';

export default function PortfolioOptimizerPage() {
  const { selectedStocks, showNotification, portfolio } = useStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<OptimizerTab>('weights');
  const [stocks, setStocks] = useState<StockReturn[]>([]);
  const [targetReturn, setTargetReturn] = useState(10); // 目标年化收益 %
  const [riskFreeRate, setRiskFreeRate] = useState(3);  // 无风险利率 %
  
  // Optimization settings
  const [optimizationTarget, setOptimizationTarget] = useState<OptimizationTarget>('max_sharpe');
  const [maxWeight, setMaxWeight] = useState(30);  // max weight per asset %
  const [minWeight, setMinWeight] = useState(0);   // min weight per asset %
  const [allowShort, setAllowShort] = useState(false);
  const [dataWindow, setDataWindow] = useState(252); // trading days
  
  // Optimization results
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [frontierPoints, setFrontierPoints] = useState<EfficientFrontierPoint[]>([]);
  const [randomPortfolios, setRandomPortfolios] = useState<EfficientFrontierPoint[]>([]);
  const [hasOptimized, setHasOptimized] = useState(false);
  
  // Constraints for optimizer
  const constraints: OptimizationConstraints = useMemo(() => ({
    maxWeight: maxWeight / 100,
    minWeight: minWeight / 100,
    allowShort,
  }), [maxWeight, minWeight, allowShort]);
  
  // Default stock pool
  const defaultStocks = [
    { symbol: '600519', name: '贵州茅台' },
    { symbol: '000001', name: '平安银行' },
    { symbol: '600036', name: '招商银行' },
    { symbol: '300750', name: '宁德时代' },
    { symbol: '000002', name: '万科A' },
  ];

  // Load stock data
  const loadStocks = useCallback(async () => {
    const pool = selectedStocks.length > 0
      ? selectedStocks.slice(0, 8).map(s => ({ symbol: s.symbol, name: s.name }))
      : defaultStocks;
    
    setLoading(true);
    setHasOptimized(false);
    setOptimizationResult(null);
    
    try {
      const results = await Promise.allSettled(
        pool.map(async (s) => {
          const kline = await fetchKlineData(s.symbol, dataWindow);
          // Calculate returns
          const returns = kline.map((k, i) => {
            if (i === 0) return 0;
            return (k.close - kline[i - 1].close) / kline[i - 1].close;
          }).slice(1);
          
          const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
          const expectedReturn = avgReturn * 252 * 100; // Annualized
          
          const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
          const volatility = Math.sqrt(variance * 252) * 100; // Annualized volatility
          
          const sharpe = volatility > 0 ? (expectedReturn - riskFreeRate) / volatility : 0;
          
          return { symbol: s.symbol, name: s.name, weight: 0, expectedReturn, volatility, sharpe, returns };
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
  }, [selectedStocks, riskFreeRate, dataWindow, showNotification]);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  // Import current positions
  const handleImportPositions = useCallback(() => {
    if (!portfolio?.positions || portfolio.positions.length === 0) {
      showNotification('info', '当前无持仓数据');
      return;
    }
    
    // Use position symbols as stock pool
    const posStocks = portfolio.positions.map(p => ({
      symbol: p.symbol,
      name: p.name,
      weight: (p.market_value / portfolio.total_market_value) * 100, // Current weight
    }));
    
    // Reload with position symbols
    setLoading(true);
    Promise.allSettled(
      posStocks.map(async (s) => {
        const kline = await fetchKlineData(s.symbol, dataWindow);
        const returns = kline.map((k, i) => {
          if (i === 0) return 0;
          return (k.close - kline[i - 1].close) / kline[i - 1].close;
        }).slice(1);
        
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const expectedReturn = avgReturn * 252 * 100;
        
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance * 252) * 100;
        
        const sharpe = volatility > 0 ? (expectedReturn - riskFreeRate) / volatility : 0;
        
        return { 
          symbol: s.symbol, 
          name: s.name, 
          weight: s.weight, // Keep current weight
          expectedReturn, 
          volatility, 
          sharpe, 
          returns 
        };
      })
    ).then(results => {
      const valid = results
        .filter((r): r is PromiseFulfilledResult<StockReturn> => r.status === 'fulfilled')
        .map(r => r.value);
      
      if (valid.length > 0) {
        setStocks(valid);
        showNotification('success', `已导入 ${valid.length} 个持仓`);
      } else {
        showNotification('error', '导入持仓数据失败');
      }
      setLoading(false);
    });
  }, [portfolio, riskFreeRate, dataWindow, showNotification]);

  // Run optimization
  const handleOptimize = useCallback(() => {
    if (stocks.length < 2) {
      showNotification('info', '需要至少2只股票进行优化');
      return;
    }
    
    setLoading(true);
    
    try {
      // Build returns matrix and covariance matrix
      const returnsMatrix = stocks.map(s => s.returns);
      const covMatrix = computeCovarianceMatrix(returnsMatrix);
      
      // Compute efficient frontier
      const frontier = computeEfficientFrontier(
        stocks.map(s => s.symbol),
        returnsMatrix,
        covMatrix,
        30,
        riskFreeRate / 100
      );
      setFrontierPoints(frontier);
      
      // Generate random portfolios for visualization
      const random = generateRandomPortfolios(
        stocks.map(s => s.symbol),
        returnsMatrix,
        covMatrix,
        150,
        constraints
      );
      setRandomPortfolios(random);
      
      // Run the selected optimization
      let result: OptimizationResult;
      
      switch (optimizationTarget) {
        case 'max_sharpe':
          result = meanVarianceOptimize(
            stocks.map(s => s.symbol),
            returnsMatrix,
            covMatrix,
            riskFreeRate / 100,
            constraints,
            'max_sharpe'
          );
          break;
          
        case 'min_variance':
          result = meanVarianceOptimize(
            stocks.map(s => s.symbol),
            returnsMatrix,
            covMatrix,
            riskFreeRate / 100,
            constraints,
            'min_variance',
            targetReturn / 100
          );
          break;
          
        case 'risk_parity':
          result = riskParityOptimize(
            stocks.map(s => s.symbol),
            covMatrix,
            constraints
          );
          break;
          
        default:
          result = meanVarianceOptimize(
            stocks.map(s => s.symbol),
            returnsMatrix,
            covMatrix,
            riskFreeRate / 100,
            constraints,
            'max_sharpe'
          );
      }
      
      setOptimizationResult(result);
      setHasOptimized(true);
      
      // Update stock weights
      setStocks(s => s.map((stock, i) => ({
        ...stock,
        weight: result.weights[i] * 100,
      })));
      
      const targetNames: Record<OptimizationTarget, string> = {
        max_sharpe: '最大夏普',
        min_variance: '最小方差',
        risk_parity: '风险平价',
      };
      showNotification('success', `已优化为${targetNames[optimizationTarget]}组合`);
    } catch (error) {
      console.error('Optimization error:', error);
      showNotification('error', '优化计算失败');
    }
    
    setLoading(false);
  }, [stocks, optimizationTarget, targetReturn, riskFreeRate, constraints, showNotification]);

  // Simple equal weight allocation
  const handleEqualWeight = () => {
    if (stocks.length === 0) return;
    const w = 100 / stocks.length;
    setStocks(s => s.map(stock => ({ ...stock, weight: w })));
    setOptimizationResult(null);
    setHasOptimized(false);
    showNotification('success', '已设为等权重分配');
  };

  // Simple risk parity (inverse volatility)
  const handleSimpleRiskParity = () => {
    if (stocks.length === 0) return;
    const totalInverseVol = stocks.reduce((sum, s) => sum + 1 / s.volatility, 0);
    setStocks(s => s.map(stock => ({
      ...stock,
      weight: (1 / stock.volatility / totalInverseVol) * 100,
    })));
    setOptimizationResult(null);
    setHasOptimized(false);
    showNotification('success', '已设为简单风险平价组合');
  };

  // Calculate portfolio metrics
  const portfolioReturn = stocks.reduce((sum, s) => sum + (s.weight / 100) * s.expectedReturn, 0);
  const portfolioVol = Math.sqrt(
    stocks.reduce((sum, s) => sum + Math.pow(s.weight / 100 * s.volatility, 2), 0)
  );
  const portfolioSharpe = portfolioVol > 0 ? (portfolioReturn - riskFreeRate) / portfolioVol : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <PieChart size={24} className="text-accent-primary" />
        <div>
          <h1 className="text-2xl font-bold">组合优化器</h1>
          <p className="text-sm text-text-muted">基于 Mean-Variance / Risk Parity 的资产配置</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-bg-secondary rounded-xl p-1 border border-border-color">
        <button
          onClick={() => setActiveTab('weights')}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'weights'
              ? "bg-accent-primary/10 text-accent-primary"
              : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"
          )}
        >
          <PieChart size={14} />
          权重优化
        </button>
        <button
          onClick={() => setActiveTab('frontier')}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'frontier'
              ? "bg-accent-primary/10 text-accent-primary"
              : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"
          )}
        >
          <BarChart3 size={14} />
          有效前沿
        </button>
        <button
          onClick={() => setActiveTab('drawdown')}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'drawdown'
              ? "bg-accent-primary/10 text-accent-primary"
              : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"
          )}
        >
          <TrendingDown size={14} />
          回撤优化
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'drawdown' ? (
        <DrawdownOptimizerPanel />
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-accent-primary" />
          <span className="ml-3 text-text-muted">正在加载股票数据...</span>
        </div>
      ) : (
        <>
          {/* Optimization Configuration */}
          <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
            <div className="flex items-center gap-2 mb-3">
              <Settings2 size={16} className="text-accent-primary" />
              <h3 className="text-sm font-semibold">优化配置</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Optimization Target */}
              <div>
                <label className="text-xs text-text-muted block mb-1">优化目标</label>
                <select
                  value={optimizationTarget}
                  onChange={(e) => setOptimizationTarget(e.target.value as OptimizationTarget)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
                >
                  <option value="max_sharpe">Max Sharpe (最大夏普)</option>
                  <option value="min_variance">Min Variance (最小方差)</option>
                  <option value="risk_parity">Risk Parity (风险平价)</option>
                </select>
              </div>
              
              {/* Max Weight */}
              <div>
                <label className="text-xs text-text-muted block mb-1">单票最大权重 (%)</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={maxWeight}
                  onChange={(e) => setMaxWeight(Math.max(5, Math.min(100, parseInt(e.target.value) || 30)))}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
                />
              </div>
              
              {/* Min Weight */}
              <div>
                <label className="text-xs text-text-muted block mb-1">单票最小权重 (%)</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={minWeight}
                  onChange={(e) => setMinWeight(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
                />
              </div>
              
              {/* Risk Free Rate */}
              <div>
                <label className="text-xs text-text-muted block mb-1">无风险利率 (%)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={riskFreeRate}
                  onChange={(e) => setRiskFreeRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              {/* Allow Short */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowShort"
                  checked={allowShort}
                  onChange={(e) => setAllowShort(e.target.checked)}
                  className="w-4 h-4 rounded border-border-color"
                />
                <label htmlFor="allowShort" className="text-xs text-text-muted">允许做空</label>
              </div>
              
              {/* Data Window */}
              <div>
                <label className="text-xs text-text-muted block mb-1">数据窗口 (日)</label>
                <select
                  value={dataWindow}
                  onChange={(e) => setDataWindow(parseInt(e.target.value) || 252)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
                >
                  <option value={60}>最近 60 天</option>
                  <option value={120}>最近 120 天</option>
                  <option value={252}>最近 252 天</option>
                </select>
              </div>
              
              {/* Target Return (for min_variance) */}
              {optimizationTarget === 'min_variance' && (
                <div>
                  <label className="text-xs text-text-muted block mb-1">目标年化收益 (%)</label>
                  <input
                    type="number"
                    value={targetReturn}
                    onChange={(e) => setTargetReturn(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm"
                  />
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={handleOptimize}
                disabled={stocks.length < 2}
                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <TrendingUp size={14} />
                执行优化
              </button>
              
              <button
                onClick={handleEqualWeight}
                className="px-3 py-2 bg-bg-tertiary hover:bg-accent-primary/20 border border-border-color rounded-lg text-xs transition-colors"
              >
                等权重
              </button>
              
              <button
                onClick={handleSimpleRiskParity}
                className="px-3 py-2 bg-bg-tertiary hover:bg-accent-primary/20 border border-border-color rounded-lg text-xs transition-colors"
              >
                简单风险平价
              </button>
              
              <button
                onClick={handleImportPositions}
                className="px-3 py-2 bg-bg-tertiary hover:bg-accent-primary/20 border border-border-color rounded-lg text-xs transition-colors flex items-center gap-1"
              >
                <Import size={12} />
                导入当前持仓
              </button>
              
              <button
                onClick={loadStocks}
                className="px-3 py-2 bg-bg-tertiary hover:bg-accent-primary/20 border border-border-color rounded-lg text-xs transition-colors"
              >
                刷新数据
              </button>
            </div>
          </div>

          {/* Efficient Frontier Chart */}
          {hasOptimized && (frontierPoints.length > 0 || randomPortfolios.length > 0) && (
            <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
              <h3 className="text-sm font-semibold mb-3">有效前沿</h3>
              <EfficientFrontierChart
                frontierPoints={frontierPoints}
                randomPortfolios={randomPortfolios}
                width={800}
                height={400}
              />
            </div>
          )}

          {/* Optimization Results Panel */}
          {hasOptimized && optimizationResult && (
            <OptimizerResultPanel
              result={optimizationResult}
              stocks={stocks}
              riskContributions={optimizationResult.riskContributions}
            />
          )}

          {/* Stock Pool Table */}
          <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">股票池 ({stocks.length})</h3>
              <span className="text-xs text-text-muted">
                权重合计: {stocks.reduce((sum, s) => sum + s.weight, 0).toFixed(1)}%
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-color">
                    <th className="text-left py-2 text-text-muted">股票</th>
                    <th className="text-right py-2 text-text-muted">年化收益</th>
                    <th className="text-right py-2 text-text-muted">波动率</th>
                    <th className="text-right py-2 text-text-muted">夏普比率</th>
                    <th className="text-right py-2 text-text-muted">优化权重</th>
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
                          step="0.1"
                          value={stock.weight.toFixed(1)}
                          onChange={(e) => {
                            const w = parseFloat(e.target.value) || 0;
                            setStocks(s => s.map(st => st.symbol === stock.symbol ? { ...st, weight: w } : st));
                            setHasOptimized(false);
                            setOptimizationResult(null);
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

          {/* Portfolio Summary */}
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
