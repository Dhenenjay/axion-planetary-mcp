#!/usr/bin/env node
/**
 * Main entry point for Earth Engine MCP Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './mcp/server';
import { list, get } from './mcp/registry';
// Environment variables are loaded from system environment
// Set GOOGLE_APPLICATION_CREDENTIALS and other env vars before running

/**
 * Main function to start the MCP server
 */
async function main() {
  console.error('🌍 Starting Earth Engine MCP Server...');
  
  try {
    // Build the server with all tools registered
    const mcpServer = await buildServer();
    
    // Create MCP server instance
    const server = new Server(
      {
        name: 'earth-engine-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Set up tool listing
    server.setRequestHandler({ method: 'tools/list' } as any, async () => {
      const tools = list();
      return {
        tools: tools.map((tool) => {
          const fullTool = get(tool.name);
          return {
            name: tool.name,
            description: tool.description,
            inputSchema: {
              type: 'object',
              properties: fullTool?.input?._def?.shape || {},
              required: [],
            },
          };
        }),
      };
    });

    // Set up tool calling
    server.setRequestHandler({ method: 'tools/call' } as any, async (request: any) => {
      const { name, arguments: args } = request.params;
      
      try {
        const tool = get(name);
        if (!tool) {
          throw new Error(`Tool not found: ${name}`);
        }
        
        // Call the tool handler
        const result = await tool.handler(args || {});
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        console.error(`Error calling tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message || 'Unknown error',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
              }),
            },
          ],
          isError: true,
        };
      }
    });

    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('✅ Earth Engine MCP Server running on stdio');
    console.error(`📦 ${list().length} tools available`);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.error('\n👋 Shutting down Earth Engine MCP Server...');
      await server.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.error('\n👋 Shutting down Earth Engine MCP Server...');
      await server.close();
      process.exit(0);
    });
    
  } catch (error: any) {
    console.error('❌ Failed to start server:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export for testing
export { buildServer } from './mcp/server';
export { initEarthEngineWithSA } from './gee/client';

// Run the server only if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}
