import { WebSocket, Server as WebSocketServer } from 'ws';
import { MockWebSocket } from '../websocket/__tests__/mocks/WebSocket';

// Mock environment variables
process.env.CONNECTIONS_TABLE = 'test-connections';
process.env.IS_OFFLINE = 'true';
process.env.AWS_REGION = 'eu-west-1';
process.env.STAGE = 'test';

// Set Jest timeout for all tests
jest.setTimeout(10000);

// Mock WebSocket globally
(global as any).WebSocket = MockWebSocket;

// Mock AWS SDK clients
const mockDynamoSend = jest.fn();
const mockApiGatewaySend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: mockDynamoSend
  })),
  PutCommand: jest.fn(),
  DeleteCommand: jest.fn(),
  QueryCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  ScanCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-apigatewaymanagementapi', () => ({
  ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => ({
    send: mockApiGatewaySend
  })),
  PostToConnectionCommand: jest.fn()
}));

// Export mocks for use in tests
export {
  mockDynamoSend,
  mockApiGatewaySend
}; 