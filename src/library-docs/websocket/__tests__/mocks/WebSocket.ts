import { EventEmitter } from 'events';
import { jest } from '@jest/globals';

export class MockWebSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  send: jest.Mock;
  close: jest.Mock;

  constructor(url: string) {
    super();
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.send = jest.fn();
    this.close = jest.fn(() => this.closeConnection(true));

    // Simulate async connection
    Promise.resolve().then(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.open();
      }
    });
  }

  private async closeConnection(wasClean: boolean) {
    if (this.readyState !== MockWebSocket.CLOSING && this.readyState !== MockWebSocket.CLOSED) {
      this.readyState = MockWebSocket.CLOSING;
      await Promise.resolve();
      this.readyState = MockWebSocket.CLOSED;
      const event = new CloseEvent('close', { wasClean });
      this.emit('close', event);
      if (this.onclose) this.onclose(event);
    }
  }

  open(): boolean {
    if (this.readyState === MockWebSocket.CONNECTING) {
      this.readyState = MockWebSocket.OPEN;
      const event = new Event('open');
      this.emit('open', event);
      if (this.onopen) this.onopen(event);
      return true;
    }
    return false;
  }

  async simulateError(error: Error) {
    const wasOpen = this.readyState === MockWebSocket.OPEN;
    const event = new ErrorEvent('error', { error });
    this.emit('error', event);
    if (this.onerror) this.onerror(event);
    
    if (wasOpen) {
      await this.closeConnection(false);
    } else {
      this.readyState = MockWebSocket.CLOSED;
    }
  }

  simulateMessage(data: any) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    const event = new MessageEvent('message', { 
      data: typeof data === 'string' ? data : JSON.stringify(data) 
    });
    this.emit('message', event);
    if (this.onmessage) this.onmessage(event);
  }
}

// Event classes for Node.js environment
class Event {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

class CloseEvent extends Event {
  code?: number;
  reason?: string;
  wasClean: boolean;

  constructor(type: string, init?: { code?: number; reason?: string; wasClean?: boolean }) {
    super(type);
    this.code = init?.code;
    this.reason = init?.reason;
    this.wasClean = init?.wasClean || false;
  }
}

class MessageEvent extends Event {
  data: any;

  constructor(type: string, init?: { data?: any }) {
    super(type);
    this.data = init?.data;
  }
}

class ErrorEvent extends Event {
  error: Error;

  constructor(type: string, init?: { error?: Error }) {
    super(type);
    this.error = init?.error || new Error('Unknown error');
  }
}

// Export the event classes for use in tests
export { Event, CloseEvent, MessageEvent, ErrorEvent }; 