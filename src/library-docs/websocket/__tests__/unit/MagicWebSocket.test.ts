import '@jest/globals';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import '../setup';

// Import mocks
import { mockDynamoClient, mockApiGatewayClient, resetDynamoMocks, resetApiGatewayMocks } from '../mocks/aws-sdk/mock-clients';

// Import types
import { MagicWebSocket } from '../../client/MagicWebSocket';
import { EventMessage, ComponentEventType } from '../../types/websocket';
import { MockWebSocket } from '../mocks/WebSocket';

// Set shorter test timeout
jest.setTimeout(5000);

describe('MagicWebSocket', () => {
  let ws: MagicWebSocket;
  let mockWs: MockWebSocket;
  
  beforeEach(() => {
    jest.useFakeTimers();
    mockWs = new MockWebSocket('ws://localhost:8080');
    (global as any).WebSocket = jest.fn().mockImplementation(() => mockWs);

    ws = new MagicWebSocket({
      url: 'ws://localhost:8080',
      clientContext: 'test-context',
      clientType: 'test',
      environment: 'test',
      region: 'us-east-1',
      pingInterval: 100, // Shorter interval for testing
      reconnectInterval: 50 // Shorter interval for testing
    });

    resetDynamoMocks();
    resetApiGatewayMocks();
  });

  afterEach(() => {
    ws.disconnect();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      const connectPromise = ws.connect();
      await connectPromise;
      expect(ws.isConnected()).toBe(true);
    });

    it('should handle connection error', async () => {
      const mockError = new Error('WebSocket connection failed');
      const connectPromise = ws.connect();
      mockWs.simulateError(mockError);
      await expect(connectPromise).rejects.toEqual(mockError);
      expect(ws.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      const connectPromise = ws.connect();
      await connectPromise;
      expect(ws.isConnected()).toBe(true);

      ws.disconnect();
      expect(ws.isConnected()).toBe(false);
    });
  });

  describe('ping/pong', () => {
    it('should send ping messages', async () => {
      const connectPromise = ws.connect();
      await connectPromise;
      jest.advanceTimersByTime(100);
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ action: 'ping' }));
    });
  });

  describe('message handling', () => {
    it('should handle incoming messages', async () => {
      const handler = jest.fn();
      ws.on('componentUpdate', handler);

      const connectPromise = ws.connect();
      await connectPromise;

      const testMessage: EventMessage = {
        event: 'componentUpdate',
        data: {
          action: 'update',
          component: { id: 'test-1', value: 'test' },
          timestamp: new Date().toISOString()
        }
      };

      mockWs.simulateMessage(testMessage);
      expect(handler).toHaveBeenCalledWith(testMessage);
    });

    it('should handle multiple messages in order', async () => {
      const messages: string[] = [];
      const handler = (msg: EventMessage) => messages.push(msg.data.component.id);

      ws.on('componentUpdate', handler);
      const connectPromise = ws.connect();
      await connectPromise;

      const testMessages = Array.from({ length: 5 }, (_, i) => ({
        event: 'componentUpdate' as ComponentEventType,
        data: {
          action: 'update',
          component: { id: `msg-${i}`, value: 'test' },
          timestamp: new Date().toISOString()
        }
      }));

      testMessages.forEach(msg => mockWs.simulateMessage(msg));
      expect(messages).toEqual(testMessages.map(m => m.data.component.id));
    });
  });

  describe('reconnection', () => {
    it('should attempt to reconnect after connection loss', async () => {
      const connectPromise = ws.connect();
      await connectPromise;
      expect(ws.isConnected()).toBe(true);

      // Simulate connection loss
      mockWs.simulateError(new Error('Connection lost'));
      expect(ws.isConnected()).toBe(false);

      // Create new mock for reconnection
      const mockWs2 = new MockWebSocket('ws://localhost:8080');
      (global as any).WebSocket = jest.fn().mockImplementation(() => mockWs2);

      // Wait for reconnect attempt
      jest.advanceTimersByTime(50);
      await Promise.resolve(); // Let the microtask queue process

      expect(ws.isConnected()).toBe(true);
    });
  });
}); 