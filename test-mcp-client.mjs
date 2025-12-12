#!/usr/bin/env node
/**
 * MCP Client Test - Tests the Earth Engine MCP server as a real client would
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testMCPServer() {
  let client;
  const results = { total: 0, passed: 0, failed: 0, errors: [] };
  
  try {
    log('\n🌍 EARTH ENGINE MCP SERVER TEST', 'cyan');
    log('=' .repeat(50), 'cyan');
    
    // Connect to MCP server
    log('\n🚀 Connecting to MCP server...', 'blue');
    
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.mjs'],
      env: {
        ...process.env,
        GOOGLE_APPLICATION_CREDENTIALS: "C:\\Users\\Dhenenjay\\Downloads\\ee-key.json"
      }
    });
    
    client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    await client.connect(transport);
    log('✅ Connected to MCP server successfully!', 'green');
    
    // List available tools
    const toolsList = await client.listTools();
    log(`\n📦 Found ${toolsList.tools.length} tools:`, 'blue');
    
    const toolsByCategory = {
      'earth_engine_data': [],
      'earth_engine_system': [],
      'earth_engine_process': [],
      'earth_engine_export': []
    };
    
    toolsList.tools.forEach(tool => {
      if (toolsByCategory[tool.name]) {
        toolsByCategory[tool.name].push(tool);
      }
      log(`  • ${tool.name}`, 'reset');
    });
    
    // Helper function to test a tool
    async function testTool(name, description, toolName, args) {
      results.total++;
      const testNum = results.total;
      
      try {
        log(`\n[${testNum}] Testing: ${description}`, 'yellow');
        const result = await client.callTool({ 
          name: toolName, 
          arguments: args 
        });
        
        if (result.content && result.content[0]) {
          const content = result.content[0];
          if (content.type === 'text') {
            const data = JSON.parse(content.text);
            if (!data.error && data.success !== false) {
              log(`  ✅ PASSED`, 'green');
              results.passed++;
              return true;
            } else {
              log(`  ❌ FAILED: ${data.error || data.message}`, 'red');
              results.failed++;
              results.errors.push({ test: description, error: data.error || data.message });
              return false;
            }
          }
        }
        log(`  ✅ PASSED`, 'green');
        results.passed++;
        return true;
      } catch (error) {
        log(`  ❌ ERROR: ${error.message}`, 'red');
        results.failed++;
        results.errors.push({ test: description, error: error.message });
        return false;
      }
    }
    
    // Test categories
    log('\n' + '='.repeat(50), 'magenta');
    log('📊 TESTING DATA OPERATIONS', 'magenta');
    log('='.repeat(50), 'magenta');
    
    await testTool('search', 'Search for Sentinel datasets', 'earth_engine_data', {
      operation: 'search',
      query: 'sentinel',
      limit: 3
    });
    
    await testTool('geometry', 'Get geometry for San Francisco', 'earth_engine_data', {
      operation: 'geometry',
      placeName: 'San Francisco'
    });
    
    await testTool('filter', 'Filter Sentinel-2 collection', 'earth_engine_data', {
      operation: 'filter',
      datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
      startDate: '2024-06-01',
      endDate: '2024-06-30',
      cloudCoverMax: 20
    });
    
    log('\n' + '='.repeat(50), 'magenta');
    log('⚙️ TESTING SYSTEM OPERATIONS', 'magenta');
    log('='.repeat(50), 'magenta');
    
    await testTool('auth', 'Check authentication', 'earth_engine_system', {
      operation: 'auth'
    });
    
    await testTool('help', 'Get help information', 'earth_engine_system', {
      operation: 'help'
    });
    
    await testTool('execute', 'Execute Earth Engine code', 'earth_engine_system', {
      operation: 'execute',
      code: 'const point = ee.Geometry.Point([0, 0]); return point.buffer(1000).area();'
    });
    
    log('\n' + '='.repeat(50), 'magenta');
    log('🔧 TESTING PROCESSING OPERATIONS', 'magenta');
    log('='.repeat(50), 'magenta');
    
    await testTool('index', 'Calculate NDVI', 'earth_engine_process', {
      operation: 'index',
      indexType: 'NDVI',
      datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
      startDate: '2024-06-01',
      endDate: '2024-06-30',
      region: 'San Francisco'
    });
    
    await testTool('composite', 'Create median composite', 'earth_engine_process', {
      operation: 'composite',
      datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
      startDate: '2024-06-01',
      endDate: '2024-06-30',
      method: 'median'
    });
    
    log('\n' + '='.repeat(50), 'magenta');
    log('📤 TESTING EXPORT OPERATIONS', 'magenta');
    log('='.repeat(50), 'magenta');
    
    await testTool('thumbnail', 'Generate thumbnail', 'earth_engine_export', {
      operation: 'thumbnail',
      datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
      startDate: '2024-06-01',
      endDate: '2024-06-30',
      region: 'San Francisco',
      dimensions: 256,
      visParams: {
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 3000
      }
    });
    
    log('\n' + '='.repeat(50), 'magenta');
    log('🌍 TESTING GLOBAL LOCATIONS', 'magenta');
    log('='.repeat(50), 'magenta');
    
    const locations = ['Tokyo', 'London', 'Sydney', 'Mumbai', 'Cairo'];
    for (const loc of locations) {
      await testTool(`geometry_${loc}`, `Find geometry for ${loc}`, 'earth_engine_data', {
        operation: 'geometry',
        placeName: loc
      });
    }
    
    // Print summary
    log('\n' + '='.repeat(50), 'cyan');
    log('📊 TEST RESULTS SUMMARY', 'cyan');
    log('='.repeat(50), 'cyan');
    
    const successRate = ((results.passed / results.total) * 100).toFixed(1);
    log(`Total Tests: ${results.total}`, 'reset');
    log(`✅ Passed: ${results.passed}`, 'green');
    log(`❌ Failed: ${results.failed}`, 'red');
    log(`Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'yellow');
    
    if (results.errors.length > 0) {
      log('\n⚠️ Failed Tests:', 'yellow');
      results.errors.forEach(err => {
        log(`  • ${err.test}: ${err.error}`, 'reset');
      });
    }
    
    if (results.passed === results.total) {
      log('\n🎉 All tests passed! MCP server is fully operational!', 'green');
    } else if (successRate >= 80) {
      log('\n✅ MCP server is operational with minor issues.', 'yellow');
    } else {
      log('\n❌ MCP server has significant issues that need fixing.', 'red');
    }
    
    // Cleanup
    await client.close();
    process.exit(results.failed > 0 ? 1 : 0);
    
  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error.stack);
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    process.exit(1);
  }
}

// Run the test
testMCPServer().catch(console.error);
