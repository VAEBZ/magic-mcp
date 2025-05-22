export * from './types';
export * from './handlers';
export * from './client';

// Re-export commonly used types and handlers
export { MagicWebSocket } from './client/MagicWebSocket';
export { ConnectionMetadata, EventMessage } from './types/websocket';
export { connectHandler, disconnectHandler, defaultHandler } from './handlers/websockets';
export { connectionHealthHandler } from './handlers/connectionHealth'; 