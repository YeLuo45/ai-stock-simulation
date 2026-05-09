/**
 * Alert Rule Editor Component
 * Add/Edit/Delete drawdown alert rules
 */
import { useState, useEffect } from "react";
import { useStore } from "../store";
import {
  getAlertRules,
  updateAlertRule,
  addAlertRule,
  deleteAlertRule,
  requestNotificationPermission,
  sendBrowserNotification,
  type AlertRule,
  type AlertSeverity,
} from "../services/drawdownEngine";
import {
  Shield,
  Bell,
  Mail,
  Trash2,
  Plus,
  X,
  Check,
  AlertTriangle,
  Info,
  AlertOctagon,
} from "lucide-react";
import clsx from "clsx";

interface AlertRuleEditorProps {
  onClose?: () => void;
}

const SEVERITY_CONFIG = {
  info: { label: "提示", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: Info },
  warning: { label: "警告", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: AlertTriangle },
  critical: { label: "严重", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: AlertOctagon },
};

export default function AlertRuleEditor({}: AlertRuleEditorProps) {
  const { showNotification } = useStore();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formThreshold, setFormThreshold] = useState(-10);
  const [formSeverity, setFormSeverity] = useState<AlertSeverity>("warning");
  const [formActions, setFormActions] = useState<("browser" | "notification" | "email")[]>(["browser"]);

  useEffect(() => {
    setRules(getAlertRules());
  }, []);

  const handleToggleEnabled = (rule: AlertRule) => {
    updateAlertRule(rule.id, { enabled: !rule.enabled });
    setRules(getAlertRules());
  };

  const handleDelete = (id: string) => {
    if (!confirm("确定删除此预警规则？")) return;
    deleteAlertRule(id);
    setRules(getAlertRules());
    showNotification("info", "预警规则已删除");
  };

  const handleTestNotification = async () => {
    setTestingNotification(true);
    const granted = await requestNotificationPermission();
    if (granted) {
      sendBrowserNotification("回撤预警测试", {
        body: "这是一条测试通知，预警系统运行正常。",
        icon: "/icon.png",
      });
      showNotification("success", "测试通知已发送");
    } else {
      showNotification("error", "请允许浏览器通知权限");
    }
    setTestingNotification(false);
  };

  const handleAddRule = () => {
    if (!formName.trim()) {
      showNotification("error", "请输入规则名称");
      return;
    }
    const newRule: AlertRule = {
      id: `rule-${Date.now()}`,
      name: formName.trim(),
      threshold: formThreshold / 100,
      severity: formSeverity,
      enabled: true,
      actions: formActions,
      triggered: false,
    };
    addAlertRule(newRule);
    setRules(getAlertRules());
    setShowAddForm(false);
    setFormName("");
    setFormThreshold(-10);
    setFormSeverity("warning");
    setFormActions(["browser"]);
    showNotification("success", "预警规则已添加");
  };

  const handleUpdateRule = (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    updateAlertRule(id, {
      name: formName || rule.name,
      threshold: formThreshold / 100,
      severity: formSeverity,
      actions: formActions,
    });
    setRules(getAlertRules());
    setEditingId(null);
    setFormName("");
    setFormThreshold(-10);
    setFormSeverity("warning");
    setFormActions(["browser"]);
    showNotification("success", "预警规则已更新");
  };

  const startEdit = (rule: AlertRule) => {
    setEditingId(rule.id);
    setFormName(rule.name);
    setFormThreshold(Math.round(rule.threshold * 100));
    setFormSeverity(rule.severity);
    setFormActions([...rule.actions]);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowAddForm(false);
    setFormName("");
    setFormThreshold(-10);
    setFormSeverity("warning");
    setFormActions(["browser"]);
  };

  const toggleAction = (action: "browser" | "notification" | "email") => {
    setFormActions(prev =>
      prev.includes(action)
        ? prev.filter(a => a !== action)
        : [...prev, action]
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-accent-primary" />
          <span className="text-sm font-medium text-text-primary">预警规则配置</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestNotification}
            disabled={testingNotification}
            className="text-xs px-3 py-1.5 rounded border border-border-color text-text-muted hover:text-text-primary hover:border-accent-primary/40 transition-colors"
          >
            {testingNotification ? "发送中..." : "测试通知"}
          </button>
          <button
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-accent-primary/10 border border-accent-primary/40 text-accent-primary hover:bg-accent-primary/20 transition-colors"
          >
            <Plus size={12} /> 添加规则
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-bg-tertiary border border-border-color rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">添加新规则</span>
            <button onClick={cancelEdit} className="text-text-muted hover:text-text-primary">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">规则名称</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="例如：-10%预警"
                className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary/50 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">回撤阈值 (%)</label>
              <input
                type="number"
                value={formThreshold}
                onChange={e => setFormThreshold(Number(e.target.value))}
                step="1"
                min="-100"
                max="0"
                className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2 text-sm text-text-primary focus:border-accent-primary/50 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1 block">预警级别</label>
            <div className="flex gap-2">
              {(["info", "warning", "critical"] as const).map(sev => {
                const cfg = SEVERITY_CONFIG[sev];
                return (
                  <button
                    key={sev}
                    onClick={() => setFormSeverity(sev)}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors",
                      formSeverity === sev
                        ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                        : "border-border-color text-text-muted hover:border-accent-primary/30"
                    )}
                  >
                    <cfg.icon size={12} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1 block">通知方式</label>
            <div className="flex gap-2">
              <button
                onClick={() => toggleAction("browser")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors",
                  formActions.includes("browser")
                    ? "bg-accent-primary/10 border-accent-primary/40 text-accent-primary"
                    : "border-border-color text-text-muted hover:border-accent-primary/30"
                )}
              >
                <Bell size={12} /> 浏览器
              </button>
              <button
                onClick={() => toggleAction("notification")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors",
                  formActions.includes("notification")
                    ? "bg-accent-primary/10 border-accent-primary/40 text-accent-primary"
                    : "border-border-color text-text-muted hover:border-accent-primary/30"
                )}
              >
                <Bell size={12} /> 弹窗
              </button>
              <button
                onClick={() => toggleAction("email")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors",
                  formActions.includes("email")
                    ? "bg-accent-primary/10 border-accent-primary/40 text-accent-primary"
                    : "border-border-color text-text-muted hover:border-accent-primary/30"
                )}
              >
                <Mail size={12} /> 邮件
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={cancelEdit}
              className="px-4 py-2 rounded text-xs border border-border-color text-text-muted hover:text-text-primary transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddRule}
              className="px-4 py-2 rounded text-xs bg-accent-primary/10 border border-accent-primary/40 text-accent-primary hover:bg-accent-primary/20 transition-colors"
            >
              确认添加
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-2">
        {rules.map(rule => {
          const cfg = SEVERITY_CONFIG[rule.severity];
          const isEditing = editingId === rule.id;

          if (isEditing) {
            return (
              <div key={rule.id} className="bg-bg-tertiary border border-border-color rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">编辑规则</span>
                  <button onClick={cancelEdit} className="text-text-muted hover:text-text-primary">
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">规则名称</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2 text-sm text-text-primary focus:border-accent-primary/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">回撤阈值 (%)</label>
                    <input
                      type="number"
                      value={formThreshold}
                      onChange={e => setFormThreshold(Number(e.target.value))}
                      step="1"
                      min="-100"
                      max="0"
                      className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2 text-sm text-text-primary focus:border-accent-primary/50 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-text-muted mb-1 block">预警级别</label>
                  <div className="flex gap-2">
                    {(["info", "warning", "critical"] as const).map(sev => {
                      const sevCfg = SEVERITY_CONFIG[sev];
                      return (
                        <button
                          key={sev}
                          onClick={() => setFormSeverity(sev)}
                          className={clsx(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors",
                            formSeverity === sev
                              ? `${sevCfg.bg} ${sevCfg.border} ${sevCfg.color}`
                              : "border-border-color text-text-muted hover:border-accent-primary/30"
                          )}
                        >
                          <sevCfg.icon size={12} />
                          {sevCfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-text-muted mb-1 block">通知方式</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAction("browser")}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors",
                        formActions.includes("browser")
                          ? "bg-accent-primary/10 border-accent-primary/40 text-accent-primary"
                          : "border-border-color text-text-muted hover:border-accent-primary/30"
                      )}
                    >
                      <Bell size={12} /> 浏览器
                    </button>
                    <button
                      onClick={() => toggleAction("notification")}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors",
                        formActions.includes("notification")
                          ? "bg-accent-primary/10 border-accent-primary/40 text-accent-primary"
                          : "border-border-color text-text-muted hover:border-accent-primary/30"
                      )}
                    >
                      <Bell size={12} /> 弹窗
                    </button>
                    <button
                      onClick={() => toggleAction("email")}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors",
                        formActions.includes("email")
                          ? "bg-accent-primary/10 border-accent-primary/40 text-accent-primary"
                          : "border-border-color text-text-muted hover:border-accent-primary/30"
                      )}
                    >
                      <Mail size={12} /> 邮件
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 rounded text-xs border border-border-color text-text-muted hover:text-text-primary transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleUpdateRule(rule.id)}
                    className="px-4 py-2 rounded text-xs bg-accent-primary/10 border border-accent-primary/40 text-accent-primary hover:bg-accent-primary/20 transition-colors"
                  >
                    保存修改
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={rule.id}
              className={clsx(
                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                rule.enabled
                  ? "bg-bg-secondary border-border-color hover:border-accent-primary/30"
                  : "bg-bg-tertiary border-border-color/50 opacity-60"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Toggle */}
                <button
                  onClick={() => handleToggleEnabled(rule)}
                  className={clsx(
                    "w-10 h-5 rounded-full transition-colors relative",
                    rule.enabled ? "bg-accent-primary" : "bg-bg-tertiary border border-border-color"
                  )}
                >
                  <span
                    className={clsx(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                      rule.enabled ? "left-5 translate-x-0" : "left-0.5"
                    )}
                  />
                </button>

                {/* Info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className={clsx("flex items-center gap-1", cfg.color)}>
                      <cfg.icon size={12} />
                    </span>
                    <span className="text-sm font-medium text-text-primary">{rule.name}</span>
                    {rule.triggered && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">
                        已触发
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-text-muted">
                      阈值: <span className="text-text-secondary">{(rule.threshold * 100).toFixed(0)}%</span>
                    </span>
                    <span className="text-xs text-text-muted">
                      方式: <span className="text-text-secondary">{rule.actions.join(", ")}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startEdit(rule)}
                  className="p-1.5 rounded text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
                  title="编辑"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="p-1.5 rounded text-text-muted hover:text-accent-danger hover:bg-accent-danger/10 transition-colors"
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-8 text-text-muted text-sm">
          暂无预警规则，请添加
        </div>
      )}
    </div>
  );
}
