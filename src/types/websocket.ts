export interface WebSocketConnection {
    connectionId: string;
    clientContext: string;
    timestamp: string;
    rbacRoles?: string[];
    allowedServers?: string[];
    clientMetadata?: {
        clientType?: string;
        region?: string;
        environment?: string;
        version?: string;
        capabilities?: string[];
        [key: string]: any;
    };
    lastPingAt?: string;
    isActive?: boolean;
}

export interface WebSocketError {
    statusCode: number;
    message: string;
    code?: string;
    details?: any;
    timestamp: string;
    connectionId?: string;
    requestId?: string;
}

export interface WebSocketResponse {
    statusCode: number;
    body: string;
    headers?: Record<string, string>;
}

export interface BroadcastOptions {
    targetContext?: string;
    excludeConnectionIds?: string[];
    includeMetadata?: boolean;
    retryCount?: number;
    batchSize?: number;
} 