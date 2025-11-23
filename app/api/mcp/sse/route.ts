import { NextRequest } from 'next/server';
import { withRateLimit } from '@/src/middleware/apply-rate-limit';
import { initEarthEngineWithSA } from '@/src/gee/client';

export const runtime = 'nodejs';

let eeInitialized = false;
async function ensureEEInitialized() {
  if (!eeInitialized) {
    await initEarthEngineWithSA();
    eeInitialized = true;
  }
}

async function handleRequest(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('SSE endpoint received:', JSON.stringify(body, null, 2));
    
    const consolidatedUrl = new URL('/api/mcp/consolidated', req.url);
    const response = await fetch(consolidatedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

export async function POST(req: NextRequest) {
  return withRateLimit(req, handleRequest);
}

export async function GET(_req: NextRequest) {
  return Response.json({ status: 'ok', message: 'Earth Engine SSE endpoint' });
}
