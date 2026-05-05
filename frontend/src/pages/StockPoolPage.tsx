/**
 * Stock Pool Page - Manage stock pools for analysis and backtesting
 */
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { searchStocks } from "../services/api";
import { Plus, Trash2, Edit2, Check, X, ChevronRight, Search, Layers } from "lucide-react";
import type { StockInfo, StockPool } from "../types";
import clsx from "clsx";

export default function StockPoolPage() {
  const {
    stockPools, setStockPools, addStockPool, updateStockPool, deleteStockPool,
    activePoolId, setActivePoolId,
    showNotification,
  } = useStore();

  const [selectedPool, setSelectedPool] = useState<StockPool | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [addingToPool, setAddingToPool] = useState(false);

  // Load pools from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("stockPools");
    if (saved) {
      try {
        setStockPools(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, [setStockPools]);

  // Save pools to localStorage
  useEffect(() => {
    localStorage.setItem("stockPools", JSON.stringify(stockPools));
  }, [stockPools]);

  const handleCreatePool = () => {
    if (!editName.trim()) {
      showNotification("error", "请输入股票池名称");
      return;
    }
    const newPool: StockPool = {
      id: Date.now().toString(),
      name: editName.trim(),
      description: editDesc.trim(),
      stocks: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addStockPool(newPool);
    setIsCreating(false);
    setEditName("");
    setEditDesc("");
    showNotification("success", `股票池"${newPool.name}"创建成功`);
  };

  const handleDeletePool = (pool: StockPool) => {
    if (!confirm(`确定删除股票池"${pool.name}"吗？`)) return;
    deleteStockPool(pool.id);
    if (selectedPool?.id === pool.id) setSelectedPool(null);
    if (activePoolId === pool.id) setActivePoolId(null);
    showNotification("success", `股票池"${pool.name}"已删除`);
  };

  const handleEditPool = () => {
    if (!selectedPool) return;
    if (!editName.trim()) {
      showNotification("error", "请输入股票池名称");
      return;
    }
    updateStockPool(selectedPool.id, {
      name: editName.trim(),
      description: editDesc.trim(),
      updated_at: new Date().toISOString(),
    });
    setSelectedPool({ ...selectedPool, name: editName.trim(), description: editDesc.trim() });
    setIsEditing(false);
    showNotification("success", "股票池已更新");
  };

  const handleSearchStock = async (kw: string) => {
    setSearchQuery(kw);
    if (kw.length < 1) { setSearchResults([]); return; }
    try {
      const results = await searchStocks(kw);
      setSearchResults(results.slice(0, 8));
    } catch { setSearchResults([]); }
  };

  const addStockToPool = (stock: StockInfo) => {
    if (!selectedPool) return;
    if (selectedPool.stocks.some(s => s.symbol === stock.symbol)) {
      showNotification("info", "该股票已在股票池中");
      return;
    }
    const updated = {
      ...selectedPool,
      stocks: [...selectedPool.stocks, stock],
      updated_at: new Date().toISOString(),
    };
    updateStockPool(selectedPool.id, { stocks: updated.stocks, updated_at: updated.updated_at });
    setSelectedPool(updated);
    setSearchQuery("");
    setSearchResults([]);
    setAddingToPool(false);
    showNotification("success", `已添加${stock.symbol}到股票池`);
  };

  const removeStockFromPool = (symbol: string) => {
    if (!selectedPool) return;
    const updated = {
      ...selectedPool,
      stocks: selectedPool.stocks.filter(s => s.symbol !== symbol),
      updated_at: new Date().toISOString(),
    };
    updateStockPool(selectedPool.id, { stocks: updated.stocks, updated_at: updated.updated_at });
    setSelectedPool(updated);
    showNotification("success", `已从股票池移除${symbol}`);
  };

  const startEdit = (pool: StockPool) => {
    setSelectedPool(pool);
    setEditName(pool.name);
    setEditDesc(pool.description || "");
    setIsEditing(true);
    setIsCreating(false);
  };

  const startCreate = () => {
    setIsCreating(true);
    setIsEditing(false);
    setEditName("");
    setEditDesc("");
    setSelectedPool(null);
  };

  const selectPool = (pool: StockPool) => {
    setSelectedPool(pool);
    setActivePoolId(pool.id);
    setIsEditing(false);
    setIsCreating(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="bg-bg-secondary rounded-xl p-6 border border-border-color">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-secondary/20 flex items-center justify-center">
              <Layers size={22} className="text-accent-secondary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">股票池管理</h2>
              <p className="text-text-muted text-sm">创建和管理股票池，用于批量技术分析和回测</p>
            </div>
          </div>
          <button
            onClick={startCreate}
            className="flex items-center gap-2 px-4 py-2 bg-accent-primary text-bg-primary rounded-lg font-medium hover:bg-accent-primary/90 transition-all shadow-[0_0_15px_rgba(0,212,255,0.3)]"
          >
            <Plus size={18} />
            新建股票池
          </button>
        </div>

        {/* Pool list */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {stockPools.map((pool) => (
            <button
              key={pool.id}
              onClick={() => selectPool(pool)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border",
                selectedPool?.id === pool.id
                  ? "bg-accent-primary/10 border-accent-primary text-accent-primary"
                  : "bg-bg-tertiary border-border-color text-text-secondary hover:text-text-primary hover:border-accent-primary/50"
              )}
            >
              <Layers size={14} />
              {pool.name}
              <span className="text-xs opacity-60">({pool.stocks.length})</span>
            </button>
          ))}
          {stockPools.length === 0 && !isCreating && (
            <p className="text-text-muted text-sm py-2">暂无股票池，点击上方按钮创建</p>
          )}
        </div>
      </div>

      {/* Create Pool Form */}
      {isCreating && (
        <div className="bg-bg-secondary rounded-xl p-5 border border-accent-primary/50">
          <h3 className="font-semibold text-text-primary mb-4">新建股票池</h3>
          <div className="space-y-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="股票池名称，如：科技股组合"
              className="w-full px-4 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50"
              autoFocus
            />
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="描述（可选）"
              className="w-full px-4 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreatePool}
                className="flex items-center gap-1 px-4 py-2 bg-accent-primary text-bg-primary rounded-lg text-sm font-medium hover:bg-accent-primary/90"
              >
                <Check size={16} /> 创建
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="flex items-center gap-1 px-4 py-2 bg-bg-tertiary border border-border-color text-text-secondary rounded-lg text-sm hover:text-text-primary"
              >
                <X size={16} /> 取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pool Detail */}
      {selectedPool && !isCreating && (
        <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
          {/* Pool Header */}
          <div className="p-5 border-b border-border-color">
            <div className="flex items-center justify-between">
              {isEditing ? (
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1 bg-bg-tertiary border border-border-color rounded text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="描述（可选）"
                    className="w-full px-3 py-1 bg-bg-tertiary border border-border-color rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleEditPool} className="flex items-center gap-1 px-3 py-1 bg-accent-primary text-bg-primary rounded text-xs font-medium">
                      <Check size={14} /> 保存
                    </button>
                    <button onClick={() => setIsEditing(false)} className="flex items-center gap-1 px-3 py-1 bg-bg-tertiary border border-border-color text-text-secondary rounded text-xs">
                      <X size={14} /> 取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">{selectedPool.name}</h3>
                    {selectedPool.description && (
                      <p className="text-sm text-text-muted mt-1">{selectedPool.description}</p>
                    )}
                    <p className="text-xs text-text-muted mt-1">
                      {selectedPool.stocks.length}只股票 | 更新于{new Date(selectedPool.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(selectedPool)}
                      className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
                      title="编辑"
                    >
                      <Edit2 size={16} className="text-text-muted" />
                    </button>
                    <button
                      onClick={() => handleDeletePool(selectedPool)}
                      className="p-2 hover:bg-accent-danger/10 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 size={16} className="text-accent-danger" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Add Stock */}
          <div className="p-4 border-b border-border-color">
            <button
              onClick={() => setAddingToPool(!addingToPool)}
              className="flex items-center gap-2 text-sm text-accent-primary hover:text-accent-primary/80 transition-colors"
            >
              <Plus size={16} />
              添加股票
            </button>
            {addingToPool && (
              <div className="mt-3 relative">
                <div className="flex items-center gap-2">
                  <Search size={16} className="absolute left-3 text-text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchStock(e.target.value)}
                    placeholder="输入股票代码或名称搜索"
                    className="w-full pl-9 pr-4 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50"
                    autoFocus
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-bg-tertiary border border-border-color rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                    {searchResults.map((s) => (
                      <button
                        key={s.symbol}
                        onClick={() => addStockToPool(s)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-bg-secondary border-b border-border-color/30 last:border-0 transition-colors flex items-center justify-between"
                      >
                        <span>
                          <span className="font-medium text-accent-primary">{s.symbol}</span>
                          <span className="ml-2 text-text-primary">{s.name}</span>
                        </span>
                        <span className="text-text-muted text-xs">¥{s.price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stock List */}
          <div className="divide-y divide-border-color/50">
            {selectedPool.stocks.length === 0 ? (
              <div className="p-8 text-center text-text-muted">
                <Layers size={40} className="mx-auto mb-3 opacity-30" />
                <p>股票池为空，点击上方添加股票</p>
              </div>
            ) : (
              selectedPool.stocks.map((stock) => (
                <div key={stock.symbol} className="p-4 flex items-center justify-between hover:bg-bg-tertiary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                      <span className="text-xs font-mono font-bold text-accent-primary">{stock.symbol.slice(0, 2)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">{stock.symbol} - {stock.name}</p>
                      <p className="text-xs text-text-muted">
                        {stock.market || "未知市场"} | PE: {stock.pe?.toFixed(1) || "--"} | ROE: {stock.roe?.toFixed(1) || "--"}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono font-bold text-text-primary">¥{stock.price.toFixed(2)}</p>
                      <p className={clsx("text-xs font-medium", stock.change_pct >= 0 ? "text-accent-success" : "text-accent-danger")}>
                        {stock.change_pct >= 0 ? "+" : ""}{stock.change_pct.toFixed(2)}%
                      </p>
                    </div>
                    <button
                      onClick={() => removeStockFromPool(stock.symbol)}
                      className="p-1.5 hover:bg-accent-danger/10 rounded transition-colors"
                      title="移除"
                    >
                      <Trash2 size={14} className="text-accent-danger" />
                    </button>
                    <ChevronRight size={16} className="text-text-muted" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedPool && !isCreating && stockPools.length > 0 && (
        <div className="bg-bg-secondary rounded-xl p-12 text-center border border-border-color">
          <Layers size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
          <p className="text-text-secondary font-medium mb-1">选择一个股票池查看详情</p>
          <p className="text-text-muted text-sm">或创建一个新的股票池开始管理</p>
        </div>
      )}
    </div>
  );
}
