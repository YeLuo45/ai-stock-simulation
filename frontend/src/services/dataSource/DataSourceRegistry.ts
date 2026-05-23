/**
 * DataSource Registry - Manages all data providers with automatic failover
 */
import type { DataSource, KLineData, RealtimeQuote, Symbol, DataSourceStatus } from './types';
import { TushareProvider } from './TushareProvider';
import { AKShareProvider } from './AKShareProvider';
import { YahooProvider } from './YahooProvider';
import { MockProvider } from './MockProvider';
import { getCached, setCache } from './cache';
import { messageBus, Channel } from '../messageBus';

// Registry key for storage
const REGISTRY_CONFIG_KEY = 'data_source_registry_config';

interface ProviderEntry {
  provider: DataSource;
  enabled: boolean;
}

// Registered providers
const providers: Map<string, ProviderEntry> = new Map();

// Provider status tracking
const providerStatus: Map<string, DataSourceStatus> = new Map();

// Default provider order
const DEFAULT_PRIORITY = ['tushare', 'akshare', 'yahoo', 'mock'];

function getConfig(): { order: string[]; enabled: Record<string, boolean> } {
  try {
    const stored = localStorage.getItem(REGISTRY_CONFIG_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { order: DEFAULT_PRIORITY, enabled: { tushare: true, akshare: true, yahoo: true, mock: true } };
}

function saveConfig(order: string[], enabled: Record<string, boolean>): void {
  localStorage.setItem(REGISTRY_CONFIG_KEY, JSON.stringify({ order, enabled }));
}

/**
 * Initialize the registry with all providers
 */
export function initializeRegistry(): void {
  providers.clear();

  register(TushareProvider);
  register(AKShareProvider);
  register(YahooProvider);
  register(MockProvider);

  // Initialize status for all
  providers.forEach((entry, name) => {
    providerStatus.set(name, {
      source: name,
      status: entry.enabled ? 'connected' : 'disabled',
    });
  });
}

/**
 * Register a provider
 */
export function register(provider: DataSource): void {
  const config = getConfig();
  providers.set(provider.name, {
    provider,
    enabled: config.enabled[provider.name] ?? true,
  });
}

/**
 * Enable/disable a provider
 */
export function setProviderEnabled(name: string, enabled: boolean): void {
  const entry = providers.get(name);
  if (entry) {
    entry.enabled = enabled;
    providerStatus.set(name, {
      source: name,
      status: enabled ? 'connected' : 'disabled',
    });

    const config = getConfig();
    config.enabled[name] = enabled;
    saveConfig(config.order, config.enabled);
  }
}

/**
 * Get a specific provider by name
 */
export function getProvider(name: string): DataSource | undefined {
  return providers.get(name)?.provider;
}

/**
 * Get all provider statuses
 */
export function getAllProviderStatus(): DataSourceStatus[] {
  return Array.from(providerStatus.values());
}

/**
 * Get primary (highest priority available) provider
 */
function getPrimaryProvider(): DataSource | undefined {
  const config = getConfig();

  for (const name of config.order) {
    const entry = providers.get(name);
    if (entry?.enabled) {
      return entry.provider;
    }
  }

  // Fallback to mock
  return providers.get('mock')?.provider;
}

/**
 * Get K-line data with automatic failover
 */
export async function getKline(symbol: string, period: string): Promise<KLineData[]> {
  const config = getConfig();
  const errors: string[] = [];

  for (const name of config.order) {
    const entry = providers.get(name);
    if (!entry?.enabled) continue;

    const start = Date.now();
    try {
      const data = await entry.provider.getKline(symbol, period);
      const latency = Date.now() - start;

      providerStatus.set(name, {
        source: name,
        status: 'connected',
        latency,
        lastFetch: Date.now(),
      });

      // Emit data:update event for event-driven data flow
      messageBus.emit(Channel.DATA_UPDATE, {
        type: 'kline',
        symbol,
        period,
        data,
        provider: name,
        timestamp: Date.now(),
      });

      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${name}: ${msg}`);

      providerStatus.set(name, {
        source: name,
        status: 'error',
        error: msg,
        lastFetch: Date.now(),
      });
    }
  }

  // All failed - try mock as last resort
  const mock = providers.get('mock');
  if (mock?.enabled) {
    return mock.provider.getKline(symbol, period);
  }

  throw new Error(`All providers failed: ${errors.join('; ')}`);
}

/**
 * Get realtime quote with automatic failover
 */
export async function getRealtime(symbol: string): Promise<RealtimeQuote> {
  const config = getConfig();
  const errors: string[] = [];

  for (const name of config.order) {
    const entry = providers.get(name);
    if (!entry?.enabled) continue;

    const start = Date.now();
    try {
      const data = await entry.provider.getRealtime(symbol);
      const latency = Date.now() - start;

      providerStatus.set(name, {
        source: name,
        status: 'connected',
        latency,
        lastFetch: Date.now(),
      });

      // Emit data:update event for event-driven data flow
      messageBus.emit(Channel.DATA_UPDATE, {
        type: 'realtime',
        symbol,
        data,
        provider: name,
        timestamp: Date.now(),
      });

      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${name}: ${msg}`);

      providerStatus.set(name, {
        source: name,
        status: 'error',
        error: msg,
        lastFetch: Date.now(),
      });
    }
  }

  // Fallback to mock
  const mock = providers.get('mock');
  if (mock?.enabled) {
    return mock.provider.getRealtime(symbol);
  }

  throw new Error(`All providers failed: ${errors.join('; ')}`);
}

/**
 * Search symbols with automatic failover
 */
export async function searchSymbols(keyword: string): Promise<Symbol[]> {
  const config = getConfig();
  const errors: string[] = [];

  for (const name of config.order) {
    const entry = providers.get(name);
    if (!entry?.enabled) continue;

    try {
      const data = await entry.provider.searchSymbols(keyword);
      if (data.length > 0) {
        providerStatus.set(name, {
          source: name,
          status: 'connected',
          lastFetch: Date.now(),
        });
        
        // Emit data:update event for event-driven data flow
        messageBus.emit(Channel.DATA_UPDATE, {
          type: 'search',
          keyword,
          data,
          provider: name,
          timestamp: Date.now(),
        });
        
        return data;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${name}: ${msg}`);
    }
  }

  // Fallback to mock
  const mock = providers.get('mock');
  if (mock?.enabled) {
    return mock.provider.searchSymbols(keyword);
  }

  throw new Error(`All providers failed: ${errors.join('; ')}`);
}

/**
 * Get index constituents with automatic failover
 */
export async function getIndexConstituents(index: string): Promise<string[]> {
  const config = getConfig();
  const errors: string[] = [];

  for (const name of config.order) {
    const entry = providers.get(name);
    if (!entry?.enabled) continue;

    try {
      const data = await entry.provider.getIndexConstituents(index);
      if (data.length > 0) {
        return data;
      }
    } catch (err) {
      errors.push(`${name}: ${err}`);
    }
  }

  // Fallback to mock
  const mock = providers.get('mock');
  if (mock?.enabled) {
    return mock.provider.getIndexConstituents(index);
  }

  throw new Error(`All providers failed: ${errors.join('; ')}`);
}

/**
 * Set provider priority order
 */
export function setProviderOrder(order: string[]): void {
  const config = getConfig();
  config.order = order;
  saveConfig(config.order, config.enabled);
}

// Initialize on module load
initializeRegistry();