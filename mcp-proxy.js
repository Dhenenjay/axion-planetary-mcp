#!/usr/bin/env node

const readline = require('readline');

// Server URL - adjust if your server runs on a different port
const SERVER_URL = 'http://localhost:3000/sse';

// Create interface for stdio communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Log to stderr since stdout is for MCP protocol
function log(...args) {
  console.error('[MCP Proxy]', ...args);
}

log('Starting Earth Engine MCP Proxy...');
log('Connecting to server at:', SERVER_URL);
log('✅ Shapefile tools available!');
log('✅ Including convert_place_to_shapefile_geometry');

// Handle incoming JSON-RPC requests
rl.on('line', async (line) => {
  let request;
  try {
    request = JSON.parse(line);
    log('Received request:', request.method);
    
    // Use built-in fetch (available in Node.js 18+)
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const error = await response.text();
      const errorResponse = {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: `Server error: ${response.status}`,
          data: error
        }
      };
      console.log(JSON.stringify(errorResponse));
      return;
    }
    
    const result = await response.json();
    
    // Format the response for MCP
    const mcpResponse = {
      jsonrpc: '2.0',
      id: request.id,
      result: result
    };
    
    // Send response back to Claude
    console.log(JSON.stringify(mcpResponse));
    
  } catch (error) {
    log('Error processing request:', error);
    const errorResponse = {
      jsonrpc: '2.0',
      id: request ? request.id : null,
      error: {
        code: -32700,
        message: 'Parse error',
        data: error.message
      }
    };
    console.log(JSON.stringify(errorResponse));
  }
});

// Handle process termination
process.on('SIGINT', () => {
  log('Shutting down MCP proxy...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Shutting down MCP proxy...');
  process.exit(0);
});
