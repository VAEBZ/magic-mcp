import { ApiGatewayManagementApi } from 'aws-sdk';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { ComponentEvent } from '../types/events';

const api = new ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API_ENDPOINT
});

export async function broadcastMessage(event: APIGatewayProxyEvent, message: ComponentEvent): Promise<void> {
    try {
        await api.postToConnection({
            ConnectionId: event.requestContext.connectionId!,
            Data: JSON.stringify(message)
        }).promise();
    } catch (error: any) {
        console.error('Failed to broadcast message:', error);
        throw error;
    }
} 