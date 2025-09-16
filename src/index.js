#!/usr/bin/env node
/**
 * Earth Engine MCP Server
 * Main entry point for Model Context Protocol integration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema
} from '@modelcontextprotocol/sdk/types.js';
import ee from '@google/earthengine';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our calibrated models
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import for CommonJS modules
let models;
try {
  const modelsPath = path.join(__dirname, 'models', 'calibrated-geospatial-models.cjs');
  models = await import(modelsPath);
} catch (error) {
  console.error('Failed to load models:', error);
  process.exit(1);
}

// Initialize Earth Engine
let eeInitialized = false;

async function initializeEarthEngine() {
  if (eeInitialized) return true;
  
  try {
    // Check for service account credentials
    const privateKey = process.env.EARTH_ENGINE_PRIVATE_KEY;
    const serviceAccount = process.env.EARTH_ENGINE_SERVICE_ACCOUNT;
    
    if (privateKey && serviceAccount) {
      const key = JSON.parse(fs.readFileSync(privateKey, 'utf8'));
      ee.data.authenticateViaPrivateKey(key, () => {
        ee.initialize(null, null, () => {
          console.log('Earth Engine initialized with service account');
          eeInitialized = true;
        }, (error) => {
          console.error('Failed to initialize Earth Engine:', error);
        });
      });
    } else {
      // Try default authentication
      ee.data.authenticateViaOauth(() => {
        ee.initialize(null, null, () => {
          console.log('Earth Engine initialized with OAuth');
          eeInitialized = true;
        }, (error) => {
          console.error('Failed to initialize Earth Engine:', error);
        });
      });
    }
    
    return eeInitialized;
  } catch (error) {
    console.error('Earth Engine initialization error:', error);
    return false;
  }
}

// Define available tools
const TOOLS = {
  earth_engine_init: {
    schema: {
      type: "function",
      function: {
        name: "earth_engine_init",
        description: "Initialize Earth Engine connection",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    handler: async () => {
      const success = await initializeEarthEngine();
      return { success, message: success ? 'Earth Engine initialized' : 'Failed to initialize' };
    }
  },
  
  wildfire_risk_assessment: {
    schema: {
      type: "function",
      function: {
        name: "wildfire_risk_assessment",
        description: "Assess wildfire risk for a specified region",
        parameters: {
          type: "object",
          properties: {
            region: {
              type: "string",
              description: "Region name or coordinates"
            },
            startDate: {
              type: "string",
              description: "Start date (YYYY-MM-DD)"
            },
            endDate: {
              type: "string",
              description: "End date (YYYY-MM-DD)"
            },
            indices: {
              type: "array",
              items: { type: "string" },
              description: "Vegetation indices to calculate"
            }
          },
          required: ["region"]
        }
      }
    },
    handler: async (params) => {
      try {
        const result = await models.wildfireRiskAssessment(params);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  
  flood_risk_assessment: {
    schema: {
      type: "function",
      function: {
        name: "flood_risk_assessment",
        description: "Assess flood risk for a specified region",
        parameters: {
          type: "object",
          properties: {
            region: {
              type: "string",
              description: "Region name or coordinates"
            },
            startDate: {
              type: "string",
              description: "Start date (YYYY-MM-DD)"
            },
            endDate: {
              type: "string",
              description: "End date (YYYY-MM-DD)"
            },
            floodType: {
              type: "string",
              enum: ["urban", "coastal", "riverine", "snowmelt"],
              description: "Type of flood to assess"
            }
          },
          required: ["region"]
        }
      }
    },
    handler: async (params) => {
      try {
        const result = await models.floodRiskAssessment(params);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  
  agricultural_monitoring: {
    schema: {
      type: "function",
      function: {
        name: "agricultural_monitoring",
        description: "Monitor agricultural conditions and crop health",
        parameters: {
          type: "object",
          properties: {
            region: {
              type: "string",
              description: "Region name or coordinates"
            },
            cropType: {
              type: "string",
              description: "Type of crop (corn, wheat, soybeans, etc.)"
            },
            startDate: {
              type: "string",
              description: "Start date (YYYY-MM-DD)"
            },
            endDate: {
              type: "string",
              description: "End date (YYYY-MM-DD)"
            }
          },
          required: ["region"]
        }
      }
    },
    handler: async (params) => {
      try {
        const result = await models.agriculturalMonitoring(params);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  
  deforestation_detection: {
    schema: {
      type: "function",
      function: {
        name: "deforestation_detection",
        description: "Detect deforestation and forest loss",
        parameters: {
          type: "object",
          properties: {
            region: {
              type: "string",
              description: "Region name or coordinates"
            },
            baselineStart: {
              type: "string",
              description: "Baseline period start date"
            },
            baselineEnd: {
              type: "string",
              description: "Baseline period end date"
            },
            currentStart: {
              type: "string",
              description: "Current period start date"
            },
            currentEnd: {
              type: "string",
              description: "Current period end date"
            }
          },
          required: ["region"]
        }
      }
    },
    handler: async (params) => {
      try {
        // Set default dates if not provided
        if (!params.baselineStart) params.baselineStart = '2023-01-01';
        if (!params.baselineEnd) params.baselineEnd = '2023-03-31';
        if (!params.currentStart) params.currentStart = '2023-10-01';
        if (!params.currentEnd) params.currentEnd = '2023-12-31';
        
        const result = await models.deforestationDetection(params);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  
  water_quality_monitoring: {
    schema: {
      type: "function",
      function: {
        name: "water_quality_monitoring",
        description: "Monitor water quality in lakes, rivers, and other water bodies",
        parameters: {
          type: "object",
          properties: {
            region: {
              type: "string",
              description: "Water body name or coordinates"
            },
            startDate: {
              type: "string",
              description: "Start date (YYYY-MM-DD)"
            },
            endDate: {
              type: "string",
              description: "End date (YYYY-MM-DD)"
            },
            waterBody: {
              type: "string",
              enum: ["lake", "river", "reservoir", "coastal"],
              description: "Type of water body"
            }
          },
          required: ["region"]
        }
      }
    },
    handler: async (params) => {
      try {
        const result = await models.waterQualityMonitoring(params);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
};

// Create MCP server
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
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.values(TOOLS).map(tool => tool.schema)
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const tool = TOOLS[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  
  try {
    const result = await tool.handler(args || {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: error.message }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  console.log('Starting Earth Engine MCP Server...');
  
  // Initialize Earth Engine on startup
  await initializeEarthEngine();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log('Earth Engine MCP Server running');
  console.log('Available tools:', Object.keys(TOOLS).join(', '));
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
