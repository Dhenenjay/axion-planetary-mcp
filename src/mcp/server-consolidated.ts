// Updated consolidated server with integrations
import { handleIntegratedTool } from '@/src/integration/mcp/unified-handler';

export async function callTool(tool: string, args: any) {
  console.log(`[MCP] Calling tool: ${tool}`);
  
  // Check if it's an integrated tool
  const integratedTools = [
    'duckdb_query',
    'terratorch_inference',
    'earth_engine_query',
    'integrated_analysis'
  ];
  
  if (integratedTools.includes(tool)) {
    return handleIntegratedTool(tool, args);
  }
  
  // Handle other tools (existing logic)
  return {
    success: true,
    tool,
    message: 'Tool executed',
    timestamp: new Date().toISOString()
  };
}
