import { NextRequest, NextResponse } from 'next/server';
import { initEarthEngineWithSA } from '@/src/gee/client';
import { list, get } from '@/src/mcp/registry';

// Import all tools to register them
import '@/src/mcp/tools';

let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await initEarthEngineWithSA();
    initialized = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureInitialized();
    
    const body = await request.json();
    const { method, params } = body;
    
    if (method === 'tools/list') {
      // Get the actual tool objects, not just names and descriptions
      const toolsList = list();
      const fullTools = toolsList.map(t => {
        const tool = get(t.name);
        return {
          name: t.name,
          description: t.description,
          inputSchema: tool?.input || {}
        };
      });
      return NextResponse.json({
        tools: fullTools
      });
    }
    
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      const tool = get(name);
      
      if (!tool) {
        return NextResponse.json({
          error: { message: `Tool ${name} not found` }
        }, { status: 404 });
      }
      
      try {
        const result = await tool.handler(args);
        return NextResponse.json({ result });
      } catch (error) {
        return NextResponse.json({
          error: { 
            message: error instanceof Error ? error.message : String(error) 
          }
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({
      error: { message: `Unknown method: ${method}` }
    }, { status: 400 });
    
  } catch (error) {
    return NextResponse.json({
      error: { 
        message: error instanceof Error ? error.message : 'Internal server error' 
      }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // List available tools for GET request
  await ensureInitialized();
  const tools = list();
  return NextResponse.json({
    message: 'Earth Engine MCP Server with Shapefile Support',
    totalTools: tools.length,
    tools: tools.map(t => ({ name: t.name, description: t.description }))
  });
}
