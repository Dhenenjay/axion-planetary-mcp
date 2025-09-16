#!/usr/bin/env node
/**
 * Entry point for the consolidated MCP server
 * This file properly handles ESM imports and provides stdio transport
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildConsolidatedServer } from './server-consolidated.ts';

async function main() {
  try {
    process.stderr.write('[MCP] Starting Earth Engine MCP Consolidated Server...\n');
    process.stderr.write('[MCP] Version: 2.0.0 (Consolidated)\n');
    process.stderr.write('[MCP] Tools: 6 super tools (data, process, export, system, map, crop_classification)\n');
    
    const server = await buildConsolidatedServer();
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    process.stderr.write('[MCP] Server connected via STDIO transport\n');
    process.stderr.write('[MCP] Ready to receive requests from MCP clients\n');
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      process.stderr.write('[MCP] Shutting down server...\n');
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    process.stderr.write(`[MCP] Failed to start server: ${error}\n`);
    if (error.stack) {
      process.stderr.write(`${error.stack}\n`);
    }
    process.exit(1);
  }
}

// Run immediately
main().catch((error) => {
  process.stderr.write(`[MCP] Fatal error: ${error}\n`);
  if (error.stack) {
    process.stderr.write(`${error.stack}\n`);
  }
  process.exit(1);
});