/**
 * ModelPrioritySettings - AI模型优先级拖拽调整组件
 * 使用 @dnd-kit 实现拖拽排序
 */
import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, CheckCircle2, Loader2 } from "lucide-react";
import clsx from "clsx";
import { getAIModelPriority, updateAIModelPriority } from "../services/api";

const MODEL_LABELS: Record<string, { label: string; desc: string }> = {
  minimax: { label: "MiniMax", desc: "高性价比，支持中文理解" },
  zhipu: { label: "智谱 GLM-4", desc: "国产大模型，支持长上下文" },
  claude: { label: "Claude", desc: "Anthropic Claude 3.5 Sonnet" },
  gemini: { label: "Gemini", desc: "Google Gemini 2.0 Flash" },
};

interface SortableItemProps {
  id: string;
  index: number;
}

function SortableItem({ id, index }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const modelInfo = MODEL_LABELS[id] || { label: id, desc: "" };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl transition-all",
        isDragging && "shadow-xl ring-2 ring-blue-400 opacity-90 z-50"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical size={18} />
      </button>

      <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800">{modelInfo.label}</p>
        <p className="text-xs text-slate-500 truncate">{modelInfo.desc}</p>
      </div>

      {isDragging && (
        <div className="text-blue-500">
          <Loader2 size={16} className="animate-spin" />
        </div>
      )}
    </div>
  );
}

interface ModelPrioritySettingsProps {
  onSaved?: () => void;
}

export default function ModelPrioritySettings({ onSaved }: ModelPrioritySettingsProps) {
  const [items, setItems] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    loadPriority();
  }, []);

  const loadPriority = async () => {
    try {
      const data = await getAIModelPriority();
      if (data.priority && data.priority.length > 0) {
        setItems(data.priority);
      } else {
        setItems(["minimax", "zhipu", "claude", "gemini"]);
      }
    } catch {
      setItems(["minimax", "zhipu", "claude", "gemini"]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        return arrayMove(prev, oldIndex, newIndex);
      });
      setSaved(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateAIModelPriority(items);
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save priority:", e);
    } finally {
      setIsSaving(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-4">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((id, index) => (
              <SortableItem key={id} id={id} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving || saved}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            saved
              ? "bg-green-100 text-green-700 border border-green-200"
              : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          )}
        >
          {isSaving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              保存中...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 size={14} />
              已保存
            </>
          ) : (
            "保存优先级"
          )}
        </button>
        <p className="text-xs text-slate-500">
          优先级高的模型会被优先调用，失败后自动切换
        </p>
      </div>
    </div>
  );
}
