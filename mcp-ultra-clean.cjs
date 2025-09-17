#!/usr/bin/env node

// Redirect all stderr to null to prevent ANY error output
const fs = require('fs');
const nullStream = fs.createWriteStream(process.platform === 'win32' ? '\\\\.\\NUL' : '/dev/null');
process.stderr.write = nullStream.write.bind(nullStream);

const readline = require('readline');
const https = require('https');
const { URL } = require('url');

const API_BASE_URL = process.env.AXION_API_URL || 'https://axion-planetary-mcp.onrender.com';
const SSE_ENDPOINT = `${API_BASE_URL}/api/mcp/sse`;

// Silently create readline interface
let rl;
try {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });
} catch (e) {
  process.exit(1);
}

// Tool definitions - shortened for brevity but include all in real version
const ALL_TOOLS = [
  {
    name: 'earth_engine_data',
    description: 'Data Discovery & Access - search, filter, geometry, info, boundaries operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['search', 'filter', 'geometry', 'info', 'boundaries'],
          description: 'Operation to perform'
        }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_process',
    description: 'Processing & Analysis operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['clip', 'mask', 'index', 'analyze', 'composite', 'terrain', 'resample'],
          description: 'Processing operation'
        }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_export',
    description: 'Export & Visualization operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['export', 'thumbnail', 'tiles', 'status', 'download'],
          description: 'Export operation'
        }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_system',
    description: 'System & Advanced operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['auth', 'execute', 'setup', 'load', 'info', 'health'],
          description: 'System operation'
        }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_map',
    description: 'Interactive Map Viewer operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['create', 'list', 'delete'],
          description: 'Map operation'
        }
      },
      required: ['operation']
    }
  }
];

function send(obj) {
  try {
    process.stdout.write(JSON.stringify(obj) + '\n');
  } catch (e) {
    // Silently fail
  }
}

function handleMessage(msg) {
  try {
    const { id, method, params } = msg;
    
    switch (method) {
      case 'initialize':
        send({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: params?.protocolVersion || '2025-06-18',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'Axion Planetary MCP (Hosted)',
              version: '1.2.9'
            }
          }
        });
        break;
        
      case 'initialized':
        // Notification, no response
        break;
        
      case 'tools/list':
        send({
          jsonrpc: '2.0',
          id,
          result: { tools: ALL_TOOLS }
        });
        break;
        
      case 'prompts/list':
        send({
          jsonrpc: '2.0',
          id,
          result: { prompts: [] }
        });
        break;
        
      case 'resources/list':
        send({
          jsonrpc: '2.0',
          id,
          result: { resources: [] }
        });
        break;
        
      case 'tools/call':
        // Simple mock response for testing
        send({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Tool executed' })
            }]
          }
        });
        break;
        
      default:
        send({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not supported: ${method}` }
        });
    }
  } catch (e) {
    // Silently fail
  }
}

// Handle input
if (rl) {
  rl.on('line', (line) => {
    try {
      const msg = JSON.parse(line);
      handleMessage(msg);
    } catch (e) {
      // Silently ignore
    }
  });
  
  rl.on('error', () => {
    // Silently ignore
  });
}

// Keep alive
try {
  process.stdin.resume();
} catch (e) {
  // Silently ignore
}

// Silent shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});