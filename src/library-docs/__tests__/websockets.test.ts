import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  mockDynamoClient,
  mockApiGatewayClient,
  resetAwsMocks,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
  PostToConnectionCommand,
  type PutCommandInput,
  type UpdateCommandInput,
  type QueryCommandInput,
  type ScanCommandInput,
  type PostToConnectionCommandInput
} from '../websocket/__tests__/mocks/aws-sdk/mock-clients';

// Mock AWS SDK modules
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-apigatewaymanagementapi');

// Import after mocks
import { connectHandler, disconnectHandler, defaultHandler, broadcastMessage } from '../websocket/handlers/websockets';
import { EventMessage } from '../websocket/types/websocket';

// WebSocket event types
interface WebSocketRequestContext {
  connectionId: string;
  domainName: string;
  stage: string;
  apiId: string;
  authorizer: {
    principalId: string;
    integrationLatency: number;
  };
  connectedAt: number;
  eventType: string;
  extendedRequestId: string;
  identity: {
    sourceIp: string;
    userAgent: string;
  };
  messageDirection: string;
  messageId: string;
  requestId: string;
  requestTime: string;
  requestTimeEpoch: number;
  routeKey: string;
}

interface WebSocketEvent {
  requestContext: WebSocketRequestContext;
  body: string | null;
  isBase64Encoded: boolean;
}

// Create a base mock event
const createMockEvent = (overrides: Partial<WebSocketEvent> = {}): WebSocketEvent => ({
  body: null,
  isBase64Encoded: false,
  requestContext: {
    connectionId: 'test-connection-id',
    domainName: 'test.execute-api.region.amazonaws.com',
    stage: 'test',
    apiId: 'test-api',
    authorizer: {
      principalId: 'test',
      integrationLatency: 0
    },
    connectedAt: Date.now(),
    eventType: 'MESSAGE',
    extendedRequestId: 'test-extended-id',
    identity: {
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent'
    },
    messageDirection: 'IN',
    messageId: 'test-message-id',
    requestId: 'test-request-id',
    requestTime: new Date().toISOString(),
    requestTimeEpoch: Date.now(),
    routeKey: '$default'
  },
  ...overrides
});

describe('WebSocket Handlers', () => {
  beforeEach(() => {
    process.env.CONNECTIONS_TABLE = 'test-connections';
    process.env.IS_OFFLINE = 'false';
    resetAwsMocks();
  });

  describe('connectHandler', () => {
    it('should handle new connection successfully', async () => {
      const mockEvent = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          routeKey: '$connect'
        }
      });

      const response = await connectHandler(mockEvent as any);
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('connectionId', mockEvent.requestContext.connectionId);
      
      expect(mockDynamoClient.send).toHaveBeenCalledWith(expect.any(PutCommand));
      const mockCall = mockDynamoClient.send.mock.calls[0][0] as typeof PutCommand;
      expect(mockCall).toBeInstanceOf(PutCommand);
      expect(mockCall.input).toEqual({
        TableName: process.env.CONNECTIONS_TABLE,
        Item: {
          connectionId: mockEvent.requestContext.connectionId,
          timestamp: expect.any(String),
          ttl: expect.any(Number)
        }
      });
    });
  });

  describe('disconnectHandler', () => {
    it('should handle disconnection successfully', async () => {
      const mockEvent = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          routeKey: '$disconnect'
        }
      });

      const response = await disconnectHandler(mockEvent as any);
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('message', 'Disconnected');
      
      expect(mockDynamoClient.send).toHaveBeenCalledWith(expect.any(UpdateCommand));
      const mockCall = mockDynamoClient.send.mock.calls[0][0] as typeof UpdateCommand;
      expect(mockCall).toBeInstanceOf(UpdateCommand);
      expect(mockCall.input).toEqual({
        TableName: process.env.CONNECTIONS_TABLE,
        Key: {
          connectionId: mockEvent.requestContext.connectionId
        },
        UpdateExpression: 'SET disconnectedAt = :now',
        ExpressionAttributeValues: {
          ':now': expect.any(String)
        }
      });
    });
  });

  describe('defaultHandler', () => {
    it('should handle ping message', async () => {
      const mockEvent = createMockEvent({
        body: JSON.stringify({ type: 'ping' })
      });

      const response = await defaultHandler(mockEvent as any);
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('message', 'pong');
      
      expect(mockDynamoClient.send).toHaveBeenCalledWith(expect.any(UpdateCommand));
      const mockCall = mockDynamoClient.send.mock.calls[0][0] as typeof UpdateCommand;
      expect(mockCall).toBeInstanceOf(UpdateCommand);
      expect(mockCall.input).toEqual({
        TableName: process.env.CONNECTIONS_TABLE,
        Key: {
          connectionId: mockEvent.requestContext.connectionId
        },
        UpdateExpression: 'SET lastSeen = :now',
        ExpressionAttributeValues: {
          ':now': expect.any(String)
        }
      });
    });

    it('should handle invalid JSON', async () => {
      const mockEvent = createMockEvent({
        body: 'invalid-json'
      });

      const response = await defaultHandler(mockEvent as any);
      
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toHaveProperty('error.message', 'Invalid message format');
    });
  });

  describe('broadcastMessage', () => {
    it('should broadcast message to all connections', async () => {
      const mockEvent = createMockEvent();
      const mockMessage: EventMessage = {
        event: 'componentUpdate',
        data: {
          action: 'update',
          component: { id: 'test' },
          timestamp: new Date().toISOString()
        }
      };

      await broadcastMessage(mockEvent as any, mockMessage);
      
      expect(mockDynamoClient.send).toHaveBeenCalledWith(expect.any(ScanCommand));
      const scanCall = mockDynamoClient.send.mock.calls[0][0] as typeof ScanCommand;
      expect(scanCall).toBeInstanceOf(ScanCommand);
      expect(scanCall.input).toEqual({
        TableName: process.env.CONNECTIONS_TABLE,
        ProjectionExpression: 'connectionId'
      });

      expect(mockApiGatewayClient.send).toHaveBeenCalledWith(expect.any(PostToConnectionCommand));
      const postCall = mockApiGatewayClient.send.mock.calls[0][0] as typeof PostToConnectionCommand;
      expect(postCall).toBeInstanceOf(PostToConnectionCommand);
      expect(postCall.input).toEqual({
        ConnectionId: 'test-connection-id',
        Data: expect.any(Buffer)
      });
    });

    it('should broadcast message with target context', async () => {
      const mockEvent = createMockEvent();
      const mockMessage: EventMessage = {
        event: 'componentUpdate',
        data: {
          action: 'update',
          component: { id: 'test' },
          timestamp: new Date().toISOString()
        }
      };

      await broadcastMessage(mockEvent as any, mockMessage, {
        clientContext: 'test-context'
      });
      
      expect(mockDynamoClient.send).toHaveBeenCalledWith(expect.any(QueryCommand));
      const queryCall = mockDynamoClient.send.mock.calls[0][0] as typeof QueryCommand;
      expect(queryCall).toBeInstanceOf(QueryCommand);
      expect(queryCall.input).toEqual({
        TableName: process.env.CONNECTIONS_TABLE,
        KeyConditionExpression: 'clientContext = :context',
        ExpressionAttributeValues: {
          ':context': 'test-context'
        },
        ProjectionExpression: 'connectionId'
      });

      expect(mockApiGatewayClient.send).toHaveBeenCalledWith(expect.any(PostToConnectionCommand));
      const postCall = mockApiGatewayClient.send.mock.calls[0][0] as typeof PostToConnectionCommand;
      expect(postCall).toBeInstanceOf(PostToConnectionCommand);
      expect(postCall.input).toEqual({
        ConnectionId: 'test-connection-id',
        Data: expect.any(Buffer)
      });
    });
  });
}); 