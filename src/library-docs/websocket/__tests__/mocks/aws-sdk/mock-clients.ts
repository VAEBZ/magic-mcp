import { jest } from '@jest/globals';
import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

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

// Reset functions for mocks
export const resetDynamoMocks = () => {
  mockDynamoClient.send.mockClear();
};

export const resetApiGatewayMocks = () => {
  mockApiGatewayClient.send.mockClear();
}; 