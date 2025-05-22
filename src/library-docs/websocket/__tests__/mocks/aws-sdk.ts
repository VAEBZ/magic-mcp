import { jest } from '@jest/globals';

// Import actual types from AWS SDK
import type {
  DynamoDBClient,
  DynamoDBClientConfig,
  ServiceInputTypes,
  ServiceOutputTypes
} from '@aws-sdk/client-dynamodb';

import type {
  DynamoDBDocumentClient,
  PutCommandOutput,
  DeleteCommandOutput,
  QueryCommandOutput,
  ScanCommandOutput,
  UpdateCommandOutput,
  QueryCommandInput,
  UpdateCommandInput,
  ScanCommandInput,
  PutCommandInput,
  DeleteCommandInput
} from '@aws-sdk/lib-dynamodb';

import type {
  ApiGatewayManagementApiClient,
  PostToConnectionCommandOutput,
  DeleteConnectionCommandOutput,
  ServiceInputTypes as ApiGatewayInputTypes,
  ServiceOutputTypes as ApiGatewayOutputTypes,
  PostToConnectionCommandInput,
  DeleteConnectionCommandInput
} from '@aws-sdk/client-apigatewaymanagementapi';

// Import actual commands to extend
const {
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand
} = jest.requireActual('@aws-sdk/lib-dynamodb') as {
  PutCommand: any;
  DeleteCommand: any;
  QueryCommand: any;
  UpdateCommand: any;
  ScanCommand: any;
};

const {
  PostToConnectionCommand,
  DeleteConnectionCommand
} = jest.requireActual('@aws-sdk/client-apigatewaymanagementapi') as {
  PostToConnectionCommand: any;
  DeleteConnectionCommand: any;
};

// Mock response types
export const mockDynamoResponse: PutCommandOutput & DeleteCommandOutput & UpdateCommandOutput = {
  $metadata: { httpStatusCode: 200 }
};

export const mockQueryResponse: QueryCommandOutput = {
  Items: [{ connectionId: 'conn1' }, { connectionId: 'conn2' }],
  Count: 2,
  ScannedCount: 2,
  $metadata: { httpStatusCode: 200 }
};

export const mockApiGatewayResponse: PostToConnectionCommandOutput & DeleteConnectionCommandOutput = {
  $metadata: { httpStatusCode: 200 }
};

// Mock send functions
export const mockDynamoSend = jest.fn().mockImplementation(() => Promise.resolve({
  $metadata: { httpStatusCode: 200 },
  Items: [
    { connectionId: 'test-connection-id', clientContext: 'test-context', isActive: true }
  ]
}));

export const mockApiGatewaySend = jest.fn().mockImplementation(() => Promise.resolve({
  $metadata: { httpStatusCode: 200 }
}));

// Mock DynamoDB client
export class MockDynamoDBClient {
  send = mockDynamoSend;
}

// Mock DynamoDB Document client
export class MockDynamoDBDocumentClient {
  static from() {
    return new MockDynamoDBDocumentClient();
  }

  send = mockDynamoSend;
}

// Mock ApiGatewayManagementApi client
export class MockApiGatewayManagementApiClient {
  send = mockApiGatewaySend;
}

// Reset function for all mocks
export const resetAwsMocks = () => {
  mockDynamoSend.mockClear();
  mockApiGatewaySend.mockClear();
  jest.clearAllMocks();
};

// Mock AWS SDK modules
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: mockDynamoSend
  }))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actualModule = jest.requireActual('@aws-sdk/lib-dynamodb') as Record<string, unknown>;
  return {
    ...actualModule,
    DynamoDBDocumentClient: {
      from: jest.fn().mockImplementation(() => ({
        send: mockDynamoSend
      }))
    }
  };
});

jest.mock('@aws-sdk/client-apigatewaymanagementapi', () => ({
  ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => ({
    send: mockApiGatewaySend
  }))
}));

// Export commands
export {
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
  PostToConnectionCommand,
  DeleteConnectionCommand
};

// Re-export types
export type {
  DynamoDBClient,
  DynamoDBClientConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
  DynamoDBDocumentClient,
  PutCommandInput,
  DeleteCommandInput,
  QueryCommandInput,
  UpdateCommandInput,
  ScanCommandInput,
  ApiGatewayManagementApiClient,
  PostToConnectionCommandInput,
  DeleteConnectionCommandInput
};