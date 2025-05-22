import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConnectionMetadata } from '../../library-docs/types/websocket';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const STALE_CONNECTION_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export const handler = async (): Promise<void> => {
  try {
    // Get all active connections
    const result = await docClient.send(new ScanCommand({
      TableName: CONNECTIONS_TABLE,
      FilterExpression: 'isActive = :true',
      ExpressionAttributeValues: { ':true': true }
    }));

    const connections = result.Items as ConnectionMetadata[];
    const now = new Date();
    const staleConnections = connections.filter(conn => {
      const lastPing = new Date(conn.lastPingAt || conn.timestamp);
      return now.getTime() - lastPing.getTime() > STALE_CONNECTION_THRESHOLD_MS;
    });

    // Mark stale connections as inactive
    await Promise.all(staleConnections.map(conn => 
      docClient.send(new UpdateCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { 
          connectionId: conn.connectionId,
          clientContext: conn.clientContext
        },
        UpdateExpression: 'SET isActive = :false, disconnectedAt = :now',
        ExpressionAttributeValues: {
          ':false': false,
          ':now': now.toISOString()
        }
      }))
    ));

    console.log(`Cleaned up ${staleConnections.length} stale connections`);
  } catch (error) {
    console.error('Error cleaning up stale connections:', error);
    throw error;
  }
}; 