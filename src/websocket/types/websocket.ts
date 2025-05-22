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
    [key: string]: any;
  };
}

export interface EventMessage {
  event: "componentUpdate" | "componentCreate" | "componentDelete";
  data: {
    action: "create" | "update" | "delete";
    component: any;
  };
}

export interface WebSocketError {
  statusCode: number;
  message: string;
  error?: any;
} 