#!/usr/bin/env node

/**
 * PRODUCTION MCP SERVER - COMPLETE WITH ALL TOOLS
 * ================================================
 * Full-featured MCP server with all Earth Engine tools and models
 * Communicates via stdio with Claude Desktop
 */

const readline = require('readline');
const http = require('http');

// API endpoints
const BASE_URL = 'http://localhost:3000';
const TOOLS_ENDPOINT = `${BASE_URL}/transport`;

// Create readline interface for stdio
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Buffer for incomplete messages
let buffer = '';

// Log helper (writes to stderr to not interfere with stdio)
function log(message) {
  if (process.env.DEBUG) {
    console.error(`[MCP Server] ${new Date().toISOString()} - ${message}`);
  }
}

// Send response to Claude
function sendResponse(response) {
  const message = JSON.stringify(response);
  console.log(message);
  log(`Sent response: ${message.substring(0, 200)}...`);
}

// Make HTTP request to Next.js server
async function callNextAPI(method, params = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ method, params });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/transport',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Handle incoming MCP requests
async function handleRequest(request) {
  log(`Received request: ${JSON.stringify(request).substring(0, 200)}...`);
  
  try {
    const { id, method, params } = request;
    
    switch (method) {
      case 'initialize':
        sendResponse({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {}
            },
            serverInfo: {
              name: 'Planetary MCP',
              version: '1.0.0'
            }
          }
        });
        break;
        
      case 'initialized':
        sendResponse({
          jsonrpc: '2.0',
          id,
          result: {}
        });
        break;
        
      case 'tools/list':
        const toolsList = await callNextAPI('tools/list');
        sendResponse({
          jsonrpc: '2.0',
          id,
          result: toolsList
        });
        break;
        
      case 'tools/call':
        const toolResult = await callNextAPI('tools/call', params);
        
        // Handle error responses
        if (toolResult.error) {
          sendResponse({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32000,
              message: toolResult.error.message || 'Tool execution failed'
            }
          });
        } else {
          sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: typeof toolResult.result === 'string' 
                    ? toolResult.result 
                    : JSON.stringify(toolResult.result, null, 2)
                }
              ]
            }
          });
        }
        break;
        
      case 'ping':
        sendResponse({
          jsonrpc: '2.0',
          id,
          result: { pong: true }
        });
        break;
        
      default:
        sendResponse({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        });
    }
  } catch (error) {
    log(`Error handling request: ${error.message}`);
    sendResponse({
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603,
        message: error.message
      }
    });
  }
}

// Process incoming data
rl.on('line', (line) => {
  buffer += line;
  
  // Try to parse complete JSON messages
  try {
    const request = JSON.parse(buffer);
    buffer = '';
    handleRequest(request);
  } catch (e) {
    // Not a complete JSON message yet, continue buffering
    if (buffer.length > 100000) {
      // Reset buffer if it gets too large
      log('Buffer overflow, resetting');
      buffer = '';
    }
  }
});

// Handle process termination
process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

// Error handling
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`);
  console.error(error);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection at: ${promise}, reason: ${reason}`);
});

// Start message
log('MCP Production Server started');
log('Waiting for requests from Claude Desktop...');