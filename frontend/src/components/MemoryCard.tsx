/**
 * MemoryCard - 记忆卡片组件
 * 展示单条记忆/笔记条目
 */
import { useState } from "react";
import { Pin, Star, Trash2, Edit2, Tag, Clock } from "lucide-react";
import clsx from "clsx";
import type { MemoryEntry, MemoryType } from "../types";
import { MEMORY_TYPE_META } from "../services/storage";

const TYPE_ICONS: Record<MemoryType, string> = {
  insight: "💡",
  note: "📝",
  trade_log: "📋",
  analysis: "📊",
  idea: "💭",
  trade_decision: "🤖",
};

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

interface MemoryCardProps {
  entry: MemoryEntry;
  onEdit?: (entry: MemoryEntry) => void;
  onDelete?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
}

export default function MemoryCard({ entry, onEdit, onDelete, onTogglePin, onToggleFavorite }: MemoryCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = MEMORY_TYPE_META[entry.type] || { label: entry.type, color: "#6b7280" };
  const icon = TYPE_ICONS[entry.type] || "📌";

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete?.(entry.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div
      className={clsx(
        "bg-white rounded-xl border border-gray-100 shadow-sm p-4 transition-all group",
        "hover:shadow-md hover:border-gray-200",
        entry.is_pinned && "border-l-4 border-l-amber-400"
      )}
      style={{ borderLeftColor: entry.is_pinned ? "#f59e0b" : undefined }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Type badge */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ backgroundColor: meta.color + "20" }}
        >
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-slate-800 text-sm truncate">{entry.title}</h4>
            {entry.is_favorite && <span className="text-amber-400">⭐</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: meta.color + "15", color: meta.color }}
            >
              {meta.label}
            </span>
            {entry.symbol && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-mono">
                {entry.symbol}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-slate-600 leading-relaxed mb-3 line-clamp-3">{entry.content}</p>

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 text-xs bg-gray-50 text-slate-500 px-2 py-0.5 rounded-full"
            >
              <Tag size={10} />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock size={12} />
          <span>{formatDate(entry.created_at)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onTogglePin?.(entry.id)}
            title={entry.is_pinned ? "取消置顶" : "置顶"}
            className={clsx(
              "p-1.5 rounded-lg transition-colors",
              entry.is_pinned ? "text-amber-500 bg-amber-50" : "text-slate-400 hover:text-amber-500 hover:bg-amber-50"
            )}
          >
            <Pin size={14} />
          </button>
          <button
            onClick={() => onToggleFavorite?.(entry.id)}
            title={entry.is_favorite ? "取消收藏" : "收藏"}
            className={clsx(
              "p-1.5 rounded-lg transition-colors",
              entry.is_favorite ? "text-amber-400 bg-amber-50" : "text-slate-400 hover:text-amber-400 hover:bg-amber-50"
            )}
          >
            <Star size={14} fill={entry.is_favorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => onEdit?.(entry)}
            title="编辑"
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={handleDelete}
            title={confirmDelete ? "再次点击确认删除" : "删除"}
            className={clsx(
              "p-1.5 rounded-lg transition-colors",
              confirmDelete
                ? "text-white bg-red-500"
                : "text-slate-400 hover:text-red-500 hover:bg-red-50"
            )}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
