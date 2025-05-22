import { jest } from '@jest/globals';
import { 
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  DeleteConnectionCommand,
  type PostToConnectionCommandInput,
  type DeleteConnectionCommandInput
} from '@aws-sdk/client-apigatewaymanagementapi';
import { mockApiGatewayClient } from './mock-clients';

// Create actual command classes
const actualCommands = jest.requireActual('@aws-sdk/client-apigatewaymanagementapi') as {
  PostToConnectionCommand: typeof PostToConnectionCommand;
  DeleteConnectionCommand: typeof DeleteConnectionCommand;
};

// Mock AWS SDK modules
jest.mock('@aws-sdk/client-apigatewaymanagementapi', () => ({
  ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => mockApiGatewayClient),
  PostToConnectionCommand: actualCommands.PostToConnectionCommand,
  DeleteConnectionCommand: actualCommands.DeleteConnectionCommand
}));

// Export all types
export {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  DeleteConnectionCommand,
  type PostToConnectionCommandInput,
  type DeleteConnectionCommandInput
}; 