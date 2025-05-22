export const config = {
  aws: {
    region: process.env.AWS_REGION || 'eu-west-1',
    stage: process.env.STAGE || 'dev',
    connectionsTable: process.env.CONNECTIONS_TABLE || 'websocket-connections',
  },
  websocket: {
    endpoint: process.env.WEBSOCKET_API_ENDPOINT,
    pingInterval: parseInt(process.env.WEBSOCKET_PING_INTERVAL || '30000', 10),
    reconnectInterval: parseInt(process.env.WEBSOCKET_RECONNECT_INTERVAL || '1000', 10),
    maxReconnectAttempts: parseInt(process.env.WEBSOCKET_MAX_RECONNECT_ATTEMPTS || '5', 10),
  },
  test: {
    region: process.env.TEST_AWS_REGION || 'eu-west-1',
    wsUrl: process.env.TEST_WS_URL || 'ws://localhost:3001',
  }
}; 