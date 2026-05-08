/**
 * Technical Analysis Page - AI-powered chart analysis with multi-panel K-line chart
 * Now also supports batch backtesting with comparison table
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useStore } from "../store";
import { technicalAnalysis, getIndicators, searchStocks, runBatchBacktest, getKlineData, exportReport } from "../services/api";
import { generatePriceHistory } from "../services/indicators";
import type { OHLCV } from "../services/indicators";
import type { TechnicalAnalysis, StockInfo, StockPool, BatchBacktestResult } from "../types";
import KLineChart from "../components/KLineChart";
import { Layers, ChevronDown, Check, X, ArrowUpDown, BarChart2, Loader2, Play, FileText, FileSpreadsheet, FileDown, Download, Newspaper, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import { toCSV, downloadCSV } from "../utils/export";
import { fetchStockNews, analyzeSentiment } from "../services/yahooFinance";

type SortField = "totalReturn" | "sharpeRatio" | "maxDrawdown" | "winRate" | "tradeCount";
type SortDir = "asc" | "desc";

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
  const [klinePeriod, setKlinePeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  // Batch backtest state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<BatchBacktestResult[]>([]);
  const [selectedStrategyType, setSelectedStrategyType] = useState<string>('mean_reversion');
  const [sortField, setSortField] = useState<SortField>("totalReturn");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const cancelRef = useRef(false);

  // News state
  const [stockNews, setStockNews] = useState<Array<{
    title: string;
    pubDate: string;
    url: string;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    if (!symbol || symbol.length !== 6) return;
    
    let cancelled = false;
    
    const loadNews = async () => {
      setNewsLoading(true);
      setStockNews([]);
      
      const news = await fetchStockNews(symbol);
      if (cancelled) return;
      
      // 对每条新闻做情感分析
      const withSentiment = news.map(n => ({
        ...n,
        sentiment: analyzeSentiment(n.title),
      }));
      
      setStockNews(withSentiment);
      setNewsLoading(false);
    };
    
    loadNews();
    return () => { cancelled = true; };
  }, [symbol]);

  const handleSymbolSearch = async (kw: string) => {
    setSymbol(kw);
    if (kw.length < 1) { setSearchResults([]); return; }
    try {
      const results = await searchStocks(kw);
      setSearchResults(results.slice(0, 8));
    } catch { setSearchResults([]); }
  };

  const selectStock = async (s: StockInfo) => {
    setSymbol(s.symbol);
    setName(s.name);
    setSearchResults([]);
    setAnalysis(null);
    setIndicators({});
    setSearchMode("search");
    // Try to load real K-line data
    try {
      const klineResult = await getKlineData(s.symbol, { period: klinePeriod });
      if (klineResult.data && klineResult.data.length > 0) {
        const ohlcvData: OHLCV[] = klineResult.data.map((k) => ({
          date: k.date,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume,
        }));
        setChartData(ohlcvData);
      } else {
        const history = generatePriceHistory(s.price, 120);
        setChartData(history);
      }
    } catch {
      const history = generatePriceHistory(s.price, 120);
      setChartData(history);
    }
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
      if (chartData.length === 0) {
        // Load real K-line data for chart
        try {
          const klineResult = await getKlineData(symbol, { period: klinePeriod });
          if (klineResult.data && klineResult.data.length > 0) {
            const ohlcvData: OHLCV[] = klineResult.data.map((k) => ({
              date: k.date,
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
              volume: k.volume,
            }));
            setChartData(ohlcvData);
          } else {
            const stock = { symbol, name, price: a.current_price };
            const history = generatePriceHistory(stock.price, 120);
            setChartData(history);
          }
        } catch {
          const stock = { symbol, name, price: a.current_price };
          const history = generatePriceHistory(stock.price, 120);
          setChartData(history);
        }
      }
      showNotification("success", "技术分析完成");
    } catch (e: unknown) {
      showNotification("error", "分析失败，请检查股票代码是否正确");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ---- Batch backtest ----
  const importFromPool = useCallback(() => {
    if (!activePool) return;
    const syms = activePool.stocks.map(s => s.symbol);
    setSelectedSymbols(syms);
    showNotification("info", `已导入 ${syms.length} 只股票到回测列表`);
  }, [activePool, showNotification]);

  const toggleSymbol = (sym: string) => {
    setSelectedSymbols(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const runBatchBacktestHandler = async () => {
    if (selectedSymbols.length === 0) {
      showNotification("error", "请先选择至少一个标的");
      return;
    }
    setBatchRunning(true);
    setBatchProgress(0);
    setBatchResults([]);
    setSortField("totalReturn");
    setSortDir("desc");
    cancelRef.current = false;

    try {
      const result = await runBatchBacktest({
        symbols: selectedSymbols,
        start_date: "2023-01-01",
        end_date: "2026-04-01",
        initial_cash: 1_000_000,
        strategy_type: selectedStrategyType as any,
        onProgress: (p) => {
          setBatchProgress(p);
        },
      });

      if (cancelRef.current) {
        showNotification("info", "批量回测已取消");
      } else {
        setBatchResults(result.results);
        setBatchProgress(1);
        showNotification("success", `批量回测完成，成功 ${result.results.length} 个，失败 ${result.failed.length} 个`);
      }
    } catch (e: unknown) {
      showNotification("error", "批量回测失败");
      console.error(e);
    } finally {
      setBatchRunning(false);
    }
  };

  const cancelBatch = () => {
    cancelRef.current = true;
    setBatchRunning(false);
  };

  const sortedResults = [...batchResults].sort((a, b) => {
    const valA = a[sortField === "totalReturn" ? "total_return" :
      sortField === "maxDrawdown" ? "max_drawdown" :
        sortField === "sharpeRatio" ? "sharpe_ratio" :
          sortField === "winRate" ? "win_rate" : "trade_count"];
    const valB = b[sortField === "totalReturn" ? "total_return" :
      sortField === "maxDrawdown" ? "max_drawdown" :
        sortField === "sharpeRatio" ? "sharpe_ratio" :
          sortField === "winRate" ? "win_rate" : "trade_count"];
    const mult = sortDir === "asc" ? 1 : -1;
    return (valA - valB) * mult;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // ---- Export handlers ----
  const handleExportPDF = async () => {
    if (batchResults.length === 0) return;
    try {
      const avgReturn = sortedResults.reduce((s, r) => s + r.total_return, 0) / sortedResults.length;
      const avgDD = sortedResults.reduce((s, r) => s + r.max_drawdown, 0) / sortedResults.length;
      const avgSharpe = sortedResults.reduce((s, r) => s + r.sharpe_ratio, 0) / sortedResults.length;
      const avgWinRate = sortedResults.reduce((s, r) => s + r.win_rate, 0) / sortedResults.length;
      await exportReport({
        type: "pdf",
        strategy_name: `批量回测对比 (${batchResults.length}标的)`,
        start_date: "2023-01-01",
        end_date: "2026-04-01",
        total_return: avgReturn,
        annual_return: avgReturn / 3,
        max_drawdown: Math.abs(avgDD),
        sharpe_ratio: avgSharpe,
        win_rate: avgWinRate,
        total_trades: sortedResults.reduce((s, r) => s + r.trade_count, 0),
        batch_results: sortedResults.map(r => ({
          symbol: r.symbol,
          name: r.name,
          total_return: r.total_return,
          sharpe_ratio: r.sharpe_ratio,
          max_drawdown: r.max_drawdown,
          win_rate: r.win_rate,
          trade_count: r.trade_count,
        })),
      });
      showNotification("success", "PDF 报告已下载");
    } catch (e: unknown) {
      showNotification("error", e instanceof Error ? e.message : "PDF 导出失败");
    }
  };

  const handleExportExcel = async () => {
    if (batchResults.length === 0) return;
    try {
      const avgReturn = sortedResults.reduce((s, r) => s + r.total_return, 0) / sortedResults.length;
      const avgDD = sortedResults.reduce((s, r) => s + r.max_drawdown, 0) / sortedResults.length;
      const avgSharpe = sortedResults.reduce((s, r) => s + r.sharpe_ratio, 0) / sortedResults.length;
      const avgWinRate = sortedResults.reduce((s, r) => s + r.win_rate, 0) / sortedResults.length;
      await exportReport({
        type: "excel",
        strategy_name: `批量回测对比 (${batchResults.length}标的)`,
        start_date: "2023-01-01",
        end_date: "2026-04-01",
        total_return: avgReturn,
        annual_return: avgReturn / 3,
        max_drawdown: Math.abs(avgDD),
        sharpe_ratio: avgSharpe,
        win_rate: avgWinRate,
        total_trades: sortedResults.reduce((s, r) => s + r.trade_count, 0),
        batch_results: sortedResults.map(r => ({
          symbol: r.symbol,
          name: r.name,
          total_return: r.total_return,
          sharpe_ratio: r.sharpe_ratio,
          max_drawdown: r.max_drawdown,
          win_rate: r.win_rate,
          trade_count: r.trade_count,
        })),
      });
      showNotification("success", "Excel 报告已下载");
    } catch (e: unknown) {
      showNotification("error", e instanceof Error ? e.message : "Excel 导出失败");
    }
  };

  const handleExportCSV = async () => {
    if (batchResults.length === 0) return;
    try {
      await exportReport({
        type: "csv",
        strategy_name: `批量回测对比 (${batchResults.length}标的)`,
        start_date: "2023-01-01",
        end_date: "2026-04-01",
        total_return: sortedResults.reduce((s, r) => s + r.total_return, 0) / sortedResults.length,
        annual_return: sortedResults.reduce((s, r) => s + r.total_return, 0) / sortedResults.length / 3,
        max_drawdown: Math.abs(sortedResults.reduce((s, r) => s + r.max_drawdown, 0) / sortedResults.length),
        sharpe_ratio: sortedResults.reduce((s, r) => s + r.sharpe_ratio, 0) / sortedResults.length,
        win_rate: sortedResults.reduce((s, r) => s + r.win_rate, 0) / sortedResults.length,
        total_trades: sortedResults.reduce((s, r) => s + r.trade_count, 0),
        batch_results: sortedResults.map(r => ({
          symbol: r.symbol,
          name: r.name,
          total_return: r.total_return,
          sharpe_ratio: r.sharpe_ratio,
          max_drawdown: r.max_drawdown,
          win_rate: r.win_rate,
          trade_count: r.trade_count,
        })),
      });
      showNotification("success", "CSV 已下载");
    } catch (e: unknown) {
      showNotification("error", e instanceof Error ? e.message : "CSV 导出失败");
    }
  };

  const handleExportKline = useCallback(() => {
    if (chartData.length === 0) {
      showNotification('error', '暂无K线数据可导出');
      return;
    }

    const data = chartData.map(k => ({
      日期: k.date,
      开盘: k.open?.toFixed(2) ?? '',
      最高: k.high?.toFixed(2) ?? '',
      最低: k.low?.toFixed(2) ?? '',
      收盘: k.close?.toFixed(2) ?? '',
      成交量: k.volume ?? '',
    }));

    const columns = [
      { key: '日期' as keyof typeof data[0], header: '日期' },
      { key: '开盘' as keyof typeof data[0], header: '开盘价' },
      { key: '最高' as keyof typeof data[0], header: '最高价' },
      { key: '最低' as keyof typeof data[0], header: '最低价' },
      { key: '收盘' as keyof typeof data[0], header: '收盘价' },
      { key: '成交量' as keyof typeof data[0], header: '成交量' },
    ];

    const csv = toCSV(data as any, columns);
    const filename = symbol ? `K线_${symbol}_${chartData[0]?.date ?? ''}_${chartData[chartData.length - 1]?.date ?? ''}.csv` : `K线_${Date.now()}.csv`;
    downloadCSV(csv, filename);
    showNotification('success', `已导出 ${data.length} 条K线数据`);
  }, [chartData, symbol, showNotification]);

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      size={12}
      className={`inline ml-1 ${sortField === field ? "text-accent-primary" : "text-text-muted"}`}
    />
  );

  // ---- Pool symbol selector for batch mode ----
  // (used for pool-based batch selection)
  const _poolSymbols = activePool?.stocks.map(s => s.symbol) || [];
  void _poolSymbols; // suppress unused warning

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

        {/* Mode toggle */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setBatchMode(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              !batchMode
                ? "bg-accent-primary text-bg-primary"
                : "bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary"
            }`}
          >
            单标的分析
          </button>
          <button
            onClick={() => setBatchMode(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              batchMode
                ? "bg-accent-primary text-bg-primary"
                : "bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary"
            }`}
          >
            批量回测
          </button>
        </div>

        {/* Single stock search */}
        {!batchMode && (
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

            {/* Period toggle */}
            <div className="flex items-center gap-1 bg-bg-tertiary border border-border-color rounded-lg p-1">
              <button
                onClick={() => setKlinePeriod("daily")}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  klinePeriod === "daily"
                    ? "bg-accent-primary text-bg-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                日K
              </button>
              <button
                onClick={() => setKlinePeriod("weekly")}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  klinePeriod === "weekly"
                    ? "bg-accent-primary text-bg-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                周K
              </button>
              <button
                onClick={() => setKlinePeriod("monthly")}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  klinePeriod === "monthly"
                    ? "bg-accent-primary text-bg-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                月K
              </button>
            </div>

            <button
              onClick={handleExportKline}
              className="flex items-center gap-1 px-3 py-1.5 text-text-secondary hover:text-accent-primary transition-colors text-xs"
              title="导出K线数据"
            >
              <Download size={14} />
              导出
            </button>
          </div>
        )}

        {/* Batch mode UI */}
        {batchMode && (
          <div className="space-y-4">
            {/* Pool import bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                {stockPools.length > 0 && (
                  <div className="flex gap-2">
                    <select
                      className="flex-1 bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary"
                      value={activePoolId || ""}
                      onChange={e => {
                        const pool = stockPools.find(p => p.id === e.target.value);
                        if (pool) selectFromPool(pool);
                      }}
                    >
                      <option value="">选择股票池导入</option>
                      {stockPools.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.stocks.length}只)</option>
                      ))}
                    </select>
                    <button
                      onClick={importFromPool}
                      disabled={!activePool}
                      className="px-4 py-2 bg-accent-secondary/10 border border-accent-secondary text-accent-secondary rounded-lg text-sm font-medium hover:bg-accent-secondary/20 disabled:opacity-40 transition-all"
                    >
                      一键导入全部
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Selected symbols chips */}
            {selectedSymbols.length > 0 && (
              <div className="bg-bg-tertiary rounded-lg p-3 border border-border-color">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-muted">
                    已选择 <span className="text-accent-primary font-medium">{selectedSymbols.length}</span> 个标的
                  </span>
                  <button
                    onClick={() => setSelectedSymbols([])}
                    className="text-xs text-text-muted hover:text-accent-danger transition-colors"
                  >
                    清空
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {selectedSymbols.map(sym => (
                    <span
                      key={sym}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-bg-secondary border border-border-color rounded text-xs text-text-primary"
                    >
                      {sym}
                      <button
                        onClick={() => toggleSymbol(sym)}
                        className="text-text-muted hover:text-accent-danger"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pool quick select */}
            {activePool && (
              <div className="bg-bg-tertiary rounded-lg p-3 border border-border-color">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-muted">{activePool.name}</span>
                  <span className="text-xs text-text-muted">点击添加/移除</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activePool.stocks.map(stock => (
                    <button
                      key={stock.symbol}
                      onClick={() => toggleSymbol(stock.symbol)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all border ${
                        selectedSymbols.includes(stock.symbol)
                          ? "bg-accent-primary/10 border-accent-primary text-accent-primary"
                          : "bg-bg-secondary border-border-color text-text-secondary hover:text-text-primary hover:border-accent-primary/50"
                      }`}
                    >
                      {stock.symbol}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Progress bar */}
            {batchRunning && (
              <div className="bg-bg-tertiary rounded-lg p-4 border border-border-color">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-primary">批量回测进行中...</span>
                  <span className="text-sm text-accent-primary font-mono">{Math.round(batchProgress * 100)}%</span>
                </div>
                <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-primary rounded-full transition-all duration-300"
                    style={{ width: `${batchProgress * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Run button */}
            <div className="flex gap-3">
              <select
                value={selectedStrategyType}
                onChange={(e) => setSelectedStrategyType(e.target.value)}
                className="px-3 py-2 bg-bg-secondary border border-border-color rounded-lg text-sm focus:outline-none focus:border-accent-primary"
              >
                <option value="mean_reversion">均线回归策略</option>
                <option value="trend_following">趋势跟踪策略</option>
                <option value="macd">MACD策略</option>
                <option value="rsi">RSI策略</option>
                <option value="value_investing">价值投资策略</option>
              </select>
              <button
                onClick={runBatchBacktestHandler}
                disabled={batchRunning || selectedSymbols.length === 0}
                className="flex items-center gap-2 bg-accent-primary text-bg-primary px-6 py-3 rounded-lg font-medium hover:bg-accent-primary/90 disabled:opacity-50 text-sm transition-all shadow-[0_0_15px_rgba(0,212,255,0.3)]"
              >
                {batchRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {batchRunning ? "回测中..." : "开始批量回测"}
              </button>
              {batchRunning && (
                <button
                  onClick={cancelBatch}
                  className="flex items-center gap-2 bg-accent-danger/10 border border-accent-danger text-accent-danger px-6 py-3 rounded-lg font-medium hover:bg-accent-danger/20 text-sm transition-all"
                >
                  <X size={16} />
                  取消
                </button>
              )}
            </div>

            {/* Batch results comparison table */}
            {batchResults.length > 0 && !batchRunning && (
              <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
                <div className="p-4 border-b border-border-color flex items-center gap-2">
                  <BarChart2 size={16} className="text-accent-primary" />
                  <h3 className="font-semibold text-sm">回测结果对比</h3>
                  <span className="ml-auto text-xs text-text-muted">
                    {sortedResults.length} 个标的 · 点击表头排序
                  </span>
                  {/* Export buttons */}
                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={handleExportPDF}
                      disabled={batchResults.length === 0}
                      title="导出 PDF"
                      className="flex items-center gap-1 px-2 py-1.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary rounded-lg text-xs font-medium hover:bg-accent-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <FileText size={12} />
                      PDF
                    </button>
                    <button
                      onClick={handleExportExcel}
                      disabled={batchResults.length === 0}
                      title="导出 Excel"
                      className="flex items-center gap-1 px-2 py-1.5 bg-accent-success/10 border border-accent-success/30 text-accent-success rounded-lg text-xs font-medium hover:bg-accent-success/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <FileSpreadsheet size={12} />
                      Excel
                    </button>
                    <button
                      onClick={handleExportCSV}
                      disabled={batchResults.length === 0}
                      title="导出 CSV"
                      className="flex items-center gap-1 px-2 py-1.5 bg-bg-tertiary border border-border-color text-text-secondary rounded-lg text-xs font-medium hover:bg-bg-tertiary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <FileDown size={12} />
                      CSV
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-color">
                        <th className="text-left px-4 py-3 text-text-muted font-medium text-xs">标的</th>
                        <th
                          className="text-right px-4 py-3 text-text-muted font-medium text-xs cursor-pointer hover:text-accent-primary"
                          onClick={() => toggleSort("totalReturn")}
                        >
                          总收益率 <SortIcon field="totalReturn" />
                        </th>
                        <th
                          className="text-right px-4 py-3 text-text-muted font-medium text-xs cursor-pointer hover:text-accent-primary"
                          onClick={() => toggleSort("sharpeRatio")}
                        >
                          夏普比率 <SortIcon field="sharpeRatio" />
                        </th>
                        <th
                          className="text-right px-4 py-3 text-text-muted font-medium text-xs cursor-pointer hover:text-accent-primary"
                          onClick={() => toggleSort("maxDrawdown")}
                        >
                          最大回撤 <SortIcon field="maxDrawdown" />
                        </th>
                        <th
                          className="text-right px-4 py-3 text-text-muted font-medium text-xs cursor-pointer hover:text-accent-primary"
                          onClick={() => toggleSort("winRate")}
                        >
                          胜率 <SortIcon field="winRate" />
                        </th>
                        <th
                          className="text-right px-4 py-3 text-text-muted font-medium text-xs cursor-pointer hover:text-accent-primary"
                          onClick={() => toggleSort("tradeCount")}
                        >
                          交易次数 <SortIcon field="tradeCount" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults.map((r, idx) => (
                        <tr
                          key={r.symbol}
                          className={`border-b border-border-color/30 last:border-0 ${
                            idx === 0 ? "bg-accent-primary/5" : ""
                          } hover:bg-bg-tertiary transition-colors`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {idx === 0 && (
                                <span className="text-xs bg-accent-primary text-bg-primary px-1.5 py-0.5 rounded font-bold">TOP</span>
                              )}
                              <span className="font-mono font-medium text-accent-primary">{r.symbol}</span>
                              <span className="text-text-secondary text-xs">{r.name}</span>
                            </div>
                          </td>
                          <td className={`text-right px-4 py-3 font-mono ${
                            r.total_return >= 0 ? "text-accent-success" : "text-accent-danger"
                          }`}>
                            {r.total_return >= 0 ? "+" : ""}{r.total_return.toFixed(2)}%
                          </td>
                          <td className="text-right px-4 py-3 font-mono text-accent-primary">
                            {r.sharpe_ratio.toFixed(2)}
                          </td>
                          <td className="text-right px-4 py-3 font-mono text-accent-danger">
                            -{Math.abs(r.max_drawdown).toFixed(2)}%
                          </td>
                          <td className="text-right px-4 py-3 font-mono text-text-primary">
                            {r.win_rate.toFixed(1)}%
                          </td>
                          <td className="text-right px-4 py-3 font-mono text-text-muted">
                            {r.trade_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {analysis && !batchMode && (
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
      {searchMode === "pool" && activePool && activePool.stocks.length > 0 && !batchMode && (
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
      {!loading && !analysis && !batchMode && (
        <div className="bg-bg-secondary rounded-xl p-12 text-center border border-border-color">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-text-secondary font-medium mb-1">输入股票代码开始分析</p>
          <p className="text-text-muted text-sm mt-2">支持沪深A股所有股票</p>
        </div>
      )}

      {/* Batch empty state */}
      {batchMode && batchResults.length === 0 && !batchRunning && (
        <div className="bg-bg-secondary rounded-xl p-12 text-center border border-border-color">
          <BarChart2 size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
          <p className="text-text-secondary font-medium mb-1">批量回测</p>
          <p className="text-text-muted text-sm mt-2">从股票池导入或手动选择标的开始批量回测</p>
        </div>
      )}

      {/* 资讯面板 */}
      {(stockNews.length > 0 || newsLoading) && (
        <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
          <div className="flex items-center gap-2 mb-3">
            <Newspaper size={16} className="text-accent-primary" />
            <h3 className="text-sm font-semibold">个股资讯</h3>
            {newsLoading && <span className="text-xs text-text-muted animate-pulse">加载中...</span>}
          </div>
          
          {stockNews.length === 0 && !newsLoading && (
            <p className="text-xs text-text-muted text-center py-4">暂无资讯</p>
          )}
          
          <div className="space-y-2">
            {stockNews.map((news, i) => (
              <a
                key={i}
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-bg-tertiary transition-colors group"
              >
                <span className="mt-0.5 flex-shrink-0">
                  {news.sentiment === 'positive' && <TrendingUp size={14} className="text-accent-success" />}
                  {news.sentiment === 'negative' && <TrendingDown size={14} className="text-accent-danger" />}
                  {news.sentiment === 'neutral' && <Minus size={14} className="text-text-muted" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed group-hover:text-accent-primary transition-colors line-clamp-2">
                    {news.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-text-muted">{news.pubDate}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      news.sentiment === 'positive' ? 'bg-accent-success/20 text-accent-success' :
                      news.sentiment === 'negative' ? 'bg-accent-danger/20 text-accent-danger' :
                      'bg-bg-tertiary text-text-muted'
                    }`}>
                      {news.sentiment === 'positive' ? '利好' : news.sentiment === 'negative' ? '利空' : '中性'}
                    </span>
                    <ExternalLink size={8} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
