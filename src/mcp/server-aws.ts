/**
 * AXION AWS MCP SERVER
 * AWS-native server using STAC, S3, DynamoDB instead of Google Earth Engine
 * Registers 7 super tools: axion_data, axion_system, axion_process, axion_export, axion_map, axion_classification, axion_sar2optical
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { list, get } from './registry';

// Import the AWS-native tools
import './tools-aws';

/**
 * Build and configure the AWS MCP server
 */
export async function buildAwsServer() {
  console.error('[MCP] Initializing AXION AWS server with 7 super tools...');
  
  // Create server instance
  const server = new Server(
    {
      name: 'axion-aws-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  
  // Register tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const toolList = list();
    console.error(`[MCP] Serving ${toolList.length} AWS-native tools`);
    
    // Log tool names for verification
    toolList.forEach(tool => {
      console.error(`[MCP] - ${tool.name}: ${tool.description.substring(0, 60)}...`);
    });
    
    return { tools: toolList };
  });
  
  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
  
  console.error('[MCP] AWS server configured successfully');
  console.error('[MCP] ✅ Tools: axion_data, axion_system, axion_process, axion_export, axion_map, axion_classification, axion_sar2optical');
  console.error('[MCP] ✅ Data source: Element84 Earth Search STAC + Microsoft Planetary Computer');
  console.error('[MCP] ✅ Storage: Amazon S3 + Google Cloud Storage');
  console.error('[MCP] ✅ AI: Vertex AI (SAR-to-Optical Diffusion Model)');
  console.error('[MCP] ✅ Database: Amazon DynamoDB');
  
  return server;
}

/**
 * Main entry point for standalone execution
 */
async function main() {
  try {
    console.error('[MCP] Starting Axion AWS MCP Server...');
    console.error('[MCP] Version: 1.0.0 (AWS-Native)');
    console.error('[MCP] Tools: 7 super tools (data, system, process, export, map, classification, sar2optical)');
    
    const server = await buildAwsServer();
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

// Run immediately - this is the entry point
main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});

// Helper function for external use
export async function callTool(name: string, args: any) {
  const tool = get(name);
  return await tool.handler(args);
}
