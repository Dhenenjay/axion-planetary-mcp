#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs');
const path = require('path');

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
    
    // Polyfill for Earth Engine in Node.js
    global.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
    if (typeof global.document === 'undefined') {
      global.document = {
        createElement: () => ({ 
          setAttribute: () => {},
          getElementsByTagName: () => [],
          parentNode: { insertBefore: () => {} }
        }),
        getElementsByTagName: () => [{ appendChild: () => {} }],
        head: { appendChild: () => {} },
        documentElement: {}
      };
    }
    if (typeof global.window === 'undefined') {
      global.window = {
        location: { href: '', protocol: 'https:' },
        document: global.document
      };
    }
    
    // Add fetch polyfill
    if (!global.fetch) {
      const nodeFetch = require('node-fetch');
      global.fetch = nodeFetch.default || nodeFetch;
      global.Headers = nodeFetch.Headers;
      global.Request = nodeFetch.Request;
      global.Response = nodeFetch.Response;
    }
    
    // Initialize Earth Engine
    const ee = require('@google/earthengine');
    const { GoogleAuth } = require('google-auth-library');
    
    console.error('[Earth Engine MCP] Initializing Earth Engine with service account...');
    
    const keyJson = JSON.parse(Buffer.from(process.env.GEE_SA_KEY_JSON || '', 'base64').toString('utf8'));
    const auth = new GoogleAuth({
      credentials: keyJson,
      scopes: ['https://www.googleapis.com/auth/earthengine']
    });
    
    const client = await auth.getClient();
    ee.data.setAuthToken('', 'Bearer', (await client.getAccessToken()).token, 3600);
    await new Promise((resolve, reject) => {
      ee.initialize(null, null, () => resolve(), (err) => reject(err));
    });
    
    console.error('[Earth Engine MCP] Earth Engine initialized successfully');
    
    // Load tools
    const { list, get } = require('./src/mcp/registry.js');
    require('./src/mcp/tools/index.js');
    
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
