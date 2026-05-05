/**
 * Technical Analysis Page - AI-powered chart analysis with multi-panel K-line chart
 */
import { useState } from "react";
import { useStore } from "../store";
import { technicalAnalysis, getIndicators, searchStocks } from "../services/api";
import { generatePriceHistory } from "../services/indicators";
import type { OHLCV } from "../services/indicators";
import type { TechnicalAnalysis, StockInfo, StockPool } from "../types";
import KLineChart from "../components/KLineChart";
import { Layers, ChevronDown, Check } from "lucide-react";

export default function AnalysisPage() {
  const { showNotification, stockPools, activePoolId, setActivePoolId } = useStore();
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TechnicalAnalysis | null>(null);
  const [indicators, setIndicators] = useState<Record<string, number>>({});
  const [chartData, setChartData] = useState<OHLCV[]>([]);
  const [poolDropdownOpen, setPoolDropdownOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<"search" | "pool">("search");

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
    setAnalysis(null);
    setIndicators({});
    setSearchMode("search");
    // Generate chart data for the selected stock
    const history = generatePriceHistory(s.price, 120);
    setChartData(history);
  };

  const selectFromPool = (pool: StockPool) => {
    setActivePoolId(pool.id);
    setPoolDropdownOpen(false);
    setSearchMode("pool");
  };

  const activePool = stockPools.find(p => p.id === activePoolId) || null;

  const runAnalysis = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const [a, ind] = await Promise.all([
        technicalAnalysis(symbol, ["MA", "MACD", "KDJ", "RSI", "BOLL"]),
        getIndicators(symbol).catch(() => ({ indicators: {} })),
      ]);
      setAnalysis(a);
      setIndicators(ind.indicators || {});
      // Ensure chart data is loaded
      if (chartData.length === 0) {
        const stock = { symbol, name, price: a.current_price };
        const history = generatePriceHistory(stock.price, 120);
        setChartData(history);
      }
      showNotification("success", "技术分析完成");
    } catch (e: unknown) {
      showNotification("error", "分析失败，请检查股票代码是否正确");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const indicatorGroups = [
    { label: "均线", items: [
      { key: "MA5", label: "MA5" },
      { key: "MA10", label: "MA10" },
      { key: "MA20", label: "MA20" },
      { key: "MA60", label: "MA60" },
    ]},
    { label: "MACD", items: [
      { key: "MACD", label: "DIF" },
      { key: "MACD_SIGNAL", label: "DEA" },
      { key: "MACD_HIST", label: "MACD柱" },
    ]},
    { label: "KDJ", items: [
      { key: "KDJ_K", label: "K" },
      { key: "KDJ_D", label: "D" },
      { key: "KDJ_J", label: "J" },
    ]},
    { label: "BOLL", items: [
      { key: "BOLL_UPPER", label: "上轨" },
      { key: "BOLL_MID", label: "中轨" },
      { key: "BOLL_LOWER", label: "下轨" },
    ]},
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="bg-bg-secondary rounded-xl p-6 border border-border-color">
        <h2 className="text-xl font-bold text-text-primary mb-1">📈 AI 技术分析</h2>
        <p className="text-text-muted text-sm mb-4">输入股票代码，AI 将解读 K 线和技术指标并给出压力位/支撑位</p>

        {/* Search */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={symbol}
              onChange={(e) => handleSymbolSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
              placeholder={searchMode === "pool" && activePool ? `已选择股票池: ${activePool.name}，输入代码搜索` : "输入股票代码或名称"}
              className="w-full px-4 py-3 bg-bg-tertiary border border-border-color rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-bg-secondary border border-border-color rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                {searchResults.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => selectStock(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-bg-tertiary border-b border-border-color/30 last:border-0 transition-colors"
                  >
                    <span className="font-medium text-accent-primary">{s.symbol}</span>
                    <span className="ml-2 text-text-primary">{s.name}</span>
                    <span className="float-right text-text-muted text-xs">¥{s.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stock Pool Selector */}
          {stockPools.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setPoolDropdownOpen(!poolDropdownOpen)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all border ${
                  activePool
                    ? "bg-accent-secondary/10 border-accent-secondary text-accent-secondary"
                    : "bg-bg-tertiary border-border-color text-text-secondary hover:text-text-primary hover:border-accent-primary/50"
                }`}
              >
                <Layers size={18} />
                <span className="hidden sm:inline">
                  {activePool ? activePool.name : "选择股票池"}
                </span>
                <ChevronDown size={14} className={`transition-transform ${poolDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {poolDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-bg-secondary border border-border-color rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto">
                  <div className="p-2 border-b border-border-color">
                    <p className="text-xs text-text-muted px-2">选择股票池以批量分析</p>
                  </div>
                  <button
                    onClick={() => { setActivePoolId(null); setPoolDropdownOpen(false); setSearchMode("search"); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-tertiary transition-colors flex items-center justify-between ${
                      !activePool ? "text-accent-primary" : "text-text-secondary"
                    }`}
                  >
                    <span>不使用股票池</span>
                    {!activePool && <Check size={14} />}
                  </button>
                  {stockPools.map((pool) => (
                    <button
                      key={pool.id}
                      onClick={() => selectFromPool(pool)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-tertiary transition-colors flex items-center justify-between ${
                        activePool?.id === pool.id ? "text-accent-primary" : "text-text-secondary"
                      }`}
                    >
                      <div>
                        <span className="font-medium">{pool.name}</span>
                        <span className="ml-2 text-xs text-text-muted">({pool.stocks.length}只)</span>
                      </div>
                      {activePool?.id === pool.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={runAnalysis}
            disabled={loading || !symbol}
            className="bg-accent-primary text-bg-primary px-6 py-3 rounded-lg font-medium hover:bg-accent-primary/90 disabled:opacity-50 text-sm transition-all shadow-[0_0_15px_rgba(0,212,255,0.3)]"
          >
            {loading ? "分析中..." : "开始分析"}
          </button>
        </div>
      </div>

      {/* Results */}
      {analysis && (
        <>
          {/* Stock Header */}
          <div className="bg-bg-secondary rounded-xl p-5 border border-border-color">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-text-primary">{analysis.name}</h3>
                <p className="text-sm text-text-muted font-mono">{analysis.symbol}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-text-primary">¥{analysis.current_price.toFixed(2)}</p>
                <p className="text-sm text-text-muted">
                  {name && <span>支撑: ¥{(analysis.support_resistance.support).toFixed(2)} | 压力: ¥{(analysis.support_resistance.resistance).toFixed(2)}</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Multi-panel K-line Chart */}
          {chartData.length > 0 && (
            <div className="rounded-xl overflow-hidden border border-border-color">
              <KLineChart data={chartData} symbol={analysis.symbol} />
            </div>
          )}

          {/* AI Summary */}
          {analysis.ai_summary && (
            <div className="bg-gradient-to-r from-accent-primary/10 to-accent-secondary/10 border border-accent-primary/30 rounded-xl p-5">
              <h4 className="font-semibold text-accent-primary text-sm mb-2">🧠 AI 综合技术面解读</h4>
              <p className="text-text-secondary text-sm whitespace-pre-wrap">{analysis.ai_summary}</p>
            </div>
          )}

          {/* Indicators */}
          <div className="bg-bg-secondary rounded-xl p-5 border border-border-color">
            <h4 className="font-semibold text-text-primary mb-4">技术指标</h4>
            <div className="space-y-4">
              {indicatorGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-xs text-text-muted mb-2">{group.label}</p>
                  <div className="flex flex-wrap gap-3">
                    {group.items.map((item) => (
                      <div key={item.key} className="bg-bg-tertiary rounded-lg px-3 py-2 min-w-[80px] border border-border-color/50">
                        <p className="text-xs text-text-muted">{item.label}</p>
                        <p className="text-sm font-bold text-text-primary">
                          {indicators[item.key] !== undefined ? indicators[item.key].toFixed(2) : "--"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* RSI Special */}
              {indicators.RSI !== undefined && (
                <div className="mt-3">
                  <p className="text-xs text-text-muted mb-2">RSI</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-bg-tertiary rounded-lg px-3 py-2 border border-border-color/50">
                      <p className="text-xs text-text-muted">RSI(14)</p>
                      <p className={`text-sm font-bold ${
                        indicators.RSI > 70 ? "text-accent-danger" : indicators.RSI < 30 ? "text-accent-success" : "text-text-primary"
                      }`}>
                        {indicators.RSI.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <div className="text-center">
                        <p className="text-xs text-text-muted">超买</p>
                        <p className="text-xs text-accent-danger">70</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-text-muted">超卖</p>
                        <p className="text-xs text-accent-success">30</p>
                      </div>
                    </div>
                  </div>
                  {/* RSI Bar */}
                  <div className="mt-2 h-2 bg-bg-tertiary rounded-full relative">
                    <div
                      className="absolute top-0 left-0 h-full rounded-full"
                      style={{
                        width: `${Math.min(Math.max(indicators.RSI, 0), 100)}%`,
                        backgroundColor: indicators.RSI > 70 ? "#ef4444" : indicators.RSI < 30 ? "#22c55e" : "#3b82f6"
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Support & Resistance */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-bg-secondary rounded-xl p-5 border border-border-color text-center">
              <p className="text-xs text-text-muted mb-2">支撑位</p>
              <p className="text-2xl font-bold text-accent-success">¥{analysis.support_resistance.support.toFixed(2)}</p>
            </div>
            <div className="bg-bg-secondary rounded-xl p-5 border border-border-color text-center">
              <p className="text-xs text-text-muted mb-2">压力位</p>
              <p className="text-2xl font-bold text-accent-danger">¥{analysis.support_resistance.resistance.toFixed(2)}</p>
            </div>
          </div>
        </>
      )}

      {/* Pool Stock Quick Select */}
      {searchMode === "pool" && activePool && activePool.stocks.length > 0 && (
        <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
          <div className="p-4 border-b border-border-color flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-accent-secondary" />
              <h3 className="font-semibold text-sm">{activePool.name} ({activePool.stocks.length}只)</h3>
            </div>
            <span className="text-xs text-text-muted">点击股票快速分析</span>
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            {activePool.stocks.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => selectStock(stock)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  symbol === stock.symbol
                    ? "bg-accent-primary/10 border-accent-primary text-accent-primary"
                    : "bg-bg-tertiary border-border-color text-text-secondary hover:text-text-primary hover:border-accent-primary/50"
                }`}
              >
                {stock.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !analysis && (
        <div className="bg-bg-secondary rounded-xl p-12 text-center border border-border-color">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-text-secondary font-medium mb-1">输入股票代码开始分析</p>
          <p className="text-text-muted text-sm mt-2">支持沪深A股所有股票</p>
        </div>
      )}
    </div>
  );
}
