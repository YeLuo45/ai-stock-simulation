/**
 * Technical Analysis Page - AI-powered chart analysis
 */
import { useState } from "react";
import { useStore } from "../store";
import { technicalAnalysis, getIndicators, searchStocks } from "../services/api";
import type { TechnicalAnalysis, StockInfo } from "../types";

export default function AnalysisPage() {
  const { showNotification } = useStore();
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TechnicalAnalysis | null>(null);
  const [indicators, setIndicators] = useState<Record<string, number>>({});

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
  };

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
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-slate-800 mb-1">📈 AI 技术分析</h2>
        <p className="text-gray-400 text-sm mb-4">输入股票代码，AI 将解读 K 线和技术指标并给出压力位/支撑位</p>

        {/* Search */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={symbol}
              onChange={(e) => handleSymbolSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
              placeholder="输入股票代码或名称"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-sm z-10 max-h-48 overflow-y-auto">
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
          <button
            onClick={runAnalysis}
            disabled={loading || !symbol}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? "分析中..." : "开始分析"}
          </button>
        </div>
      </div>

      {/* Results */}
      {analysis && (
        <>
          {/* Stock Header */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{analysis.name}</h3>
                <p className="text-sm text-gray-400">{analysis.symbol}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">¥{analysis.current_price.toFixed(2)}</p>
                <p className="text-sm text-gray-400">
                  {name && <span>支持: ¥{(analysis.support_resistance.support).toFixed(2)} | 压力: ¥{(analysis.support_resistance.resistance).toFixed(2)}</span>}
                </p>
              </div>
            </div>
          </div>

          {/* AI Summary */}
          {analysis.ai_summary && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
              <h4 className="font-semibold text-blue-800 text-sm mb-2">🧠 AI 综合技术面解读</h4>
              <p className="text-blue-700 text-sm whitespace-pre-wrap">{analysis.ai_summary}</p>
            </div>
          )}

          {/* Indicators */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h4 className="font-semibold text-slate-800 mb-4">技术指标</h4>
            <div className="space-y-4">
              {indicatorGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-xs text-gray-400 mb-2">{group.label}</p>
                  <div className="flex flex-wrap gap-3">
                    {group.items.map((item) => (
                      <div key={item.key} className="bg-gray-50 rounded-lg px-3 py-2 min-w-[80px]">
                        <p className="text-xs text-gray-400">{item.label}</p>
                        <p className="text-sm font-bold text-slate-800">
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
                  <p className="text-xs text-gray-400 mb-2">RSI</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-400">RSI(14)</p>
                      <p className={`text-sm font-bold ${
                        indicators.RSI > 70 ? "text-red-500" : indicators.RSI < 30 ? "text-green-500" : "text-slate-800"
                      }`}>
                        {indicators.RSI.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <div className="text-center">
                        <p className="text-xs text-gray-400">超买</p>
                        <p className="text-xs text-red-500">70</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400">超卖</p>
                        <p className="text-xs text-green-500">30</p>
                      </div>
                    </div>
                  </div>
                  {/* RSI Bar */}
                  <div className="mt-2 h-2 bg-gray-100 rounded-full relative">
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
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
              <p className="text-xs text-gray-400 mb-2">支撑位</p>
              <p className="text-2xl font-bold text-green-600">¥{analysis.support_resistance.support.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
              <p className="text-xs text-gray-400 mb-2">压力位</p>
              <p className="text-2xl font-bold text-red-600">¥{analysis.support_resistance.resistance.toFixed(2)}</p>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && !analysis && (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-gray-500">输入股票代码开始分析</p>
          <p className="text-gray-400 text-xs mt-2">支持沪深A股所有股票</p>
        </div>
      )}
    </div>
  );
}
