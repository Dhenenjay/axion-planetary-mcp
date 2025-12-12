#!/usr/bin/env node

/**
 * MCP to SSE Bridge for Claude Desktop
 * This bridges Claude Desktop's MCP protocol to your Earth Engine SSE endpoint
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const fetch = require('node-fetch');

const SSE_ENDPOINT = 'http://localhost:3000/api/mcp/sse';

// Check if SSE endpoint is available
async function checkSSEEndpoint() {
  try {
    const response = await fetch(SSE_ENDPOINT, { method: 'GET' });
    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    console.error('SSE endpoint not available:', error.message);
    return false;
  }
}

// Call SSE endpoint
async function callSSE(tool, args) {
  try {
    const response = await fetch(SSE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool: tool,
        arguments: args
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SSE error (${response.status}): ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('SSE call error:', error);
    throw error;
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'earth-engine-sse',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools that map to SSE endpoints
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      // System tools
      {
        name: 'earth_engine_auth_check',
        description: 'Check Earth Engine authentication status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'earth_engine_health',
        description: 'Check Earth Engine system health',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      
      // Data tools
      {
        name: 'earth_engine_search',
        description: 'Search Google Earth Engine data catalog',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (e.g., "Sentinel-2", "NDVI", "Landsat")',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'earth_engine_get_geometry',
        description: 'Get geometry for a place name',
        inputSchema: {
          type: 'object',
          properties: {
            placeName: {
              type: 'string',
              description: 'Place name (e.g., "San Francisco", "Tokyo", "London")',
            },
          },
          required: ['placeName'],
        },
      },
      
      // Processing tools
      {
        name: 'earth_engine_calculate_index',
        description: 'Calculate vegetation indices (NDVI, EVI, NDWI, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            indexType: {
              type: 'string',
              enum: ['NDVI', 'EVI', 'NDWI', 'SAVI', 'MSAVI', 'NBR'],
              description: 'Type of index to calculate',
            },
            datasetId: {
              type: 'string',
              description: 'Dataset ID (e.g., "COPERNICUS/S2_SR_HARMONIZED")',
              default: 'COPERNICUS/S2_SR_HARMONIZED',
            },
            startDate: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              description: 'End date (YYYY-MM-DD)',
            },
            region: {
              type: 'string',
              description: 'Region name or coordinates',
            },
          },
          required: ['indexType', 'startDate', 'endDate', 'region'],
        },
      },
      {
        name: 'earth_engine_analyze',
        description: 'Perform statistical analysis on Earth Engine data',
        inputSchema: {
          type: 'object',
          properties: {
            analysisType: {
              type: 'string',
              enum: ['statistics', 'timeseries', 'histogram'],
              description: 'Type of analysis',
            },
            datasetId: {
              type: 'string',
              description: 'Dataset ID',
            },
            startDate: {
              type: 'string',
              description: 'Start date',
            },
            endDate: {
              type: 'string',
              description: 'End date',
            },
            region: {
              type: 'string',
              description: 'Region for analysis',
            },
            bands: {
              type: 'array',
              items: { type: 'string' },
              description: 'Bands to analyze',
            },
          },
          required: ['analysisType', 'datasetId', 'region'],
        },
      },
      
      // Export tools
      {
        name: 'earth_engine_visualize',
        description: 'Generate visualization/thumbnail of Earth Engine data',
        inputSchema: {
          type: 'object',
          properties: {
            datasetId: {
              type: 'string',
              description: 'Dataset ID',
            },
            startDate: {
              type: 'string',
              description: 'Start date',
            },
            endDate: {
              type: 'string',
              description: 'End date',
            },
            region: {
              type: 'string',
              description: 'Region to visualize',
            },
            bands: {
              type: 'array',
              items: { type: 'string' },
              description: 'Bands for visualization (e.g., ["B4", "B3", "B2"] for RGB)',
              default: ['B4', 'B3', 'B2'],
            },
            min: {
              type: 'number',
              description: 'Minimum value for visualization',
              default: 0,
            },
            max: {
              type: 'number',
              description: 'Maximum value for visualization',
              default: 3000,
            },
            dimensions: {
              type: 'number',
              description: 'Image dimensions in pixels',
              default: 512,
            },
          },
          required: ['datasetId', 'region'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Map MCP tool calls to SSE endpoint calls
    let sseResult;
    
    switch (name) {
      case 'earth_engine_auth_check':
        sseResult = await callSSE('earth_engine_system', { operation: 'auth' });
        break;
        
      case 'earth_engine_health':
        sseResult = await callSSE('earth_engine_system', { operation: 'health' });
        break;
        
      case 'earth_engine_search':
        sseResult = await callSSE('earth_engine_data', {
          operation: 'search',
          query: args.query,
          limit: args.limit || 10
        });
        break;
        
      case 'earth_engine_get_geometry':
        sseResult = await callSSE('earth_engine_data', {
          operation: 'geometry',
          placeName: args.placeName
        });
        break;
        
      case 'earth_engine_calculate_index':
        sseResult = await callSSE('earth_engine_process', {
          operation: 'index',
          indexType: args.indexType,
          datasetId: args.datasetId || 'COPERNICUS/S2_SR_HARMONIZED',
          startDate: args.startDate,
          endDate: args.endDate,
          region: args.region
        });
        break;
        
      case 'earth_engine_analyze':
        sseResult = await callSSE('earth_engine_process', {
          operation: 'analyze',
          analysisType: args.analysisType,
          datasetId: args.datasetId,
          startDate: args.startDate,
          endDate: args.endDate,
          region: args.region,
          bands: args.bands
        });
        break;
        
      case 'earth_engine_visualize':
        sseResult = await callSSE('earth_engine_export', {
          operation: 'thumbnail',
          datasetId: args.datasetId,
          startDate: args.startDate,
          endDate: args.endDate,
          region: args.region,
          dimensions: args.dimensions || 512,
          visParams: {
            bands: args.bands || ['B4', 'B3', 'B2'],
            min: args.min || 0,
            max: args.max || 3000
          }
        });
        break;
        
      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }

    // Return the SSE result formatted for MCP
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(sseResult, null, 2),
        },
      ],
    };
    
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  console.log('Starting MCP-SSE Bridge...');
  
  // Check if SSE endpoint is available
  const sseAvailable = await checkSSEEndpoint();
  if (!sseAvailable) {
    console.error('ERROR: SSE endpoint not available at', SSE_ENDPOINT);
    console.log('Please ensure the Next.js server is running with: npm run dev');
    process.exit(1);
  }
  
  console.log('SSE endpoint available at', SSE_ENDPOINT);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log('MCP-SSE Bridge is running');
}

main().catch((error) => {
  console.error('Bridge error:', error);
  process.exit(1);
});
