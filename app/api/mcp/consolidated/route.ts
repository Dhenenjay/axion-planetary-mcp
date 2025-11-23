import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/src/middleware/apply-rate-limit';
import { callTool } from '@/src/mcp/server-consolidated';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handleRequest(request: NextRequest) {
  try {
    const { tool, arguments: args } = await request.json();
    
    console.log('[Consolidated] Tool called:', tool);
    console.log('[Consolidated] Arguments:', JSON.stringify(args, null, 2));
    
    const coreTools = [
      'earth_engine_data',
      'earth_engine_process', 
      'earth_engine_export',
      'earth_engine_system',
      'earth_engine_map',
      'crop_classification',
      'duckdb_query',
      'terratorch_inference'
    ];
    
    const modelTools = [
      'wildfire_risk_assessment',
      'flood_risk_assessment',
      'agricultural_monitoring',
      'deforestation_detection',
      'water_quality_monitoring'
    ];
    
    if (coreTools.includes(tool)) {
      const result = await callTool(tool, args);
      return NextResponse.json(result);
    }
    
    if (modelTools.includes(tool)) {
      const models = await import('@/src/models/geospatial-models.js');
      const modelMap: any = {
        'wildfire_risk_assessment': models.wildfireRiskAssessment,
        'flood_risk_assessment': models.floodRiskAssessment,
        'agricultural_monitoring': models.agriculturalMonitoring,
        'deforestation_detection': models.deforestationDetection,
        'water_quality_monitoring': models.waterQualityMonitoring
      };
      
      const result = await modelMap[tool](args);
      return NextResponse.json(result);
    }
    
    return NextResponse.json({
      error: { message: `Invalid tool: ${tool}` }
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('[Consolidated] Error:', error);
    return NextResponse.json({
      error: { message: error.message || 'Internal server error' }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, handleRequest);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
