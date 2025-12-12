#!/usr/bin/env node
/**
 * COMPREHENSIVE EARTH ENGINE MCP TEST SUITE
 * Tests all functionality end-to-end
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class EarthEngineTestSuite {
  constructor() {
    this.client = null;
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  async connect() {
    try {
      log('🚀 Starting Earth Engine MCP Server...', 'cyan');
      
      const transport = new StdioClientTransport({
        command: 'node',
        args: [join(__dirname, '../dist/index.mjs')],
        env: { ...process.env }
      });

      this.client = new Client({
        name: 'ee-test-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await this.client.connect(transport);
      log('✅ Connected to Earth Engine MCP server', 'green');
      
      // List available tools
      const tools = await this.client.listTools();
      log(`\n📦 Available tools: ${tools.tools.length}`, 'blue');
      tools.tools.forEach(tool => {
        log(`  - ${tool.name}: ${tool.description}`, 'white');
      });
      
      return true;
    } catch (error) {
      log(`❌ Failed to connect: ${error.message}`, 'red');
      return false;
    }
  }

  async runTest(name, testFn) {
    this.totalTests++;
    try {
      log(`\n🧪 Testing: ${name}`, 'yellow');
      const result = await testFn();
      if (result.success !== false) {
        this.passedTests++;
        log(`  ✅ PASSED`, 'green');
        this.testResults.push({ name, status: 'PASSED', result });
        return true;
      } else {
        this.failedTests++;
        log(`  ❌ FAILED: ${result.error || 'Unknown error'}`, 'red');
        this.testResults.push({ name, status: 'FAILED', error: result.error });
        return false;
      }
    } catch (error) {
      this.failedTests++;
      log(`  ❌ ERROR: ${error.message}`, 'red');
      this.testResults.push({ name, status: 'ERROR', error: error.message });
      return false;
    }
  }

  async callTool(name, args) {
    try {
      const result = await this.client.callTool({ name, arguments: args });
      const content = result.content[0];
      return content.type === 'text' ? JSON.parse(content.text) : content;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== TEST CATEGORIES ==========

  async testDataOperations() {
    log('\n\n📊 DATA OPERATIONS TESTS', 'magenta');
    
    // Test 1: Search catalog
    await this.runTest('Search GEE Catalog', async () => {
      return await this.callTool('earth_engine_data', {
        operation: 'search',
        query: 'sentinel',
        limit: 5
      });
    });

    // Test 2: Filter collection
    await this.runTest('Filter Image Collection', async () => {
      return await this.callTool('earth_engine_data', {
        operation: 'filter',
        datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        cloudCoverMax: 20
      });
    });

    // Test 3: Get geometry from place name
    await this.runTest('Get Geometry - San Francisco', async () => {
      return await this.callTool('earth_engine_data', {
        operation: 'geometry',
        placeName: 'San Francisco'
      });
    });

    // Test 4: Get geometry from coordinates
    await this.runTest('Get Geometry - Coordinates', async () => {
      return await this.callTool('earth_engine_data', {
        operation: 'geometry',
        coordinates: [-122.4194, 37.7749]
      });
    });

    // Test 5: Get dataset info
    await this.runTest('Get Dataset Info', async () => {
      return await this.callTool('earth_engine_data', {
        operation: 'info',
        datasetId: 'COPERNICUS/S2_SR_HARMONIZED'
      });
    });
  }

  async testProcessingOperations() {
    log('\n\n🔧 PROCESSING OPERATIONS TESTS', 'magenta');
    
    // Test 1: Calculate NDVI
    await this.runTest('Calculate NDVI Index', async () => {
      return await this.callTool('earth_engine_process', {
        operation: 'index',
        datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
        indexType: 'NDVI',
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        region: 'San Francisco'
      });
    });

    // Test 2: Calculate NDWI
    await this.runTest('Calculate NDWI Index', async () => {
      return await this.callTool('earth_engine_process', {
        operation: 'index',
        indexType: 'NDWI',
        datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
        startDate: '2024-06-01',
        endDate: '2024-06-30'
      });
    });

    // Test 3: Statistics analysis
    await this.runTest('Calculate Statistics', async () => {
      return await this.callTool('earth_engine_process', {
        operation: 'analyze',
        analysisType: 'statistics',
        datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
        reducer: 'mean',
        region: 'San Francisco',
        startDate: '2024-06-01',
        endDate: '2024-06-30'
      });
    });

    // Test 4: Time series analysis
    await this.runTest('Time Series Analysis', async () => {
      return await this.callTool('earth_engine_process', {
        operation: 'analyze',
        analysisType: 'timeseries',
        datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
        band: 'B4',
        reducer: 'mean',
        region: 'San Francisco',
        startDate: '2024-01-01',
        endDate: '2024-03-31'
      });
    });

    // Test 5: Composite creation
    await this.runTest('Create Composite', async () => {
      return await this.callTool('earth_engine_process', {
        operation: 'composite',
        datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        method: 'median',
        region: 'San Francisco'
      });
    });
  }

  async testExportOperations() {
    log('\n\n📤 EXPORT OPERATIONS TESTS', 'magenta');
    
    // Test 1: Generate thumbnail
    await this.runTest('Generate Thumbnail', async () => {
      return await this.callTool('earth_engine_export', {
        operation: 'thumbnail',
        datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        region: 'San Francisco',
        dimensions: 512,
        visParams: {
          bands: ['B4', 'B3', 'B2'],
          min: 0,
          max: 3000
        }
      });
    });

    // Test 2: Generate tiles
    await this.runTest('Generate Map Tiles', async () => {
      return await this.callTool('earth_engine_export', {
        operation: 'tiles',
        datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        region: 'San Francisco',
        zoomLevel: 10
      });
    });

    // Test 3: Export to GCS
    await this.runTest('Export to Cloud Storage', async () => {
      return await this.callTool('earth_engine_export', {
        operation: 'export',
        datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        region: 'San Francisco',
        scale: 10,
        destination: 'gcs',
        fileNamePrefix: 'test_export'
      });
    });

    // Test 4: Check export status (with test ID)
    await this.runTest('Check Export Status', async () => {
      return await this.callTool('earth_engine_export', {
        operation: 'status',
        taskId: 'test_task_id'
      });
    });
  }

  async testSystemOperations() {
    log('\n\n⚙️ SYSTEM OPERATIONS TESTS', 'magenta');
    
    // Test 1: Check authentication
    await this.runTest('Check Authentication', async () => {
      return await this.callTool('earth_engine_system', {
        operation: 'auth'
      });
    });

    // Test 2: Get help
    await this.runTest('Get Help', async () => {
      return await this.callTool('earth_engine_system', {
        operation: 'help'
      });
    });

    // Test 3: Execute simple Earth Engine code
    await this.runTest('Execute EE Code - Simple', async () => {
      return await this.callTool('earth_engine_system', {
        operation: 'execute',
        code: `
          const point = ee.Geometry.Point([-122.4194, 37.7749]);
          return point.buffer(1000);
        `
      });
    });

    // Test 4: Execute complex Earth Engine code
    await this.runTest('Execute EE Code - Complex', async () => {
      return await this.callTool('earth_engine_system', {
        operation: 'execute',
        code: `
          const collection = new ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterDate('2024-01-01', '2024-01-31')
            .filterBounds(ee.Geometry.Point([-122.4194, 37.7749]))
            .limit(5);
          
          const count = collection.size();
          return count;
        `
      });
    });
  }

  async testEdgeCases() {
    log('\n\n🔍 EDGE CASES & ERROR HANDLING', 'magenta');
    
    // Test 1: Invalid dataset
    await this.runTest('Handle Invalid Dataset', async () => {
      const result = await this.callTool('earth_engine_data', {
        operation: 'filter',
        datasetId: 'INVALID/DATASET/NAME',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      // Should handle gracefully
      return { success: result.error ? true : false };
    });

    // Test 2: Invalid date range
    await this.runTest('Handle Invalid Date Range', async () => {
      const result = await this.callTool('earth_engine_process', {
        operation: 'analyze',
        analysisType: 'timeseries',
        datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
        startDate: '2024-12-01',
        endDate: '2024-01-01', // End before start
        region: 'San Francisco'
      });
      return { success: result.error ? true : false };
    });

    // Test 3: Missing required parameters
    await this.runTest('Handle Missing Parameters', async () => {
      const result = await this.callTool('earth_engine_process', {
        operation: 'analyze',
        analysisType: 'timeseries'
        // Missing required: datasetId, region, dates
      });
      return { success: result.error ? true : false };
    });

    // Test 4: Large area timeout handling
    await this.runTest('Handle Large Area Timeout', async () => {
      return await this.callTool('earth_engine_data', {
        operation: 'filter',
        datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
        startDate: '2020-01-01',
        endDate: '2024-12-31' // Very large date range
      });
    });

    // Test 5: Unknown location
    await this.runTest('Handle Unknown Location', async () => {
      const result = await this.callTool('earth_engine_data', {
        operation: 'geometry',
        placeName: 'Xyzabc123InvalidPlace'
      });
      return { success: result.error ? true : false };
    });
  }

  async testGlobalLocations() {
    log('\n\n🌍 GLOBAL LOCATION TESTS', 'magenta');
    
    const locations = [
      'New York',
      'London',
      'Tokyo',
      'Paris',
      'Sydney',
      'Mumbai',
      'Beijing',
      'Cairo',
      'Rio de Janeiro',
      'Moscow',
      'Dubai',
      'Singapore',
      'Toronto',
      'Mexico City',
      'Lagos',
      'Delhi',
      'Shanghai',
      'Istanbul',
      'Buenos Aires',
      'Johannesburg'
    ];

    for (const location of locations.slice(0, 5)) { // Test first 5
      await this.runTest(`Find Global Location: ${location}`, async () => {
        return await this.callTool('earth_engine_data', {
          operation: 'geometry',
          placeName: location
        });
      });
    }
  }

  async runAllTests() {
    log('\n' + '='.repeat(60), 'cyan');
    log('🌍 EARTH ENGINE MCP COMPREHENSIVE TEST SUITE', 'cyan');
    log('='.repeat(60) + '\n', 'cyan');

    const connected = await this.connect();
    if (!connected) {
      log('\n❌ Cannot run tests - server connection failed', 'red');
      process.exit(1);
    }

    // Run all test categories
    await this.testDataOperations();
    await this.testProcessingOperations();
    await this.testExportOperations();
    await this.testSystemOperations();
    await this.testEdgeCases();
    await this.testGlobalLocations();

    // Print summary
    log('\n' + '='.repeat(60), 'cyan');
    log('📊 TEST SUMMARY', 'cyan');
    log('='.repeat(60), 'cyan');
    
    log(`\nTotal Tests: ${this.totalTests}`, 'white');
    log(`✅ Passed: ${this.passedTests}`, 'green');
    log(`❌ Failed: ${this.failedTests}`, 'red');
    log(`📈 Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`, 
        this.passedTests === this.totalTests ? 'green' : 'yellow');

    // Print failed tests if any
    if (this.failedTests > 0) {
      log('\n❌ FAILED TESTS:', 'red');
      this.testResults
        .filter(r => r.status !== 'PASSED')
        .forEach(r => {
          log(`  - ${r.name}: ${r.error || 'Unknown error'}`, 'red');
        });
    }

    // Disconnect
    if (this.client) {
      await this.client.close();
      log('\n👋 Disconnected from server', 'cyan');
    }

    // Exit with appropriate code
    process.exit(this.failedTests > 0 ? 1 : 0);
  }
}

// Run the test suite
const suite = new EarthEngineTestSuite();
suite.runAllTests().catch(error => {
  log(`\n💥 Fatal error: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});
