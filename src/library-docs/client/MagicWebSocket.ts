/// <reference lib="dom" />

import { EventMessage, ComponentEventType } from '../types/websocket';
import { Component } from '../types/component';

declare global {
  interface Window {
    WebSocket: typeof WebSocket;
  }
}

export interface MagicWebSocketOptions {
  url: string;
  clientContext?: string;
  clientType?: string;
  region?: string;
  environment?: string;
  version?: string;
  capabilities?: string[];
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  pingInterval?: number;
}

export type EventHandler = (event: EventMessage) => void;

export class MagicWebSocket {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<ComponentEventType, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly options: MagicWebSocketOptions & {
    clientContext: string;
    clientType: string;
    autoReconnect: boolean;
    maxReconnectAttempts: number;
    reconnectInterval: number;
    pingInterval: number;
  };

  constructor(options: MagicWebSocketOptions) {
    this.options = {
      clientContext: 'default',
      clientType: 'web',
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectInterval: 1000,
      pingInterval: 30000,
      ...options
    };
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const queryParams = new URLSearchParams({
        clientContext: this.options.clientContext,
        clientType: this.options.clientType,
        region: this.options.region || '',
        environment: this.options.environment || '',
        version: this.options.version || '',
        capabilities: this.options.capabilities?.join(',') || ''
      });

      const url = `${this.options.url}?${queryParams.toString()}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setupPing();
        resolve();
      };

      this.ws.onclose = () => {
        this.cleanup();
        if (this.options.autoReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts));
        }
      };

      this.ws.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message: EventMessage = JSON.parse(event.data);
          const handlers = this.eventHandlers.get(message.event);
          if (handlers) {
            handlers.forEach(handler => handler(message));
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };
    });
  }

  public on(event: ComponentEventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  public off(event: ComponentEventType, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public disconnect(): void {
    this.cleanup();
    this.ws?.close();
  }

  private setupPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.ws!.send(JSON.stringify({ action: 'ping' }));
      }
    }, this.options.pingInterval);
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Example usage:
/*
const client = new MagicWebSocket({
  url: 'wss://your-api-gateway-url/dev',
  clientContext: 'my-app',
  clientType: 'web',
  environment: 'production',
  version: '1.0.0'
});

client.on('componentCreate', (event) => {
  console.log('Component created:', event.data.component);
});

client.on('componentUpdate', (event) => {
  console.log('Component updated:', event.data.component);
});

client.on('componentDelete', (event) => {
  console.log('Component deleted:', event.data.component);
});

await client.connect();
*/ 