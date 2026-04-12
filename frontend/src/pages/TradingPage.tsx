/**
 * Trading Page - Simulated Trading & Portfolio Management
 */
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { getPortfolio, executeTrade, getTrades, resetPortfolio, searchStocks } from "../services/api";
import type { StockInfo } from "../types";

export default function TradingPage() {
  const { portfolio, setPortfolio, trades, setTrades, addTrade, showNotification } = useStore();
  const [tab, setTab] = useState<"positions" | "trade" | "history">("positions");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);

  const loadPortfolio = async () => {
    try {
      const p = await getPortfolio();
      setPortfolio(p);
    } catch (e) {
      console.error(e);
    }
  };

  const loadTrades = async () => {
    try {
      const t = await getTrades(50);
      setTrades(t);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPortfolio();
    loadTrades();
  }, []);

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
  };

  const handleTrade = async () => {
    if (!symbol || !quantity) return;
    setLoading(true);
    try {
      const trade = await executeTrade({
        symbol,
        name: name || symbol,
        trade_type: tradeType,
        quantity: parseInt(quantity),
      });
      addTrade(trade);
      await loadPortfolio();
      setSymbol(""); setName(""); setQuantity("");
      showNotification("success", `${tradeType === "buy" ? "买入" : "卖出"}成功！`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "交易失败";
      showNotification("error", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("确定要清空所有持仓和交易记录吗？初始资金将恢复为100万元。")) return;
    try {
      await resetPortfolio();
      await loadPortfolio();
      setTrades([]);
      showNotification("success", "模拟账户已重置");
    } catch (e) {
      showNotification("error", "重置失败");
    }
  };

  const formatMoney = (n: number) => n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Portfolio Summary */}
      {portfolio && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "总资产", value: `¥${formatMoney(portfolio.total_assets)}`, color: "text-slate-800" },
            { label: "持仓市值", value: `¥${formatMoney(portfolio.total_market_value)}`, color: "text-slate-800" },
            { label: "可用资金", value: `¥${formatMoney(portfolio.cash)}`, color: "text-green-600" },
            { label: "累计收益", value: `${portfolio.total_profit_loss >= 0 ? "+" : ""}¥${formatMoney(portfolio.total_profit_loss)}`, color: portfolio.total_profit_loss >= 0 ? "text-red-500" : "text-green-500" },
            { label: "持仓股票", value: `${portfolio.positions.length} 只`, color: "text-blue-600" },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs mb-1">{card.label}</p>
              <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(["positions", "trade", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "positions" ? "持仓" : t === "trade" ? "交易" : "历史"}
            </button>
          ))}
        </div>

        {/* Positions Tab */}
        {tab === "positions" && (
          <div>
            {portfolio && portfolio.positions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      <th className="text-left px-5 py-2">股票</th>
                      <th className="text-right px-3">持仓数量</th>
                      <th className="text-right px-3">成本价</th>
                      <th className="text-right px-3">现价</th>
                      <th className="text-right px-3">市值</th>
                      <th className="text-right px-3">盈亏</th>
                      <th className="text-right px-3">盈亏%</th>
                      <th className="text-right px-5">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {portfolio!.positions.map((pos) => (
                      <tr key={pos.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800 text-sm">{pos.name}</p>
                          <p className="text-xs text-gray-400">{pos.symbol}</p>
                        </td>
                        <td className="text-right px-3 py-3 text-sm">{pos.quantity}</td>
                        <td className="text-right px-3 py-3 text-sm">¥{pos.avg_cost.toFixed(2)}</td>
                        <td className="text-right px-3 py-3 text-sm font-medium">¥{pos.current_price.toFixed(2)}</td>
                        <td className="text-right px-3 py-3 text-sm">¥{formatMoney(pos.market_value)}</td>
                        <td className={`text-right px-3 py-3 text-sm font-medium ${pos.profit_loss >= 0 ? "text-red-500" : "text-green-500"}`}>
                          {pos.profit_loss >= 0 ? "+" : ""}¥{formatMoney(pos.profit_loss)}
                        </td>
                        <td className={`text-right px-3 py-3 text-sm font-medium ${pos.profit_loss >= 0 ? "text-red-500" : "text-green-500"}`}>
                          {pos.profit_loss >= 0 ? "+" : ""}{pos.profit_loss_pct.toFixed(2)}%
                        </td>
                        <td className="text-right px-5 py-3">
                          <button
                            onClick={() => { setSymbol(pos.symbol); setName(pos.name); setTradeType("sell"); setTab("trade"); }}
                            className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded hover:bg-red-100"
                          >
                            卖出
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-gray-500">暂无持仓</p>
                <button onClick={() => setTab("trade")} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                  去交易
                </button>
              </div>
            )}

            {portfolio && portfolio.positions.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center">
                <button onClick={handleReset} className="text-xs text-red-500 hover:underline">
                  重置模拟账户
                </button>
                <button onClick={loadPortfolio} className="text-xs text-blue-500 hover:underline">
                  刷新行情
                </button>
              </div>
            )}
          </div>
        )}

        {/* Trade Tab */}
        {tab === "trade" && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">股票代码</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => handleSymbolSearch(e.target.value)}
                  placeholder="输入股票代码或名称搜索"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {searchResults.length > 0 && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-sm max-h-40 overflow-y-auto">
                    {searchResults.map((s) => (
                      <button
                        key={s.symbol}
                        onClick={() => selectStock(s)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium">{s.symbol}</span> {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">股票名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="自动填充或手动输入"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">买入/卖出</label>
                <div className="flex gap-2">
                  {(["buy", "sell"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTradeType(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                        tradeType === t
                          ? t === "buy" ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700"
                          : "border-gray-200 text-gray-500"
                      }`}
                    >
                      {t === "buy" ? "买入" : "卖出"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">数量（股）</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="输入购买数量"
                  min="1"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {symbol && quantity && (
              <div className="bg-gray-50 rounded-lg p-4 text-sm">
                <p className="text-gray-500">预估交易额：市价成交（实际价格以下单时价格为准）</p>
              </div>
            )}

            <button
              onClick={handleTrade}
              disabled={loading || !symbol || !quantity}
              className={`w-full py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
                tradeType === "buy"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
            >
              {loading ? "处理中..." : `${tradeType === "buy" ? "买入" : "卖出"} ${symbol || ""} ${quantity ? quantity + "股" : ""}`}
            </button>
          </div>
        )}

        {/* History Tab */}
        {tab === "history" && (
          <div>
            {trades.length > 0 ? (
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {trades.map((t) => (
                  <div key={t.id} className="px-5 py-3 hover:bg-gray-50 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${t.trade_type === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {t.trade_type === "buy" ? "买入" : "卖出"}
                        </span>
                        <span className="text-sm font-medium text-slate-800">{t.name}</span>
                        <span className="text-xs text-gray-400">{t.symbol}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(t.timestamp).toLocaleString("zh-CN")} · ¥{t.price.toFixed(2)} × {t.quantity}股 · 手续费¥{t.commission.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">¥{formatMoney(t.price * t.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-gray-500">暂无交易记录</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
