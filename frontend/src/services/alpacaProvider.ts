/**
 * Alpaca Broker Provider Implementation
 * Uses native fetch to call Alpaca REST API
 * Paper Trading: https://paper-api.alpaca.markets
 * Live Trading: https://api.alpaca.markets
 */

import type {
  BrokerConfig,
  BrokerProvider,
  BrokerAccount,
  BrokerPosition,
  BrokerOrder,
  OrderSide,
  OrderType,
} from './brokerProvider';

const ALPACA_PAPER_URL = 'https://paper-api.alpaca.markets';
const ALPACA_LIVE_URL = 'https://api.alpaca.markets';

export class AlpacaProvider implements BrokerProvider {
  config: BrokerConfig;
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private _connected = false;

  constructor(config: BrokerConfig) {
    this.config = config;
    this.baseUrl = config.paper ? ALPACA_PAPER_URL : ALPACA_LIVE_URL;
    this.apiKey = config.apiKey || '';
    this.apiSecret = config.apiSecret || '';
  }

  private get headers(): HeadersInit {
    return {
      'APCA-API-KEY-ID': this.apiKey,
      'APCA-API-SECRET-KEY': this.apiSecret,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      throw new Error(`Alpaca API error ${res.status}: ${errorText}`);
    }

    // Handle 204 No Content
    if (res.status === 204) {
      return {} as T;
    }

    return res.json();
  }

  async connect(): Promise<void> {
    // Test connection by fetching account info
    await this.getAccount();
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }

  isConnected(): boolean {
    return this._connected;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const account = await this.getAccount();
      const mode = this.config.paper ? 'Paper' : 'Live';
      return {
        success: true,
        message: `${mode}模式连接成功 - 账户: ${account.accountId}, 权益: $${account.equity.toFixed(2)}`,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '连接失败';
      return { success: false, message: `连接失败: ${msg}` };
    }
  }

  async getAccount(): Promise<BrokerAccount> {
    const data = await this.request<{
      id: string;
      cash: string;
      equity: string;
      buying_power: string;
      currency: string;
    }>('/v2/account');

    return {
      accountId: data.id,
      cash: parseFloat(data.cash) || 0,
      equity: parseFloat(data.equity) || 0,
      buyingPower: parseFloat(data.buying_power) || 0,
      currency: data.currency || 'USD',
    };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const data = await this.request<Array<{
      symbol: string;
      qty: string;
      avg_entry_price: string;
      current_price: string;
      market_value: string;
      unrealized_pl: string;
      unrealized_plpc: string;
    }>>('/v2/positions');

    return data.map(pos => ({
      symbol: pos.symbol,
      quantity: parseFloat(pos.qty) || 0,
      avgCost: parseFloat(pos.avg_entry_price) || 0,
      currentPrice: parseFloat(pos.current_price) || 0,
      marketValue: parseFloat(pos.market_value) || 0,
      unrealizedPL: parseFloat(pos.unrealized_pl) || 0,
      unrealizedPLPct: parseFloat(pos.unrealized_plpc) || 0,
    }));
  }

  async getOrders(status: 'open' | 'closed' = 'open'): Promise<BrokerOrder[]> {
    const data = await this.request<Array<{
      id: string;
      symbol: string;
      side: OrderSide;
      qty: string;
      type: string;
      limit_price?: string;
      status: string;
      filled_qty: string;
      filled_at?: string;
    }>>(`/v2/orders?status=${status}`);

    return data.map(order => ({
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: parseFloat(order.qty) || 0,
      orderType: order.type === 'limit' ? 'limit' : 'market',
      limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
      status: this.mapOrderStatus(order.status),
      filledQty: parseFloat(order.filled_qty) || 0,
      filledAt: order.filled_at,
    }));
  }

  private mapOrderStatus(status: string): BrokerOrder['status'] {
    switch (status) {
      case 'new':
      case 'accepted':
      case 'pending_new':
      case 'queued':
        return 'pending';
      case 'filled':
        return 'filled';
      case 'cancelled':
        return 'cancelled';
      case 'rejected':
        return 'rejected';
      case 'partially_filled':
        return 'filled'; // Treat as filled for simplicity
      default:
        return 'pending';
    }
  }

  async placeOrder(
    symbol: string,
    side: OrderSide,
    qty: number,
    orderType: OrderType,
    limitPrice?: number
  ): Promise<BrokerOrder> {
    const body: Record<string, unknown> = {
      symbol,
      side,
      qty,
      type: orderType,
    };

    if (orderType === 'limit' && limitPrice) {
      body.limit_price = limitPrice;
    }

    // Time in force: day order
    body.time_in_force = 'day';

    const data = await this.request<{
      id: string;
      symbol: string;
      side: OrderSide;
      qty: string;
      type: string;
      limit_price?: string;
      status: string;
      filled_qty: string;
      filled_at?: string;
    }>('/v2/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      id: data.id,
      symbol: data.symbol,
      side: data.side,
      quantity: parseFloat(data.qty) || 0,
      orderType: data.type === 'limit' ? 'limit' : 'market',
      limitPrice: data.limit_price ? parseFloat(data.limit_price) : undefined,
      status: this.mapOrderStatus(data.status),
      filledQty: parseFloat(data.filled_qty) || 0,
      filledAt: data.filled_at,
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.request(`/v2/orders/${orderId}`, {
      method: 'DELETE',
    });
  }
}
