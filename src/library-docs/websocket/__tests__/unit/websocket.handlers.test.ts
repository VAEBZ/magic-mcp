import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { APIGatewayProxyResult } from 'aws-lambda';

// Import setup first
import '../setup';

// Mock AWS SDK modules first
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

// Mock AWS clients module
jest.mock('../../clients/aws', () => ({
  docClient: {
    send: mockDynamoSend
  }
}));

// Import mocks
import {
  mockDynamoSend,
  mockApiGatewaySend,
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
} from '../mocks/aws-sdk';

// Import handlers after mocks
import { connectHandler, disconnectHandler, defaultHandler, broadcastMessage } from '../../handlers/websockets';
import { EventMessage } from '../../types/websocket';

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

    // Mock successful DynamoDB responses
    mockDynamoSend.mockImplementation((command) => {
      if (command instanceof QueryCommand || command instanceof ScanCommand) {
        return Promise.resolve({
          $metadata: { httpStatusCode: 200 },
          Items: [
            { connectionId: 'test-connection-id', clientContext: 'test-context', isActive: true }
          ]
        });
      }
      return Promise.resolve({
        $metadata: { httpStatusCode: 200 }
      });
    });
  });

  afterEach(() => {
    delete process.env.CONNECTIONS_TABLE;
    delete process.env.IS_OFFLINE;
  });

  describe('connectHandler', () => {
    it('should handle new connection successfully', async () => {
      const mockEvent = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          routeKey: '$connect'
        }
      });

      const response = await connectHandler(mockEvent as any, {} as any, {} as any) as APIGatewayProxyResult;
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('connectionId', mockEvent.requestContext.connectionId);
      
      expect(mockDynamoSend).toHaveBeenCalledWith(expect.any(PutCommand));
      const mockCall = mockDynamoSend.mock.calls[0][0] as typeof PutCommand;
      expect(mockCall).toBeInstanceOf(PutCommand);
      expect(mockCall.input).toEqual({
        TableName: 'test-connections',
        Item: expect.objectContaining({
          connectionId: mockEvent.requestContext.connectionId,
          isActive: true,
          timestamp: expect.any(String),
          lastPingAt: expect.any(String)
        }),
        ConditionExpression: 'attribute_not_exists(connectionId) OR isActive = :false',
        ExpressionAttributeValues: {
          ':false': false
        }
      } as PutCommandInput);
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

      const response = await disconnectHandler(mockEvent as any, {} as any, {} as any) as APIGatewayProxyResult;
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('message', 'Disconnected');
      
      expect(mockDynamoSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      const mockCall = mockDynamoSend.mock.calls[0][0] as typeof UpdateCommand;
      expect(mockCall).toBeInstanceOf(UpdateCommand);
      expect(mockCall.input).toEqual({
        TableName: 'test-connections',
        Key: { 
          connectionId: mockEvent.requestContext.connectionId,
          clientContext: 'default'
        },
        UpdateExpression: 'SET isActive = :false, disconnectedAt = :now',
        ExpressionAttributeValues: {
          ':false': false,
          ':now': expect.any(String)
        }
      } as UpdateCommandInput);
    });
  });

  describe('defaultHandler', () => {
    it('should handle ping message', async () => {
      const mockEvent = createMockEvent({
        body: JSON.stringify({ type: 'ping' })
      });

      const response = await defaultHandler(mockEvent as any, {} as any, {} as any) as APIGatewayProxyResult;
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('message', 'pong');
      
      expect(mockDynamoSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      const mockCall = mockDynamoSend.mock.calls[0][0] as typeof UpdateCommand;
      expect(mockCall).toBeInstanceOf(UpdateCommand);
      expect(mockCall.input).toEqual({
        TableName: 'test-connections',
        Key: {
          connectionId: mockEvent.requestContext.connectionId
        },
        UpdateExpression: 'SET lastPingAt = :now',
        ExpressionAttributeValues: {
          ':now': expect.any(String)
        }
      } as UpdateCommandInput);
    });

    it('should handle invalid JSON', async () => {
      const mockEvent = createMockEvent({
        body: 'invalid-json'
      });

      const response = await defaultHandler(mockEvent as any, {} as any, {} as any) as APIGatewayProxyResult;
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('message', 'Invalid message format');
      expect(body).toHaveProperty('statusCode', 400);
      expect(mockDynamoSend).not.toHaveBeenCalled();
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
      
      expect(mockDynamoSend).toHaveBeenCalledWith(expect.any(ScanCommand));
      const scanCall = mockDynamoSend.mock.calls[0][0] as typeof ScanCommand;
      expect(scanCall).toBeInstanceOf(ScanCommand);
      expect(scanCall.input).toEqual({
        TableName: 'test-connections',
        FilterExpression: 'isActive = :true',
        ExpressionAttributeValues: {
          ':true': true
        }
      } as ScanCommandInput);

      expect(mockApiGatewaySend).toHaveBeenCalledWith(expect.any(PostToConnectionCommand));
      const postCall = mockApiGatewaySend.mock.calls[0][0] as typeof PostToConnectionCommand;
      expect(postCall).toBeInstanceOf(PostToConnectionCommand);
      expect(postCall.input).toEqual({
        ConnectionId: 'test-connection-id',
        Data: JSON.stringify(mockMessage)
      } as PostToConnectionCommandInput);
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
        targetContext: 'test-context'
      });
      
      expect(mockDynamoSend).toHaveBeenCalledWith(expect.any(QueryCommand));
      const queryCall = mockDynamoSend.mock.calls[0][0] as typeof QueryCommand;
      expect(queryCall).toBeInstanceOf(QueryCommand);
      expect(queryCall.input).toEqual({
        TableName: 'test-connections',
        IndexName: 'ClientContextIndex',
        KeyConditionExpression: 'clientContext = :ctx',
        FilterExpression: 'isActive = :true',
        ExpressionAttributeValues: {
          ':true': true,
          ':ctx': 'test-context'
        }
      } as QueryCommandInput);

      expect(mockApiGatewaySend).toHaveBeenCalledWith(expect.any(PostToConnectionCommand));
      const postCall = mockApiGatewaySend.mock.calls[0][0] as typeof PostToConnectionCommand;
      expect(postCall).toBeInstanceOf(PostToConnectionCommand);
      expect(postCall.input).toEqual({
        ConnectionId: 'test-connection-id',
        Data: JSON.stringify(mockMessage)
      } as PostToConnectionCommandInput);
    });
  });
}); 