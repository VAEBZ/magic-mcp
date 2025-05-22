import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import '../setup';
import { MagicWebSocket } from '../../client/MagicWebSocket';
import { EventMessage } from '../../types/websocket';
import { config } from '../../../config';
import { MockWebSocket } from '../mocks/WebSocket';
import { resetAwsMocks } from '../mocks/aws-sdk';

jest.setTimeout(5000); // Set shorter timeout for all tests

describe('WebSocket Integration', () => {
  let ws1: MagicWebSocket;
  let ws2: MagicWebSocket;
  let mockWs1: MockWebSocket;
  let mockWs2: MockWebSocket;

  beforeEach(async () => {
    jest.useFakeTimers();
    resetAwsMocks();

    // Create mock WebSockets
    mockWs1 = new MockWebSocket('ws://localhost:8080');
    mockWs2 = new MockWebSocket('ws://localhost:8080');
    (global as any).WebSocket = jest.fn()
      .mockImplementationOnce(() => mockWs1)
      .mockImplementationOnce(() => mockWs2);

    // Create two WebSocket clients with different contexts
    ws1 = new MagicWebSocket({
      url: config.test.wsUrl,
      clientContext: 'test-context-1',
      clientType: 'integration-test',
      environment: 'test',
      region: config.test.region,
      pingInterval: 100,
      reconnectInterval: 50
    });

    ws2 = new MagicWebSocket({
      url: config.test.wsUrl,
      clientContext: 'test-context-2',
      clientType: 'integration-test',
      environment: 'test',
      region: config.test.region,
      pingInterval: 100,
      reconnectInterval: 50
    });

    // Connect both clients
    const connectPromises = [ws1.connect(), ws2.connect()];
    
    // Advance timers to handle connection setup
    jest.advanceTimersByTime(10);
    await Promise.all(connectPromises);
  });

  afterAll(() => {
    ws1?.disconnect();
    ws2?.disconnect();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should establish connections successfully', () => {
    expect(ws1.isConnected()).toBe(true);
    expect(ws2.isConnected()).toBe(true);
  });

  it('should handle ping/pong', async () => {
    // Advance time to trigger ping
    jest.advanceTimersByTime(100);
    
    // Wait for any promises to resolve
    await Promise.resolve();
    
    expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify({ action: 'ping' }));
    expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify({ action: 'ping' }));
  });

  it('should receive messages in correct context', async () => {
    const testMessage: EventMessage = {
      event: 'componentUpdate',
      data: {
        action: 'update',
        component: { id: 'test-1', value: 'test' },
        timestamp: new Date().toISOString()
      }
    };

    const handler1 = jest.fn();
    const handler2 = jest.fn();

    ws1.on('componentUpdate', handler1);
    ws2.on('componentUpdate', handler2);

    // Send messages
    mockWs1.simulateMessage(testMessage);
    mockWs2.simulateMessage(testMessage);
    
    // Advance timers and wait for promises
    jest.advanceTimersByTime(10);
    await Promise.resolve();

    expect(handler1).toHaveBeenCalledWith(testMessage);
    expect(handler2).toHaveBeenCalledWith(testMessage);
  });

  it('should handle reconnection', async () => {
    ws1.disconnect();
    expect(ws1.isConnected()).toBe(false);

    // Create new mock for reconnection
    const mockWs3 = new MockWebSocket('ws://localhost:8080');
    (global as any).WebSocket = jest.fn().mockImplementation(() => mockWs3);

    // Trigger reconnect
    const connectPromise = ws1.connect();
    
    // Advance timers to handle connection setup
    jest.advanceTimersByTime(10);
    await connectPromise;

    expect(ws1.isConnected()).toBe(true);
  });

  it('should handle connection errors', async () => {
    const error = new Error('Connection lost');
    await mockWs1.simulateError(error);
    expect(ws1.isConnected()).toBe(false);

    // Create new mock for reconnection
    const mockWs3 = new MockWebSocket('ws://localhost:8080');
    (global as any).WebSocket = jest.fn().mockImplementation(() => mockWs3);

    // Wait for auto-reconnect
    jest.advanceTimersByTime(50);
    await Promise.resolve();

    // Advance timers to handle connection setup
    jest.advanceTimersByTime(10);
    await Promise.resolve();

    expect(ws1.isConnected()).toBe(true);
  });

  it('should maintain message order', async () => {
    const messages: string[] = [];
    const handler = (msg: EventMessage) => {
      messages.push(msg.data.component.id);
    };

    ws1.on('componentUpdate', handler);

    // Send multiple messages in quick succession
    const testMessages = Array.from({ length: 5 }, (_, i) => ({
      event: 'componentUpdate' as const,
      data: {
        action: 'update' as const,
        component: { id: `msg-${i}` },
        timestamp: new Date().toISOString()
      }
    }));

    // Send messages with small delays to ensure order
    for (const msg of testMessages) {
      mockWs1.simulateMessage(msg);
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    }

    expect(messages).toEqual(testMessages.map(m => m.data.component.id));
  });
}); 