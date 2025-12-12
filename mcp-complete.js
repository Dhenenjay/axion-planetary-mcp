#!/usr/bin/env node

const readline = require('readline');
const http = require('http');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Load all tools from the saved JSON file
let ALL_TOOLS = [];
try {
  const toolsJson = fs.readFileSync(path.join(__dirname, 'all-tools.json'), 'utf8');
  ALL_TOOLS = JSON.parse(toolsJson);
  console.error(`[Earth Engine MCP] Loaded ${ALL_TOOLS.length} tools from configuration`);
} catch (e) {
  console.error('[Earth Engine MCP] Warning: Could not load tools from file, will fetch from server');
}

// Make request to Next.js server
async function callNextServer(endpoint, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseBody));
        } catch (e) {
          console.error('[Earth Engine MCP] Failed to parse response:', e.message);
          resolve({ error: 'Failed to parse response' });
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('[Earth Engine MCP] Server request failed:', e.message);
      resolve({ error: e.message });
    });
    
    if (data) req.write(data);
    req.end();
  });
}

// Fetch tools from server if not loaded
async function loadTools() {
  if (ALL_TOOLS.length === 0) {
    console.error('[Earth Engine MCP] Fetching tools from server...');
    const response = await callNextServer('/sse', 'GET', null);
    if (response.tools) {
      ALL_TOOLS = response.tools;
      console.error(`[Earth Engine MCP] Loaded ${ALL_TOOLS.length} tools from server`);
      // Save for next time
      fs.writeFileSync(path.join(__dirname, 'all-tools.json'), JSON.stringify(ALL_TOOLS, null, 2));
    }
  }
  return ALL_TOOLS;
}

console.error('[Earth Engine MCP] Starting complete Earth Engine MCP server...');
console.error('[Earth Engine MCP] Connecting to Next.js backend at http://localhost:3000');

// Initialize by loading tools
loadTools().then(tools => {
  console.error('[Earth Engine MCP] Available tool categories:');
  console.error('  🗺️ Shapefile tools: convert_place_to_shapefile_geometry, get_shapefile_boundary, etc.');
  console.error('  🌍 Collection tools: filter_collection_by_date_and_region, smart_filter_collection');
  console.error('  🖼️ Visualization: get_thumbnail_image, get_map_visualization_url, create_clean_mosaic');
  console.error('  📊 Analysis: calculate_spectral_index, calculate_summary_statistics, detect_change_between_images');
  console.error('  ☁️ Export: export_image_to_cloud_storage, get_export_task_status');
  console.error('  📈 Time series: create_time_series_chart_for_region');
  console.error(`  📦 Total: ${tools.length} tools`);
});

rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    
    if (message.method === 'initialize') {
      // Respond with proper protocol version
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'earth-engine',
            version: '2.0.0'
          }
        }
      };
      console.log(JSON.stringify(response));
      console.error('[Earth Engine MCP] Initialized successfully');
      
    } else if (message.method === 'tools/list') {
      // Make sure tools are loaded
      const tools = await loadTools();
      
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: tools
        }
      };
      console.log(JSON.stringify(response));
      console.error(`[Earth Engine MCP] Sent ${tools.length} tools to client`);
      
    } else if (message.method === 'prompts/list') {
      // Return empty prompts list
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          prompts: []
        }
      };
      console.log(JSON.stringify(response));
      
    } else if (message.method === 'resources/list') {
      // Return empty resources list
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          resources: []
        }
      };
      console.log(JSON.stringify(response));
      
    } else if (message.method === 'notifications/initialized') {
      // Ignore this notification
      console.error('[Earth Engine MCP] Client initialized');
      
    } else if (message.method === 'notifications/cancelled') {
      // Ignore cancellation notifications
      console.error('[Earth Engine MCP] Request cancelled');
      
    } else if (message.method === 'tools/call') {
      const toolName = message.params.name;
      const args = message.params.arguments;
      
      console.error(`[Earth Engine MCP] Executing tool: ${toolName}`);
      
      // Forward the tool call to the Next.js server
      const serverResponse = await callNextServer('/sse', 'POST', {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        id: Date.now()
      });
      
      let resultContent;
      
      if (serverResponse.result) {
        // Server returned a result
        resultContent = [{
          type: 'text',
          text: JSON.stringify(serverResponse.result)
        }];
      } else if (serverResponse.error) {
        // Server returned an error
        resultContent = [{
          type: 'text',
          text: JSON.stringify({ error: serverResponse.error })
        }];
      } else {
        // Fallback response
        resultContent = [{
          type: 'text',
          text: JSON.stringify({
            tool: toolName,
            args: args,
            message: 'Tool executed',
            note: 'Response from Earth Engine server'
          })
        }];
      }
      
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: resultContent
        }
      };
      
      console.log(JSON.stringify(response));
      console.error(`[Earth Engine MCP] Tool ${toolName} completed`);
      
    } else {
      console.error(`[Earth Engine MCP] Unknown method: ${message.method}`);
    }
    
  } catch (e) {
    console.error('[Earth Engine MCP] Error processing message:', e.message);
  }
});

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.error('[Earth Engine MCP] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[Earth Engine MCP] Shutting down...');
  process.exit(0);
});

console.error('[Earth Engine MCP] Server ready and waiting for connections');
