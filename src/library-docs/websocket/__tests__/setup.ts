import { jest } from '@jest/globals';
import { mockDynamoClient, mockApiGatewayClient, resetDynamoMocks, resetApiGatewayMocks } from './mocks/aws-sdk/mock-clients';

// Mock environment variables
process.env.CONNECTIONS_TABLE = 'test-connections';
process.env.IS_OFFLINE = 'true';
process.env.AWS_REGION = 'eu-west-1';
process.env.STAGE = 'test';

// Set longer test timeout globally
jest.setTimeout(30000); // 30 seconds

// Mock AWS SDK modules first
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  }))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actualModule = jest.requireActual('@aws-sdk/lib-dynamodb') as Record<string, unknown>;
  return {
    ...actualModule,
    DynamoDBDocumentClient: {
      from: jest.fn().mockImplementation(() => ({
        send: jest.fn()
      }))
    }
  };
});

jest.mock('@aws-sdk/client-apigatewaymanagementapi', () => ({
  ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  }))
}));

// WebSocket constants
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSED = 3;

// Mock WebSocket for browser environment
class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  readyState = WS_CONNECTING;
  send = jest.fn();
  
  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = WS_OPEN;
      this.onopen?.();
    }, 0);
  }

  close(): void {
    this.readyState = WS_CLOSED;
    this.onclose?.();
  }

  simulateMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage({ data: typeof data === 'string' ? data : JSON.stringify(data) });
    }
  }

  simulateError(error: Error): void {
    if (this.onerror) {
      this.onerror(error);
    }
    this.readyState = WS_CLOSED;
    if (this.onclose) {
      this.onclose();
    }
  }
}

// Mock WebSocket globally
(global as any).WebSocket = MockWebSocket;

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  resetDynamoMocks();
  resetApiGatewayMocks();
});

// Clean up after all tests
afterAll(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// Export mocks for use in tests
export {
  mockDynamoClient,
  mockApiGatewayClient,
  MockWebSocket
}; 