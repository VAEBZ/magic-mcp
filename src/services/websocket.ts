import { ApiGatewayManagementApi } from 'aws-sdk';
import { DynamoDB } from 'aws-sdk';
import { ComponentEvent } from '../types/events';
import { WebSocketConnection } from '../types/websocket';

export class WebSocketService {
    private api: ApiGatewayManagementApi | null = null;
    private dynamoDB: DynamoDB.DocumentClient | null = null;
    private tableName: string;
    private isOffline: boolean;
    private connections: Map<string, WebSocketConnection> = new Map();

    constructor() {
        this.isOffline = process.env.IS_OFFLINE === 'true';
        this.tableName = process.env.CONNECTIONS_TABLE || 'magic-mcp-connections';

        if (!this.isOffline) {
            this.api = new ApiGatewayManagementApi({
                apiVersion: '2018-11-29',
                endpoint: process.env.WEBSOCKET_API_ENDPOINT
            });
            this.dynamoDB = new DynamoDB.DocumentClient();
        }
    }

    async onConnect(connectionId: string, context: string): Promise<void> {
        const connection: WebSocketConnection = {
            connectionId,
            clientContext: context,
            timestamp: new Date().toISOString()
        };

        if (this.isOffline) {
            this.connections.set(connectionId, connection);
        } else {
            if (!this.dynamoDB) {
                throw new Error('DynamoDB client not initialized');
            }
            await this.dynamoDB.put({
                TableName: this.tableName,
                Item: connection
            }).promise();
        }
    }

    async onDisconnect(connectionId: string): Promise<void> {
        if (this.isOffline) {
            this.connections.delete(connectionId);
        } else {
            if (!this.dynamoDB) {
                throw new Error('DynamoDB client not initialized');
            }
            await this.dynamoDB.delete({
                TableName: this.tableName,
                Key: { connectionId }
            }).promise();
        }
    }

    async broadcastEvent(event: ComponentEvent): Promise<void> {
        let connections: WebSocketConnection[];

        if (this.isOffline) {
            connections = Array.from(this.connections.values());
        } else {
            if (!this.dynamoDB) {
                throw new Error('DynamoDB client not initialized');
            }
            const result = await this.dynamoDB.scan({
                TableName: this.tableName
            }).promise();
            connections = result.Items as WebSocketConnection[];
        }

        const message = JSON.stringify(event);
        const postToConnection = async (connection: WebSocketConnection) => {
            try {
                if (this.isOffline) {
                    console.log(`[Offline] Would send to ${connection.connectionId}:`, message);
                    return;
                }

                if (!this.api) {
                    throw new Error('API Gateway client not initialized');
                }

                await this.api.postToConnection({
                    ConnectionId: connection.connectionId,
                    Data: message
                }).promise();
            } catch (error: any) {
                if ((error as any).statusCode === 410) {
                    // Connection is stale, remove it
                    await this.onDisconnect(connection.connectionId);
                } else {
                    console.error(`Failed to send message to ${connection.connectionId}:`, error);
                }
            }
        };

        // Send to all connections in parallel
        await Promise.all(connections.map(postToConnection));
    }

    async getConnections(): Promise<WebSocketConnection[]> {
        if (this.isOffline) {
            return Array.from(this.connections.values());
        }

        if (!this.dynamoDB) {
            throw new Error('DynamoDB client not initialized');
        }

        const result = await this.dynamoDB.scan({
            TableName: this.tableName
        }).promise();

        return result.Items as WebSocketConnection[];
    }
} 