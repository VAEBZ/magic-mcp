export interface ConnectionMetadata {
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

export type ComponentEventType = "componentUpdate" | "componentCreate" | "componentDelete";
export type ComponentActionType = "create" | "update" | "delete";

export interface EventMessage {
  event: ComponentEventType;
  data: {
    action: ComponentActionType;
    component: any;
    timestamp: string;
    metadata?: {
      userId?: string;
      reason?: string;
      [key: string]: any;
    };
  };
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