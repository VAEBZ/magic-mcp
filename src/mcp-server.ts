import { Server } from 'http';
import * as WebSocket from 'ws';
import { ComponentService } from './services/component';
import { EventEmitter } from 'events';

interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any) => Promise<any>;
}

export class MCPServer extends EventEmitter {
  private httpServer: Server;
  private wsServer: WebSocket.Server;
  private tools: Map<string, MCPTool> = new Map();
  private componentService: ComponentService;

  constructor(server: Server) {
    super();
    this.httpServer = server;
    this.wsServer = new WebSocket.Server({ server });
    this.componentService = new ComponentService();
    this.setupWebSocket();
    this.registerTools();
  }

  private setupWebSocket() {
    this.wsServer.on('connection', (ws) => {
      ws.on('message', async (message) => {
        try {
          const request = JSON.parse(message.toString());
          const { tool, params } = request;
          
          const toolImpl = this.tools.get(tool);
          if (!toolImpl) {
            ws.send(JSON.stringify({ error: `Tool ${tool} not found` }));
            return;
          }

          const result = await toolImpl.handler(params);
          ws.send(JSON.stringify({ result }));
        } catch (error) {
          ws.send(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        }
      });
    });
  }

  private registerTools() {
    this.registerTool({
      name: 'createComponent',
      description: 'Create a new component',
      parameters: {
        type: { type: 'string' },
        content: { type: 'object' }
      },
      handler: async (params) => {
        const component = await this.componentService.createComponent(params);
        return { component };
      }
    });

    this.registerTool({
      name: 'getComponent',
      description: 'Get a component by ID',
      parameters: {
        id: { type: 'string' }
      },
      handler: async (params) => {
        const component = await this.componentService.getComponent(params.id);
        return { component };
      }
    });

    this.registerTool({
      name: 'listComponents',
      description: 'List all components',
      parameters: {},
      handler: async () => {
        const components = await this.componentService.listComponents();
        return { components };
      }
    });

    this.registerTool({
      name: 'updateComponent',
      description: 'Update a component',
      parameters: {
        id: { type: 'string' },
        content: { type: 'object' }
      },
      handler: async (params) => {
        const component = await this.componentService.updateComponent(params.id, params.content);
        return { component };
      }
    });

    this.registerTool({
      name: 'deleteComponent',
      description: 'Delete a component',
      parameters: {
        id: { type: 'string' }
      },
      handler: async (params) => {
        await this.componentService.deleteComponent(params.id);
        return { success: true };
      }
    });

    this.registerTool({
      name: 'previewComponent',
      description: 'Generate a preview of components',
      parameters: {
        components: { type: 'array' }
      },
      handler: async (params) => {
        const preview = await this.componentService.generatePreview(params);
        return { preview };
      }
    });
  }

  private registerTool(tool: MCPTool) {
    this.tools.set(tool.name, tool);
  }

  public getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }
}

export const createMCPServer = (server: Server): MCPServer => {
  return new MCPServer(server);
}; 