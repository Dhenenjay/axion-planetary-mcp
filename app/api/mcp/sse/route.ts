import { NextRequest } from 'next/server';
import { initEarthEngineWithSA } from '@/src/gee/client';
import { analytics } from '@/src/analytics';

export const runtime = 'nodejs';

// Initialize Earth Engine once
let eeInitialized = false;
async function ensureEEInitialized() {
  if (!eeInitialized) {
    await initEarthEngineWithSA();
    eeInitialized = true;
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    console.log('SSE endpoint received:', JSON.stringify(body, null, 2));
    
    // Track analytics
    const tool = body.params?.tool || 'unknown';
    const operation = body.params?.arguments?.operation || body.method || 'unknown';
    const region = body.params?.arguments?.region || body.params?.arguments?.placeName;
    
    analytics.track({
      eventType: 'api_request',
      tool,
      operation,
      region,
      userAgent: req.headers.get('user-agent') || undefined
    });
    
    // Import handlers
    const { callTool } = await import('../../../../src/mcp/server-utils');
    
    // Extract tool and arguments from the MCP request format
    let toolName: string;
    let toolArgs: any;
    
    if (body.method === 'tools/call' && body.params) {
      // MCP format: { method: 'tools/call', params: { tool, arguments } }
      toolName = body.params.tool;
      toolArgs = body.params.arguments || {};
    } else if (body.tool) {
      // Direct format: { tool, arguments }
      toolName = body.tool;
      toolArgs = body.arguments || {};
    } else {
      throw new Error('Invalid request format');
    }
    
    console.log('Executing tool:', toolName);
    console.log('With arguments:', JSON.stringify(toolArgs, null, 2));
    
    // Model tools that need special handling
    const modelTools = [
      'wildfire_risk_assessment',
      'flood_risk_assessment',
      'flood_risk_analysis',
      'agricultural_monitoring',
      'agriculture_monitoring',
      'deforestation_detection',
      'deforestation_tracking',
      'water_quality_monitoring',
      'water_quality_assessment',
      'water_quality_analysis'
    ];
    
    let result;
    
    try {
      // Try calling as a registered tool first
      result = await callTool(toolName, toolArgs);
    } catch (toolError: any) {
      // If it's a model tool, handle it specially
      if (modelTools.includes(toolName)) {
        // Import as ES module
        const modelsModule = await import('../../../../src/models/geospatial-models.js');
        const models = modelsModule.default || modelsModule;
        
        console.log('Loaded models module:', Object.keys(models));
        
        const modelMap: any = {
          'wildfire_risk_assessment': models.wildfireRiskAssessment,
          'flood_risk_assessment': models.floodRiskAssessment,
          'flood_risk_analysis': models.floodRiskAssessment,
          'agricultural_monitoring': models.agriculturalMonitoring,
          'agriculture_monitoring': models.agriculturalMonitoring,
          'deforestation_detection': models.deforestationDetection,
          'deforestation_tracking': models.deforestationDetection,
          'water_quality_monitoring': models.waterQualityMonitoring,
          'water_quality_assessment': models.waterQualityMonitoring,
          'water_quality_analysis': models.waterQualityMonitoring
        };
        
        const modelFunc = modelMap[toolName];
        if (modelFunc && typeof modelFunc === 'function') {
          console.log(`Executing model function: ${toolName}`);
          result = await modelFunc(toolArgs);
        } else {
          console.error(`Available functions:`, Object.keys(models));
          console.error(`Requested function ${toolName} type:`, typeof modelFunc);
          throw new Error(`Model function not found for: ${toolName}`);
        }
      } else {
        // Not a model tool, re-throw the original error
        throw toolError;
      }
    }
    
    // Track success metrics
    analytics.track({
      eventType: 'api_response',
      tool: toolName,
      operation,
      duration: Date.now() - startTime,
      error: false
    });
    
    // Add CORS headers for production
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error: any) {
    console.error('SSE endpoint error:', error);
    
    // Track error
    analytics.track({
      eventType: 'api_error',
      tool: 'unknown',
      duration: Date.now() - startTime,
      error: true
    });
    
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function GET(_req: NextRequest) {
  // Get analytics stats for monitoring
  const stats = analytics.getStats();
  
  return new Response(JSON.stringify({
    status: 'ok',
    message: 'Earth Engine SSE endpoint',
    analytics: stats
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function OPTIONS(_req: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
