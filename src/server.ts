import express, { Request, Response } from 'express';
import * as http from 'http';
import { createMCPServer } from './mcp-server';

const app = express();
const server = http.createServer(app);
const mcpServer = createMCPServer(server);

// Parse JSON bodies
app.use(express.json());

// MCP Server Info endpoint
app.get('/mcp/info', (req: Request, res: Response) => {
  res.json({
    name: 'magic-mcp',
    description: 'Magic Component Platform MCP Server',
    version: '1.0.0',
    tools: mcpServer.getTools()
  });
});

// SSE endpoint for real-time updates
app.get('/mcp/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send a ping every 30 seconds to keep the connection alive
  const pingInterval = setInterval(() => {
    res.write('event: ping\ndata: {}\n\n');
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(pingInterval);
  });

  // Function to send events to the client
  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Register this client for events
  // mcpServer.on('componentUpdate', (data) => sendEvent('componentUpdate', data));
  // mcpServer.on('componentCreate', (data) => sendEvent('componentCreate', data));
  // mcpServer.on('componentDelete', (data) => sendEvent('componentDelete', data));
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0'
  });
});

const PORT = process.env.PORT || 9628;

server.listen(PORT, () => {
  console.log(`Magic MCP Server running on port ${PORT}`);
}); 