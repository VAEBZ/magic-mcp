import '@jest/globals';
import { ConnectionMetadata, EventMessage, WebSocketError, WebSocketResponse } from '../../types/websocket';
import { describe, it, expect } from '@jest/globals';
import type {
  ComponentEventType,
  ComponentActionType,
  BroadcastOptions
} from '../../types/websocket';

describe('WebSocket Types', () => {
  describe('ConnectionMetadata', () => {
    it('should validate a minimal ConnectionMetadata object', () => {
      const metadata: ConnectionMetadata = {
        connectionId: 'test-connection',
        clientContext: 'test-context',
        timestamp: new Date().toISOString()
      };

      expect(metadata.connectionId).toBeDefined();
      expect(metadata.clientContext).toBeDefined();
      expect(metadata.timestamp).toBeDefined();
    });

    it('should validate a full ConnectionMetadata object', () => {
      const metadata: ConnectionMetadata = {
        connectionId: 'test-connection',
        clientContext: 'test-context',
        timestamp: new Date().toISOString(),
        rbacRoles: ['admin', 'user'],
        allowedServers: ['server1', 'server2'],
        clientMetadata: {
          clientType: 'web',
          region: 'us-east-1',
          environment: 'test',
          version: '1.0.0',
          capabilities: ['feature1', 'feature2'],
          customField: 'value'
        },
        lastPingAt: new Date().toISOString(),
        isActive: true
      };

      expect(metadata).toMatchObject({
        connectionId: expect.any(String),
        clientContext: expect.any(String),
        timestamp: expect.any(String),
        rbacRoles: expect.arrayContaining(['admin', 'user']),
        allowedServers: expect.arrayContaining(['server1', 'server2']),
        clientMetadata: expect.objectContaining({
          clientType: 'web',
          region: 'us-east-1',
          environment: 'test',
          version: '1.0.0',
          capabilities: expect.arrayContaining(['feature1', 'feature2']),
          customField: 'value'
        }),
        lastPingAt: expect.any(String),
        isActive: true
      });
    });
  });

  describe('EventMessage', () => {
    it('should validate a minimal EventMessage object', () => {
      const message: EventMessage = {
        event: 'componentUpdate',
        data: {
          action: 'update',
          component: { id: 'test' },
          timestamp: new Date().toISOString()
        }
      };

      expect(message.event).toBe('componentUpdate');
      expect(message.data.action).toBe('update');
      expect(message.data.component).toBeDefined();
      expect(message.data.timestamp).toBeDefined();
    });

    it('should validate an EventMessage with metadata', () => {
      const message: EventMessage = {
        event: 'componentCreate',
        data: {
          action: 'create',
          component: { id: 'test' },
          timestamp: new Date().toISOString(),
          metadata: {
            userId: 'user123',
            reason: 'test creation',
            customField: 'value'
          }
        }
      };

      expect(message.data.metadata).toMatchObject({
        userId: 'user123',
        reason: 'test creation',
        customField: 'value'
      });
    });
  });

  describe('WebSocketError', () => {
    it('should create valid error object', () => {
      const error: WebSocketError = {
        statusCode: 400,
        message: 'Bad Request',
        code: 'INVALID_INPUT',
        details: { field: 'test' },
        timestamp: new Date().toISOString(),
        connectionId: 'test-connection',
        requestId: 'test-request'
      };

      expect(error.statusCode).toBe(400);
      expect(error.message).toBeDefined();
      expect(error.timestamp).toBeDefined();
    });
  });

  describe('WebSocketResponse', () => {
    it('should create valid response object', () => {
      const response: WebSocketResponse = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' }),
        headers: {
          'Content-Type': 'application/json'
        }
      };

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
      expect(JSON.parse(response.body)).toHaveProperty('message');
    });
  });

  describe('BroadcastOptions', () => {
    it('should validate BroadcastOptions with all fields', () => {
      const options: BroadcastOptions = {
        targetContext: 'test-context',
        excludeConnectionIds: ['conn1', 'conn2'],
        includeMetadata: true,
        retryCount: 3,
        batchSize: 100
      };

      expect(options).toMatchObject({
        targetContext: expect.any(String),
        excludeConnectionIds: expect.arrayContaining(['conn1', 'conn2']),
        includeMetadata: true,
        retryCount: 3,
        batchSize: 100
      });
    });
  });
}); 