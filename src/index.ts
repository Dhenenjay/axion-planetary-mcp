#!/usr/bin/env node
/**
 * Main entry point for Axion AWS MCP Server (AWS-native)
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildAwsServer } from './mcp/server-aws';
import { list } from './mcp/registry';

async function main() {
  console.error('[MCP] Starting Axion AWS MCP Server...');
  try {
    const server = await buildAwsServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[MCP] ✅ Connected via STDIO');
    console.error(`[MCP] 📦 ${list().length} AWS tools available`);

    process.on('SIGINT', async () => {
      console.error('[MCP] Shutting down...');
      await server.close();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      console.error('[MCP] Shutting down...');
      await server.close();
      process.exit(0);
    });
  } catch (error: any) {
    console.error('[MCP] ❌ Failed to start:', error?.message || error);
    if (error?.stack) console.error(error.stack);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('[MCP] 💥 Fatal error:', error);
    process.exit(1);
  });
}
