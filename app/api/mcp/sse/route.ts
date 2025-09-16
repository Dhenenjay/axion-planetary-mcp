import { NextRequest } from 'next/server';
import { initEarthEngineWithSA } from '@/src/gee/client';

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
  try {
    const body = await req.json();
    console.log('SSE endpoint received:', JSON.stringify(body, null, 2));
    
    // Simply forward to the consolidated endpoint
    const consolidatedUrl = new URL('/api/mcp/consolidated', req.url);
    const response = await fetch(consolidatedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    const result = await response.json();
    return Response.json(result, { status: response.status });
  } catch (error: any) {
    console.error('SSE endpoint error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

export async function GET(_req: NextRequest) {
  return Response.json({ status: 'ok', message: 'Earth Engine SSE endpoint' });
}
