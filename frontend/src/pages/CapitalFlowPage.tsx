import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import clsx from 'clsx'

// Types
interface SectorFlow {
  sector: string
  flow: number // in 亿
  change: number
}

interface StockFlow {
  time: string
  inflow: number
  outflow: number
  net: number
}

// Mock data generators
function generateSectorFlow(): SectorFlow[] {
  const sectors = ['科技', '医药', '消费', '金融', '新能源', '地产', '军工', '化工']
  return sectors.map(sector => ({
    sector,
    flow: Math.round((Math.random() - 0.3) * 100 * 100) / 100,
    change: Math.round((Math.random() - 0.5) * 10 * 100) / 100,
  })).sort((a, b) => b.flow - a.flow)
}

function generateStockFlow(): StockFlow[] {
  const times = ['09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00']
  let net = 0
  return times.map(time => {
    const inflow = Math.round(Math.random() * 5000)
    const outflow = Math.round(Math.random() * 4000)
    net += (inflow - outflow) / 100
    return {
      time,
      inflow: Math.round(inflow / 100 * 100) / 100,
      outflow: Math.round(outflow / 100 * 100) / 100,
      net: Math.round(net * 100) / 100,
    }
  })
}

// Stock list for individual flow
const STOCKS = [
  { symbol: '600519', name: '贵州茅台' },
  { symbol: '000001', name: '平安银行' },
  { symbol: '000002', name: '万科A' },
  { symbol: '600036', name: '招商银行' },
  { symbol: '300750', name: '宁德时代' },
  { symbol: '601318', name: '中国平安' },
  { symbol: '000333', name: '美的集团' },
  { symbol: '002594', name: '比亚迪' },
]

type TabType = 'sector' | 'stock'

export default function CapitalFlowPage() {
  const [activeTab, setActiveTab] = useState<TabType>('sector')
  const [sectorData, setSectorData] = useState<SectorFlow[]>(generateSectorFlow())
  const [stockFlowData, setStockFlowData] = useState<StockFlow[]>(generateStockFlow())
  const [selectedStock, setSelectedStock] = useState(STOCKS[0])
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Refresh data every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSectorData(generateSectorFlow())
      setStockFlowData(generateStockFlow())
      setLastUpdate(new Date())
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setSectorData(generateSectorFlow())
    setStockFlowData(generateStockFlow())
    setLastUpdate(new Date())
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const handleStockChange = (stock: typeof STOCKS[0]) => {
    setSelectedStock(stock)
    setStockFlowData(generateStockFlow())
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">资金流向分析</h1>
          <p className="text-sm text-text-muted mt-1">
            实时监控板块与个股资金流向
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            最后更新: {lastUpdate.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            className={clsx(
              'p-2 rounded-lg bg-bg-secondary border border-border-color hover:border-accent-primary/50 transition-colors',
              isRefreshing && 'animate-spin'
            )}
          >
            <RefreshCw size={16} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-bg-secondary rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('sector')}
          className={clsx(
            'px-4 py-2 rounded-md text-sm font-medium transition-all',
            activeTab === 'sector'
              ? 'bg-accent-primary text-bg-primary'
              : 'text-text-secondary hover:text-text-primary'
          )}
        >
          板块
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          className={clsx(
            'px-4 py-2 rounded-md text-sm font-medium transition-all',
            activeTab === 'stock'
              ? 'bg-accent-primary text-bg-primary'
              : 'text-text-secondary hover:text-text-primary'
          )}
        >
          个股
        </button>
      </div>

      {/* Content */}
      {activeTab === 'sector' ? (
        <SectorFlowView data={sectorData} />
      ) : (
        <StockFlowView
          data={stockFlowData}
          stocks={STOCKS}
          selectedStock={selectedStock}
          onStockChange={handleStockChange}
        />
      )}
    </div>
  )
}

function SectorFlowView({ data }: { data: SectorFlow[] }) {
  const totalInflow = data.filter(d => d.flow > 0).reduce((sum, d) => sum + d.flow, 0)
  const totalOutflow = Math.abs(data.filter(d => d.flow < 0).reduce((sum, d) => sum + d.flow, 0))

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-accent-primary" />
            <span className="text-sm text-text-muted">主力净流入</span>
          </div>
          <p className="text-2xl font-mono font-bold text-accent-primary">
            +{totalInflow.toFixed(2)} 亿
          </p>
        </div>
        <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} className="text-red-500" />
            <span className="text-sm text-text-muted">主力净流出</span>
          </div>
          <p className="text-2xl font-mono font-bold text-red-500">
            -{totalOutflow.toFixed(2)} 亿
          </p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-bg-secondary border border-border-color rounded-xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">板块资金流向 (单位: 亿)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 60, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={true} vertical={false} />
              <XAxis
                type="number"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={{ stroke: '#374151' }}
                tickFormatter={(v) => v.toFixed(0)}
              />
              <YAxis
                type="category"
                dataKey="sector"
                tick={{ fill: '#D1D5DB', fontSize: 13 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={{ stroke: '#374151' }}
                width={55}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F3F4F6',
                }}
                formatter={(value: number) => [`${value.toFixed(2)} 亿`, '资金流向']}
                labelStyle={{ color: '#D1D5DB' }}
              />
              <Bar
                dataKey="flow"
                radius={[0, 4, 4, 0]}
                maxBarSize={30}
              >
                {data.map((entry, index) => (
                  <rect key={index} fill={entry.flow >= 0 ? '#10B981' : '#EF4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sector Table */}
      <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-color">
              <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">板块</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-text-muted">净流入 (亿)</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-text-muted">涨跌幅</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.sector} className="border-b border-border-color/50 hover:bg-bg-tertiary/50 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-medium text-text-primary">{item.sector}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={clsx(
                    'font-mono',
                    item.flow >= 0 ? 'text-accent-primary' : 'text-red-500'
                  )}>
                    {item.flow >= 0 ? '+' : ''}{item.flow.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={clsx(
                    'font-mono',
                    item.change >= 0 ? 'text-accent-primary' : 'text-red-500'
                  )}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StockFlowView({
  data,
  stocks,
  selectedStock,
  onStockChange,
}: {
  data: StockFlow[]
  stocks: typeof STOCKS
  selectedStock: typeof STOCKS[0]
  onStockChange: (stock: typeof STOCKS[0]) => void
}) {
  const totalNet = data.reduce((sum, d) => sum + d.net, 0)
  const maxInflow = Math.max(...data.map(d => d.inflow))
  const maxOutflow = Math.max(...data.map(d => d.outflow))

  return (
    <div className="space-y-6">
      {/* Stock Selector */}
      <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
        <label className="block text-sm text-text-muted mb-2">选择股票</label>
        <div className="flex flex-wrap gap-2">
          {stocks.map((stock) => (
            <button
              key={stock.symbol}
              onClick={() => onStockChange(stock)}
              className={clsx(
                'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                selectedStock.symbol === stock.symbol
                  ? 'bg-accent-primary text-bg-primary'
                  : 'bg-bg-tertiary text-text-secondary hover:text-text-primary border border-border-color'
              )}
            >
              {stock.name} ({stock.symbol})
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-accent-primary" />
            <span className="text-sm text-text-muted">当日主力净流入</span>
          </div>
          <p className={clsx(
            'text-2xl font-mono font-bold',
            totalNet >= 0 ? 'text-accent-primary' : 'text-red-500'
          )}>
            {totalNet >= 0 ? '+' : ''}{totalNet.toFixed(2)} 亿
          </p>
        </div>
        <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-green-400" />
            <span className="text-sm text-text-muted">最大流入时刻</span>
          </div>
          <p className="text-2xl font-mono font-bold text-text-primary">
            {data.find(d => d.inflow === maxInflow)?.time || '--'}
          </p>
        </div>
        <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} className="text-red-400" />
            <span className="text-sm text-text-muted">最大流出时刻</span>
          </div>
          <p className="text-2xl font-mono font-bold text-text-primary">
            {data.find(d => d.outflow === maxOutflow)?.time || '--'}
          </p>
        </div>
      </div>

      {/* Inflow/Outflow Area Chart */}
      <div className="bg-bg-secondary border border-border-color rounded-xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          {selectedStock.name} ({selectedStock.symbol}) 分时资金流向
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 10, right: 20 }}>
              <defs>
                <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={{ stroke: '#374151' }}
              />
              <YAxis
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={{ stroke: '#374151' }}
                tickFormatter={(v) => v.toFixed(0)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F3F4F6',
                }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(2)} 亿`,
                  name === 'inflow' ? '流入' : name === 'outflow' ? '流出' : '净流入'
                ]}
                labelStyle={{ color: '#D1D5DB' }}
              />
              <Area
                type="monotone"
                dataKey="inflow"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#colorInflow)"
                name="inflow"
              />
              <Area
                type="monotone"
                dataKey="outflow"
                stroke="#EF4444"
                strokeWidth={2}
                fill="url(#colorOutflow)"
                name="outflow"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Net Flow Line Chart */}
      <div className="bg-bg-secondary border border-border-color rounded-xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">净流入走势</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={{ stroke: '#374151' }}
              />
              <YAxis
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={{ stroke: '#374151' }}
                tickFormatter={(v) => v.toFixed(0)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F3F4F6',
                }}
                formatter={(value: number) => [`${value.toFixed(2)} 亿`, '净流入']}
                labelStyle={{ color: '#D1D5DB' }}
              />
              <Line
                type="monotone"
                dataKey="net"
                stroke="#6366F1"
                strokeWidth={2}
                dot={{ fill: '#6366F1', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
