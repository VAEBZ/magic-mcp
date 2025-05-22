import { jest } from '@jest/globals';
import { mockApiGatewayClient } from './mock-clients';
import {
  PostToConnectionCommand,
  DeleteConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi';

// Mock AWS SDK modules
jest.mock('@aws-sdk/client-apigatewaymanagementapi', () => {
  const actual = jest.requireActual('@aws-sdk/client-apigatewaymanagementapi') as {
    PostToConnectionCommand: typeof PostToConnectionCommand;
    DeleteConnectionCommand: typeof DeleteConnectionCommand;
  };
  return {
    ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => mockApiGatewayClient),
    PostToConnectionCommand: actual.PostToConnectionCommand,
    DeleteConnectionCommand: actual.DeleteConnectionCommand
  };
});

// Export all types
export {
  PostToConnectionCommand,
  DeleteConnectionCommand
}; 