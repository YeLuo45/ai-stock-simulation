/**
 * Broker Provider Abstraction Layer
 * Supports Alpaca, Interactive Brokers, and Simulate modes
 */

// ============ Types ============

export type BrokerType = 'alpaca' | 'interactive_brokers' | 'simulate';

export interface BrokerConfig {
  provider: BrokerType;
  apiKey?: string;
  apiSecret?: string;
  paper?: boolean; // Alpaca paper trading
  baseUrl?: string;
}

export interface BrokerPosition {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPct: number;
}

export interface BrokerAccount {
  accountId: string;
  cash: number;
  equity: number;
  buyingPower: number;
  currency: string;
}

export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected' | 'open' | 'closed';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';

export interface BrokerOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  orderType: OrderType;
  limitPrice?: number;
  status: OrderStatus;
  filledQty: number;
  filledAt?: string;
}

export interface BrokerProvider {
  config: BrokerConfig;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAccount(): Promise<BrokerAccount>;
  getPositions(): Promise<BrokerPosition[]>;
  getOrders(status?: 'open' | 'closed'): Promise<BrokerOrder[]>;
  placeOrder(symbol: string, side: OrderSide, qty: number, orderType: OrderType, limitPrice?: number): Promise<BrokerOrder>;
  cancelOrder(orderId: string): Promise<void>;
  isConnected(): boolean;
  testConnection(): Promise<{ success: boolean; message: string }>;
}

// ============ Simulate Provider (Default) ============

class SimulateProvider implements BrokerProvider {
  config: BrokerConfig;
  private _connected = false;
  private account: BrokerAccount = {
    accountId: 'simulate-001',
    cash: 1000000,
    equity: 1000000,
    buyingPower: 1000000,
    currency: 'CNY',
  };
  private positions: BrokerPosition[] = [];
  private orders: BrokerOrder[] = [];

  constructor(config: BrokerConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    await new Promise(r => setTimeout(r, 300));
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }

  isConnected(): boolean {
    return this._connected;
  }

  async getAccount(): Promise<BrokerAccount> {
    return { ...this.account };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    return [...this.positions];
  }

  async getOrders(_status?: 'open' | 'closed'): Promise<BrokerOrder[]> {
    return [...this.orders];
  }

  async placeOrder(symbol: string, side: OrderSide, qty: number, orderType: OrderType, limitPrice?: number): Promise<BrokerOrder> {
    const order: BrokerOrder = {
      id: `sim-${Date.now()}`,
      symbol,
      side,
      quantity: qty,
      orderType,
      limitPrice,
      status: 'filled',
      filledQty: qty,
      filledAt: new Date().toISOString(),
    };
    this.orders.push(order);

    // Update positions
    const existing = this.positions.find(p => p.symbol === symbol);
    if (side === 'buy') {
      if (existing) {
        const totalCost = existing.avgCost * existing.quantity + (limitPrice || 0) * qty;
        existing.quantity += qty;
        existing.avgCost = totalCost / existing.quantity;
      } else {
        this.positions.push({
          symbol,
          quantity: qty,
          avgCost: limitPrice || 0,
          currentPrice: limitPrice || 0,
          marketValue: qty * (limitPrice || 0),
          unrealizedPL: 0,
          unrealizedPLPct: 0,
        });
      }
      this.account.cash -= qty * (limitPrice || 0);
    } else {
      if (existing) {
        existing.quantity -= qty;
        if (existing.quantity <= 0) {
          this.positions = this.positions.filter(p => p.symbol !== symbol);
        }
      }
      this.account.cash += qty * (limitPrice || 0);
    }
    this.account.equity = this.account.cash + this.positions.reduce((sum, p) => sum + p.marketValue, 0);

    return order;
  }

  async cancelOrder(orderId: string): Promise<void> {
    const order = this.orders.find(o => o.id === orderId);
    if (order && order.status === 'pending') {
      order.status = 'cancelled';
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: '模拟模式连接成功' };
  }
}

// ============ Factory ============

export function createBrokerProvider(config: BrokerConfig): BrokerProvider {
  switch (config.provider) {
    case 'alpaca':
      // Dynamic import to avoid circular deps - will be loaded later
      return createAlpacaProvider(config);
    case 'interactive_brokers':
      // Placeholder for IB
      return createSimulateProvider(config);
    case 'simulate':
    default:
      return createSimulateProvider(config);
  }
}

function createSimulateProvider(config: BrokerConfig): BrokerProvider {
  return new SimulateProvider(config);
}

function createAlpacaProvider(config: BrokerConfig): BrokerProvider {
  // This will be replaced by actual AlpacaProvider after we import it
  // For now, return a proxy that loads alpacaProvider dynamically
  return new (class AlpacaProviderProxy implements BrokerProvider {
    config = config;
    private provider: BrokerProvider | null = null;

    async loadProvider(): Promise<BrokerProvider> {
      if (!this.provider) {
        const { AlpacaProvider } = await import('./alpacaProvider');
        this.provider = new AlpacaProvider(config);
      }
      return this.provider;
    }

    async connect(): Promise<void> {
      const p = await this.loadProvider();
      return p.connect();
    }
    async disconnect(): Promise<void> {
      if (this.provider) return this.provider.disconnect();
    }
    async getAccount(): Promise<BrokerAccount> {
      const p = await this.loadProvider();
      return p.getAccount();
    }
    async getPositions(): Promise<BrokerPosition[]> {
      const p = await this.loadProvider();
      return p.getPositions();
    }
    async getOrders(status?: 'open' | 'closed'): Promise<BrokerOrder[]> {
      const p = await this.loadProvider();
      return p.getOrders(status);
    }
    async placeOrder(symbol: string, side: OrderSide, qty: number, orderType: OrderType, limitPrice?: number): Promise<BrokerOrder> {
      const p = await this.loadProvider();
      return p.placeOrder(symbol, side, qty, orderType, limitPrice);
    }
    async cancelOrder(orderId: string): Promise<void> {
      const p = await this.loadProvider();
      return p.cancelOrder(orderId);
    }
    isConnected(): boolean {
      return this.provider?.isConnected() ?? false;
    }
    async testConnection(): Promise<{ success: boolean; message: string }> {
      const p = await this.loadProvider();
      return p.testConnection();
    }
  })();
}

// ============ Config Storage ============

const BROKER_CONFIG_KEY = 'broker_config';

export function loadBrokerConfig(): BrokerConfig {
  try {
    const saved = localStorage.getItem(BROKER_CONFIG_KEY);
    if (saved) {
      const config = JSON.parse(saved);
      // Decode base64 encoded secrets
      if (config._encoded) {
        config.apiKey = atob(config.apiKey || '');
        config.apiSecret = atob(config.apiSecret || '');
        delete config._encoded;
      }
      return config;
    }
  } catch {}
  return { provider: 'simulate', paper: true };
}

export function saveBrokerConfig(config: BrokerConfig): void {
  try {
    // Encode secrets in base64 for storage
    const toSave: BrokerConfig & { _encoded?: boolean } = { ...config };
    if (config.apiKey) {
      toSave.apiKey = btoa(config.apiKey);
    }
    if (config.apiSecret) {
      toSave.apiSecret = btoa(config.apiSecret);
    }
    toSave._encoded = true;
    localStorage.setItem(BROKER_CONFIG_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save broker config:', e);
  }
}

export function clearBrokerConfig(): void {
  try {
    localStorage.removeItem(BROKER_CONFIG_KEY);
  } catch {}
}
