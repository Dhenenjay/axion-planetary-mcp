#!/usr/bin/env node
/**
 * SSE Bridge - Connects Claude Desktop (stdio) to an SSE MCP server
 * Usage: node sse-bridge.mjs <sse-url> [api-key]
 * 
 * This allows Claude Desktop to connect to remote SSE MCP servers
 * that are hosted on Render, Railway, or anywhere else.
 */

import http from 'http';
import https from 'https';

const SSE_URL = process.env.SSE_URL || process.argv[2] || 'http://localhost:3000/sse';
const API_KEY = process.env.API_KEY || process.argv[3] || '';

let sessionId = null;
let messagesEndpoint = null;

// Parse URL
const url = new URL(SSE_URL);
const isHttps = url.protocol === 'https:';
const httpModule = isHttps ? https : http;

// Connect to SSE endpoint
function connectSSE() {
  const headers = {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
  };
  
  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  }

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method: 'GET',
    headers,
  };

  const req = httpModule.request(options, (res) => {
    if (res.statusCode === 401) {
      console.error('[Bridge] Unauthorized - check API key');
      process.exit(1);
    }
    
    if (res.statusCode !== 200) {
      console.error(`[Bridge] SSE connection failed: ${res.statusCode}`);
      process.exit(1);
    }

    console.error(`[Bridge] Connected to SSE server`);

    let buffer = '';
    
    res.on('data', (chunk) => {
      buffer += chunk.toString();
      
      // Process complete SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('event:')) {
          const eventType = line.slice(6).trim();
          if (eventType === 'endpoint') {
            // Next data line will have the endpoint URL
          }
        } else if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          
          // Check if this is the endpoint event
          if (data.startsWith('/messages?sessionId=')) {
            messagesEndpoint = data;
            sessionId = new URL(data, SSE_URL).searchParams.get('sessionId');
            console.error(`[Bridge] Session ID: ${sessionId}`);
          } else if (data) {
            // This is a JSON-RPC message from server
            try {
              JSON.parse(data); // Validate JSON
              process.stdout.write(data + '\n');
            } catch (e) {
              // Not JSON, ignore
            }
          }
        }
      }
    });

    res.on('end', () => {
      console.error('[Bridge] SSE connection closed');
      process.exit(0);
    });

    res.on('error', (err) => {
      console.error(`[Bridge] SSE error: ${err.message}`);
      process.exit(1);
    });
  });

  req.on('error', (err) => {
    console.error(`[Bridge] Connection error: ${err.message}`);
    process.exit(1);
  });

  req.end();
}

// Send message to SSE server via POST
function sendMessage(message) {
  if (!sessionId) {
    console.error('[Bridge] No session ID yet, queuing message...');
    setTimeout(() => sendMessage(message), 100);
    return;
  }

  const postData = JSON.stringify(message);
  const postUrl = new URL(messagesEndpoint, SSE_URL);
  
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  };
  
  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  }

  const options = {
    hostname: postUrl.hostname,
    port: postUrl.port || (isHttps ? 443 : 80),
    path: postUrl.pathname + postUrl.search,
    method: 'POST',
    headers,
  };

  const req = httpModule.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      if (res.statusCode !== 200 && res.statusCode !== 202) {
        console.error(`[Bridge] POST error ${res.statusCode}: ${body}`);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[Bridge] POST error: ${err.message}`);
  });

  req.write(postData);
  req.end();
}

// Read stdin for messages from Claude Desktop
let stdinBuffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  stdinBuffer += chunk;
  
  // Process complete lines
  const lines = stdinBuffer.split('\n');
  stdinBuffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        sendMessage(message);
      } catch (e) {
        console.error(`[Bridge] Invalid JSON from stdin: ${e.message}`);
      }
    }
  }
});

process.stdin.on('end', () => {
  console.error('[Bridge] stdin closed');
  process.exit(0);
});

// Start connection
console.error(`[Bridge] Connecting to ${SSE_URL}...`);
connectSSE();
