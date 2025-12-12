#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.local');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
    console.error('[Earth Engine MCP] Environment loaded from .env.local');
  }
}

async function main() {
  try {
    // Load environment
    loadEnvFile();
    
    // Dynamic import for ES modules
    const { initEarthEngineWithSA } = await import('./src/gee/client.js');
    const { list, get } = await import('./src/mcp/registry.js');
    
    // Initialize Earth Engine
    console.error('[Earth Engine MCP] Initializing Earth Engine...');
    await initEarthEngineWithSA();
    
    // Import all tools to register them
    await import('./src/mcp/tools/index.js');
    
    // Get all registered tools
    const tools = list();
    console.error(`[Earth Engine MCP] Loaded ${tools.length} tools`);
    
    // List shapefile tools
    const shapefileTools = tools.filter(t => 
      t.name.includes('shapefile') || 
      t.name.includes('boundary') ||
      t.name === 'convert_place_to_shapefile_geometry'
    );
    
    if (shapefileTools.length > 0) {
      console.error('[Earth Engine MCP] Shapefile tools available:');
      shapefileTools.forEach(t => {
        console.error(`  ✅ ${t.name}`);
      });
    }
    
    // Create MCP server
    const server = new Server(
      {
        name: 'earth-engine-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    // Register tools/list handler
    server.setRequestHandler('tools/list', async () => {
      return {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.input || {},
        })),
      };
    });
    
    // Register tools/call handler
    server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      const tool = get(name);
      
      if (!tool) {
        console.error(`[Earth Engine MCP] Tool not found: ${name}`);
        throw new Error(`Tool not found: ${name}`);
      }
      
      console.error(`[Earth Engine MCP] Calling tool: ${name}`);
      
      try {
        const result = await tool.handler(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        console.error(`[Earth Engine MCP] Tool error: ${error.message}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: error.message }),
            },
          ],
          isError: true,
        };
      }
    });
    
    // Create stdio transport
    const transport = new StdioServerTransport();
    
    // Connect the server
    await server.connect(transport);
    
    console.error('====================================================');
    console.error('🌍 Earth Engine MCP Server Ready!');
    console.error('====================================================');
    console.error(`📦 Total tools: ${tools.length}`);
    console.error(`🗺️ Shapefile tools: ${shapefileTools.length}`);
    console.error('✅ Server connected via stdio transport');
    console.error('====================================================');
    
  } catch (error) {
    console.error('[Earth Engine MCP] Failed to start:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('[Earth Engine MCP] Fatal error:', error);
  console.error(error.stack); 
  process.exit(1);
});
