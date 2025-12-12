#!/usr/bin/env node

const readline = require('readline');

// Create interface for stdio
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Available tools
const TOOLS = [
  {
    name: 'health_check',
    description: 'Check if the Earth Engine MCP server is running',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'search_gee_catalog',
    description: 'Search the Google Earth Engine data catalog',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' }
      },
      required: ['query']
    }
  }
];

let buffer = '';

// Process incoming messages
rl.on('line', (line) => {
  buffer += line;
  
  try {
    const message = JSON.parse(buffer);
    buffer = '';
    
    if (message.method === 'initialize') {
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            prompts: {},
            resources: {}
          },
          serverInfo: {
            name: 'earth-engine-mcp',
            version: '1.0.0'
          }
        }
      }));
    } else if (message.method === 'tools/list') {
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: { tools: TOOLS }
      }));
    } else if (message.method === 'prompts/list') {
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: { prompts: [] }
      }));
    } else if (message.method === 'resources/list') {
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: { resources: [] }
      }));
    } else if (message.method === 'tools/call') {
      const { name, arguments: args } = message.params;
      let result = {
        content: [{
          type: 'text',
          text: `Tool ${name} called with args: ${JSON.stringify(args)}`
        }]
      };
      
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: result
      }));
    }
  } catch (e) {
    // Buffer incomplete message
  }
});

process.stderr.write('[MCP] Earth Engine server ready\n');
