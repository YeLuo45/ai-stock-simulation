/**
 * Trading Page - Simulated Trading & Portfolio Management
 * Cyberpunk Terminal Theme
 * Multi-Account Support
 */
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { resetPortfolio, searchStocks, getPortfolio, executeTrade, getTrades } from "../services/api";
import type { StockInfo } from "../types";
import { Search, RefreshCw, Trash2, TrendingUp, TrendingDown, Wallet, History, Briefcase, ArrowUpDown, ChevronLeft, ChevronRight, Filter, Plus, Settings2, X, Check } from "lucide-react";
import clsx from "clsx";

const PAGE_SIZE = 10;

export default function TradingPage() {
  const { portfolio, setPortfolio, trades, setTrades, showNotification, accounts, currentAccountId, setCurrentAccountId, addAccount, deleteAccount, renameAccount } = useStore();
  const [tab, setTab] = useState<"positions" | "trade" | "history">("positions");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingAccountName, setEditingAccountName] = useState("");
  const [newAccountName, setNewAccountName] = useState("");

  // History tab filters & pagination
  const [historyFilter, setHistoryFilter] = useState<"all" | "buy" | "sell">("all");
  const [historyPage, setHistoryPage] = useState(1);

  const loadPortfolio = async () => {
    if (!currentAccountId) return;
    try {
      const data = await getPortfolio(currentAccountId);
      setPortfolio(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadTrades = async () => {
    if (!currentAccountId) return;
    try {
      const data = await getTrades(100, currentAccountId);
      // Handle both array (demo/backend trading.py) and object with trades property (account.py)
      const trades = Array.isArray(data)
        ? data
        : (data as any)?.trades || [];
      setTrades(trades);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPortfolio();
    loadTrades();
  }, [currentAccountId]);

  const handleSymbolSearch = async (kw: string) => {
    setSymbol(kw);
    if (kw.length < 1) { setSearchResults([]); return; }
    try {
      const results = await searchStocks(kw);
      setSearchResults(results.slice(0, 8));
    } catch { setSearchResults([]); }
  };

  const selectStock = (s: StockInfo) => {
    setSymbol(s.symbol);
    setName(s.name);
    setSearchResults([]);
    setSearchFocused(false);
  };

  const handleTrade = async () => {
    if (!symbol || !quantity || !currentAccountId) return;
    setLoading(true);
    try {
      await executeTrade({
        symbol,
        name: name || symbol,
        trade_type: tradeType,
        quantity: parseInt(quantity),
      }, currentAccountId);
      await loadPortfolio();
      await loadTrades();
      setSymbol(""); setName(""); setQuantity("");
      showNotification("success", `${tradeType === "buy" ? "买入" : "卖出"}成功`);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || "交易失败";
      showNotification("error", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!currentAccountId) return;
    if (!confirm("确定要清空所有持仓和交易记录吗？初始资金将恢复为100万元。")) return;
    try {
      await resetPortfolio(currentAccountId);
      await loadPortfolio();
      setTrades([]);
      showNotification("success", "模拟账户已重置");
    } catch (e) {
      showNotification("error", "重置失败");
    }
  };

  const handleQuickSell = (pos: { symbol: string; name: string }) => {
    setSymbol(pos.symbol);
    setName(pos.name);
    setTradeType("sell");
    setTab("trade");
  };

  // ============== Account Management ==============
  const handleSwitchAccount = (accountId: number) => {
    setCurrentAccountId(accountId);
  };

  const handleCreateAccount = () => {
    if (!newAccountName.trim()) return;
    const newId = Date.now();
    addAccount({ id: newId, name: newAccountName.trim(), created_at: new Date().toISOString() });
    setNewAccountName("");
    setCurrentAccountId(newId);
    showNotification("success", `账户"${newAccountName.trim()}"已创建`);
  };

  const handleStartEditAccount = (id: number, name: string) => {
    setEditingAccountId(id);
    setEditingAccountName(name);
  };

  const handleSaveEditAccount = () => {
    if (editingAccountId !== null && editingAccountName.trim()) {
      renameAccount(editingAccountId, editingAccountName.trim());
      showNotification("success", "账户名称已更新");
    }
    setEditingAccountId(null);
    setEditingAccountName("");
  };

  const handleDeleteAccount = (id: number) => {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    if (!confirm(`确定删除账户"${acc.name}"吗？所有持仓和交易记录将被清除，且无法恢复。`)) return;
    deleteAccount(id);
    showNotification("info", `账户"${acc.name}"已删除`);
  };

  const formatMoney = (n: number) => n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filtered and paginated trades
  const filteredTrades = historyFilter === "all"
    ? trades
    : trades.filter(t => t.trade_type === historyFilter);
  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / PAGE_SIZE));
  const paginatedTrades = filteredTrades.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);

  const profitLossColor = (v: number) => v >= 0 ? "text-accent-danger" : "text-accent-success";
  const profitLossSign = (v: number) => v >= 0 ? "+" : "";

  // ============ Account Card ============
  const renderAccountCard = () => {
    if (!portfolio) return null;
    const cards = [
      { label: "可用资金", value: portfolio.cash, icon: <Wallet size={16} />, color: "text-accent-primary" },
      { label: "持仓市值", value: portfolio.total_market_value, icon: <Briefcase size={16} />, color: "text-accent-primary" },
      { label: "总资产", value: portfolio.total_assets, icon: <TrendingUp size={16} />, color: "text-text-primary" },
      { label: "累计收益", value: portfolio.total_profit_loss, icon: portfolio.total_profit_loss >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />, color: profitLossColor(portfolio.total_profit_loss) },
      { label: "收益率", value: portfolio.total_profit_loss_pct, suffix: "%", color: profitLossColor(portfolio.total_profit_loss), isPct: true },
    ];

    return (
      <div className="space-y-3">
        {/* Account Switcher Bar */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-text-muted uppercase tracking-wider">账户:</span>
            <div className="flex gap-1.5">
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => handleSwitchAccount(acc.id)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap",
                    currentAccountId === acc.id
                      ? "bg-accent-primary/10 border-accent-primary/40 text-accent-primary"
                      : "bg-bg-tertiary border-border-color text-text-muted hover:text-text-secondary hover:border-accent-primary/30"
                  )}
                >
                  {acc.name}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowAccountManager(true)}
            className="shrink-0 p-1.5 rounded-lg border border-border-color text-text-muted hover:text-accent-primary hover:border-accent-primary/40 transition-colors"
            title="管理账户"
          >
            <Settings2 size={14} />
          </button>
        </div>

        {/* Account Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {cards.map((card) => (
            <div key={card.label} className="bg-bg-secondary border border-border-color rounded-xl p-4 relative overflow-hidden group hover:border-accent-primary/40 transition-all">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-accent-primary/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-2 mb-2">
                <span className="text-accent-primary/60">{card.icon}</span>
                <span className="text-xs text-text-muted uppercase tracking-wider">{card.label}</span>
              </div>
              <p className={clsx("font-mono text-xl font-bold", card.color)}>
                {card.isPct
                  ? <>{profitLossSign(card.value)}{card.value.toFixed(2)}%</>
                  : <span className={card.color}>¥{formatMoney(card.value)}</span>
                }
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ============ Positions ============
  const renderPositions = () => (
    <div className="space-y-4">
      {portfolio && portfolio.positions.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-color">
                  {["股票", "持仓", "成本价", "现价", "市值", "盈亏额", "盈亏%", "操作"].map(h => (
                    <th key={h} className={clsx(
                      "text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider",
                      h !== "股票" && h !== "操作" && "text-right"
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((pos) => (
                  <tr key={pos.id} className="border-b border-border-color/50 hover:bg-bg-tertiary/30 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-medium text-text-primary text-sm">{pos.name}</p>
                      <p className="text-xs text-text-muted font-mono">{pos.symbol}</p>
                    </td>
                    <td className="text-right px-4 py-4 text-sm text-text-secondary font-mono">{pos.quantity}</td>
                    <td className="text-right px-4 py-4 text-sm text-text-secondary font-mono">¥{pos.avg_cost.toFixed(2)}</td>
                    <td className="text-right px-4 py-4 text-sm text-text-primary font-mono font-medium">¥{pos.current_price.toFixed(2)}</td>
                    <td className="text-right px-4 py-4 text-sm text-text-secondary font-mono">¥{formatMoney(pos.market_value)}</td>
                    <td className={clsx("text-right px-4 py-4 text-sm font-mono font-medium", profitLossColor(pos.profit_loss))}>
                      {profitLossSign(pos.profit_loss)}¥{formatMoney(pos.profit_loss)}
                    </td>
                    <td className={clsx("text-right px-4 py-4 text-sm font-mono font-medium", profitLossColor(pos.profit_loss_pct))}>
                      {profitLossSign(pos.profit_loss_pct)}{pos.profit_loss_pct.toFixed(2)}%
                    </td>
                    <td className="text-right px-4 py-4">
                      <button
                        onClick={() => handleQuickSell(pos)}
                        className="text-xs px-3 py-1.5 rounded border border-accent-danger/40 text-accent-danger hover:bg-accent-danger/10 transition-colors"
                      >
                        卖出
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center px-4 py-3 border-t border-border-color">
            <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-accent-danger/60 hover:text-accent-danger transition-colors">
              <Trash2 size={12} /> 重置账户
            </button>
            <button onClick={loadPortfolio} className="flex items-center gap-1.5 text-xs text-accent-primary/60 hover:text-accent-primary transition-colors">
              <RefreshCw size={12} /> 刷新
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
            <Briefcase size={28} className="text-text-muted" />
          </div>
          <p className="text-text-secondary font-medium mb-1">暂无持仓</p>
          <p className="text-text-muted text-sm mb-4">开始你的第一笔交易吧</p>
          <button onClick={() => setTab("trade")} className="px-5 py-2 rounded-lg bg-accent-primary/10 text-accent-primary text-sm font-medium hover:bg-accent-primary/20 transition-colors">
            去交易
          </button>
        </div>
      )}
    </div>
  );

  // ============ Trade Form ============
  const renderTradeForm = () => {
    const selectedStock = searchResults.find(s => s.symbol === symbol) || (symbol ? { symbol, name, price: 0 } : null);
    const estimatedCost = selectedStock && quantity
      ? parseInt(quantity) * (selectedStock.price || 0) * 1.0003
      : 0;

    return (
      <div className="p-6 space-y-5">
        {/* Buy/Sell Toggle */}
        <div className="flex gap-2">
          {(["buy", "sell"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTradeType(t)}
              className={clsx(
                "flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all",
                tradeType === t
                  ? t === "buy"
                    ? "border-accent-success bg-accent-success/10 text-accent-success shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    : "border-accent-danger bg-accent-danger/10 text-accent-danger shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  : "border-border-color text-text-muted hover:border-text-muted"
              )}
            >
              {t === "buy" ? "买入" : "卖出"}
            </button>
          ))}
        </div>

        {/* Stock Search */}
        <div className="relative">
          <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">股票代码</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={symbol}
              onChange={(e) => handleSymbolSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder="输入股票代码或名称搜索"
              className="w-full pl-9 pr-4 py-2.5 bg-bg-tertiary border border-border-color rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
          </div>
          {searchFocused && searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-bg-secondary border border-border-color rounded-xl shadow-xl overflow-hidden">
              {searchResults.map((s) => (
                <button
                  key={s.symbol}
                  onMouseDown={() => selectStock(s)}
                  className="w-full text-left px-4 py-3 hover:bg-bg-tertiary transition-colors border-b border-border-color/30 last:border-0 flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-accent-primary text-sm font-medium">{s.symbol}</span>
                    <span className="ml-2 text-text-primary text-sm">{s.name}</span>
                  </div>
                  <span className="text-text-muted text-xs font-mono">¥{s.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stock Name */}
        <div>
          <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">股票名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="自动填充或手动输入"
            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-color rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-colors"
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">数量（股）</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="输入购买数量"
            min="1"
            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-color rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-colors font-mono"
          />
        </div>

        {/* Estimated Cost */}
        {symbol && quantity && selectedStock && selectedStock.price > 0 && (
          <div className="bg-bg-tertiary/50 border border-border-color rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs text-text-muted">
              <span>当前价</span>
              <span className="font-mono text-text-secondary">¥{selectedStock.price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-text-muted">
              <span>数量</span>
              <span className="font-mono text-text-secondary">{quantity} 股</span>
            </div>
            <div className="flex justify-between text-xs text-text-muted">
              <span>交易额</span>
              <span className="font-mono text-text-secondary">¥{formatMoney(parseInt(quantity) * selectedStock.price)}</span>
            </div>
            <div className="flex justify-between text-xs text-text-muted">
              <span>手续费 (0.03%)</span>
              <span className="font-mono text-text-secondary">¥{(parseInt(quantity) * selectedStock.price * 0.0003).toFixed(2)}</span>
            </div>
            <div className="border-t border-border-color/50 pt-2 mt-2 flex justify-between items-center">
              <span className="text-xs text-text-muted">预估{tradeType === "buy" ? "支出" : "收入"}</span>
              <span className={clsx("font-mono font-bold text-sm", tradeType === "buy" ? "text-accent-danger" : "text-accent-success")}>
                {tradeType === "buy" ? "-" : "+"}¥{formatMoney(estimatedCost)}
              </span>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleTrade}
          disabled={loading || !symbol || !quantity}
          className={clsx(
            "w-full py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed",
            tradeType === "buy"
              ? "bg-accent-success hover:bg-accent-success/90 text-bg-primary shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
              : "bg-accent-danger hover:bg-accent-danger/90 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]"
          )}
        >
          {loading
            ? <span className="flex items-center justify-center gap-2"><RefreshCw size={14} className="animate-spin" /> 处理中...</span>
            : `${tradeType === "buy" ? "买入" : "卖出"} ${symbol || ""} ${quantity ? quantity + "股" : ""}`
          }
        </button>
      </div>
    );
  };

  // ============ Trade History ============
  const renderHistory = () => (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-text-muted" />
          <div className="flex gap-1">
            {(["all", "buy", "sell"] as const).map(f => (
              <button
                key={f}
                onClick={() => { setHistoryFilter(f); setHistoryPage(1); }}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                  historyFilter === f
                    ? "bg-accent-primary/10 text-accent-primary"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                {f === "all" ? "全部" : f === "buy" ? "买入" : "卖出"}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-text-muted">
          共 {filteredTrades.length} 条记录
        </span>
      </div>

      {/* Table */}
      {paginatedTrades.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-color">
                  {["时间", "股票", "方向", "价格", "数量", "手续费", "总额"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedTrades.map((t) => (
                  <tr key={t.id} className="border-b border-border-color/30 hover:bg-bg-tertiary/20 transition-colors">
                    <td className="px-4 py-3.5 text-xs text-text-muted font-mono whitespace-nowrap">
                      {new Date(t.timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-text-primary font-medium">{t.name}</p>
                      <p className="text-xs text-text-muted font-mono">{t.symbol}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={clsx(
                        "text-xs px-2 py-1 rounded font-medium",
                        t.trade_type === "buy"
                          ? "bg-accent-success/10 text-accent-success border border-accent-success/20"
                          : "bg-accent-danger/10 text-accent-danger border border-accent-danger/20"
                      )}>
                        {t.trade_type === "buy" ? "买入" : "卖出"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-text-secondary font-mono">¥{t.price.toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-sm text-text-secondary font-mono text-right">{t.quantity}</td>
                    <td className="px-4 py-3.5 text-xs text-text-muted font-mono">¥{t.commission.toFixed(2)}</td>
                    <td className={clsx("px-4 py-3.5 text-sm font-mono font-medium text-right", t.trade_type === "buy" ? "text-accent-danger" : "text-accent-success")}>
                      {t.trade_type === "buy" ? "-" : "+"}¥{formatMoney(Math.abs(t.total_cost))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-4 border-t border-border-color">
              <button
                onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                disabled={historyPage === 1}
                className="p-2 rounded-lg border border-border-color text-text-muted hover:text-text-primary hover:border-accent-primary/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setHistoryPage(page)}
                    className={clsx(
                      "w-8 h-8 rounded-lg text-xs font-mono transition-colors",
                      historyPage === page
                        ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/30"
                        : "text-text-muted hover:text-text-primary"
                    )}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                disabled={historyPage === totalPages}
                className="p-2 rounded-lg border border-border-color text-text-muted hover:text-text-primary hover:border-accent-primary/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
            <History size={28} className="text-text-muted" />
          </div>
          <p className="text-text-secondary font-medium mb-1">暂无交易记录</p>
          <p className="text-text-muted text-sm">完成第一笔交易后将显示在这里</p>
        </div>
      )}
    </div>
  );

  // ============ Account Manager Modal ============
  const renderAccountManager = () => {
    if (!showAccountManager) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-md mx-4 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
            <h3 className="text-lg font-bold text-text-primary">账户管理</h3>
            <button
              onClick={() => setShowAccountManager(false)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Account List */}
            <div className="space-y-2">
              <span className="text-xs text-text-muted uppercase tracking-wider">我的账户</span>
              {accounts.map(acc => (
                <div
                  key={acc.id}
                  className={clsx(
                    "flex items-center justify-between px-4 py-3 rounded-xl border transition-all",
                    currentAccountId === acc.id
                      ? "bg-accent-primary/5 border-accent-primary/30"
                      : "bg-bg-tertiary border-border-color hover:border-accent-primary/30"
                  )}
                >
                  {editingAccountId === acc.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingAccountName}
                        onChange={(e) => setEditingAccountName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveEditAccount()}
                        className="flex-1 px-3 py-1.5 bg-bg-primary border border-border-color rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveEditAccount}
                        className="p-1.5 rounded-lg bg-accent-success/10 text-accent-success hover:bg-accent-success/20 transition-colors"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingAccountId(null)}
                        className="p-1.5 rounded-lg bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          "w-2 h-2 rounded-full",
                          currentAccountId === acc.id ? "bg-accent-primary" : "bg-text-muted"
                        )} />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{acc.name}</p>
                          <p className="text-xs text-text-muted">
                            创建于 {new Date(acc.created_at).toLocaleDateString("zh-CN")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEditAccount(acc.id, acc.name)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
                          title="重命名"
                        >
                          <Settings2 size={14} />
                        </button>
                        {accounts.length > 1 && (
                          <button
                            onClick={() => handleDeleteAccount(acc.id)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-accent-danger hover:bg-accent-danger/10 transition-colors"
                            title="删除账户"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Create New Account */}
            <div className="pt-4 border-t border-border-color">
              <span className="text-xs text-text-muted uppercase tracking-wider block mb-3">创建新账户</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateAccount()}
                  placeholder="输入账户名称"
                  className="flex-1 px-4 py-2.5 bg-bg-tertiary border border-border-color rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-colors"
                />
                <button
                  onClick={handleCreateAccount}
                  disabled={!newAccountName.trim()}
                  className="px-4 py-2.5 rounded-xl bg-accent-primary text-bg-primary text-sm font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Plus size={14} /> 创建
                </button>
              </div>
              <p className="text-xs text-text-muted mt-2">新账户初始资金为100万元，独立持仓和交易记录</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Account Cards */}
      {renderAccountCard()}

      {/* Account Manager Modal */}
      {renderAccountManager()}

      {/* Main Panel */}
      <div className="bg-bg-secondary border border-border-color rounded-2xl overflow-hidden">
        {/* Tab Bar */}
        <div className="flex border-b border-border-color">
          {([
            { key: "positions" as const, label: "持仓", icon: <Briefcase size={14} /> },
            { key: "trade" as const, label: "交易", icon: <ArrowUpDown size={14} /> },
            { key: "history" as const, label: "历史", icon: <History size={14} /> },
          ]).map(tabItem => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={clsx(
                "flex items-center gap-2 px-6 py-3.5 text-sm font-medium border-b-2 transition-all",
                tab === tabItem.key
                  ? "border-accent-primary text-accent-primary bg-accent-primary/5"
                  : "border-transparent text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/30"
              )}
            >
              {tabItem.icon}
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {tab === "positions" && renderPositions()}
          {tab === "trade" && renderTradeForm()}
          {tab === "history" && renderHistory()}
        </div>
      </div>
    </div>
  );
}
