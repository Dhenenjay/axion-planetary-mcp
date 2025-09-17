/**
 * MCP SSE Endpoint
 * Handles MCP bridge requests from hosted clients
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { setupAllTools } from '../../../src/mcp/tools/index';
import { setupModels } from '../../../src/models';
import ee from '@google/earthengine';
import { authenticateEarthEngine } from '../../../src/auth/ee-auth';

// Analytics tracking
const analytics = {
  requests: 0,
  tools: {} as Record<string, number>,
  errors: 0,
  startTime: Date.now()
};

// Initialize Earth Engine once
let eeInitialized = false;

async function initializeEarthEngine() {
  if (eeInitialized) return;
  
  try {
    console.log('[SSE API] Initializing Earth Engine...');
    await authenticateEarthEngine();
    eeInitialized = true;
    console.log('[SSE API] Earth Engine initialized successfully');
  } catch (error) {
    console.error('[SSE API] Failed to initialize Earth Engine:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET request returns analytics
  if (req.method === 'GET') {
    const uptime = Date.now() - analytics.startTime;
    res.status(200).json({
      status: 'operational',
      analytics: {
        ...analytics,
        uptime: Math.floor(uptime / 1000) + ' seconds',
        eeInitialized
      }
    });
    return;
  }

  // POST request handles MCP tool calls
  if (req.method === 'POST') {
    try {
      // Initialize EE if needed
      if (!eeInitialized) {
        await initializeEarthEngine();
      }

      analytics.requests++;

      const { method, params } = req.body;

      if (method === 'tools/call') {
        const { tool, arguments: args } = params;
        
        // Track tool usage
        analytics.tools[tool] = (analytics.tools[tool] || 0) + 1;

        console.log(`[SSE API] Executing tool: ${tool}`);
        
        try {
          // Import and execute the appropriate tool
          const tools = await import('../../../src/mcp/tools/consolidated');
          
          // Map tool names to their handlers
          const toolMap: Record<string, Function> = {
            earth_engine_data: tools.handleDataTool,
            earth_engine_process: tools.handleProcessTool,
            earth_engine_export: tools.handleExportTool,
            earth_engine_system: tools.handleSystemTool,
            earth_engine_map: tools.handleMapTool,
            // Models
            wildfire_risk_assessment: tools.handleWildfireRiskModel,
            flood_risk_assessment: tools.handleFloodRiskModel,
            agricultural_monitoring: tools.handleAgriculturalModel,
            deforestation_detection: tools.handleDeforestationModel,
            water_quality_analysis: tools.handleWaterQualityModel
          };

          const handler = toolMap[tool];
          if (!handler) {
            throw new Error(`Unknown tool: ${tool}`);
          }

          const result = await handler(args);
          
          // Return the result directly (MCP bridge expects this format)
          res.status(200).json(result);
        } catch (error: any) {
          console.error(`[SSE API] Tool execution error:`, error);
          analytics.errors++;
          
          res.status(500).json({
            success: false,
            error: error.message || 'Tool execution failed'
          });
        }
      } else {
        res.status(400).json({
          success: false,
          error: `Unsupported method: ${method}`
        });
      }
    } catch (error: any) {
      console.error('[SSE API] Request error:', error);
      analytics.errors++;
      
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  } else {
    res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }
}