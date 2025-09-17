#!/usr/bin/env node
/**
 * Local API test script - Tests tools through the Next.js API endpoints
 * This simulates how the tools would be called in production
 */

import fetch from 'node-fetch';

// Colors for output
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
  failed: []
};

// API endpoint (local Next.js server)
const API_URL = 'http://localhost:3000/api/mcp/sse';

// Helper function to call API
async function callAPI(tool, args) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'tools/call',
        params: { tool, arguments: args }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error calling ${tool}:`, error.message);
    throw error;
  }
}

// Test configuration
const testConfig = {
  region: 'San Francisco',
  startDate: '2023-01-01',
  endDate: '2023-12-31'
};

// Tests to run
const tests = [
  // Earth Engine Tools
  {
    name: 'Search datasets',
    tool: 'earth_engine_data',
    args: {
      operation: 'search',
      query: 'landsat 8 surface reflectance'
    }
  },
  {
    name: 'Get dataset info',
    tool: 'earth_engine_data',
    args: {
      operation: 'info',
      datasetId: 'LANDSAT/LC08/C02/T1_L2'
    }
  },
  {
    name: 'Calculate NDVI',
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
    name: 'Statistics analysis',
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
    name: 'Generate thumbnail',
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
  },
  // Geospatial Models
  {
    name: 'Wildfire Risk Assessment',
    tool: 'wildfire_risk_assessment',
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
    tool: 'flood_risk_assessment',
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
    tool: 'agricultural_monitoring',
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
    tool: 'deforestation_detection',
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
    tool: 'water_quality_monitoring',
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
  console.log(`${colors.blue}Earth Engine MCP - Local API Testing`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
  
  console.log(`${colors.yellow}Testing API endpoint: ${API_URL}${colors.reset}\n`);
  
  // Check if server is running
  try {
    const healthResponse = await fetch('http://localhost:3000/api/health');
    if (!healthResponse.ok) {
      throw new Error('Server not responding');
    }
    console.log(`${colors.green}✓ Server is running${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.red}✗ Server is not running at http://localhost:3000${colors.reset}`);
    console.error(`${colors.red}Please start the Next.js dev server first: npm run dev${colors.reset}`);
    process.exit(1);
  }
  
  // Run tests
  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      const startTime = Date.now();
      const result = await callAPI(test.tool, test.args);
      const duration = Date.now() - startTime;
      
      if (result && !result.error) {
        console.log(`${colors.green}[PASS]${colors.reset} ${test.name}`);
        console.log(`  ${colors.cyan}Duration:${colors.reset} ${duration}ms`);
        
        // Log key results
        if (result.riskLevel) {
          console.log(`  ${colors.cyan}Risk Level:${colors.reset} ${result.riskLevel}`);
        }
        if (result.qualityLevel) {
          console.log(`  ${colors.cyan}Quality Level:${colors.reset} ${result.qualityLevel}`);
        }
        if (result.url) {
          console.log(`  ${colors.cyan}Generated URL:${colors.reset} ${result.url.substring(0, 50)}...`);
        }
        
        results.passed.push(test.name);
      } else {
        console.log(`${colors.red}[FAIL]${colors.reset} ${test.name}`);
        console.log(`  ${colors.red}Error:${colors.reset} ${result?.error || 'Unknown error'}`);
        results.failed.push({ name: test.name, error: result?.error });
      }
    } catch (error) {
      console.log(`${colors.red}[FAIL]${colors.reset} ${test.name}`);
      console.log(`  ${colors.red}Error:${colors.reset} ${error.message}`);
      results.failed.push({ name: test.name, error: error.message });
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
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
        console.log(`    ${test.error}`);
      }
    });
  }
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});