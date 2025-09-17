#!/usr/bin/env node
/**
 * Comprehensive test script for all Earth Engine tools and geospatial models
 * Tests each tool and model to ensure they work correctly
 */

// Set environment variables
process.env.NODE_ENV = 'development';

// Import required modules  
// Load the built index which includes server functionality
async function loadModules() {
  // Import Earth Engine initialization
  const { initEarthEngineWithSA } = await import('./dist/index.js');
  await initEarthEngineWithSA();
  
  // Import registry from the source (TypeScript modules)
  const registryModule = await import('./src/mcp/registry.ts');
  const get = registryModule.get;
  
  // Import the consolidated tools to register them
  await import('./src/mcp/tools/consolidated/earth_engine_data.ts');
  await import('./src/mcp/tools/consolidated/earth_engine_process.ts');
  await import('./src/mcp/tools/consolidated/earth_engine_export.ts');
  await import('./src/mcp/tools/consolidated/earth_engine_system.ts');
  
  // Create callTool function
  const callTool = async (name, args) => {
    const tool = get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    return await tool.handler(args);
  };
  
  // Import models as ES module
  const modelsModule = await import('./src/models/geospatial-models.js');
  const models = modelsModule.default || modelsModule;
  
  return { callTool, models };
}

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test results
const results = {
  passed: [],
  failed: [],
  skipped: []
};

// Helper function to log test results
function logTest(name, status, details = null) {
  const statusColor = status === 'PASS' ? colors.green : 
                      status === 'FAIL' ? colors.red : 
                      colors.yellow;
  console.log(`${statusColor}[${status}]${colors.reset} ${name}`);
  if (details) {
    console.log(`  ${colors.cyan}Details:${colors.reset}`, details);
  }
}

// Test configuration
const testConfig = {
  region: 'San Francisco',
  startDate: '2023-01-01',
  endDate: '2023-12-31',
  placeName: 'San Francisco Bay Area'
};

// Earth Engine Tools Tests
const toolTests = [
  {
    name: 'earth_engine_data - Search datasets',
    tool: 'earth_engine_data',
    args: {
      operation: 'search',
      query: 'landsat 8 surface reflectance'
    }
  },
  {
    name: 'earth_engine_data - Get dataset info',
    tool: 'earth_engine_data',
    args: {
      operation: 'info',
      datasetId: 'LANDSAT/LC08/C02/T1_L2'
    }
  },
  {
    name: 'earth_engine_process - Calculate NDVI',
    tool: 'earth_engine_process',
    args: {
      operation: 'index',
      indexType: 'NDVI',
      datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
      startDate: testConfig.startDate,
      endDate: testConfig.endDate,
      region: testConfig.region
    }
  },
  {
    name: 'earth_engine_process - Statistics analysis',
    tool: 'earth_engine_process',
    args: {
      operation: 'analyze',
      analysisType: 'statistics',
      datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
      band: 'B4',
      reducer: 'mean',
      startDate: testConfig.startDate,
      endDate: testConfig.endDate,
      region: testConfig.region,
      scale: 100
    }
  },
  {
    name: 'earth_engine_export - Generate thumbnail',
    tool: 'earth_engine_export',
    args: {
      operation: 'thumbnail',
      datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
      startDate: testConfig.startDate,
      endDate: testConfig.endDate,
      region: testConfig.region,
      dimensions: 256,
      visParams: {
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 3000,
        gamma: 1.4
      }
    }
  }
];

// Geospatial Model Tests
const modelTests = [
  {
    name: 'Wildfire Risk Assessment',
    func: null, // Will be set after modules load
    args: {
      region: 'California',
      startDate: '2023-06-01',
      endDate: '2023-10-31',
      scale: 100,
      indices: ['NDVI', 'NDWI'],
      includeTimeSeries: false,
      exportMaps: false
    }
  },
  {
    name: 'Flood Risk Assessment',
    func: null, // Will be set after modules load
    args: {
      region: 'Houston',
      startDate: '2023-08-01',
      endDate: '2023-08-31',
      floodType: 'river',
      scale: 100,
      analyzeWaterChange: false
    }
  },
  {
    name: 'Agricultural Monitoring',
    func: null, // Will be set after modules load
    args: {
      region: 'Iowa',
      cropType: 'corn',
      startDate: '2023-04-01',
      endDate: '2023-09-30',
      scale: 30,
      indices: ['NDVI', 'EVI']
    }
  },
  {
    name: 'Deforestation Detection',
    func: null, // Will be set after modules load
    args: {
      region: 'Amazon',
      baselineStart: '2023-01-01',
      baselineEnd: '2023-03-31',
      currentStart: '2023-10-01',
      currentEnd: '2023-12-31',
      scale: 30
    }
  },
  {
    name: 'Water Quality Monitoring',
    func: null, // Will be set after modules load
    args: {
      region: 'Lake Tahoe',
      startDate: '2023-06-01',
      endDate: '2023-08-31',
      waterBody: 'lake',
      scale: 30
    }
  }
];

// Main test function
async function runTests() {
  console.log(`\n${colors.blue}${'='.repeat(60)}`);
  console.log(`${colors.blue}Earth Engine MCP - Comprehensive Tool Testing`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
  
  // Load modules
  console.log('Loading modules...');
  const { callTool, models } = await loadModules();
  console.log('Modules loaded successfully\n');
  
  // Update model tests with loaded models
  modelTests[0].func = models.wildfireRiskAssessment;
  modelTests[1].func = models.floodRiskAssessment;
  modelTests[2].func = models.agriculturalMonitoring;
  modelTests[3].func = models.deforestationDetection;
  modelTests[4].func = models.waterQualityMonitoring;

  // Test Earth Engine Tools
  console.log(`${colors.yellow}Testing Earth Engine Tools...${colors.reset}\n`);
  
  for (const test of toolTests) {
    try {
      console.log(`Testing: ${test.name}`);
      const startTime = Date.now();
      const result = await callTool(test.tool, test.args);
      const duration = Date.now() - startTime;
      
      if (result && (result.success !== false)) {
        logTest(test.name, 'PASS', `Completed in ${duration}ms`);
        results.passed.push(test.name);
      } else {
        logTest(test.name, 'FAIL', result?.error || 'Unknown error');
        results.failed.push({ name: test.name, error: result?.error });
      }
    } catch (error) {
      logTest(test.name, 'FAIL', error.message);
      results.failed.push({ name: test.name, error: error.message });
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Test Geospatial Models
  console.log(`\n${colors.yellow}Testing Geospatial Models...${colors.reset}\n`);
  
  for (const test of modelTests) {
    try {
      console.log(`Testing: ${test.name}`);
      const startTime = Date.now();
      const result = await test.func(test.args);
      const duration = Date.now() - startTime;
      
      if (result && (result.success !== false)) {
        logTest(test.name, 'PASS', `Completed in ${duration}ms`);
        results.passed.push(test.name);
        
        // Log key results for models
        if (result.riskLevel) {
          console.log(`  Risk Level: ${result.riskLevel}`);
        }
        if (result.qualityLevel) {
          console.log(`  Quality Level: ${result.qualityLevel}`);
        }
      } else {
        logTest(test.name, 'FAIL', result?.error || 'Unknown error');
        results.failed.push({ name: test.name, error: result?.error });
      }
    } catch (error) {
      logTest(test.name, 'FAIL', error.message);
      results.failed.push({ name: test.name, error: error.message });
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print summary
  console.log(`\n${colors.blue}${'='.repeat(60)}`);
  console.log(`${colors.blue}Test Summary`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
  
  console.log(`${colors.green}✓ Passed: ${results.passed.length}${colors.reset}`);
  console.log(`${colors.red}✗ Failed: ${results.failed.length}${colors.reset}`);
  
  if (results.failed.length > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    results.failed.forEach(test => {
      console.log(`  - ${test.name}`);
      if (test.error) {
        console.log(`    Error: ${test.error}`);
      }
    });
  }
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    console.error(`${colors.red}Fatal error running tests:${colors.reset}`, error);
    process.exit(1);
  });
}

module.exports = { runTests };