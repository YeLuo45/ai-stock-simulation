/**
 * Memory Review Page - AI Decision & Reasoning History
 * Cyberpunk Terminal Theme
 * Displays AI memory entries: stock selections, trade decisions, analysis results
 */
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { Brain, Trash2, Search, Filter, Clock, TrendingUp, Bot, BarChart2, Star, ChevronDown, RefreshCw, X, Download, PieChart, List, MessageSquare } from "lucide-react";
import clsx from "clsx";
import OutcomeBadge from "../components/OutcomeBadge";
import { getMemoryEntries } from "../services/storage";
import ConversationPanel from "../components/ConversationPanel";

interface MemoryStatsData {
  total: number;
  pending: number;
  profit: number;
  loss: number;
  stopLoss: number;
  takeProfit: number;
  avgHoldingDays: number;
  winRate: number;
  factorStats: Record<string, { total: number; wins: number; winRate: number }>;
}

export interface MemoryEntry {
  id: string;
  type: "stock_selection" | "trade_decision" | "analysis" | "ipo_evaluation" | "backtest_explanation" | "strategy_build";
  title: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  // 策略记忆系统增强字段
  linkedTradeId?: string;
  linkedPositionId?: string;
  outcome?: 'pending' | 'profit' | 'loss' | 'stop_loss' | 'take_profit';
  pnlPercent?: number;
  holdingDays?: number;
  decisionFactors?: string[];
  auto?: boolean;
}

const MEMORY_KEY = "ai-stock-memory-entries";
const PAGE_SIZE = 20;

const TYPE_CONFIG: Record<MemoryEntry["type"], { label: string; icon: React.ReactNode; color: string }> = {
  stock_selection: { label: "AI选股", icon: <Bot size={14} />, color: "text-accent-primary" },
  trade_decision: { label: "交易决策", icon: <TrendingUp size={14} />, color: "text-accent-success" },
  analysis: { label: "技术分析", icon: <BarChart2 size={14} />, color: "text-accent-secondary" },
  ipo_evaluation: { label: "新股评估", icon: <Star size={14} />, color: "text-yellow-400" },
  backtest_explanation: { label: "回测解读", icon: <BarChart2 size={14} />, color: "text-purple-400" },
  strategy_build: { label: "策略构建", icon: <Brain size={14} />, color: "text-cyan-400" },
};

function loadMemoryEntries(): MemoryEntry[] {
  try {
    const saved = localStorage.getItem(MEMORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveMemoryEntries(entries: MemoryEntry[]): void {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

export default function MemoryReviewPage() {
  const { showNotification } = useStore();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [filterType, setFilterType] = useState<MemoryEntry["type"] | "all">("all");
  const [filterOutcome, setFilterOutcome] = useState<MemoryEntry["outcome"] | "all">("all");
  const [searchKw, setSearchKw] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"list" | "stats" | "conversation">("list");
  const [_stats, setStats] = useState<MemoryStatsData|null>(null);

  const loadEntries = () => {
    const data = loadMemoryEntries();
    // Sort by timestamp descending
    data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setEntries(data);
    // Refresh stats
    try {
      const allEntries = getMemoryEntries();
      const autoEntries = allEntries.filter(e => e.auto === true);
      const computedStats: MemoryStatsData = {
        total: autoEntries.length,
        pending: 0,
        profit: 0,
        loss: 0,
        stopLoss: 0,
        takeProfit: 0,
        avgHoldingDays: 0,
        winRate: 0,
        factorStats: {},
      };
      let totalHoldingDays = 0;
      let closedCount = 0;
      for (const e of autoEntries) {
        switch (e.outcome) {
          case 'pending': computedStats.pending++; break;
          case 'profit': computedStats.profit++; closedCount++; break;
          case 'loss': computedStats.loss++; closedCount++; break;
          case 'stop_loss': computedStats.stopLoss++; closedCount++; break;
          case 'take_profit': computedStats.takeProfit++; closedCount++; break;
        }
        if (e.holdingDays) totalHoldingDays += e.holdingDays;
        if (e.decisionFactors) {
          for (const factor of e.decisionFactors) {
            if (!computedStats.factorStats[factor]) {
              computedStats.factorStats[factor] = { total: 0, wins: 0, winRate: 0 };
            }
            computedStats.factorStats[factor].total++;
            if (e.outcome === 'profit' || e.outcome === 'take_profit') {
              computedStats.factorStats[factor].wins++;
            }
          }
        }
      }
      if (closedCount > 0) {
        computedStats.winRate = ((computedStats.profit + computedStats.takeProfit) / closedCount) * 100;
        computedStats.avgHoldingDays = totalHoldingDays / closedCount;
      }
      for (const factor of Object.keys(computedStats.factorStats)) {
        const fs = computedStats.factorStats[factor];
        if (fs.total > 0) fs.winRate = (fs.wins / fs.total) * 100;
      }
      setStats(computedStats);
    } catch (e) {
      console.warn('Failed to compute memory stats:', e);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  // Auto-add some demo entries if empty (for demonstration)
  useEffect(() => {
    if (entries.length === 0) {
      const demoEntries: MemoryEntry[] = [
        {
          id: "demo-1",
          type: "stock_selection",
          title: "低估价值股筛选",
          content: "根据「低估值价值投资」的条件，筛选出估值偏低的优质股票：贵州茅台、招商银行。这些股票当前市盈率低于行业平均，具有一定的估值修复空间。ROE分别为35.2%和12.5%，显示良好的盈利能力。",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          metadata: { query: "低估价值投资", resultCount: 2 },
        },
        {
          id: "demo-2",
          type: "trade_decision",
          title: "买入决策：宁德时代",
          content: "基于技术分析显示，300750宁德时代近期呈现上涨趋势，MA5上穿MA20形成金叉，RSI为58处于强势区域，MACD柱状图扩大。建议在198.30附近买入，止损位设置在190.00，预计持有周期5-10个交易日，目标收益率8%。",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          metadata: { symbol: "300750", action: "buy", confidence: 0.78 },
        },
        {
          id: "demo-3",
          type: "analysis",
          title: "技术分析：贵州茅台",
          content: "600519贵州茅台当前价格1688.00元，技术指标显示：MA5=1692.3，MA20=1658.7，RSI=54.2，MACD=12.5。建议关注1680支撑位，若跌破则考虑止损。短期阻力位1750，中期阻力位1800。",
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          metadata: { symbol: "600519", price: 1688.0 },
        },
        {
          id: "demo-4",
          type: "backtest_explanation",
          title: "均线回归策略回测解读",
          content: "策略「均线回归策略」总收益12.5%，年化8.2%，最大回撤6.3%，夏普比率1.45，胜率58%。整体表现良好，正收益说明策略有效。策略在震荡市中表现优异，建议配合趋势过滤使用。",
          timestamp: new Date(Date.now() - 14400000).toISOString(),
          metadata: { strategy: "均线回归策略", totalReturn: 12.5 },
        },
        {
          id: "demo-5",
          type: "ipo_evaluation",
          title: "新股评估：华兴源创",
          content: "688001华兴源创评分75分，推荐等级「推荐」。基本面：PE=45.2略高，ROE=8.5%一般，但营收增长稳定。技术面：上市3天，处于上涨趋势，换手率活跃。综合建议：可适度参与，关注80元阻力位。",
          timestamp: new Date(Date.now() - 18000000).toISOString(),
          metadata: { symbol: "688001", score: 75, recommendation: "推荐" },
        },
        {
          id: "demo-6",
          type: "strategy_build",
          title: "AI策略构建：科技成长股筛选",
          content: "根据您的要求，构建科技成长股筛选策略：1) 市盈率PE在25-50之间；2) 净资产收益率ROE大于15%；3) 市净率PB大于3；4) 总市值大于500亿；5) 近一年营收增长率大于20%。该策略注重成长性与估值的平衡。",
          timestamp: new Date(Date.now() - 21600000).toISOString(),
          metadata: { criteria: { pe: "25-50", roe: ">15", pb: ">3" } },
        },
      ];
      saveMemoryEntries(demoEntries);
      loadEntries();
    }
  }, []);

  const filtered = entries.filter(e => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (filterOutcome !== "all" && e.outcome !== filterOutcome) return false;
    if (searchKw && !e.title.toLowerCase().includes(searchKw.toLowerCase()) && !e.content.toLowerCase().includes(searchKw.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleClearAll = () => {
    if (!confirm("确定清空所有记忆记录吗？此操作不可恢复。")) return;
    saveMemoryEntries([]);
    setEntries([]);
    showNotification("info", "记忆已清空");
  };

  const handleExport = () => {
    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai_memory_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification("success", "记忆已导出");
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 border border-accent-primary/30 flex items-center justify-center">
            <Brain size={20} className="text-accent-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">AI 记忆库</h1>
            <p className="text-xs text-text-muted">记录AI选股、决策与分析的思考过程</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadEntries}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-accent-primary border border-border-color hover:border-accent-primary/40 transition-colors"
          >
            <RefreshCw size={12} /> 刷新
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-accent-primary border border-border-color hover:border-accent-primary/40 transition-colors"
          >
            <Download size={12} /> 导出
          </button>
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-accent-danger/60 hover:text-accent-danger border border-border-color hover:border-accent-danger/40 transition-colors"
          >
            <Trash2 size={12} /> 清空
          </button>
          {/* View tab toggle */}
          <div className="flex items-center gap-1 ml-2 px-1 py-1 rounded-lg bg-bg-tertiary border border-border-color">
            <button
              onClick={() => setViewTab("list")}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewTab === "list"
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              <List size={12} /> 列表
            </button>
            <button
              onClick={() => setViewTab("stats")}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewTab === "stats"
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              <PieChart size={12} /> 统计
            </button>
            <button
              onClick={() => setViewTab("conversation")}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewTab === "conversation"
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              <MessageSquare size={12} /> 对话
            </button>
          </div>
        </div>
      </div>

      {/* Filters - only show for list/stats views */}
      {viewTab !== "conversation" && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchKw}
              onChange={(e) => { setSearchKw(e.target.value); setPage(1); }}
              placeholder="搜索记忆..."
              className="w-full pl-9 pr-4 py-2 bg-bg-secondary border border-border-color rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
            {searchKw && (
              <button
                onClick={() => setSearchKw("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X size={12} />
              </button>
            )}
          </div>

        {/* Type filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={14} className="text-text-muted" />
          <button
            onClick={() => { setFilterType("all"); setPage(1); }}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filterType === "all"
                ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/30"
                : "text-text-muted hover:text-text-secondary border border-transparent hover:border-border-color"
            )}
          >
            全部
          </button>
          {(Object.keys(TYPE_CONFIG) as MemoryEntry["type"][]).map(type => (
            <button
              key={type}
              onClick={() => { setFilterType(type); setPage(1); }}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                filterType === type
                  ? "bg-accent-primary/10 text-accent-primary border-accent-primary/30"
                  : "text-text-muted hover:text-text-secondary border-transparent hover:border-border-color"
              )}
            >
              <span className={TYPE_CONFIG[type].color}>{TYPE_CONFIG[type].icon}</span>
              {TYPE_CONFIG[type].label}
            </button>
          ))}
        </div>

        {/* Outcome filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-text-muted">结果:</span>
          {(["all", "pending", "profit", "loss", "stop_loss", "take_profit"] as const).map(outcome => (
            <button
              key={outcome}
              onClick={() => { setFilterOutcome(outcome); setPage(1); }}
              className={clsx(
                "px-2 py-1 rounded-lg text-xs font-medium transition-colors",
                filterOutcome === outcome
                  ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/30"
                  : "text-text-muted hover:text-text-secondary border border-transparent hover:border-border-color"
              )}
            >
              {outcome === 'all' ? '全部' : outcome === 'pending' ? '🟡待验证' : outcome === 'profit' ? '🟢盈利' : outcome === 'loss' ? '🔴亏损' : outcome === 'stop_loss' ? '⏸止损' : '🏆止盈'}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Conversation View */}
      {viewTab === "conversation" ? (
        <ConversationPanel />
      ) : (
        <>
      {/* Stats bar */}
      {viewTab === "stats" && (
        <div className="flex items-center gap-4 px-4 py-3 bg-bg-secondary border border-border-color rounded-xl">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted">共</span>
            <span className="text-sm font-mono font-bold text-accent-primary">{filtered.length}</span>
            <span className="text-xs text-text-muted">条记录</span>
          </div>
          {filterType !== "all" && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span>筛选:</span>
              <span className={TYPE_CONFIG[filterType].color}>{TYPE_CONFIG[filterType].label}</span>
            </div>
          )}
          {searchKw && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span>关键词:</span>
              <span className="text-accent-primary">"{searchKw}"</span>
            </div>
          )}
        </div>
      )}

      {/* Entries List */}
      {paginated.length > 0 ? (
        <div className="space-y-3">
          {paginated.map((entry) => {
            const config = TYPE_CONFIG[entry.type];
            const isExpanded = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden hover:border-accent-primary/30 transition-all group"
              >
                {/* Entry Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full flex items-start gap-3 p-4 text-left"
                >
                  <div className={clsx(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    "bg-bg-tertiary border border-border-color group-hover:border-accent-primary/30 transition-colors"
                  )}>
                    <span className={config.color}>{config.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-text-primary truncate">{entry.title}</h3>
                      <span className={clsx(
                        "px-2 py-0.5 rounded text-[10px] font-medium shrink-0",
                        "bg-bg-tertiary text-text-muted border border-border-color"
                      )}>
                        {config.label}
                      </span>
                      {entry.auto && <OutcomeBadge outcome={entry.outcome} size="sm" />}
                    </div>
                    <p className={clsx(
                      "text-xs text-text-muted",
                      isExpanded ? "line-clamp-none" : "line-clamp-2"
                    )}>
                      {entry.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-text-muted whitespace-nowrap">{formatTime(entry.timestamp)}</span>
                    <ChevronDown size={14} className={clsx(
                      "text-text-muted transition-transform",
                      isExpanded && "rotate-180"
                    )} />
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-border-color/50">
                    <div className="mt-3 p-3 bg-bg-tertiary/50 rounded-lg">
                      <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">完整内容</p>
                      <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                    </div>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="mt-2 p-3 bg-bg-tertiary/30 rounded-lg">
                        <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">元数据</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(entry.metadata).map(([k, v]) => (
                            <span key={k} className="px-2 py-1 bg-bg-tertiary rounded text-xs text-text-muted font-mono">
                              {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-[10px] text-text-muted font-mono">
                        {new Date(entry.timestamp).toLocaleString("zh-CN")}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">ID: {entry.id}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
            <Brain size={28} className="text-text-muted" />
          </div>
          <p className="text-text-secondary font-medium mb-1">暂无记忆记录</p>
          <p className="text-text-muted text-sm">AI的分析和决策将自动记录在这里</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4 border-t border-border-color">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-border-color text-text-muted hover:text-text-primary hover:border-accent-primary/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown size={16} className="rotate-90" />
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) {
                p = i + 1;
              } else if (page <= 4) {
                p = i + 1;
                if (i === 6) p = totalPages;
              } else if (page >= totalPages - 3) {
                p = i === 0 ? 1 : totalPages - 6 + i;
              } else {
                p = i === 0 ? 1 : i === 6 ? totalPages : page - 3 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={clsx(
                    "w-8 h-8 rounded-lg text-xs font-mono transition-colors",
                    page === p
                      ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/30"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-border-color text-text-muted hover:text-text-primary hover:border-accent-primary/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown size={16} className="-rotate-90" />
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
}

// Helper function to add memory entries from other parts of the app
export function addMemoryEntry(entry: Omit<MemoryEntry, "id" | "timestamp">): void {
  const entries = loadMemoryEntries();
  entries.push({
    ...entry,
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  });
  saveMemoryEntries(entries);
}
