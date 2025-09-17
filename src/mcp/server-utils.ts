/**
 * Server utilities for API routes
 * Provides helper functions for calling MCP tools from Next.js API routes
 */

import { get } from './registry';
import { initEarthEngineWithSA } from '../gee/client';

// Import all consolidated tools to register them
import './tools/consolidated/earth_engine_data';
import './tools/consolidated/earth_engine_process';
import './tools/consolidated/earth_engine_export';
import './tools/consolidated/earth_engine_system';
import './tools/consolidated/earth_engine_map';
import './tools/consolidated/crop_classification';

let initialized = false;

/**
 * Initialize Earth Engine if not already initialized
 */
async function ensureInitialized() {
  if (!initialized) {
    await initEarthEngineWithSA();
    initialized = true;
    console.log('[Server Utils] Earth Engine initialized');
  }
}

/**
 * Call a tool by name with the given arguments
 */
export async function callTool(name: string, args: any) {
  // Ensure Earth Engine is initialized
  await ensureInitialized();
  
  const tool = get(name);
  if (!tool) {
    throw new Error(`Tool ${name} not found`);
  }
  
  return await tool.handler(args);
}

/**
 * Get list of all available tools
 */
export async function listTools() {
  await ensureInitialized();
  const { list } = await import('./registry');
  return list();
}

export default { callTool, listTools };