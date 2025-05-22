import { jest } from '@jest/globals';
import { MockWebSocket } from './mocks/WebSocket';
import { mockDynamoClient, mockApiGatewayClient, resetDynamoMocks, resetApiGatewayMocks } from './mocks/aws-sdk/mock-clients';

// Mock environment variables
process.env.CONNECTIONS_TABLE = 'test-connections';
process.env.IS_OFFLINE = 'true';
process.env.AWS_REGION = 'eu-west-1';
process.env.STAGE = 'test';

// Set Jest timeout for all tests (increased to handle async operations)
jest.setTimeout(10000);

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
  mockApiGatewayClient
}; 