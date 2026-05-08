/**
 * MemoryEntryModal - 记忆/笔记编辑弹窗
 * 支持新建和编辑记忆条目
 */
import { useState, useEffect, useRef } from "react";
import { X, Plus, Tag } from "lucide-react";
import clsx from "clsx";
import type { MemoryEntry, MemoryType } from "../types";
import { MEMORY_TYPE_META } from "../services/storage";
import { DEFAULT_STOCKS } from "../services/storage";

const MEMORY_TYPES: { value: MemoryType; label: string; icon: string; desc: string }[] = [
  { value: "insight", label: "💡 灵感", icon: "💡", desc: "突然想到的投资想法或观察" },
  { value: "note", label: "📝 笔记", icon: "📝", desc: "日常投资学习笔记" },
  { value: "trade_log", label: "📋 交易记录", icon: "📋", desc: "买入卖出操作记录" },
  { value: "analysis", label: "📊 分析", icon: "📊", desc: "股票或市场分析内容" },
  { value: "idea", label: "💭 想法", icon: "💭", desc: "还没成型的投资思路" },
];

const QUICK_TAGS = ["低估", "成长", "技术分析", "止损", "止盈", "仓位管理", "基本面", "趋势", "价值投资", "短线", "长线"];

interface MemoryEntryModalProps {
  entry?: MemoryEntry | null;
  defaultType?: MemoryType;
  defaultSymbol?: string;
  onSave: (entry: MemoryEntry) => void;
  onClose: () => void;
}

export default function MemoryEntryModal({ entry, defaultType, defaultSymbol, onSave, onClose }: MemoryEntryModalProps) {
  const [type, setType] = useState<MemoryType>(entry?.type || defaultType || "note");
  const [title, setTitle] = useState(entry?.title || "");
  const [content, setContent] = useState(entry?.content || "");
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [symbol, setSymbol] = useState(entry?.symbol || defaultSymbol || "");
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const isEditing = !!entry;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    // Set default type from prop only when creating new
    if (!entry && defaultType) {
      setType(defaultType);
    }
  }, [defaultType, entry]);

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const validate = () => {
    const errs: { title?: string; content?: string } = {};
    if (!title.trim()) errs.title = "请输入标题";
    if (!content.trim()) errs.content = "请输入内容";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const now = new Date().toISOString();
    const savedEntry: MemoryEntry = {
      id: entry?.id || `mem-${Date.now()}`,
      type,
      title: title.trim(),
      content: content.trim(),
      tags,
      symbol: symbol.trim() || undefined,
      created_at: entry?.created_at || now,
      updated_at: now,
      is_pinned: entry?.is_pinned || false,
      is_favorite: entry?.is_favorite || false,
    };
    onSave(savedEntry);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-slate-800">
            {isEditing ? "编辑记忆" : "新建记忆"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">类型</label>
            <div className="grid grid-cols-5 gap-2">
              {MEMORY_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={clsx(
                    "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-center",
                    type === t.value
                      ? "border-2 shadow-sm"
                      : "border border-gray-200 hover:border-gray-300"
                  )}
                  style={type === t.value ? { borderColor: MEMORY_TYPE_META[t.value].color, backgroundColor: MEMORY_TYPE_META[t.value].color + "10" } : {}}
                >
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-xs font-medium text-slate-700">{t.label.split(" ")[1]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">标题 *</label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors({ ...errors, title: undefined });
              }}
              placeholder="给这条记忆起个标题..."
              className={clsx(
                "w-full px-4 py-2.5 border rounded-xl text-sm text-slate-800 placeholder:text-slate-400",
                "focus:outline-none focus:ring-2 transition-all",
                errors.title ? "border-red-300 focus:ring-red-200" : "border-gray-200 focus:ring-blue-200 focus:border-blue-400"
              )}
            />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">内容 *</label>
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (errors.content) setErrors({ ...errors, content: undefined });
              }}
              placeholder="详细记录你的想法、分析或交易记录..."
              rows={5}
              className={clsx(
                "w-full px-4 py-2.5 border rounded-xl text-sm text-slate-800 placeholder:text-slate-400 resize-none",
                "focus:outline-none focus:ring-2 transition-all",
                errors.content ? "border-red-300 focus:ring-red-200" : "border-gray-200 focus:ring-blue-200 focus:border-blue-400"
              )}
            />
            {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content}</p>}
          </div>

          {/* Symbol */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">关联股票（可选）</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="如 000001、600519"
              list="memory-symbol-list"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
            />
            <datalist id="memory-symbol-list">
              {DEFAULT_STOCKS.map((s) => (
                <option key={s.symbol} value={s.symbol} label={s.name} />
              ))}
            </datalist>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              <span className="flex items-center gap-1"><Tag size={12} /> 标签</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full"
                >
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-blue-800 ml-0.5">×</button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder="输入标签后回车添加（最多10个）"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
            />
            {/* Quick tags */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_TAGS.filter((qt) => !tags.includes(qt)).map((qt) => (
                <button
                  key={qt}
                  type="button"
                  onClick={() => handleAddTag(qt)}
                  className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  + {qt}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-slate-600 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              {isEditing ? "保存修改" : "创建记忆"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
