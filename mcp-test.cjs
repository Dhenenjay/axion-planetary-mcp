#!/usr/bin/env node

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

const TOOLS = [{
  name: 'test_tool',
  description: 'A simple test tool',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string' }
    }
  }
}];

function send(response) {
  process.stdout.write(JSON.stringify(response) + '\n');
}

rl.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    const { id, method, params } = message;
    
    switch (method) {
      case 'initialize':
        send({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: params?.protocolVersion || '2025-06-18',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'Test MCP Server',
              version: '1.0.0'
            }
          }
        });
        break;
        
      case 'initialized':
        // No response for notification
        break;
        
      case 'tools/list':
        send({
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS }
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
        send({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{
              type: 'text',
              text: 'Test response: ' + JSON.stringify(params.arguments)
            }]
          }
        });
        break;
        
      default:
        send({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not supported: ${method}`
          }
        });
    }
  } catch (e) {
    // Silently ignore parse errors
  }
});

// Keep process alive
process.stdin.resume();