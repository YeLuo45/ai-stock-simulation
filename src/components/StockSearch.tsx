/**
 * StockSearch - 股票搜索组件
 */
import { useState, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import clsx from "clsx";

interface StockSearchProps {
  onSearch: (stockCode: string) => void;
  loading?: boolean;
  placeholder?: string;
}

export default function StockSearch({
  onSearch,
  loading = false,
  placeholder = "输入股票代码，如 000001 或 688001",
}: StockSearchProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const code = value.trim();
      if (!code) return;
      onSearch(code);
    },
    [value, onSearch]
  );

  const handleExample = useCallback(
    (code: string) => {
      setValue(code);
      onSearch(code);
    },
    [onSearch]
  );

  const examples = ["000001", "600519", "688001", "300750"];

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className={clsx(
              "w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-slate-800",
              "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent",
              "bg-white"
            )}
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className={clsx(
            "px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2",
            "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              评估中
            </>
          ) : (
            "开始评估"
          )}
        </button>
      </form>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">示例：</span>
        {examples.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => handleExample(code)}
            className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
            disabled={loading}
          >
            {code}
          </button>
        ))}
      </div>
    </div>
  );
}
