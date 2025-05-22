import { EventEmitter } from 'events';
import { jest } from '@jest/globals';

// WebSocket constants
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

export class MockWebSocket {
  static CONNECTING = WS_CONNECTING;
  static OPEN = WS_OPEN;
  static CLOSING = WS_CLOSING;
  static CLOSED = WS_CLOSED;

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  readyState = WS_CONNECTING;
  send = jest.fn();
  close = jest.fn(() => this.closeConnection(true));

  constructor(public url: string) {
    // Simulate async connection - make sure this happens immediately during the test
    this.readyState = WS_OPEN;
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }

  closeConnection(wasClean = true) {
    if (this.readyState === WS_CLOSED || this.readyState === WS_CLOSING) {
      return false;
    }
    
    this.readyState = WS_CLOSING;

    // Simulate async closing
    setTimeout(() => {
      this.readyState = WS_CLOSED;
      if (this.onclose) this.onclose();
    }, 0);

    return true;
  }

  open() {
    if (this.readyState !== WS_CONNECTING) {
      return false;
    }

    this.readyState = WS_OPEN;
    if (this.onopen) this.onopen();
    return true;
  }

  simulateError(error: Error) {
    // Create an event-like object with error property
    const errorEvent = { type: 'error', error } as Event;
    if (this.onerror) this.onerror(errorEvent);
    
    this.closeConnection(false);
  }

  simulateMessage(data: any): void {
    if (this.readyState !== WS_OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    const messageStr = typeof data === 'string' ? data : JSON.stringify(data);
    const messageEvent = { data: messageStr };
    
    if (this.onmessage) {
      this.onmessage(messageEvent);
    }
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