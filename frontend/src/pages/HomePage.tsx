import { useStore } from '../store'
import { TrendingUp, TrendingDown, Wallet, PieChart, RefreshCw, Eye, EyeOff, Bell, BellOff, Trash2, Shield, Loader2, Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import { useState, useCallback, Fragment, useEffect, useRef } from 'react'
import { fetchFundamentalData, getRealtimeQuote } from '../services/yahooFinance'
import { useRegimeStore } from '../services/regime/RegimeStore'
import { RegimeDetector } from '../services/regime/RegimeDetector'

export default function HomePage() {
  const { portfolio, trades, isLoading, setPage, priceAlerts, addPriceAlert, removePriceAlert, triggerAlert, showNotification } = useStore()
  const { currentRegime, confidence, isDetecting, setRegime, setDetecting } = useRegimeStore()

  const [expandedPosition, setExpandedPosition] = useState<string | null>(null);
  const [fundamentalCache, setFundamentalCache] = useState<Record<string, any>>({});
  const [alertPanelPosition, setAlertPanelPosition] = useState<string | null>(null);
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  const alertCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<{
    totalValue: number;
    totalCost: number;
    totalProfitLoss: number;
    totalProfitLossPct: number;
    positionConcentration: number;
    sharpeRatio: number;
    beta: number;
    dailyVaR: number;
    loading: boolean;
  }>({
    totalValue: 0,
    totalCost: 0,
    totalProfitLoss: 0,
    totalProfitLossPct: 0,
    positionConcentration: 0,
    sharpeRatio: 0,
    beta: 1,
    dailyVaR: 0,
    loading: false,
  });

  // Regime detection handler
  const handleRegimeDetect = useCallback(async () => {
    setDetecting(true);
    try {
      const result = await RegimeDetector.detect('000001');
      setRegime(result);
      showNotification('info', `市场状态检测完成：${result.regime}（置信度 ${(result.confidence * 100).toFixed(0)}%）`);
    } catch (e) {
      showNotification('error', '市场状态检测失败');
    } finally {
      setDetecting(false);
    }
  }, [setDetecting, setRegime, showNotification]);

  const handleToggleExpand = useCallback(async (stockCode: string) => {
    if (expandedPosition === stockCode) {
      setExpandedPosition(null);
      return;
    }
    setExpandedPosition(stockCode);
    if (!fundamentalCache[stockCode]) {
      try {
        const data = await fetchFundamentalData(stockCode);
        setFundamentalCache(prev => ({ ...prev, [stockCode]: data }));
      } catch (e) {
        // silently fail, card shows no data
      }
    }
  }, [expandedPosition, fundamentalCache]);

  // Price alert checking
  const showNotificationRef = useRef(showNotification);
  showNotificationRef.current = showNotification;

  useEffect(() => {
    if (priceAlerts.length === 0) return;
    
    const checkAlerts = async () => {
      const activeAlerts = priceAlerts.filter(a => !a.triggered);
      if (activeAlerts.length === 0) return;
      
      for (const alert of activeAlerts) {
        try {
          const quote = await getRealtimeQuote(alert.symbol);
          const triggered = alert.condition === 'above' 
            ? quote.price >= alert.targetPrice
            : quote.price <= alert.targetPrice;
          
          if (triggered) {
            triggerAlert(alert.id);
            showNotificationRef.current(
              'info',
              `${alert.name} (${alert.symbol}) 触发预警：${alert.condition === 'above' ? '涨至' : '跌至'} ¥${quote.price.toFixed(2)}（设置价 ¥${alert.targetPrice.toFixed(2)}）`
            );
          }
        } catch {
          // silently fail
        }
      }
    };
    
    // Check immediately once
    checkAlerts();
    // Then check every 30 seconds
    alertCheckRef.current = setInterval(checkAlerts, 30000);
    return () => {
      if (alertCheckRef.current) clearInterval(alertCheckRef.current);
    };
  }, [priceAlerts, triggerAlert]);

  const positions = portfolio?.positions ?? []
  const totalValue = portfolio?.total_assets ?? 1000000
  const profitLoss = portfolio?.total_profit_loss ?? 0
  const profitLossPct = portfolio?.total_profit_loss_pct ?? 0

  // Risk metrics calculation - must be before early return to follow Rules of Hooks
  useEffect(() => {
    if (!portfolio || positions.length === 0) return;

    const calculateRisk = async () => {
      setRiskMetrics(prev => ({ ...prev, loading: true }));
      
      try {
        const totalCost = positions.reduce((sum, p) => sum + (p.avg_cost * p.quantity), 0);
        const totalValueCalc = positions.reduce((sum, p) => sum + (p.current_price * p.quantity), 0);
        const totalProfitLoss = totalValueCalc - totalCost;
        const totalProfitLossPct = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;
        
        const positionValues = positions.map(p => ({ symbol: p.symbol, value: p.current_price * p.quantity }));
        const maxPositionValue = Math.max(...positionValues.map(p => p.value));
        const positionConcentration = totalValueCalc > 0 ? (maxPositionValue / totalValueCalc) * 100 : 0;
        
        let portfolioBeta = 1;
        
        await Promise.allSettled(
          positionValues.map(async (p) => {
            try {
              const quote = await getRealtimeQuote(p.symbol);
              const weight = p.value / totalValueCalc;
              portfolioBeta += (quote.beta - 1) * weight;
            } catch {
              // ignore
            }
          })
        );
        
        const estimatedVolatility = 0.15 / Math.sqrt(positions.length);
        const expectedReturn = totalProfitLossPct / 100;
        const riskFreeRate = 0.03;
        const sharpeRatio = estimatedVolatility > 0 
          ? (expectedReturn - riskFreeRate) / estimatedVolatility 
          : 0;
        
        const dailyVolatility = estimatedVolatility / Math.sqrt(252);
        const dailyVaR = dailyVolatility * 1.645 * 100;
        
        setRiskMetrics({
          totalValue: totalValueCalc,
          totalCost,
          totalProfitLoss,
          totalProfitLossPct,
          positionConcentration,
          sharpeRatio,
          beta: portfolioBeta,
          dailyVaR,
          loading: false,
        });
      } catch {
        setRiskMetrics(prev => ({ ...prev, loading: false }));
      }
    };
    
    calculateRisk();
  }, [portfolio, positions]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">账户概览</h1>
        <button
          onClick={() => setPage('trading')}
          className="px-4 py-2 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors text-sm"
        >
          模拟交易
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="总资产"
          value={`¥${totalValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          icon={<Wallet size={20} className="text-accent-primary" />}
        />
        <StatCard
          label="持仓市值"
          value={`¥${(portfolio?.total_market_value ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          icon={<PieChart size={20} className="text-accent-secondary" />}
        />
        <StatCard
          label="今日收益"
          value={`${profitLoss >= 0 ? '+' : ''}¥${profitLoss.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          subtext={`${profitLossPct >= 0 ? '+' : ''}${profitLossPct.toFixed(2)}%`}
          icon={
            profitLoss >= 0
              ? <TrendingUp size={20} className="text-accent-success" />
              : <TrendingDown size={20} className="text-accent-danger" />
          }
          valueClass={profitLoss >= 0 ? 'text-accent-success' : 'text-accent-danger'}
        />
        <StatCard
          label="可用资金"
          value={`¥${(portfolio?.cash ?? 1000000).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          icon={<Wallet size={20} className="text-accent-warning" />}
        />
      </div>

      {/* Regime Status Display */}
      <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              currentRegime === 'BULL' ? 'bg-accent-success/20 text-accent-success' :
              currentRegime === 'BEAR' ? 'bg-accent-danger/20 text-accent-danger' :
              currentRegime === 'RANGEBOUND' ? 'bg-accent-warning/20 text-accent-warning' :
              'bg-gray-500/20 text-gray-400'
            )}>
              <Activity size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">市场状态</span>
                <span className={clsx(
                  'px-2 py-0.5 rounded text-xs font-bold',
                  currentRegime === 'BULL' ? 'bg-accent-success/20 text-accent-success' :
                  currentRegime === 'BEAR' ? 'bg-accent-danger/20 text-accent-danger' :
                  currentRegime === 'RANGEBOUND' ? 'bg-accent-warning/20 text-accent-warning' :
                  'bg-gray-500/20 text-gray-400'
                )}>
                  {currentRegime === 'BULL' ? '牛市' : 
                   currentRegime === 'BEAR' ? '熊市' : 
                   currentRegime === 'RANGEBOUND' ? '震荡' : '未知'}
                </span>
              </div>
              <div className="text-xs text-text-muted mt-0.5">
                置信度: {(confidence * 100).toFixed(0)}%
                {currentRegime !== 'UNKNOWN' && (
                  <span className="ml-2">• 策略池已切换</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleRegimeDetect}
            disabled={isDetecting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-tertiary hover:bg-bg-tertiary/80 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isDetecting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            重新检测
          </button>
        </div>
      </div>

      {positions.length > 0 && (
        <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-accent-warning" />
            <h3 className="text-sm font-semibold">风控仪表盘</h3>
            {riskMetrics.loading && <Loader2 size={12} className="animate-spin text-text-muted" />}
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-bg-tertiary rounded-lg p-3">
              <div className="text-xs text-text-muted mb-1">组合Beta</div>
              <div className={`text-lg font-bold ${riskMetrics.beta > 1.2 ? 'text-accent-danger' : riskMetrics.beta < 0.8 ? 'text-accent-success' : 'text-text-primary'}`}>
                {riskMetrics.beta.toFixed(2)}
              </div>
              <div className="text-[10px] text-text-muted">
                {riskMetrics.beta > 1.2 ? '高波动' : riskMetrics.beta < 0.8 ? '低波动' : '适中'}
              </div>
            </div>
            
            <div className="bg-bg-tertiary rounded-lg p-3">
              <div className="text-xs text-text-muted mb-1">夏普比率</div>
              <div className={`text-lg font-bold ${riskMetrics.sharpeRatio >= 1 ? 'text-accent-success' : riskMetrics.sharpeRatio >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                {riskMetrics.sharpeRatio.toFixed(2)}
              </div>
              <div className="text-[10px] text-text-muted">
                {riskMetrics.sharpeRatio >= 2 ? '优秀' : riskMetrics.sharpeRatio >= 1 ? '良好' : riskMetrics.sharpeRatio >= 0 ? '一般' : '较差'}
              </div>
            </div>
            
            <div className="bg-bg-tertiary rounded-lg p-3">
              <div className="text-xs text-text-muted mb-1">持仓集中度</div>
              <div className={`text-lg font-bold ${riskMetrics.positionConcentration > 50 ? 'text-accent-danger' : riskMetrics.positionConcentration > 30 ? 'text-accent-warning' : 'text-accent-success'}`}>
                {riskMetrics.positionConcentration.toFixed(1)}%
              </div>
              <div className="text-[10px] text-text-muted">
                {riskMetrics.positionConcentration > 50 ? '过于集中' : riskMetrics.positionConcentration > 30 ? '分散一般' : '分散良好'}
              </div>
            </div>
            
            <div className="bg-bg-tertiary rounded-lg p-3">
              <div className="text-xs text-text-muted mb-1">日VaR (95%)</div>
              <div className="text-lg font-bold text-accent-danger">
                -{riskMetrics.dailyVaR.toFixed(2)}%
              </div>
              <div className="text-[10px] text-text-muted">
                最大日损失估计
              </div>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-border-color">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-text-muted">当日盈亏</span>
              <span className={riskMetrics.totalProfitLoss >= 0 ? 'text-accent-success' : 'text-accent-danger'}>
                {riskMetrics.totalProfitLoss >= 0 ? '+' : ''}{riskMetrics.totalProfitLoss.toFixed(2)} ({riskMetrics.totalProfitLossPct >= 0 ? '+' : ''}{riskMetrics.totalProfitLossPct.toFixed(2)}%)
              </span>
            </div>
            <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${riskMetrics.totalProfitLoss >= 0 ? 'bg-accent-success' : 'bg-accent-danger'}`}
                style={{ width: `${Math.min(Math.abs(riskMetrics.totalProfitLossPct) * 5, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Positions */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">持仓 ({positions.length})</h2>
          {positions.length > 0 && (
            <button
              onClick={() => setPage('trading')}
              className="text-sm text-accent-primary hover:underline"
            >
              查看全部
            </button>
          )}
        </div>

        {positions.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <PieChart size={48} className="mx-auto mb-3 opacity-50" />
            <p>暂无持仓</p>
            <button
              onClick={() => setPage('selection')}
              className="mt-3 text-accent-primary hover:underline text-sm"
            >
              去选股
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted border-b border-border-color">
                  <th className="text-left py-3 px-2 font-medium">股票</th>
                  <th className="text-right py-3 px-2 font-medium">持仓</th>
                  <th className="text-right py-3 px-2 font-medium">成本价</th>
                  <th className="text-right py-3 px-2 font-medium">现价</th>
                  <th className="text-right py-3 px-2 font-medium">市值</th>
                  <th className="text-right py-3 px-2 font-medium">盈亏</th>
                </tr>
              </thead>
              <tbody>
                  {positions.slice(0, 5).map((pos) => (
                    <Fragment key={pos.id}>
                      <tr className="border-b border-border-color/50 hover:bg-bg-tertiary/50 transition-colors">
                        <td className="py-3 px-2">
                          <div className="font-mono font-medium">{pos.symbol}</div>
                          <div className="text-text-muted text-xs">{pos.name}</div>
                        </td>
                        <td className="text-right py-3 px-2 font-mono">{pos.quantity}</td>
                        <td className="text-right py-3 px-2 font-mono">¥{pos.avg_cost.toFixed(2)}</td>
                        <td className="text-right py-3 px-2 font-mono">¥{pos.current_price.toFixed(2)}</td>
                        <td className="text-right py-3 px-2 font-mono">¥{pos.market_value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                        <td className={clsx(
                          'text-right py-3 px-2 font-mono font-medium flex items-center justify-end gap-2',
                          pos.profit_loss >= 0 ? 'text-accent-success' : 'text-accent-danger'
                        )}>
                          <span>
                            {pos.profit_loss >= 0 ? '+' : ''}{pos.profit_loss_pct.toFixed(2)}%
                          </span>
                          <button
                            onClick={() => handleToggleExpand(pos.symbol)}
                            className="text-text-muted hover:text-accent-primary"
                          >
                            {expandedPosition === pos.symbol ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            onClick={() => {
                              setAlertPanelPosition(alertPanelPosition === pos.symbol ? null : pos.symbol);
                              setAlertTargetPrice('');
                              setAlertCondition('above');
                            }}
                            className="ml-1 text-text-muted hover:text-accent-warning"
                            title="价格预警"
                          >
                            {priceAlerts.some(a => a.symbol === pos.symbol && !a.triggered) 
                              ? <Bell size={14} className="text-accent-warning" /> 
                              : <BellOff size={14} />}
                          </button>
                        </td>
                      </tr>
                      {(expandedPosition === pos.symbol && fundamentalCache[pos.symbol]) && (
                        <tr>
                          <td colSpan={6} className="py-3 px-2">
                            <div className="mt-3 pt-3 border-t border-border-color grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <FundamentalItem label="市盈率" value={fundamentalCache[pos.symbol].pe?.toFixed(2) ?? '-'} />
                              <FundamentalItem label="市净率" value={fundamentalCache[pos.symbol].pb?.toFixed(2) ?? '-'} />
                              <FundamentalItem label="总市值" value={fundamentalCache[pos.symbol].marketCap ? `${(fundamentalCache[pos.symbol].marketCap / 1e8).toFixed(2)}亿` : '-'} />
                              <FundamentalItem label="股息率" value={fundamentalCache[pos.symbol].dividendYield ? `${(fundamentalCache[pos.symbol].dividendYield * 100).toFixed(2)}%` : '-'} />
                              <FundamentalItem label="52W高" value={fundamentalCache[pos.symbol].week52High?.toFixed(2) ?? '-'} />
                              <FundamentalItem label="52W低" value={fundamentalCache[pos.symbol].week52Low?.toFixed(2) ?? '-'} />
                              <FundamentalItem label="EPS" value={fundamentalCache[pos.symbol].eps?.toFixed(2) ?? '-'} />
                              <FundamentalItem label="Beta" value={fundamentalCache[pos.symbol].beta?.toFixed(2) ?? '-'} />
                            </div>
                          </td>
                        </tr>
                      )}
                      {alertPanelPosition === pos.symbol && (
                        <tr>
                          <td colSpan={6} className="py-3 px-2">
                            <div className="mt-3 pt-3 border-t border-border-color space-y-3">
                              <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                                <Bell size={12} />
                                价格预警
                              </div>
                              <div className="flex gap-2">
                                <select
                                  value={alertCondition}
                                  onChange={(e) => setAlertCondition(e.target.value as 'above' | 'below')}
                                  className="px-2 py-1 text-xs bg-bg-tertiary border border-border-color rounded"
                                >
                                  <option value="above">涨到</option>
                                  <option value="below">跌到</option>
                                </select>
                                <input
                                  type="number"
                                  value={alertTargetPrice}
                                  onChange={(e) => setAlertTargetPrice(e.target.value)}
                                  placeholder="目标价"
                                  className="flex-1 px-2 py-1 text-xs bg-bg-tertiary border border-border-color rounded"
                                />
                                <button
                                  onClick={() => {
                                    if (!alertTargetPrice) return;
                                    addPriceAlert({
                                      id: `alert-${Date.now()}-${pos.symbol}`,
                                      symbol: pos.symbol,
                                      name: pos.name || pos.symbol,
                                      targetPrice: parseFloat(alertTargetPrice),
                                      condition: alertCondition,
                                      triggered: false,
                                      createdAt: new Date().toISOString(),
                                    });
                                    setAlertPanelPosition(null);
                                    showNotification('success', `已设置预警：${pos.symbol} ${alertCondition === 'above' ? '涨到' : '跌到'} ¥${alertTargetPrice}`);
                                  }}
                                  className="px-3 py-1 text-xs bg-accent-primary text-bg-primary rounded hover:bg-accent-primary/90"
                                >
                                  确认
                                </button>
                              </div>
                              {/* 已有预警列表 */}
                              {priceAlerts.filter(a => a.symbol === pos.symbol).map(alert => (
                                <div key={alert.id} className="flex items-center gap-2 text-xs">
                                  <span className={alert.triggered ? 'text-accent-success line-through' : 'text-text-muted'}>
                                    {alert.condition === 'above' ? '涨到' : '跌到'} ¥{alert.targetPrice.toFixed(2)}
                                  </span>
                                  {alert.triggered && <span className="text-accent-success text-[10px]">已触发</span>}
                                  {!alert.triggered && (
                                    <button
                                      onClick={() => removePriceAlert(alert.id)}
                                      className="ml-auto text-text-muted hover:text-accent-danger"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent trades */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
        <h2 className="text-lg font-semibold mb-4">最近交易</h2>
        {trades.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm">
            暂无交易记录
          </div>
        ) : (
          <div className="space-y-3">
            {trades.slice(0, 5).map((trade) => (
              <div key={trade.id} className="flex items-center justify-between py-2 border-b border-border-color/50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    trade.trade_type === 'buy' ? 'bg-accent-success/20 text-accent-success' : 'bg-accent-danger/20 text-accent-danger'
                  )}>
                    {trade.trade_type === 'buy' ? '买入' : '卖出'}
                  </span>
                  <div>
                    <span className="font-mono font-medium">{trade.symbol}</span>
                    <span className="text-text-muted text-xs ml-2">{trade.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">
                    {trade.quantity}股 @ ¥{trade.price.toFixed(2)}
                  </div>
                  <div className="text-text-muted text-xs">
                    {formatDistanceToNow(new Date(trade.timestamp), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FundamentalItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono font-medium text-text-primary">{value}</span>
    </div>
  )
}

function StatCard({
  label,
  value,
  subtext,
  icon,
  valueClass = 'text-text-primary',
}: {
  label: string
  value: string
  subtext?: string
  icon: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color p-4 card-hover">
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-muted text-sm">{label}</span>
        {icon}
      </div>
      <div className={clsx('font-mono text-xl font-bold', valueClass)}>
        {value}
      </div>
      {subtext && (
        <div className={clsx('text-sm font-medium mt-1', valueClass)}>
          {subtext}
        </div>
      )}
    </div>
  )
}
