import { APIGatewayProxyHandler, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { ConnectionMetadata, EventMessage, WebSocketError } from '../types/websocket';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const IS_OFFLINE = process.env.IS_OFFLINE === 'true';

// In-memory store for local development
const localConnections = new Map<string, ConnectionMetadata>();

export const connectHandler: APIGatewayProxyHandler = async (event) => {
  if (!event.requestContext.connectionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing connectionId' })
    };
  }

  const connectionId = event.requestContext.connectionId;
  const queryParams = event.queryStringParameters || {};
  const clientContext = queryParams.clientContext || 'default';
  
  const connection: ConnectionMetadata = {
    connectionId,
    clientContext,
    timestamp: new Date().toISOString(),
    rbacRoles: [],
    allowedServers: [],
    clientMetadata: {
      clientType: queryParams.clientType,
      region: queryParams.region,
      environment: queryParams.environment
    }
  };

  try {
    if (IS_OFFLINE) {
      localConnections.set(connectionId, connection);
    } else {
      await docClient.send(new PutCommand({
        TableName: CONNECTIONS_TABLE,
        Item: connection
      }));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Connected', connectionId })
    };
  } catch (error) {
    console.error('Failed to store connection:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to connect', error })
    };
  }
};

export const disconnectHandler: APIGatewayProxyHandler = async (event) => {
  if (!event.requestContext.connectionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing connectionId' })
    };
  }

  const connectionId = event.requestContext.connectionId;
  const clientContext = event.queryStringParameters?.clientContext || 'default';

  try {
    if (IS_OFFLINE) {
      localConnections.delete(connectionId);
    } else {
      await docClient.send(new DeleteCommand({
        TableName: CONNECTIONS_TABLE,
        Key: {
          connectionId,
          clientContext
        }
      }));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Disconnected' })
    };
  } catch (error) {
    console.error('Failed to remove connection:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to disconnect', error })
    };
  }
};

export const broadcastMessage = async (
  event: APIGatewayProxyWebsocketEventV2,
  messagePayload: EventMessage,
  targetContext?: string
): Promise<void> => {
  // Initialize API Gateway Management API client
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
      connections = Array.from(localConnections.values());
      if (targetContext) {
        connections = connections.filter(conn => conn.clientContext === targetContext);
      }
    } else {
      const params = {
        TableName: CONNECTIONS_TABLE,
        ...(targetContext ? {
          IndexName: 'ClientContextIndex',
          KeyConditionExpression: 'clientContext = :ctx',
          ExpressionAttributeValues: { ':ctx': targetContext }
        } : {})
      };

      const result = targetContext
        ? await docClient.send(new QueryCommand(params))
        : await docClient.send(new ScanCommand(params));

      connections = result.Items as ConnectionMetadata[];
    }

    const postCalls = connections.map(async ({ connectionId }) => {
      try {
        await apiGwClient.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify(messagePayload)
        }));
      } catch (error: any) {
        if (error.statusCode === 410) {
          // Connection is stale, remove it
          if (IS_OFFLINE) {
            localConnections.delete(connectionId);
          } else {
            await docClient.send(new DeleteCommand({
              TableName: CONNECTIONS_TABLE,
              Key: { connectionId }
            }));
          }
        } else {
          console.error(`Failed to send message to connection ${connectionId}:`, error);
        }
      }
    });

    await Promise.all(postCalls);
  } catch (error) {
    console.error('Broadcast error:', error);
    throw error;
  }
};

export const defaultHandler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    console.log('Received message:', body);

    // This will be enhanced later for server discovery and context updates
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Message received', data: body })
    };
  } catch (error) {
    console.error('Error in default handler:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid message format' })
    };
  }
}; 