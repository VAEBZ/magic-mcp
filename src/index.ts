import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { createComponent, getComponent, listComponents, updateComponent, deleteComponent } from './handlers/components';
import { generatePreview } from './handlers/preview';
import { DiscoveryService } from './services/discovery';
import { HealthService } from './services/health';
import { WebSocketService } from './services/websocket';

// Initialize services
const discoveryService = new DiscoveryService();
const healthService = new HealthService();
const webSocketService = new WebSocketService();

// Register with MAGRATHEAN on cold start
discoveryService.register().catch(error => {
    console.error('Failed to register with MAGRATHEAN:', error);
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Remove /dev and /mcp prefixes from path for checking
        const path = event.path.replace(/^\/dev/, '').replace(/^\/mcp/, '');
        console.log('Processing request for path:', event.path, 'normalized to:', path);

        // Health check endpoint
        if (path === '/magic/health') {
            const status = await healthService.getStatus();
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'GET,OPTIONS'
                },
                body: JSON.stringify(status)
            };
        }

        // Component endpoints
        if (path.startsWith('/magic/components')) {
            // Extract component ID from path
            const pathParts = path.split('/');
            const id = pathParts.length > 3 ? pathParts[3] : '';

            switch (event.httpMethod) {
                case 'GET':
                    if (id === '') {
                        return await listComponents();
                    }
                    return await getComponent(id);

                case 'POST':
                    if (id !== '') {
                        return {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
                            },
                            body: JSON.stringify({ message: 'Invalid path for POST request' })
                        };
                    }
                    const createBody = JSON.parse(event.body || '{}');
                    const componentId = Date.now().toString();
                    const createResult = await createComponent(createBody.type, createBody.content, componentId);
                    
                    // Broadcast component creation event
                    await webSocketService.broadcastEvent({
                        event: 'componentCreate',
                        data: {
                            action: 'create',
                            component: { id: componentId, ...createBody },
                            timestamp: new Date().toISOString()
                        }
                    });
                    
                    return createResult;

                case 'PUT':
                    if (id === '') {
                        return {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
                            },
                            body: JSON.stringify({ message: 'Component ID required for update' })
                        };
                    }
                    const updateBody = JSON.parse(event.body || '{}');
                    const updateResult = await updateComponent(id, updateBody.content, event);
                    
                    // Broadcast component update event
                    await webSocketService.broadcastEvent({
                        event: 'componentUpdate',
                        data: {
                            action: 'update',
                            component: { id, ...updateBody },
                            timestamp: new Date().toISOString()
                        }
                    });
                    
                    return updateResult;

                case 'DELETE':
                    if (id === '') {
                        return {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
                            },
                            body: JSON.stringify({ message: 'Component ID required for deletion' })
                        };
                    }
                    const deleteResult = await deleteComponent(id, event);
                    
                    // Broadcast component deletion event
                    await webSocketService.broadcastEvent({
                        event: 'componentDelete',
                        data: {
                            action: 'delete',
                            component: { id },
                            timestamp: new Date().toISOString()
                        }
                    });
                    
                    return deleteResult;

                case 'OPTIONS':
                    return {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
                        },
                        body: ''
                    };

                default:
                    return {
                        statusCode: 405,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
                        },
                        body: JSON.stringify({ message: 'Method not allowed' })
                    };
            }
        }

        // Preview endpoint
        if (path === '/magic/preview' && event.httpMethod === 'POST') {
            const previewRequest = JSON.parse(event.body || '{}');
            return await generatePreview(previewRequest);
        }

        // Handle unknown paths
        console.log('Path not matched:', path);
        return {
            statusCode: 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            body: JSON.stringify({
                message: 'Not Found'
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            body: JSON.stringify({
                message: 'Internal Server Error'
            })
        };
    }
};

// WebSocket handlers
export const webSocketConnectHandler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
    try {
        const connectionId = event.requestContext.connectionId;
        const context = event.requestContext.domainName || 'default';
        
        await webSocketService.onConnect(connectionId, context);
        healthService.incrementConnections();
        
        return { statusCode: 200, body: 'Connected' };
    } catch (error) {
        console.error('WebSocket connect error:', error);
        return { statusCode: 500, body: 'Failed to connect' };
    }
};

export const webSocketDisconnectHandler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
    try {
        const connectionId = event.requestContext.connectionId;
        
        await webSocketService.onDisconnect(connectionId);
        healthService.decrementConnections();
        
        return { statusCode: 200, body: 'Disconnected' };
    } catch (error) {
        console.error('WebSocket disconnect error:', error);
        return { statusCode: 500, body: 'Failed to disconnect' };
    }
};

export const webSocketDefaultHandler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
    try {
        // Handle any custom WebSocket messages here
        return { statusCode: 200, body: 'Message received' };
    } catch (error) {
        console.error('WebSocket message error:', error);
        return { statusCode: 500, body: 'Failed to process message' };
    }
};
