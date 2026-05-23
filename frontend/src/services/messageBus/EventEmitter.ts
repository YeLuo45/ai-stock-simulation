/**
 * EventEmitter - Lightweight event emitter for MessageBus
 * Provides publish/subscribe pattern with event namespacing
 */
import type { ChannelName } from './channel';

export type EventHandler<T = unknown> = (payload: T) => void;

interface Listener<T = unknown> {
  handler: EventHandler<T>;
  once: boolean;
}

export class EventEmitter {
  private listeners: Map<ChannelName, Listener[]>;
  private anyListeners: Array<EventHandler<{ channel: ChannelName; payload: unknown }>>;

  constructor() {
    this.listeners = new Map();
    this.anyListeners = [];
  }

  /**
   * Subscribe to an event
   * @param channel - Event channel name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on<T = unknown>(channel: ChannelName, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);
    }
    const listeners = this.listeners.get(channel)!;
    listeners.push({ handler: handler as EventHandler<unknown>, once: false });

    // Return unsubscribe function
    return () => this.off(channel, handler);
  }

  /**
   * Subscribe to an event only once
   * @param channel - Event channel name
   * @param handler - Event handler function
   */
  once<T = unknown>(channel: ChannelName, handler: EventHandler<T>): void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);
    }
    const listeners = this.listeners.get(channel)!;
    listeners.push({ handler: handler as EventHandler<unknown>, once: true });
  }

  /**
   * Unsubscribe from an event
   * @param channel - Event channel name
   * @param handler - Event handler to remove
   */
  off<T = unknown>(channel: ChannelName, handler: EventHandler<T>): void {
    const listeners = this.listeners.get(channel);
    if (listeners) {
      const index = listeners.findIndex(l => l.handler === handler);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   * @param channel - Event channel name
   * @param payload - Event payload
   */
  emit<T = unknown>(channel: ChannelName, payload: T): void {
    // Emit to specific channel listeners
    const listeners = this.listeners.get(channel);
    if (listeners && listeners.length > 0) {
      // Create a copy to avoid mutation issues during emission
      const toEmit = [...listeners];
      for (let i = toEmit.length - 1; i >= 0; i--) {
        const listener = toEmit[i];
        try {
          listener.handler(payload);
        } catch (error) {
          console.error(`[EventEmitter] Handler error on ${channel}:`, error);
        }
        // Remove if once listener
        if (listener.once) {
          const idx = listeners.indexOf(listener);
          if (idx !== -1) listeners.splice(idx, 1);
        }
      }
    }

    // Emit to any-listener (wildcard subscribers)
    if (this.anyListeners.length > 0) {
      const anyPayload = { channel, payload };
      for (const handler of this.anyListeners) {
        try {
          handler(anyPayload);
        } catch (error) {
          console.error('[EventEmitter] Any-listener error:', error);
        }
      }
    }
  }

  /**
   * Subscribe to all events (wildcard)
   * @param handler - Handler that receives { channel, payload }
   * @returns Unsubscribe function
   */
  onAny(handler: EventHandler<{ channel: ChannelName; payload: unknown }>): () => void {
    this.anyListeners.push(handler);
    return () => {
      const index = this.anyListeners.indexOf(handler);
      if (index !== -1) this.anyListeners.splice(index, 1);
    };
  }

  /**
   * Remove all listeners for a channel
   * @param channel - Event channel name (optional, removes all if not provided)
   */
  removeAllListeners(channel?: ChannelName): void {
    if (channel) {
      this.listeners.delete(channel);
    } else {
      this.listeners.clear();
      this.anyListeners = [];
    }
  }

  /**
   * Get listener count for a channel
   */
  listenerCount(channel: ChannelName): number {
    return this.listeners.get(channel)?.length ?? 0;
  }

  /**
   * Get all channel names with listeners
   */
  getChannels(): ChannelName[] {
    return Array.from(this.listeners.keys()).filter(
      ch => (this.listeners.get(ch)?.length ?? 0) > 0
    );
  }
}