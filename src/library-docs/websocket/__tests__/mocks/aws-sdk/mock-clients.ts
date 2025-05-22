import { jest } from '@jest/globals';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
  type PutCommandInput,
  type DeleteCommandInput,
  type QueryCommandInput,
  type UpdateCommandInput,
  type ScanCommandInput
} from '@aws-sdk/lib-dynamodb';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  DeleteConnectionCommand,
  type PostToConnectionCommandInput,
  type DeleteConnectionCommandInput
} from '@aws-sdk/client-apigatewaymanagementapi';

// Define mock class first
class MockDynamoDBClient {
  send = jest.fn().mockImplementation((command) => {
    if (command instanceof QueryCommand || command instanceof ScanCommand) {
      return Promise.resolve({
        $metadata: { httpStatusCode: 200 },
        Items: [
          { connectionId: 'test-connection-id', clientContext: 'test-context' }
        ]
      });
    }
    return Promise.resolve({
      $metadata: { httpStatusCode: 200 }
    });
  });
}

// Create instance of mock client
export const mockDynamoClient = new MockDynamoDBClient();

// Create mock document client with the same send function
export const mockDocumentClient = {
  send: mockDynamoClient.send
};

// Define API Gateway mock class
class MockApiGatewayManagementApiClient {
  send = jest.fn().mockImplementation(() => 
    Promise.resolve({
      $metadata: { httpStatusCode: 200 }
    })
  );
}

// Create instance of mock API Gateway client
export const mockApiGatewayClient = new MockApiGatewayManagementApiClient();

// Mock send functions for direct access
export const mockDynamoSend = mockDynamoClient.send;
export const mockApiGatewaySend = mockApiGatewayClient.send;

// Reset functions for mocks
export const resetDynamoMocks = () => {
  mockDynamoClient.send.mockClear();
};

export const resetApiGatewayMocks = () => {
  mockApiGatewayClient.send.mockClear();
};

// Combined reset function
export const resetAwsMocks = () => {
  resetDynamoMocks();
  resetApiGatewayMocks();
};

// Export all types and commands
export {
  DynamoDBClient,
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
  type PutCommandInput,
  type DeleteCommandInput,
  type QueryCommandInput,
  type UpdateCommandInput,
  type ScanCommandInput,
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  DeleteConnectionCommand,
  type PostToConnectionCommandInput,
  type DeleteConnectionCommandInput
}; 