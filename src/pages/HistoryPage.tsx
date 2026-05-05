import { useState, useEffect } from 'react'
import { useStore } from '../store'
import {
  getBacktestResults,
  getBacktestRecordById,
  deleteBacktestRecordById,
  clearAllBacktestHistory,
  getTradeHistoryRecords,
  deleteTradeRecordById,
  clearAllTradeHistory,
} from '../services/api'
import type { BacktestResponse } from '../types'
import { TradeHistoryRecord } from '../services/db'
import { exportTradesToCSV } from '../services/export'
import {
  Clock,
  Search,
  Trash2,
  Download,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  ComposedChart, Area, BarChart, Bar, Cell,
} from 'recharts'

type TabType = 'backtest' | 'trade'

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<TabType>('backtest')

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
          <Clock size={22} className="text-accent-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">历史记录</h1>
          <p className="text-text-muted text-sm">查看回测历史和交易记录</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-color pb-2">
        <button
          onClick={() => setActiveTab('backtest')}
          className={clsx(
            'px-4 py-2 rounded-t-lg text-sm font-medium transition-colors',
            activeTab === 'backtest'
              ? 'bg-accent-primary/20 text-accent-primary border-b-2 border-accent-primary'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          回测历史
        </button>
        <button
          onClick={() => setActiveTab('trade')}
          className={clsx(
            'px-4 py-2 rounded-t-lg text-sm font-medium transition-colors',
            activeTab === 'trade'
              ? 'bg-accent-primary/20 text-accent-primary border-b-2 border-accent-primary'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          交易历史
        </button>
      </div>

      {activeTab === 'backtest' ? <BacktestHistoryTab /> : <TradeHistoryTab />}
    </div>
  )
}

function BacktestHistoryTab() {
  const { showNotification } = useStore()
  const [records, setRecords] = useState<BacktestResponse[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedRecord, setSelectedRecord] = useState<BacktestResponse | null>(null)

  const loadRecords = async () => {
    setLoading(true)
    try {
      const data = await getBacktestResults(50)
      setRecords(data)
    } catch {
      showNotification('error', '加载回测历史失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [])

  const filteredRecords = records.filter((r) =>
    r.strategy_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条回测记录吗？')) return
    try {
      await deleteBacktestRecordById(id)
      await loadRecords()
      showNotification('success', '删除成功')
    } catch {
      showNotification('error', '删除失败')
    }
  }

  const handleClearAll = async () => {
    if (!confirm('确定要清空所有回测历史吗？此操作不可恢复。')) return
    try {
      await clearAllBacktestHistory()
      setRecords([])
      showNotification('success', '已清空所有回测历史')
    } catch {
      showNotification('error', '清空失败')
    }
  }

  const handleViewDetail = async (id: number) => {
    const record = await getBacktestRecordById(id)
    if (record) {
      setSelectedRecord(record)
    } else {
      // Fallback: use from records list
      const found = records.find((r) => r.id === id)
      if (found) setSelectedRecord(found)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <>
      {/* Search and actions */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索策略名称..."
              className="w-full bg-bg-tertiary border border-border-color rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>
          <button
            onClick={handleClearAll}
            disabled={records.length === 0}
            className="px-4 py-2 text-sm rounded-lg border border-accent-danger/50 text-accent-danger hover:bg-accent-danger/10 disabled:opacity-50 flex items-center gap-2"
          >
            <Trash2 size={14} />
            清空全部
          </button>
        </div>
      </div>

      {/* Records list */}
      {filteredRecords.length === 0 ? (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-12 text-center">
          <BarChart2 size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
          <p className="text-text-muted text-lg mb-2">暂无回测历史</p>
          <p className="text-text-muted text-sm">运行回测后将自动保存到这里</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              className="bg-bg-secondary rounded-xl border border-border-color p-4 hover:border-accent-primary/50 transition-colors cursor-pointer"
              onClick={() => handleViewDetail(record.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-sm truncate max-w-[180px]" title={record.strategy_name}>
                    {record.strategy_name}
                  </h4>
                  <span className="text-text-muted text-xs">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(record.id)
                  }}
                  className="text-text-muted hover:text-accent-danger p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-xs">总收益率</span>
                  <span className={clsx(
                    'font-mono font-semibold',
                    record.total_return >= 0 ? 'text-accent-success' : 'text-accent-danger'
                  )}>
                    {record.total_return >= 0 ? '+' : ''}{record.total_return.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-xs">夏普比率</span>
                  <span className="font-mono text-accent-primary">{record.sharpe_ratio.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-xs">交易次数</span>
                  <span className="font-mono">{record.total_trades}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedRecord && (
        <BacktestDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </>
  )
}

function BacktestDetailModal({
  record,
  onClose,
}: {
  record: BacktestResponse
  onClose: () => void
}) {
  const equityColor = record.total_return >= 0 ? '#10b981' : '#ef4444'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-primary rounded-xl border border-border-color w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-bg-primary border-b border-border-color p-4 flex items-center justify-between">
          <h3 className="font-semibold">{record.strategy_name}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <MetricCard
              label="总收益率"
              value={`${record.total_return >= 0 ? '+' : ''}${record.total_return.toFixed(2)}%`}
              className={record.total_return >= 0 ? 'text-accent-success' : 'text-accent-danger'}
              icon={record.total_return >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            />
            <MetricCard
              label="年化收益"
              value={`${record.annual_return >= 0 ? '+' : ''}${record.annual_return.toFixed(2)}%`}
              className={record.annual_return >= 0 ? 'text-accent-success' : 'text-accent-danger'}
              icon={<TrendingUp size={14} />}
            />
            <MetricCard
              label="最大回撤"
              value={`${record.max_drawdown.toFixed(2)}%`}
              className="text-accent-danger"
              icon={<TrendingDown size={14} />}
            />
            <MetricCard
              label="夏普比率"
              value={record.sharpe_ratio.toFixed(2)}
              className="text-accent-primary"
              icon={<Target size={14} />}
            />
            <MetricCard
              label="胜率"
              value={`${record.win_rate.toFixed(1)}%`}
              className="text-accent-secondary"
              icon={<Target size={14} />}
            />
            <MetricCard
              label="盈亏比"
              value={record.profit_loss_ratio.toFixed(2)}
              className="text-accent-warning"
            />
            <MetricCard
              label="交易次数"
              value={record.total_trades.toString()}
              className="text-text-primary"
              icon={<BarChart2 size={14} />}
            />
          </div>

          {/* Equity Curve */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
            <h4 className="font-semibold mb-3">资金曲线</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={record.equity_curve}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickFormatter={(v) => v.slice(0, 7)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(v: any) => [`¥${v.toLocaleString()}`, '资金']}
                  />
                  <ReferenceLine y={record.equity_curve[0]?.value} stroke="#6b7280" strokeDasharray="3 3" label="初始" />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={equityColor}
                    fill={equityColor}
                    fillOpacity={0.1}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: equityColor }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Returns */}
          {record.monthly_returns && record.monthly_returns.length > 0 && (
            <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
              <h4 className="font-semibold mb-3">月度收益</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={record.monthly_returns}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(v: any) => [`${v.toFixed(2)}%`, '月收益']}
                    />
                    <ReferenceLine y={0} stroke="#374151" />
                    <Bar dataKey="return_pct" radius={[4, 4, 0, 0]}>
                      {record.monthly_returns.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.return_pct >= 0 ? '#10b981' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Trade Log */}
          {record.trades && record.trades.length > 0 && (
            <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
              <h4 className="font-semibold mb-3">交易记录 (共 {record.trades.length} 笔)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-muted border-b border-border-color">
                      <th className="text-left py-2 px-3 font-normal">日期</th>
                      <th className="text-left py-2 px-3 font-normal">标的</th>
                      <th className="text-left py-2 px-3 font-normal">类型</th>
                      <th className="text-right py-2 px-3 font-normal">价格</th>
                      <th className="text-right py-2 px-3 font-normal">数量</th>
                      <th className="text-right py-2 px-3 font-normal">金额</th>
                      <th className="text-right py-2 px-3 font-normal">盈亏</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.trades.map((trade, idx) => (
                      <tr key={idx} className="border-b border-border-color/50 last:border-0">
                        <td className="py-2 px-3 text-text-muted">{trade.date}</td>
                        <td className="py-2 px-3 font-mono">{trade.symbol}</td>
                        <td className="py-2 px-3">
                          <span className={clsx(
                            "px-1.5 py-0.5 rounded text-xs",
                            trade.type === 'buy' ? 'bg-accent-success/20 text-accent-success' : 'bg-accent-danger/20 text-accent-danger'
                          )}>
                            {trade.type === 'buy' ? '买入' : '卖出'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">¥{trade.price.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono">{trade.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono">¥{trade.amount.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {trade.profit !== undefined && (
                            <span className={trade.profit >= 0 ? 'text-accent-success' : 'text-accent-danger'}>
                              {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(0)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TradeHistoryTab() {
  const { showNotification } = useStore()
  const [records, setRecords] = useState<TradeHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [symbolSearch, setSymbolSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'backtest' | 'live'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  const loadRecords = async () => {
    setLoading(true)
    try {
      const data = await getTradeHistoryRecords({ limit: 500 })
      setRecords(data)
    } catch {
      showNotification('error', '加载交易历史失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [])

  const filteredRecords = records.filter((r) => {
    if (symbolSearch && !r.symbol.toLowerCase().includes(symbolSearch.toLowerCase()) &&
        !r.name?.toLowerCase().includes(symbolSearch.toLowerCase())) {
      return false
    }
    if (sourceFilter !== 'all' && r.source !== sourceFilter) {
      return false
    }
    if (startDate && r.timestamp < startDate) {
      return false
    }
    if (endDate && r.timestamp > endDate + 'T23:59:59') {
      return false
    }
    return true
  })

  const totalPages = Math.ceil(filteredRecords.length / pageSize)
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条交易记录吗？')) return
    try {
      await deleteTradeRecordById(id)
      await loadRecords()
      showNotification('success', '删除成功')
    } catch {
      showNotification('error', '删除失败')
    }
  }

  const handleClearAll = async () => {
    if (!confirm('确定要清空所有交易历史吗？此操作不可恢复。')) return
    try {
      await clearAllTradeHistory()
      setRecords([])
      showNotification('success', '已清空所有交易历史')
    } catch {
      showNotification('error', '清空失败')
    }
  }

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      showNotification('info', '没有可导出的数据')
      return
    }
    // Convert TradeHistoryRecord to BacktestTrade format for export
    const trades = filteredRecords.map((r) => ({
      date: r.timestamp.slice(0, 10),
      symbol: r.symbol,
      type: r.trade_type,
      price: r.price,
      quantity: r.quantity,
      amount: r.total_cost,
      profit: r.profit,
    }))
    exportTradesToCSV(trades, `交易历史_${new Date().toISOString().split('T')[0]}`)
    showNotification('success', '已导出CSV')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <>
      {/* Filters */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-text-muted text-xs mb-1">标的搜索</label>
            <input
              type="text"
              value={symbolSearch}
              onChange={(e) => {
                setSymbolSearch(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="股票代码或名称"
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs mb-1">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs mb-1">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs mb-1">来源</label>
            <div className="flex gap-2">
              {(['all', 'backtest', 'live'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSourceFilter(s)
                    setCurrentPage(1)
                  }}
                  className={clsx(
                    'flex-1 px-3 py-2 text-xs rounded-lg border transition-colors',
                    sourceFilter === s
                      ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                      : 'border-border-color text-text-muted hover:border-accent-primary/50'
                  )}
                >
                  {s === 'all' ? '全部' : s === 'backtest' ? '回测' : '实盘'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="px-4 py-2 text-sm rounded-lg border border-accent-primary/50 text-accent-primary hover:bg-accent-primary/10 disabled:opacity-50 flex items-center gap-2"
          >
            <Download size={14} />
            导出CSV
          </button>
          <button
            onClick={handleClearAll}
            disabled={records.length === 0}
            className="px-4 py-2 text-sm rounded-lg border border-accent-danger/50 text-accent-danger hover:bg-accent-danger/10 disabled:opacity-50 flex items-center gap-2"
          >
            <Trash2 size={14} />
            清空全部
          </button>
        </div>
      </div>

      {/* Table */}
      {filteredRecords.length === 0 ? (
        <div className="bg-bg-secondary rounded-xl border border-border-color p-12 text-center">
          <Clock size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
          <p className="text-text-muted text-lg mb-2">暂无交易历史</p>
          <p className="text-text-muted text-sm">执行回测或实盘交易后将自动记录</p>
        </div>
      ) : (
        <>
          <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-muted border-b border-border-color bg-bg-tertiary">
                    <th className="text-left py-3 px-4 font-normal">时间</th>
                    <th className="text-left py-3 px-4 font-normal">标的</th>
                    <th className="text-left py-3 px-4 font-normal">名称</th>
                    <th className="text-left py-3 px-4 font-normal">类型</th>
                    <th className="text-right py-3 px-4 font-normal">价格</th>
                    <th className="text-right py-3 px-4 font-normal">数量</th>
                    <th className="text-right py-3 px-4 font-normal">金额</th>
                    <th className="text-right py-3 px-4 font-normal">盈亏</th>
                    <th className="text-left py-3 px-4 font-normal">来源</th>
                    <th className="text-left py-3 px-4 font-normal">策略</th>
                    <th className="text-right py-3 px-4 font-normal">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record) => (
                    <tr key={record.id} className="border-b border-border-color/50 last:border-0 hover:bg-bg-tertiary/50">
                      <td className="py-2 px-4 text-text-muted">{record.timestamp.slice(0, 16)}</td>
                      <td className="py-2 px-4 font-mono">{record.symbol}</td>
                      <td className="py-2 px-4">{record.name || '-'}</td>
                      <td className="py-2 px-4">
                        <span className={clsx(
                          "px-1.5 py-0.5 rounded text-xs",
                          record.trade_type === 'buy' ? 'bg-accent-success/20 text-accent-success' : 'bg-accent-danger/20 text-accent-danger'
                        )}>
                          {record.trade_type === 'buy' ? '买入' : '卖出'}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right font-mono">¥{record.price.toFixed(2)}</td>
                      <td className="py-2 px-4 text-right font-mono">{record.quantity}</td>
                      <td className="py-2 px-4 text-right font-mono">¥{record.total_cost.toLocaleString()}</td>
                      <td className="py-2 px-4 text-right font-mono">
                        {record.profit !== undefined ? (
                          <span className={record.profit >= 0 ? 'text-accent-success' : 'text-accent-danger'}>
                            {record.profit >= 0 ? '+' : ''}{record.profit.toFixed(0)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-2 px-4">
                        <span className={clsx(
                          "px-1.5 py-0.5 rounded text-xs",
                          record.source === 'backtest' ? 'bg-accent-secondary/20 text-accent-secondary' : 'bg-accent-primary/20 text-accent-primary'
                        )}>
                          {record.source === 'backtest' ? '回测' : '实盘'}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-text-muted text-xs max-w-[120px] truncate" title={record.strategy_name}>
                        {record.strategy_name || '-'}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <button
                          onClick={() => record.id !== undefined && handleDelete(record.id)}
                          className="text-text-muted hover:text-accent-danger p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-sm">
                共 {filteredRecords.length} 条，第 {currentPage}/{totalPages} 页
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-border-color disabled:opacity-50 hover:border-accent-primary/50"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm px-3">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-border-color disabled:opacity-50 hover:border-accent-primary/50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

function MetricCard({
  label,
  value,
  icon,
  className = 'text-text-primary',
}: {
  label: string
  value: string
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color p-3">
      <div className="flex items-center gap-1.5 mb-1.5 text-text-muted text-xs">
        {icon}
        {label}
      </div>
      <div className={clsx('font-mono text-lg font-bold', className)}>{value}</div>
    </div>
  )
}
