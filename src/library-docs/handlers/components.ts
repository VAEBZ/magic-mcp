import { APIGatewayProxyResult, APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import { broadcastMessage } from './websockets';
import { EventMessage } from '../../library-docs/types/websocket';
import { Component } from '../../library-docs/types/component';

// In-memory storage for offline development
const inMemoryStorage = new Map<string, Component>();

// Initialize S3 client only if not in offline mode
const s3 = process.env.IS_OFFLINE ? null : new S3();
const BUCKET_NAME = process.env.STORAGE_BUCKET || '';

interface ComponentTypeDefinition {
  required: string[];
  optional: string[];
}

// ... existing validation code ...

export const createComponent: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing request body' })
      };
    }

    const { type, content } = JSON.parse(event.body);
    
    if (!type || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields: type, content' })
      };
    }

    console.log('Creating component:', { type, content });
    
    // Validate component
    const validation = validateComponent(type, content);
    if (!validation.valid) {
      console.log('Component validation failed:', validation.errors);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid component', errors: validation.errors })
      };
    }

    const newComponent: Component = {
      id: `${type}-${Date.now()}`,
      type,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (process.env.IS_OFFLINE) {
      console.log('Running in offline mode, using in-memory storage');
      inMemoryStorage.set(newComponent.id, newComponent);
    } else {
      await s3!.putObject({
        Bucket: BUCKET_NAME,
        Key: `components/${newComponent.id}.json`,
        Body: JSON.stringify(newComponent),
        ContentType: 'application/json'
      }).promise();
    }

    // After successful creation
    try {
      const message: EventMessage = {
        event: 'componentCreate',
        data: {
          action: 'create',
          component: newComponent,
          timestamp: new Date().toISOString(),
          metadata: {
            reason: 'Component created via API'
          }
        }
      };
      await broadcastMessage(event as any, message, {
        includeMetadata: true,
        retryCount: 3
      });
    } catch (broadcastError) {
      console.error('Failed to broadcast component creation:', broadcastError);
      // Don't fail the request if broadcast fails
    }

    return {
      statusCode: 201,
      body: JSON.stringify(newComponent)
    };
  } catch (error) {
    console.error('Error creating component:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to create component', error })
    };
  }
};

export const updateComponent: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing component ID' })
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing request body' })
      };
    }

    const { content } = JSON.parse(event.body);
    
    if (!content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required field: content' })
      };
    }

    let existingComponent: Component | undefined;

    if (process.env.IS_OFFLINE) {
      console.log('Running in offline mode, using in-memory storage');
      existingComponent = inMemoryStorage.get(id);
      if (!existingComponent) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'Component not found' })
        };
      }
    } else {
      try {
        const existing = await s3!.getObject({
          Bucket: BUCKET_NAME,
          Key: `components/${id}.json`
        }).promise();
        existingComponent = JSON.parse(existing.Body!.toString());
      } catch (error: any) {
        if (error.code === 'NoSuchKey') {
          return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Component not found' })
          };
        }
        throw error;
      }
    }

    // Validate updated content
    const validation = validateComponent(existingComponent.type, content);
    if (!validation.valid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid component content', errors: validation.errors })
      };
    }

    const updatedComponent: Component = {
      id: existingComponent.id,
      type: existingComponent.type,
      content,
      createdAt: existingComponent.createdAt,
      updatedAt: new Date().toISOString()
    };

    if (process.env.IS_OFFLINE) {
      inMemoryStorage.set(id, updatedComponent);
    } else {
      await s3!.putObject({
        Bucket: BUCKET_NAME,
        Key: `components/${id}.json`,
        Body: JSON.stringify(updatedComponent),
        ContentType: 'application/json'
      }).promise();
    }

    // After successful update
    try {
      const message: EventMessage = {
        event: 'componentUpdate',
        data: {
          action: 'update',
          component: updatedComponent,
          timestamp: new Date().toISOString(),
          metadata: {
            reason: 'Component updated via API'
          }
        }
      };
      await broadcastMessage(event as any, message, {
        includeMetadata: true,
        retryCount: 3
      });
    } catch (broadcastError) {
      console.error('Failed to broadcast component update:', broadcastError);
      // Don't fail the request if broadcast fails
    }

    return {
      statusCode: 200,
      body: JSON.stringify(updatedComponent)
    };
  } catch (error) {
    console.error('Error updating component:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to update component', error })
    };
  }
};

export const deleteComponent: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing component ID' })
      };
    }

    let deletedComponent: Component | undefined;

    if (process.env.IS_OFFLINE) {
      deletedComponent = inMemoryStorage.get(id);
      if (!deletedComponent) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'Component not found' })
        };
      }
      inMemoryStorage.delete(id);
    } else {
      try {
        const existing = await s3!.getObject({
          Bucket: BUCKET_NAME,
          Key: `components/${id}.json`
        }).promise();
        deletedComponent = JSON.parse(existing.Body!.toString());
        
        await s3!.deleteObject({
          Bucket: BUCKET_NAME,
          Key: `components/${id}.json`
        }).promise();
      } catch (error: any) {
        if (error.code === 'NoSuchKey') {
          return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Component not found' })
          };
        }
        throw error;
      }
    }

    // After successful deletion
    try {
      const message: EventMessage = {
        event: 'componentDelete',
        data: {
          action: 'delete',
          component: deletedComponent,
          timestamp: new Date().toISOString(),
          metadata: {
            reason: 'Component deleted via API'
          }
        }
      };
      await broadcastMessage(event as any, message, {
        includeMetadata: true,
        retryCount: 3
      });
    } catch (broadcastError) {
      console.error('Failed to broadcast component deletion:', broadcastError);
      // Don't fail the request if broadcast fails
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Component deleted successfully' })
    };
  } catch (error) {
    console.error('Error deleting component:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to delete component', error })
    };
  }
}; 