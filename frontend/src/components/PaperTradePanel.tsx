/**
 * PaperTradePanel - Simulated Real Trading UI
 * Displays positions, orders, PnL, and comparison with backtest results
 */
import { useState, useEffect, useCallback } from 'react';
import { getPaperTradeEngine, type PaperTradeSnapshot, type PaperPosition, type PaperOrder } from '../agents/PaperTradeEngine';
import { useStore } from '../store';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowDownUp,
  History,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PiggyBank,
} from 'lucide-react';
import clsx from 'clsx';

const PAPER_TRADE_KEY = 'paper_trade_snapshots';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatMoney(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PnLBadge({ value, pct }: { value: number; pct: number }) {
  const positive = value >= 0;
  return (
    <div className={clsx('flex flex-col items-end', positive ? 'text-red-500' : 'text-green-500')}>
      <span className="text-sm font-semibold flex items-center gap-1">
        {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {positive ? '+' : ''}{formatMoney(value)}
      </span>
      <span className="text-xs opacity-75">{positive ? '+' : ''}{pct.toFixed(2)}%</span>
    </div>
  );
}

interface BacktestMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}

export default function PaperTradePanel() {
  const { showNotification } = useStore();
  const [snapshot, setSnapshot] = useState<PaperTradeSnapshot | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [comparison, setComparison] = useState<{
    paperTrade: PaperTradeSnapshot | null;
    backtest: BacktestMetrics | null;
    traceId: string;
  } | null>(null);

  const engine = getPaperTradeEngine();

  // Refresh snapshot from engine state
  const refresh = useCallback(() => {
    const snap = engine.getSnapshot('current');
    setSnapshot(snap);
    // Load comparison from localStorage
    const stored = localStorage.getItem(PAPER_TRADE_KEY);
    if (stored) {
      try {
        setComparison(JSON.parse(stored));
      } catch { /* ignore */ }
    }
  }, [engine]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleReset = () => {
    engine.reset();
    localStorage.removeItem(PAPER_TRADE_KEY);
    setComparison(null);
    refresh();
    showNotification('info', 'Paper Trade 已重置');
  };

  const handleSaveComparison = (traceId: string, backtestMetrics: BacktestMetrics) => {
    const snap = engine.getSnapshot(traceId);
    const data = { paperTrade: snap, backtest: backtestMetrics, traceId };
    localStorage.setItem(PAPER_TRADE_KEY, JSON.stringify(data));
    setComparison(data);
  };

  // Expose save function globally for Supervisor to call
  useEffect(() => {
    (window as any).__paperTradeSaveComparison = handleSaveComparison;
  }, []);

  if (!snapshot) return null;

  const { balance, initialBalance, positions, orders, realizedPnL, unrealizedPnL, totalPnL, totalPnLPct } = snapshot;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="text-indigo-500" size={20} />
          <h3 className="font-semibold text-slate-800">模拟实盘 (Paper Trade)</h3>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
        >
          <RotateCcw size={12} /> 重置
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-100">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className="text-indigo-500" />
            <span className="text-xs font-medium text-indigo-600">现金余额</span>
          </div>
          <div className="text-xl font-bold text-indigo-700">{formatMoney(balance)}</div>
          <div className="text-xs text-indigo-400 mt-1">
            初始: {formatMoney(initialBalance)}
          </div>
        </div>

        {/* Total PnL Card */}
        <div className={clsx(
          'rounded-xl p-4 border',
          totalPnL >= 0 ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-100' : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className={totalPnL >= 0 ? 'text-red-500' : 'text-green-500'} />
            <span className="text-xs font-medium text-slate-500">总盈亏</span>
          </div>
          <PnLBadge value={totalPnL} pct={totalPnLPct} />
          <div className="flex gap-3 mt-2 text-xs">
            <span className="text-slate-500">已实现: <span className={realizedPnL >= 0 ? 'text-red-500' : 'text-green-500'}>{realizedPnL >= 0 ? '+' : ''}{formatMoney(realizedPnL)}</span></span>
            <span className="text-slate-500">未实现: <span className={unrealizedPnL >= 0 ? 'text-red-500' : 'text-green-500'}>{unrealizedPnL >= 0 ? '+' : ''}{formatMoney(unrealizedPnL)}</span></span>
          </div>
        </div>
      </div>

      {/* Positions */}
      {positions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-600 flex items-center gap-1">
            <ArrowDownUp size={14} /> 持仓 ({positions.length})
          </h4>
          <div className="space-y-2">
            {positions.map(pos => (
              <PositionCard key={pos.symbol} pos={pos} />
            ))}
          </div>
        </div>
      )}

      {/* Order History Toggle */}
      {orders.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowOrders(v => !v)}
            className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            <History size={14} />
            订单历史 ({orders.length})
            {showOrders ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showOrders && (
            <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr className="text-slate-500">
                    <th className="text-left p-2">时间</th>
                    <th className="text-left p-2">股票</th>
                    <th className="text-center p-2">方向</th>
                    <th className="text-right p-2">数量</th>
                    <th className="text-right p-2">价格</th>
                    <th className="text-right p-2">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice().reverse().map(order => (
                    <tr key={order.id} className="border-t border-slate-100">
                      <td className="p-2 text-slate-400">{formatTime(order.timestamp)}</td>
                      <td className="p-2 font-medium text-slate-700">{order.symbol}</td>
                      <td className="p-2 text-center">
                        <span className={clsx('px-1.5 py-0.5 rounded text-xs font-medium', order.action === 'buy' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600')}>
                          {order.action === 'buy' ? '买入' : '卖出'}
                        </span>
                      </td>
                      <td className="p-2 text-right text-slate-600">{order.quantity}</td>
                      <td className="p-2 text-right text-slate-600">{formatMoney(order.price)}</td>
                      <td className="p-2 text-right font-medium text-slate-700">{formatMoney(order.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Comparison with Backtest */}
      {comparison && comparison.backtest && (
        <ComparisonCard comparison={comparison} />
      )}
    </div>
  );
}

function PositionCard({ pos }: { pos: PaperPosition }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{pos.symbol}</span>
          <span className="text-xs text-slate-400">{pos.name}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span>持股 {pos.shares}</span>
          <span>成本 {formatMoney(pos.avgCost)}</span>
          <span>现价 {formatMoney(pos.currentPrice)}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="font-semibold text-slate-700">{formatMoney(pos.marketValue)}</span>
        <PnLBadge value={pos.unrealizedPnL} pct={pos.unrealizedPnLPct} />
      </div>
    </div>
  );
}

function ComparisonCard({ comparison }: { comparison: { paperTrade: PaperTradeSnapshot; backtest: BacktestMetrics; traceId: string } }) {
  const { paperTrade, backtest } = comparison;
  const paperReturn = paperTrade.totalPnLPct;
  const backtestReturn = backtest.totalReturn;
  const diff = paperReturn - backtestReturn;

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200 space-y-3">
      <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
        <BarChart3 size={14} /> 模拟实盘 vs 回测 对比
      </h4>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="text-xs text-slate-500 mb-1">模拟实盘收益</div>
          <div className={clsx('font-bold text-lg', paperReturn >= 0 ? 'text-red-500' : 'text-green-500')}>
            {paperReturn >= 0 ? '+' : ''}{paperReturn.toFixed(2)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">{formatMoney(paperTrade.totalPnL)}</div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="text-xs text-slate-500 mb-1">回测收益率</div>
          <div className={clsx('font-bold text-lg', backtestReturn >= 0 ? 'text-red-500' : 'text-green-500')}>
            {backtestReturn >= 0 ? '+' : ''}{backtestReturn.toFixed(2)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">夏普 {backtest.sharpeRatio.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="text-xs text-slate-500 mb-1">差异</div>
          <div className={clsx('font-bold text-lg', diff >= 0 ? 'text-red-500' : 'text-green-500')}>
            {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {diff >= 0 ? '实盘跑赢' : '实盘跑输'}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
        <div>胜率: 回测 {backtest.winRate.toFixed(1)}% | 实盘 {paperTrade.orders.filter(o => o.action === 'sell').length > 0 ? '—' : '持仓中'}</div>
        <div>最大回撤: 回测 {backtest.maxDrawdown.toFixed(2)}%</div>
      </div>
    </div>
  );
}
