/**
 * PubSubBus - Agent间发布订阅通信总线
 * 支持跨Agent的事件发布订阅，用于并行Agent之间的数据共享和状态同步
 */

export interface AgentEvent {
  from: string;
  event: string;
  payload: unknown;
  timestamp: number;
  traceId: string;
}

export interface SubscribeOptions {
  from?: string;
  events: string[];
  callback: (e: AgentEvent) => void;
}

interface HandlerEntry {
  from: string | undefined;
  events: Set<string>;
  callback: (e: AgentEvent) => void;
}

export class PubSubBus {
  private handlers: Map<string, Set<HandlerEntry>> = new Map();
  private eventHistory: AgentEvent[] = [];
  private traceIndex: Map<string, AgentEvent[]> = new Map();

  /**
   * 订阅事件
   * @param opts 订阅选项: from(可选，来源Agent), events(事件列表), callback(回调函数)
   * @returns 取消订阅函数
   */
  subscribe(opts: SubscribeOptions): () => void {
    const { from, events, callback } = opts;
    const entry: HandlerEntry = {
      from,
      events: new Set(events),
      callback,
    };

    for (const event of events) {
      if (!this.handlers.has(event)) {
        this.handlers.set(event, new Set());
      }
      this.handlers.get(event)!.add(entry);
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribeEntry(entry);
    };
  }

  /**
   * 取消单个entry的订阅
   */
  private unsubscribeEntry(entry: HandlerEntry): void {
    for (const event of entry.events) {
      const handlers = this.handlers.get(event);
      if (handlers) {
        handlers.delete(entry);
        if (handlers.size === 0) {
          this.handlers.delete(event);
        }
      }
    }
  }

  /**
   * 发布事件到所有订阅者
   * @param event 事件对象
   */
  publish(event: AgentEvent): void {
    // Ensure timestamp and traceId
    const enrichedEvent: AgentEvent = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      traceId: event.traceId || '',
    };

    // Store in history (limit to 1000 events)
    this.eventHistory.push(enrichedEvent);
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-1000);
    }

    // Index by traceId
    if (enrichedEvent.traceId) {
      if (!this.traceIndex.has(enrichedEvent.traceId)) {
        this.traceIndex.set(enrichedEvent.traceId, []);
      }
      const traceEvents = this.traceIndex.get(enrichedEvent.traceId)!;
      traceEvents.push(enrichedEvent);
      if (traceEvents.length > 500) {
        this.traceIndex.set(enrichedEvent.traceId, traceEvents.slice(-500));
      }
    }

    // Notify handlers for each event type
    const handlers = this.handlers.get(enrichedEvent.event);
    if (handlers) {
      for (const handler of handlers) {
        // Check from filter
        if (handler.from !== undefined && handler.from !== enrichedEvent.from) {
          continue;
        }
        // Handler callback
        try {
          handler.callback(enrichedEvent);
        } catch {
          // Catch callback errors to not break other handlers
        }
      }
    }

    // Also notify wildcard handlers (subscribe with events: ['*'])
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        if (handler.from !== undefined && handler.from !== enrichedEvent.from) {
          continue;
        }
        try {
          handler.callback(enrichedEvent);
        } catch {
          // Catch callback errors
        }
      }
    }
  }

  /**
   * 取消订阅 - 移除指定来源的所有订阅
   * @param from 可选的来源Agent ID，不传则移除所有
   */
  unsubscribe(from?: string): void {
    if (from === undefined) {
      // Clear all handlers
      this.handlers.clear();
      return;
    }

    // Remove handlers for specific from
    for (const [event, handlers] of this.handlers.entries()) {
      for (const handler of handlers) {
        if (handler.from === from) {
          handlers.delete(handler);
        }
      }
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * 获取指定traceId的所有事件历史
   * @param traceId trace ID
   * @returns 事件数组，按时间排序
   */
  getEventHistory(traceId: string): AgentEvent[] {
    return this.traceIndex.get(traceId) || [];
  }

  /**
   * 获取所有事件历史（最近1000条）
   */
  getAllHistory(): AgentEvent[] {
    return [...this.eventHistory];
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.eventHistory = [];
    this.traceIndex.clear();
  }

  /**
   * 获取当前订阅统计
   */
  getStats(): { eventTypes: number; totalHandlers: number } {
    let totalHandlers = 0;
    for (const handlers of this.handlers.values()) {
      totalHandlers += handlers.size;
    }
    return {
      eventTypes: this.handlers.size,
      totalHandlers,
    };
  }
}

/**
 * Create a new PubSubBus instance
 */
export function createPubSubBus(): PubSubBus {
  return new PubSubBus();
}