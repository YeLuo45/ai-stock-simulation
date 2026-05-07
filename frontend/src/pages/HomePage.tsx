import { useStore } from '../store'
import { TrendingUp, TrendingDown, Wallet, PieChart, RefreshCw, Eye, EyeOff, Bell, BellOff, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import { useState, useCallback, Fragment, useEffect, useRef } from 'react'
import { fetchFundamentalData, getRealtimeQuote } from '../services/yahooFinance'

export default function HomePage() {
  const { portfolio, trades, isLoading, setPage, priceAlerts, addPriceAlert, removePriceAlert, triggerAlert, showNotification } = useStore()

  const [expandedPosition, setExpandedPosition] = useState<string | null>(null);
  const [fundamentalCache, setFundamentalCache] = useState<Record<string, any>>({});
  const [alertPanelPosition, setAlertPanelPosition] = useState<string | null>(null);
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  const alertCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  if (isLoading && !portfolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={32} className="animate-spin text-accent-primary" />
      </div>
    )
  }

  const positions = portfolio?.positions ?? []
  const totalValue = portfolio?.total_assets ?? 1000000
  const profitLoss = portfolio?.total_profit_loss ?? 0
  const profitLossPct = portfolio?.total_profit_loss_pct ?? 0

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
