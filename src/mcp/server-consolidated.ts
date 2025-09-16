/**
 * CONSOLIDATED MCP SERVER - CRITICAL FOR STABILITY
 * Only registers 4 super tools to prevent MCP client crashes
 * Reduces from 30 tools to 4 tools (87% reduction)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { list, get } from './registry';
import { initEarthEngineWithSA } from '../gee/client';

// Import the consolidated super tools
import './tools/consolidated/earth_engine_data';
import './tools/consolidated/earth_engine_process';
import './tools/consolidated/earth_engine_export';
import './tools/consolidated/earth_engine_system';
import './tools/consolidated/earth_engine_map';
import './tools/consolidated/crop_classification';

/**
 * Build and configure the consolidated MCP server
 */
export async function buildConsolidatedServer() {
  console.error('[MCP] Initializing CONSOLIDATED server with 4 super tools...');
  
  // Initialize Earth Engine
  await initEarthEngineWithSA();
  console.error('[MCP] Earth Engine initialized successfully');
  
  // Create server instance
  const server = new Server(
    {
      name: 'earth-engine-mcp-consolidated',
      version: '2.0.0', // Major version bump for consolidated tools
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  
  // Register tools handler
  server.setRequestHandler({ method: 'tools/list' } as any, async () => {
    const toolList = list();
    console.error(`[MCP] Serving ${toolList.length} consolidated tools`);
    
    // Log tool names for verification
    toolList.forEach(tool => {
      console.error(`[MCP] - ${tool.name}: ${tool.description.substring(0, 50)}...`);
    });
    
    return { tools: toolList };
  });
  
  // Register tool call handler
  server.setRequestHandler({ method: 'tools/call' } as any, async (request: any) => {
    const { name, arguments: args } = request.params;
    console.error(`[MCP] Tool called: ${name}`);
    
    try {
      const tool = get(name);
      const result = await tool.handler(args || {});
      console.error(`[MCP] Tool ${name} completed successfully`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error(`[MCP] Tool ${name} failed:`, error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message || 'Unknown error',
              tool: name,
              stack: error.stack
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });
  
  console.error('[MCP] Consolidated server configured successfully');
  console.error('[MCP] ✅ Reduced from 30 tools to 6 super tools');
  console.error('[MCP] ✅ This should prevent MCP client crashes');
  
  return server;
}

/**
 * Main entry point for standalone execution
 */
async function main() {
  try {
    console.error('[MCP] Starting Earth Engine MCP Consolidated Server...');
    console.error('[MCP] Version: 2.0.0 (Consolidated)');
    console.error('[MCP] Tools: 6 super tools (data, process, export, system, map, crop_classification)');
    
    const server = await buildConsolidatedServer();
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    console.error('[MCP] Server connected via STDIO transport');
    console.error('[MCP] Ready to receive requests from MCP clients');
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.error('[MCP] Shutting down server...');
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('[MCP] Failed to start server:', error);
    process.exit(1);
  }
}

// Export main for external use
export { main };

// Helper function for external use
export async function callTool(name: string, args: any) {
  // Ensure Earth Engine is initialized
  await initEarthEngineWithSA();
  
  const tool = get(name);
  return await tool.handler(args);
}
