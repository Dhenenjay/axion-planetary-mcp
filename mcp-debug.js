#!/usr/bin/env node

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.error('[DEBUG] MCP Server starting...');

// Simple tool for testing
const TEST_TOOL = {
  name: 'test_earth_engine',
  description: 'Test Earth Engine connection',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string' }
    },
    required: ['message']
  }
};

rl.on('line', (line) => {
  console.error('[DEBUG] Received:', line.substring(0, 100));
  
  try {
    const msg = JSON.parse(line);
    let response;
    
    switch(msg.method) {
      case 'initialize':
        response = {
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            protocolVersion: '2025-06-18',
            capabilities: { tools: {} },
            serverInfo: { name: 'earth-engine-debug', version: '1.0.0' }
          }
        };
        break;
        
      case 'tools/list':
        response = {
          jsonrpc: '2.0',
          id: msg.id,
          result: { tools: [TEST_TOOL] }
        };
        break;
        
      case 'prompts/list':
        response = {
          jsonrpc: '2.0',
          id: msg.id,
          result: { prompts: [] }
        };
        break;
        
      case 'resources/list':
        response = {
          jsonrpc: '2.0',
          id: msg.id,
          result: { resources: [] }
        };
        break;
        
      case 'tools/call':
        console.error('[DEBUG] Tool called:', msg.params.name);
        response = {
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            content: [{
              type: 'text',
              text: `Test successful! You called ${msg.params.name} with: ${JSON.stringify(msg.params.arguments)}`
            }]
          }
        };
        break;
        
      default:
        if (msg.method?.startsWith('notifications/')) {
          console.error('[DEBUG] Notification:', msg.method);
          return; // Don't respond to notifications
        }
        console.error('[DEBUG] Unknown method:', msg.method);
        return;
    }
    
    if (response) {
      const responseStr = JSON.stringify(response);
      console.log(responseStr);
      console.error('[DEBUG] Sent response for:', msg.method);
    }
    
  } catch (e) {
    console.error('[DEBUG] Error:', e.message);
  }
});

console.error('[DEBUG] Server ready');
