import { useStore } from '../store'
import { TrendingUp, TrendingDown, Wallet, PieChart, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

export default function HomePage() {
  const { portfolio, trades, isLoading, setPage } = useStore()

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
                  <tr key={pos.id} className="border-b border-border-color/50 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="py-3 px-2">
                      <div className="font-mono font-medium">{pos.symbol}</div>
                      <div className="text-text-muted text-xs">{pos.name}</div>
                    </td>
                    <td className="text-right py-3 px-2 font-mono">{pos.quantity}</td>
                    <td className="text-right py-3 px-2 font-mono">¥{pos.avg_cost.toFixed(2)}</td>
                    <td className="text-right py-3 px-2 font-mono">¥{pos.current_price.toFixed(2)}</td>
                    <td className="text-right py-3 px-2 font-mono">¥{pos.market_value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                    <td className={clsx(
                      'text-right py-3 px-2 font-mono font-medium',
                      pos.profit_loss >= 0 ? 'text-accent-success' : 'text-accent-danger'
                    )}>
                      {pos.profit_loss >= 0 ? '+' : ''}{pos.profit_loss_pct.toFixed(2)}%
                    </td>
                  </tr>
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
