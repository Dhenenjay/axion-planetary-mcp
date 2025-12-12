#!/usr/bin/env node

/**
 * MCP STDIO Server for Earth Engine
 * This wraps the HTTP SSE server for Claude Desktop compatibility
 */

const { spawn } = require('child_process');
const readline = require('readline');
const http = require('http');

// Simple STDIO to SSE bridge
async function startBridge() {
  console.error('[MCP] Starting Earth Engine MCP STDIO bridge...');
  
  // Check if local server is running
  const checkServer = () => {
    return new Promise((resolve) => {
      http.get('http://localhost:3000/api/health', (res) => {
        resolve(res.statusCode === 200);
      }).on('error', () => {
        resolve(false);
      });
    });
  };

  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.error('[MCP] Local server not running. Starting server...');
    // Start the dev server
    const server = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      detached: true,
      stdio: 'ignore',
      shell: true
    });
    server.unref();
    
    // Wait for server to start
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 1000));
      if (await checkServer()) {
        console.error('[MCP] Server started successfully');
        break;
      }
      attempts++;
    }
  } else {
    console.error('[MCP] Server already running');
  }

  // Now use the SSE adapter
  const adapter = spawn('npx', [
    '-y',
    '@modelcontextprotocol/server-sse', 
    'http://localhost:3000/api/mcp/sse'
  ], {
    stdio: 'inherit',
    shell: true
  });

  adapter.on('error', (err) => {
    console.error('[MCP] Adapter error:', err);
    process.exit(1);
  });

  adapter.on('exit', (code) => {
    console.error('[MCP] Adapter exited with code:', code);
    process.exit(code || 0);
  });
}

startBridge().catch(err => {
  console.error('[MCP] Bridge error:', err);
  process.exit(1);
});
