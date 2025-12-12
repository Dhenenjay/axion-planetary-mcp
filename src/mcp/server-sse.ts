/**
 * AXION MCP SSE SERVER
 * HTTP server with SSE transport for remote MCP access
 * API key authentication enabled
 */

import express, { Request, Response, NextFunction } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { list, get } from './registry';
import * as fs from 'fs';
import * as path from 'path';
import { getMap, listMaps } from './tools-aws/map-store';

// Import the AWS-native tools
import './tools-aws';

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const REQUIRE_AUTH = process.env.REQUIRE_AUTH !== 'false';

// Load API key from environment variable
let validApiKeys: Set<string> = new Set();

function loadApiKeys() {
  const apiKey = process.env.AXION_API_KEY;
  if (apiKey) {
    validApiKeys = new Set([apiKey]);
    console.log('[SSE] API key configured from AXION_API_KEY env var');
  } else {
    console.log('[SSE] No API key configured - auth will be disabled');
  }
}

loadApiKeys();

// Setup Google credentials from env var if provided
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    const credsPath = '/tmp/gcp-credentials.json';
    const credsJson = Buffer.from(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      'base64'
    ).toString('utf-8');
    fs.writeFileSync(credsPath, credsJson);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
    console.log('[SSE] Google credentials configured from env var');
  } catch (e: any) {
    console.error('[SSE] Failed to setup Google credentials:', e.message);
  }
}

/**
 * Build the MCP server instance
 */
function buildMcpServer(): Server {
  console.log('[MCP] Initializing AXION AWS server with 6 tools...');
  
  const server = new Server(
    {
      name: 'axion-aws-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  
  // Register tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const toolList = list();
    console.log(`[MCP] Serving ${toolList.length} AWS-native tools`);
    return { tools: toolList };
  });
  
  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.log(`[MCP] Tool called: ${name}`);
    
    try {
      const tool = get(name);
      const result = await tool.handler(args || {});
      console.log(`[MCP] Tool ${name} completed successfully`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error(`[MCP] Tool ${name} failed:`, error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message || 'Unknown error',
              tool: name,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });
  
  return server;
}

/**
 * API Key authentication middleware
 */
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip auth for health check and map viewing
  if (req.path === '/health' || req.path.startsWith('/map/') || req.path === '/maps' || req.path.startsWith('/classification/')) {
    return next();
  }
  
  // Skip if auth not required or no keys configured
  if (!REQUIRE_AUTH || validApiKeys.size === 0) {
    return next();
  }
  
  // Check API key in header or query param
  const providedKey = 
    req.headers['x-api-key'] as string ||
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.query.api_key as string;
  
  if (!providedKey || !validApiKeys.has(providedKey)) {
    console.log('[SSE] Unauthorized request - invalid API key');
    res.status(401).json({ error: 'Unauthorized - Invalid API key' });
    return;
  }
  
  next();
}

/**
 * Main entry point
 */
async function main() {
  console.log('[SSE] Starting Axion MCP SSE Server...');
  console.log(`[SSE] Port: ${PORT}`);
  console.log(`[SSE] Auth required: ${REQUIRE_AUTH}`);
  console.log(`[SSE] API keys configured: ${validApiKeys.size}`);
  
  const app = express();
  app.use(express.json());
  
  // Apply auth middleware
  app.use(authMiddleware);
  
  // Store transports by session ID
  const transports: Record<string, SSEServerTransport> = {};
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'axion-mcp-sse',
      version: '1.0.0',
      tools: list().length,
      timestamp: new Date().toISOString(),
    });
  });
  
  // Info endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'Axion MCP Server',
      version: '1.0.0',
      description: 'AWS-native satellite imagery analysis MCP server',
      tools: list().map(t => ({ name: t.name, description: t.description.substring(0, 100) })),
      endpoints: {
        sse: 'GET /sse - Establish SSE connection',
        messages: 'POST /messages?sessionId=<id> - Send messages',
        health: 'GET /health - Health check',
        maps: 'GET /map/:id - View generated maps',
      },
      auth: REQUIRE_AUTH ? 'API key required (x-api-key header)' : 'No auth required',
    });
  });
  
  // Map serving endpoint (no auth required for viewing maps)
  app.get('/map/:id', (req, res) => {
    const mapId = req.params.id;
    const mapData = getMap(mapId);
    
    if (!mapData) {
      res.status(404).json({ error: 'Map not found', id: mapId, available: listMaps().slice(0, 10) });
      return;
    }
    
    res.setHeader('Content-Type', mapData.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(mapData.content);
  });

  // Legacy route for classification maps (backward-compatible)
  app.get('/classification/:id', (req, res) => {
    const mapId = req.params.id;
    const mapData = getMap(mapId);
    if (!mapData) {
      res.status(404).send('Map not found');
      return;
    }
    res.setHeader('Content-Type', mapData.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(mapData.content);
  });
  
  // List available maps
  app.get('/maps', (req, res) => {
    const maps = listMaps();
    res.json({
      count: maps.length,
      maps: maps.map(id => ({ id, url: `/map/${id}` })),
    });
  });
  
  // SSE endpoint for establishing the stream
  app.get('/sse', async (req, res) => {
    console.log('[SSE] New SSE connection request');
    
    try {
      // Create a new SSE transport
      const transport = new SSEServerTransport('/messages', res);
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;
      
      console.log(`[SSE] Established stream with session ID: ${sessionId}`);
      
      // Clean up on close
      transport.onclose = () => {
        console.log(`[SSE] Transport closed for session ${sessionId}`);
        delete transports[sessionId];
      };
      
      // Create and connect MCP server
      const server = buildMcpServer();
      await server.connect(transport);
      
    } catch (error: any) {
      console.error('[SSE] Error establishing stream:', error);
      if (!res.headersSent) {
        res.status(500).send('Error establishing SSE stream');
      }
    }
  });
  
  // Messages endpoint for receiving client requests
  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    
    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId parameter' });
      return;
    }
    
    const transport = transports[sessionId];
    if (!transport) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    
    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (error: any) {
      console.error('[SSE] Error handling message:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error handling request' });
      }
    }
  });
  
  // Start server
  app.listen(PORT, () => {
    console.log(`[SSE] ✅ Server listening on port ${PORT}`);
    console.log(`[SSE] ✅ SSE endpoint: http://localhost:${PORT}/sse`);
    console.log(`[SSE] ✅ Health check: http://localhost:${PORT}/health`);
    console.log('[SSE] ✅ Tools: axion_data, axion_system, axion_process, axion_export, axion_map, axion_classification, axion_sar2optical');
  });
  
  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('[SSE] Shutting down...');
    for (const sessionId in transports) {
      try {
        await transports[sessionId].close();
        delete transports[sessionId];
      } catch (e) {}
    }
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('[SSE] SIGTERM received, shutting down...');
    for (const sessionId in transports) {
      try {
        await transports[sessionId].close();
        delete transports[sessionId];
      } catch (e) {}
    }
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[SSE] Fatal error:', error);
  process.exit(1);
});
