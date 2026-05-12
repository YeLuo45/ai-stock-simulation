/**
 * Notification Service - Risk Alert Management
 * Handles browser notifications and local storage for risk alerts
 */

export interface RiskAlert {
  id: string;
  level: 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  metadata?: Record<string, unknown>;
}

const STORAGE_KEY = 'risk_alerts';
const MAX_ALERTS = 50;

function generateId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getStoredAlerts(): RiskAlert[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAlerts(alerts: RiskAlert[]): void {
  try {
    // Keep only the most recent MAX_ALERTS
    const trimmed = alerts.slice(-MAX_ALERTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Silent fail for storage errors
  }
}

export const NotificationService = {
  /**
   * Request browser notification permission
   * @returns true if permission granted, false otherwise
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission === 'denied') {
      return false;
    }
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  },

  /**
   * Send a risk alert
   * Shows browser notification if permitted, and stores in localStorage
   */
  sendAlert(alert: Omit<RiskAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const fullAlert: RiskAlert = {
      ...alert,
      id: generateId(),
      timestamp: Date.now(),
      acknowledged: false,
    };

    // Store in localStorage
    const alerts = getStoredAlerts();
    alerts.push(fullAlert);
    saveAlerts(alerts);

    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(fullAlert.title, {
          body: fullAlert.message,
          icon: '/favicon.ico',
          tag: fullAlert.id,
        });
      } catch {
        // Silent fail for notification errors
      }
    }
  },

  /**
   * Get all alerts from localStorage
   */
  getAlerts(): RiskAlert[] {
    return getStoredAlerts();
  },

  /**
   * Mark a specific alert as acknowledged
   */
  acknowledgeAlert(id: string): void {
    const alerts = getStoredAlerts();
    const idx = alerts.findIndex(a => a.id === id);
    if (idx !== -1) {
      alerts[idx].acknowledged = true;
      saveAlerts(alerts);
    }
  },

  /**
   * Get count of unacknowledged alerts
   */
  getUnacknowledgedCount(): number {
    const alerts = getStoredAlerts();
    return alerts.filter(a => !a.acknowledged).length;
  },
};
