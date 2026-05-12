/**
 * SchedulerStore - LocalStorage-based schedule configuration store
 */

export interface ScheduleConfig {
  id: string;
  name: string;
  enabled: boolean;
  trigger: 'daily' | 'weekly' | 'manual';
  timeOfDay?: string;       // "14:30" format
  dayOfWeek?: number;       // 0-6, only for weekly (0=Sunday)
  stockPool: string[];
  factors: Array<{ factor_id: string; weight: number; direction: 'long' | 'short' }>;
  lastRun?: number;
  nextRun?: number;
  status: 'idle' | 'running' | 'success' | 'error';
  lastResult?: {
    selectedSymbol?: string;
    totalReturn?: number;
    sharpeRatio?: number;
    error?: string;
  };
}

const STORAGE_KEY = 'scheduler_configs';

function getStoredConfigs(): ScheduleConfig[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredConfigs(configs: ScheduleConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch {
    // Silent fail
  }
}

export const SchedulerStore = {
  /**
   * Save a schedule config (add or update)
   */
  saveSchedule(config: ScheduleConfig): void {
    const configs = getStoredConfigs();
    const idx = configs.findIndex(c => c.id === config.id);
    if (idx !== -1) {
      configs[idx] = config;
    } else {
      configs.push(config);
    }
    saveStoredConfigs(configs);
  },

  /**
   * Get all schedules
   */
  getSchedules(): ScheduleConfig[] {
    return getStoredConfigs();
  },

  /**
   * Delete a schedule by id
   */
  deleteSchedule(id: string): void {
    const configs = getStoredConfigs().filter(c => c.id !== id);
    saveStoredConfigs(configs);
  },

  /**
   * Update schedule status and other fields
   */
  updateScheduleStatus(id: string, updates: Partial<ScheduleConfig>): void {
    const configs = getStoredConfigs();
    const idx = configs.findIndex(c => c.id === id);
    if (idx !== -1) {
      configs[idx] = { ...configs[idx], ...updates };
      saveStoredConfigs(configs);
    }
  },

  /**
   * Calculate next run timestamp based on trigger config
   */
  calculateNextRun(config: ScheduleConfig): number {
    const now = Date.now();
    const today = new Date(now);

    if (config.trigger === 'manual') {
      return 0;
    }

    if (!config.timeOfDay) {
      return 0;
    }

    const [hours, minutes] = config.timeOfDay.split(':').map(Number);

    if (config.trigger === 'daily') {
      // Next occurrence of timeOfDay today or tomorrow
      const next = new Date(today);
      next.setHours(hours, minutes, 0, 0);
      if (next.getTime() <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next.getTime();
    }

    if (config.trigger === 'weekly') {
      if (config.dayOfWeek === undefined) return 0;
      const currentDay = today.getDay(); // 0=Sun, 6=Sat
      let daysUntilTarget = config.dayOfWeek - currentDay;
      if (daysUntilTarget < 0) daysUntilTarget += 7;
      // If same day but time has passed, go to next week
      if (daysUntilTarget === 0) {
        const targetThisWeek = new Date(today);
        targetThisWeek.setHours(hours, minutes, 0, 0);
        if (targetThisWeek.getTime() <= now) {
          daysUntilTarget = 7;
        }
      }
      const next = new Date(today);
      next.setDate(next.getDate() + daysUntilTarget);
      next.setHours(hours, minutes, 0, 0);
      return next.getTime();
    }

    return 0;
  },
};
