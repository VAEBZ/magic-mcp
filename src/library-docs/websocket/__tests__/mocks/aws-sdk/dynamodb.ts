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
import { mockDynamoClient, mockDocumentClient } from './mock-clients';

// Mock AWS SDK modules
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => mockDynamoClient)
}));

// Create actual command classes
const actual = jest.requireActual('@aws-sdk/lib-dynamodb') as {
  PutCommand: typeof PutCommand;
  DeleteCommand: typeof DeleteCommand;
  QueryCommand: typeof QueryCommand;
  UpdateCommand: typeof UpdateCommand;
  ScanCommand: typeof ScanCommand;
};

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue(mockDocumentClient)
  },
  PutCommand: actual.PutCommand,
  DeleteCommand: actual.DeleteCommand,
  QueryCommand: actual.QueryCommand,
  UpdateCommand: actual.UpdateCommand,
  ScanCommand: actual.ScanCommand
}));

// Export all types and mocks
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
  type ScanCommandInput
}; 