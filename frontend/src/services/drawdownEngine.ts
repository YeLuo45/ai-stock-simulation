/**
 * Drawdown Calculation Engine
 * Computes drawdown metrics, tracks equity curve, and checks alert thresholds
 */
import { load, save } from "./storage";
import type { Trade } from "../types";

// ============== Types ==============

export interface EquitySnapshot {
  timestamp: string;
  value: number;
  drawdown: number;
  maxDrawdown: number;
}

export interface DrawdownResult {
  currentDrawdown: number;    // e.g., -0.12 for -12%
  maxDrawdown: number;        // historical max
  peakValue: number;
  peakDate: string;
  currentValue: number;
  currentDate: string;
  inDrawdown: boolean;
  drawdownDuration?: number;  // hours since peak
}

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertAction = "browser" | "notification" | "email";

export interface AlertRule {
  id: string;
  name: string;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  actions: AlertAction[];
  triggered: boolean;
  triggeredAt?: string;
  recoveredAt?: string;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  threshold: number;
  severity: AlertSeverity;
  drawdownValue: number;
  triggeredAt: string;
  recoveredAt?: string;
  duration?: number;          // hours
}

// ============== Storage Keys ==============

const KEY_EQUITY_SNAPSHOTS = "equity_curve_snapshots";
const KEY_ALERT_RULES = "alert_rules";
const KEY_ALERT_EVENTS = "alert_events";

// ============== Default Alert Rules ==============

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: "rule-5pct",
    name: "小幅回撤",
    threshold: -0.05,
    severity: "info",
    enabled: true,
    actions: ["browser"],
    triggered: false,
  },
  {
    id: "rule-10pct",
    name: "中度回撤",
    threshold: -0.10,
    severity: "warning",
    enabled: true,
    actions: ["browser", "notification"],
    triggered: false,
  },
  {
    id: "rule-20pct",
    name: "严重回撤",
    threshold: -0.20,
    severity: "critical",
    enabled: true,
    actions: ["browser", "notification", "email"],
    triggered: false,
  },
  {
    id: "rule-30pct",
    name: "极度回撤",
    threshold: -0.30,
    severity: "critical",
    enabled: true,
    actions: ["browser", "notification", "email"],
    triggered: false,
  },
];

// ============== Equity Snapshot Management ==============

export function getEquitySnapshots(): EquitySnapshot[] {
  return load<EquitySnapshot[]>(KEY_EQUITY_SNAPSHOTS, []);
}

export function saveEquitySnapshots(snapshots: EquitySnapshot[]): void {
  // Keep last 1000 snapshots
  const trimmed = snapshots.slice(-1000);
  save(KEY_EQUITY_SNAPSHOTS, trimmed);
}

export function trackEquitySnapshot(value: number, timestamp?: string): EquitySnapshot {
  const now = timestamp || new Date().toISOString();
  const snapshots = getEquitySnapshots();

  // Find peak
  let peakValue = value;
  for (const s of snapshots) {
    if (s.value > peakValue) {
      peakValue = s.value;
    }
  }

  const currentDrawdown = peakValue > 0 ? (value - peakValue) / peakValue : 0;
  const maxDrawdown = snapshots.length > 0
    ? Math.min(...snapshots.map(s => s.drawdown), currentDrawdown)
    : currentDrawdown;

  const snapshot: EquitySnapshot = {
    timestamp: now,
    value,
    drawdown: currentDrawdown,
    maxDrawdown,
  };

  snapshots.push(snapshot);
  saveEquitySnapshots(snapshots);

  return snapshot;
}

// ============== Rebuild Equity from Trades ==============

export function rebuildEquityFromTrades(
  trades: Trade[],
  initialCash: number = 1000000
): EquitySnapshot[] {
  if (!trades || trades.length === 0) {
    return [];
  }

  // Sort trades by timestamp
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const snapshots: EquitySnapshot[] = [];
  let cash = initialCash;
  let peakValue = initialCash;

  for (const trade of sortedTrades) {
    const tradeValue = trade.price * trade.quantity;
    if (trade.trade_type === "buy") {
      cash -= tradeValue;
    } else {
      cash += tradeValue;
    }

    const totalValue = cash;
    const now = trade.timestamp;

    if (totalValue > peakValue) {
      peakValue = totalValue;
    }

    const currentDrawdown = peakValue > 0 ? (totalValue - peakValue) / peakValue : 0;
    const maxDrawdown = snapshots.length > 0
      ? Math.min(...snapshots.map(s => s.drawdown), currentDrawdown)
      : currentDrawdown;

    snapshots.push({
      timestamp: now,
      value: totalValue,
      drawdown: currentDrawdown,
      maxDrawdown,
    });
  }

  return snapshots;
}

// ============== Drawdown Calculation ==============

export function computeDrawdown(equityCurve?: EquitySnapshot[]): DrawdownResult {
  const snapshots = equityCurve || getEquitySnapshots();

  if (snapshots.length === 0) {
    return {
      currentDrawdown: 0,
      maxDrawdown: 0,
      peakValue: 0,
      peakDate: new Date().toISOString(),
      currentValue: 0,
      currentDate: new Date().toISOString(),
      inDrawdown: false,
      drawdownDuration: 0,
    };
  }

  let peakValue = -Infinity;
  let peakDate = "";
  let maxDrawdown = 0;

  for (const s of snapshots) {
    if (s.value > peakValue) {
      peakValue = s.value;
      peakDate = s.timestamp;
    }
    if (s.drawdown < maxDrawdown) {
      maxDrawdown = s.drawdown;
    }
  }

  const latest = snapshots[snapshots.length - 1];
  const currentValue = latest.value;
  const currentDate = latest.timestamp;
  const currentDrawdown = peakValue > 0 ? (currentValue - peakValue) / peakValue : 0;
  const inDrawdown = currentDrawdown < 0;

  // Calculate drawdown duration
  let drawdownDuration = 0;
  if (inDrawdown && peakDate) {
    const peakTime = new Date(peakDate).getTime();
    const currentTime = new Date(currentDate).getTime();
    drawdownDuration = (currentTime - peakTime) / (1000 * 60 * 60);
  }

  return {
    currentDrawdown,
    maxDrawdown,
    peakValue,
    peakDate,
    currentValue,
    currentDate,
    inDrawdown,
    drawdownDuration,
  };
}

// ============== Alert Rules Management ==============

export function getAlertRules(): AlertRule[] {
  return load<AlertRule[]>(KEY_ALERT_RULES, [...DEFAULT_ALERT_RULES]);
}

export function saveAlertRules(rules: AlertRule[]): void {
  save(KEY_ALERT_RULES, rules);
}

export function updateAlertRule(id: string, updates: Partial<AlertRule>): AlertRule | null {
  const rules = getAlertRules();
  const idx = rules.findIndex(r => r.id === id);
  if (idx < 0) return null;
  rules[idx] = { ...rules[idx], ...updates };
  saveAlertRules(rules);
  return rules[idx];
}

export function addAlertRule(rule: AlertRule): void {
  const rules = getAlertRules();
  rules.push(rule);
  saveAlertRules(rules);
}

export function deleteAlertRule(id: string): void {
  const rules = getAlertRules().filter(r => r.id !== id);
  saveAlertRules(rules);
}

// ============== Alert Events ==============

export function getAlertEvents(): AlertEvent[] {
  return load<AlertEvent[]>(KEY_ALERT_EVENTS, []);
}

export function saveAlertEvents(events: AlertEvent[]): void {
  // Keep last 100 events
  const trimmed = events.slice(-100);
  save(KEY_ALERT_EVENTS, trimmed);
}

export function addAlertEvent(event: AlertEvent): void {
  const events = getAlertEvents();
  events.push(event);
  saveAlertEvents(events);
}

export function recoverAlertEvent(ruleId: string): void {
  const events = getAlertEvents();
  // Find the last un-recovered event for this rule
  let idx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].ruleId === ruleId && !events[i].recoveredAt) {
      idx = i;
      break;
    }
  }
  if (idx >= 0) {
    const recoveredAt = new Date().toISOString();
    events[idx].recoveredAt = recoveredAt;
    if (events[idx].triggeredAt) {
      const start = new Date(events[idx].triggeredAt).getTime();
      const end = new Date(recoveredAt).getTime();
      events[idx].duration = (end - start) / (1000 * 60 * 60);
    }
    saveAlertEvents(events);
  }
}

// ============== Alert Checking ==============

export function checkAlertThresholds(
  currentDrawdown: number,
  rules?: AlertRule[]
): AlertRule[] {
  const alertRules = rules || getAlertRules();
  const triggeredRules: AlertRule[] = [];

  for (const rule of alertRules) {
    if (!rule.enabled) continue;
    if (currentDrawdown <= rule.threshold && !rule.triggered) {
      triggeredRules.push(rule);
    }
  }

  return triggeredRules;
}

// ============== Browser Notification ==============

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission === "denied") {
    return false;
  }
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendBrowserNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }
  return new Notification(title, options);
}

export function sendDrawdownAlert(
  rule: AlertRule,
  currentDrawdown: number
): void {
  const pct = (currentDrawdown * 100).toFixed(1);
  const thresholdPct = (rule.threshold * 100).toFixed(0);

  if (rule.actions.includes("browser")) {
    sendBrowserNotification("回撤预警", {
      body: `组合当前回撤 ${pct}%，超过您设置的 ${thresholdPct}% 阈值`,
      icon: "/icon.png",
      tag: `drawdown-${rule.id}`,
    });
  }

  if (rule.actions.includes("email")) {
    const subject = encodeURIComponent(`【回撤预警】组合回撤 ${pct}%`);
    const body = encodeURIComponent(
      `组合当前回撤 ${pct}%，超过您设置的 ${thresholdPct}% 阈值。\n` +
      `预警规则: ${rule.name}\n` +
      `触发时间: ${new Date().toLocaleString("zh-CN")}\n` +
      `请及时查看并处理。`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }
}

// ============== Main Check Function ==============

export function checkAndTriggerAlerts(currentDrawdown: number): AlertEvent[] {
  const rules = getAlertRules();
  const triggeredRules = checkAlertThresholds(currentDrawdown, rules);
  const events: AlertEvent[] = [];

  for (const rule of triggeredRules) {
    // Update rule state
    updateAlertRule(rule.id, {
      triggered: true,
      triggeredAt: new Date().toISOString(),
    });

    // Send notifications
    sendDrawdownAlert(rule, currentDrawdown);

    // Create event
    const event: AlertEvent = {
      id: `evt-${Date.now()}-${rule.id}`,
      ruleId: rule.id,
      ruleName: rule.name,
      threshold: rule.threshold,
      severity: rule.severity,
      drawdownValue: currentDrawdown,
      triggeredAt: new Date().toISOString(),
    };
    addAlertEvent(event);
    events.push(event);
  }

  // Check for recovery
  for (const rule of rules) {
    if (rule.enabled && rule.triggered && currentDrawdown > rule.threshold) {
      // Recovered
      updateAlertRule(rule.id, {
        triggered: false,
        recoveredAt: new Date().toISOString(),
      });
      recoverAlertEvent(rule.id);
    }
  }

  return events;
}

// ============== Equity Curve for Charts ==============

export function getEquityCurveData(): { date: string; value: number; drawdown: number }[] {
  return getEquitySnapshots().map(s => ({
    date: s.timestamp,
    value: s.value,
    drawdown: s.drawdown,
  }));
}

// ============== Reset ==============

export function resetDrawdownState(): void {
  localStorage.removeItem(KEY_EQUITY_SNAPSHOTS);
  localStorage.removeItem(KEY_ALERT_EVENTS);
  saveAlertRules([...DEFAULT_ALERT_RULES]);
}
