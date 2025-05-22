import { APIGatewayProxyResult, APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import { broadcastMessage } from '../handlers/websockets';
import { ComponentEvent } from '../types/events';

// In-memory storage for offline development
const inMemoryStorage = new Map<string, Component>();

// Initialize S3 client only if not in offline mode
const s3 = process.env.IS_OFFLINE ? null : new S3();
const BUCKET_NAME = process.env.STORAGE_BUCKET || '';

interface ComponentTypeDefinition {
  required: string[];
  optional: string[];
}

interface ComponentTypes {
  [key: string]: ComponentTypeDefinition;
}

// Supported component types and their required fields
const COMPONENT_TYPES: ComponentTypes = {
  button: {
    required: ['label', 'action'],
    optional: ['style', 'size', 'disabled']
  },
  input: {
    required: ['type', 'name'],
    optional: ['placeholder', 'value', 'required', 'disabled']
  },
  card: {
    required: ['title'],
    optional: ['subtitle', 'content', 'image', 'actions']
  },
  container: {
    required: ['children'],
    optional: ['style', 'layout']
  }
};

export interface Component {
  id: string;
  type: string;
  content: any;
  createdAt: string;
  updatedAt: string;
}

function validateComponent(type: string, content: any): { valid: boolean; errors?: string[] } {
  if (!COMPONENT_TYPES[type]) {
    return { valid: false, errors: [`Invalid component type: ${type}`] };
  }

  const errors: string[] = [];
  const { required = [], optional = [] } = COMPONENT_TYPES[type];

  // Check required fields
  for (const field of required) {
    if (!content[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check for unknown fields
  const allowedFields = [...required, ...optional];
  Object.keys(content).forEach(field => {
    if (!allowedFields.includes(field)) {
      errors.push(`Unknown field: ${field}`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export const createComponent = async (type: string, content: any, id: string): Promise<APIGatewayProxyResult> => {
  try {
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
      id,
      type,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (process.env.IS_OFFLINE) {
      console.log('Running in offline mode, using in-memory storage');
      inMemoryStorage.set(newComponent.id, newComponent);
    } else {
      console.log('Running in online mode, using S3 storage');
      console.log('S3 bucket:', BUCKET_NAME);
      console.log('Component key:', `components/${newComponent.id}.json`);
      
      if (!s3) {
        throw new Error('S3 client not initialized');
      }

      try {
        await s3.putObject({
          Bucket: BUCKET_NAME,
          Key: `components/${newComponent.id}.json`,
          Body: JSON.stringify(newComponent),
          ContentType: 'application/json'
        }).promise();
      } catch (error: any) {
        console.error('S3 error:', error);
        throw new Error(`Failed to store component in S3: ${error.message || 'Unknown error'}`);
      }
    }

    return {
      statusCode: 201,
      body: JSON.stringify(newComponent)
    };
  } catch (error: any) {
    console.error('Error creating component:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Failed to create component',
        error: error instanceof Error ? error.message : String(error),
        details: process.env.NODE_ENV === 'development' ? error : undefined
      })
    };
  }
};

export const updateComponent = async (id: string, content: any, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required field: content' })
      };
    }

    let existingComponent: Component;

    if (process.env.IS_OFFLINE) {
      console.log('Running in offline mode, using in-memory storage');
      const component = inMemoryStorage.get(id);
      if (!component) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'Component not found' })
        };
      }
      existingComponent = component;
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
      const message: ComponentEvent = {
        event: 'componentUpdate',
        data: {
          action: 'update',
          component: updatedComponent,
          timestamp: new Date().toISOString()
        }
      };
      await broadcastMessage(event, message);
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

export const deleteComponent = async (id: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    let deletedComponent: Component;

    if (process.env.IS_OFFLINE) {
      const component = inMemoryStorage.get(id);
      if (!component) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'Component not found' })
        };
      }
      deletedComponent = component;
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
      const message: ComponentEvent = {
        event: 'componentDelete',
        data: {
          action: 'delete',
          component: deletedComponent,
          timestamp: new Date().toISOString()
        }
      };
      await broadcastMessage(event, message);
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

export async function listComponents(): Promise<APIGatewayProxyResult> {
  try {
    let components: Component[] = [];

    if (process.env.IS_OFFLINE) {
      console.log('Running in offline mode, using in-memory storage');
      components = Array.from(inMemoryStorage.values());
      console.log('Found components:', components);
    } else {
      console.log('Running in online mode, using S3 storage');
      const result = await s3!.listObjects({
        Bucket: BUCKET_NAME,
        Prefix: 'components/'
      }).promise();

      components = await Promise.all(
        (result.Contents || [])
          .filter((item: any) => item.Key?.endsWith('.json'))
          .map(async (item: any) => {
            const obj = await s3!.getObject({
              Bucket: BUCKET_NAME,
              Key: item.Key!
            }).promise();
            return JSON.parse(obj.Body?.toString() || '{}');
          })
      );
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(components)
    };
  } catch (error) {
    console.error('Error listing components:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error listing components' })
    };
  }
}

export async function getComponent(id: string): Promise<APIGatewayProxyResult> {
  try {
    let component: Component | undefined;

    if (process.env.IS_OFFLINE) {
      console.log('Running in offline mode, using in-memory storage');
      component = inMemoryStorage.get(id);
      if (!component) {
        throw new Error('Component not found');
      }
    } else {
      console.log('Running in online mode, using S3 storage');
      const result = await s3!.getObject({
        Bucket: BUCKET_NAME,
        Key: `components/${id}.json`
      }).promise();

      component = JSON.parse(result.Body?.toString() || '{}');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(component)
    };
  } catch (error) {
    console.error('Error getting component:', error);
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ message: 'Component not found' })
    };
  }
} 