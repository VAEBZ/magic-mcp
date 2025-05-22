import { APIGatewayProxyHandler, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { ConnectionMetadata, EventMessage, WebSocketError, WebSocketResponse, BroadcastOptions } from '../../library-docs/types/websocket';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const IS_OFFLINE = process.env.IS_OFFLINE === 'true';
const MAX_RETRY_COUNT = 3;
const BATCH_SIZE = 25;

// In-memory store for local development
const localConnections = new Map<string, ConnectionMetadata>();

const createResponse = (statusCode: number, body: any, headers?: Record<string, string>): WebSocketResponse => ({
  statusCode,
  body: JSON.stringify(body),
  headers
});

const createError = (statusCode: number, message: string, details?: any): WebSocketError => ({
  statusCode,
  message,
  timestamp: new Date().toISOString(),
  ...(details && { details })
});

export const connectHandler: APIGatewayProxyHandler = async (event) => {
  if (!event.requestContext.connectionId) {
    return createResponse(400, createError(400, 'Missing connectionId'));
  }

  const connectionId = event.requestContext.connectionId;
  const queryParams = event.queryStringParameters || {};
  const clientContext = queryParams.clientContext || 'default';
  
  const connection: ConnectionMetadata = {
    connectionId,
    clientContext,
    timestamp: new Date().toISOString(),
    lastPingAt: new Date().toISOString(),
    isActive: true,
    rbacRoles: [],
    allowedServers: [],
    clientMetadata: {
      clientType: queryParams.clientType,
      region: queryParams.region,
      environment: queryParams.environment,
      version: queryParams.version,
      capabilities: queryParams.capabilities?.split(',')
    }
  };

  try {
    if (IS_OFFLINE) {
      localConnections.set(connectionId, connection);
    } else {
      await docClient.send(new PutCommand({
        TableName: CONNECTIONS_TABLE,
        Item: connection,
        ConditionExpression: 'attribute_not_exists(connectionId) OR isActive = :false',
        ExpressionAttributeValues: {
          ':false': false
        }
      }));
    }

    return createResponse(200, { 
      message: 'Connected',
      connectionId,
      timestamp: connection.timestamp
    });
  } catch (error) {
    console.error('Failed to store connection:', error);
    return createResponse(500, createError(500, 'Failed to connect', error));
  }
};

export const disconnectHandler: APIGatewayProxyHandler = async (event) => {
  if (!event.requestContext.connectionId) {
    return createResponse(400, createError(400, 'Missing connectionId'));
  }

  const connectionId = event.requestContext.connectionId;
  const clientContext = event.queryStringParameters?.clientContext || 'default';

  try {
    if (IS_OFFLINE) {
      localConnections.delete(connectionId);
    } else {
      await docClient.send(new UpdateCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId, clientContext },
        UpdateExpression: 'SET isActive = :false, disconnectedAt = :now',
        ExpressionAttributeValues: {
          ':false': false,
          ':now': new Date().toISOString()
        }
      }));
    }

    return createResponse(200, { message: 'Disconnected' });
  } catch (error) {
    console.error('Failed to handle disconnect:', error);
    return createResponse(500, createError(500, 'Failed to disconnect', error));
  }
};

export const broadcastMessage = async (
  event: APIGatewayProxyWebsocketEventV2,
  messagePayload: EventMessage,
  options: BroadcastOptions = {}
): Promise<void> => {
  const {
    targetContext,
    excludeConnectionIds = [],
    includeMetadata = false,
    retryCount = MAX_RETRY_COUNT,
    batchSize = BATCH_SIZE
  } = options;

  const endpoint = IS_OFFLINE
    ? 'http://localhost:9630'
    : `https://${event.requestContext.domainName}/${event.requestContext.stage}`;

  const apiGwClient = new ApiGatewayManagementApiClient({
    endpoint,
    ...(IS_OFFLINE ? { region: 'local' } : {})
  });

  let connections: ConnectionMetadata[] = [];

  try {
    if (IS_OFFLINE) {
      connections = Array.from(localConnections.values())
        .filter(conn => conn.isActive && !excludeConnectionIds.includes(conn.connectionId));
      if (targetContext) {
        connections = connections.filter(conn => conn.clientContext === targetContext);
      }
    } else {
      const params = {
        TableName: CONNECTIONS_TABLE,
        FilterExpression: 'isActive = :true',
        ExpressionAttributeValues: { ':true': true },
        ...(targetContext ? {
          IndexName: 'ClientContextIndex',
          KeyConditionExpression: 'clientContext = :ctx',
          ExpressionAttributeValues: { 
            ':true': true,
            ':ctx': targetContext 
          }
        } : {})
      };

      const result = targetContext
        ? await docClient.send(new QueryCommand(params))
        : await docClient.send(new ScanCommand(params));

      connections = (result.Items as ConnectionMetadata[])
        .filter(conn => !excludeConnectionIds.includes(conn.connectionId));
    }

    // Process connections in batches
    for (let i = 0; i < connections.length; i += batchSize) {
      const batch = connections.slice(i, i + batchSize);
      const postCalls = batch.map(async ({ connectionId, clientMetadata }) => {
        const payload = {
          ...messagePayload,
          ...(includeMetadata && { metadata: { clientMetadata } })
        };

        let lastError;
        for (let attempt = 0; attempt < retryCount; attempt++) {
          try {
            await apiGwClient.send(new PostToConnectionCommand({
              ConnectionId: connectionId,
              Data: JSON.stringify(payload)
            }));
            return;
          } catch (error: any) {
            lastError = error;
            if (error.statusCode === 410) {
              // Connection is stale
              if (IS_OFFLINE) {
                localConnections.delete(connectionId);
              } else {
                await docClient.send(new UpdateCommand({
                  TableName: CONNECTIONS_TABLE,
                  Key: { connectionId },
                  UpdateExpression: 'SET isActive = :false, disconnectedAt = :now',
                  ExpressionAttributeValues: {
                    ':false': false,
                    ':now': new Date().toISOString()
                  }
                }));
              }
              break;
            }
            if (attempt === retryCount - 1) {
              console.error(`Failed to send message to connection ${connectionId} after ${retryCount} attempts:`, error);
            }
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
          }
        }
        if (lastError && lastError.statusCode !== 410) {
          throw lastError;
        }
      });

      await Promise.all(postCalls);
    }
  } catch (error) {
    console.error('Broadcast error:', error);
    throw error;
  }
};

export const defaultHandler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const connectionId = event.requestContext.connectionId;
    
    if (body.action === 'ping') {
      if (!IS_OFFLINE) {
        await docClient.send(new UpdateCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connectionId },
          UpdateExpression: 'SET lastPingAt = :now',
          ExpressionAttributeValues: {
            ':now': new Date().toISOString()
          }
        }));
      }
      return createResponse(200, { message: 'pong', timestamp: new Date().toISOString() });
    }

    console.log('Received message:', body);
    return createResponse(200, { 
      message: 'Message received',
      data: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in default handler:', error);
    return createResponse(400, createError(400, 'Invalid message format', error));
  }
}; 