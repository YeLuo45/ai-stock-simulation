/**
 * MessageBus - Event Bus Singleton for Service Layer
 * Provides event-driven architecture for regime, data, and workflow events
 */
import { EventEmitter } from './EventEmitter';
import { Channel, type ChannelName } from './channel';

class MessageBus {
  private emitter: EventEmitter;
  private initialized: boolean;

  constructor() {
    this.emitter = new EventEmitter();
    this.initialized = false;
  }

  /**
   * Initialize the message bus
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[MessageBus] Initialized');
  }

  /**
   * Subscribe to an event channel
   * @param channel - Event channel name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on<T = unknown>(channel: ChannelName, handler: (payload: T) => void): () => void {
    return this.emitter.on(channel, handler);
  }

  /**
   * Subscribe once to an event channel
   * @param channel - Event channel name
   * @param handler - Event handler function
   */
  once<T = unknown>(channel: ChannelName, handler: (payload: T) => void): void {
    this.emitter.once(channel, handler);
  }

  /**
   * Unsubscribe from an event channel
   * @param channel - Event channel name
   * @param handler - Event handler function
   */
  off<T = unknown>(channel: ChannelName, handler: (payload: T) => void): void {
    this.emitter.off(channel, handler);
  }

  /**
   * Emit an event to all subscribers
   * @param channel - Event channel name
   * @param payload - Event payload
   */
  emit<T = unknown>(channel: ChannelName, payload: T): void {
    this.emitter.emit(channel, payload);
  }

  /**
   * Subscribe to all events (wildcard)
   * @param handler - Handler that receives { channel, payload }
   * @returns Unsubscribe function
   */
  onAny(handler: (event: { channel: ChannelName; payload: unknown }) => void): () => void {
    return this.emitter.onAny(handler);
  }

  /**
   * Remove all listeners
   * @param channel - Optional channel to clear (clears all if not provided)
   */
  removeAllListeners(channel?: ChannelName): void {
    this.emitter.removeAllListeners(channel);
  }

  /**
   * Get listener count for a channel
   */
  listenerCount(channel: ChannelName): number {
    return this.emitter.listenerCount(channel);
  }

  /**
   * Get all active channels
   */
  getChannels(): ChannelName[] {
    return this.emitter.getChannels();
  }
}

// Singleton instance
const messageBus = new MessageBus();

// Auto-initialize on module load
messageBus.init();

export { messageBus, Channel, type ChannelName };
export { EventEmitter };
export default messageBus;