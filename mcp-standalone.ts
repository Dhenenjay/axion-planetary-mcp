#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
  }
}

async function main() {
  try {
    // Load environment
    loadEnvFile();
    
    // Set up path resolution for TypeScript aliases
    process.env.TS_NODE_PROJECT = path.join(__dirname, 'tsconfig.json');
    
    // Initialize Earth Engine and load tools using relative paths
    // First, we need to handle the env loading directly since tsx doesn't resolve aliases
    await import('./src/gee/client.js').then(async (module) => {
      await module.initEarthEngineWithSA();
    }).catch(async () => {
      // Fallback: initialize Earth Engine directly
      const ee = await import('@google/earthengine');
      const { GoogleAuth } = await import('google-auth-library');
      
      console.error('[Earth Engine MCP] Initializing Earth Engine with service account...');
      
      const keyJson = JSON.parse(Buffer.from(process.env.GEE_SA_KEY_JSON || '', 'base64').toString('utf8'));
      const auth = new GoogleAuth({
        credentials: keyJson,
        scopes: ['https://www.googleapis.com/auth/earthengine']
      });
      
      const client = await auth.getClient();
      (ee as any).data.setAuthToken('', 'Bearer', (await client.getAccessToken()).token, 3600);
      await new Promise<void>((resolve, reject) => {
        ee.initialize(null, null, () => resolve(), (err: any) => reject(err));
      });
      
      console.error('[Earth Engine MCP] Earth Engine initialized successfully');
    });
    
    const { list, get } = await import('./src/mcp/registry.js');
    await import('./src/mcp/tools/index.js');
    
    const tools = list();
    console.error(`[Earth Engine MCP] Loaded ${tools.length} tools`);
    
    // List shapefile tools
    const shapefileTools = tools.filter(t => 
      t.name.includes('shapefile') || 
      t.name.includes('boundary')
    );
    console.error(`[Earth Engine MCP] Shapefile tools: ${shapefileTools.map(t => t.name).join(', ')}`);
    
    // Create server
    const server = new Server(
      {
        name: 'earth-engine-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    // Handle tool listing
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: tools.map(tool => {
        const fullTool = get(tool.name);
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: fullTool?.input?._def || {},
        };
      }),
    }));
    
    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = get(name);
      
      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }
      
      console.error(`[Earth Engine MCP] Executing: ${name}`);
      const result = await tool.handler(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result),
        }],
      };
    });
    
    // Connect stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('====================================');
    console.error('🌍 Earth Engine MCP Server Ready');
    console.error('====================================');
    console.error('✅ All shapefile tools loaded');
    console.error('====================================');
    
  } catch (error) {
    console.error('[Earth Engine MCP] Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
