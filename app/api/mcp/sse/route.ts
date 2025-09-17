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
    
    // Extract tool and arguments from the MCP request format
    let forwardBody;
    if (body.method === 'tools/call' && body.params) {
      // MCP format: { method: 'tools/call', params: { tool, arguments } }
      forwardBody = {
        tool: body.params.tool,
        arguments: body.params.arguments || {}
      };
    } else if (body.tool && body.arguments) {
      // Direct format: { tool, arguments }
      forwardBody = body;
    } else {
      // Fallback: assume the entire body is the request
      forwardBody = body;
    }
    
    console.log('Forwarding to consolidated:', JSON.stringify(forwardBody, null, 2));
    
    // Forward to the consolidated endpoint
    const consolidatedUrl = new URL('/api/mcp/consolidated', req.url);
    const response = await fetch(consolidatedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(forwardBody)
    });
    
    const result = await response.json();
    
    // Track success metrics
    analytics.track({
      eventType: 'api_response',
      tool,
      operation,
      duration: Date.now() - startTime,
      error: response.status >= 400
    });
    
    // Add CORS headers for production
    return new Response(JSON.stringify(result), {
      status: response.status,
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
