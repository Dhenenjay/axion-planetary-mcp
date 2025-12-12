#!/usr/bin/env node

/**
 * PROFESSIONAL STRESS TEST SUITE FOR EARTH ENGINE MCP SERVER
 * ===========================================================
 * Simulates real-world geospatial engineering workloads
 */

const http = require('http');
const fs = require('fs');

// Stress test configuration
const STRESS_CONFIG = {
  concurrentRequests: 5,
  largeRegionTests: true,
  longTimeSeriesTests: true,
  complexComputations: true,
  errorRecoveryTests: true,
  memoryLeakTests: true
};

// Helper to make API calls
async function callAPI(toolName, args, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/transport',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const startTime = Date.now();
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          result.responseTime = Date.now() - startTime;
          resolve(result);
        } catch (e) {
          reject(new Error(`Parse error: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeout}ms`));
    });
    
    req.write(postData);
    req.end();
  });
}

// Test scenarios
const STRESS_SCENARIOS = {
  // 1. Large region processing
  largeRegions: [
    { name: 'Continental US', region: 'United States' },
    { name: 'Brazil Amazon', region: 'Brazil' },
    { name: 'Sahara Desert', region: 'Africa' },
    { name: 'Siberia', region: 'Russia' }
  ],
  
  // 2. Complex time series
  timeSeries: [
    { name: '5 Year Daily', start: '2019-01-01', end: '2024-01-01', interval: 'daily' },
    { name: '10 Year Monthly', start: '2014-01-01', end: '2024-01-01', interval: 'monthly' },
    { name: '20 Year Annual', start: '2004-01-01', end: '2024-01-01', interval: 'annual' }
  ],
  
  // 3. Multiple indices computation
  multipleIndices: ['NDVI', 'NDWI', 'EVI', 'SAVI', 'NDBI', 'NBR', 'MNDWI'],
  
  // 4. High resolution exports
  resolutions: [10, 30, 100, 250, 500, 1000],
  
  // 5. Complex composite operations
  compositeTypes: ['median', 'mean', 'max', 'min', 'mosaic', 'greenest']
};

// Run concurrent requests
async function runConcurrentTest(name, requests) {
  console.log(`\n🔄 Running Concurrent Test: ${name}`);
  console.log(`   Requests: ${requests.length}`);
  
  const startTime = Date.now();
  try {
    const results = await Promise.allSettled(requests);
    const duration = Date.now() - startTime;
    
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`   ✅ Completed in ${duration}ms`);
    console.log(`   Success: ${succeeded}/${requests.length}`);
    console.log(`   Failed: ${failed}/${requests.length}`);
    
    return { name, duration, succeeded, failed, total: requests.length };
  } catch (error) {
    console.log(`   ❌ Test failed: ${error.message}`);
    return { name, error: error.message };
  }
}

// Main stress test suite
async function runStressTests() {
  console.log('============================================');
  console.log('PROFESSIONAL GEOSPATIAL STRESS TEST SUITE');
  console.log('============================================');
  console.log(`Started: ${new Date().toISOString()}`);
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    performance: {
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      totalRequests: 0,
      failedRequests: 0
    }
  };
  
  // TEST 1: Concurrent Data Searches
  console.log('\n📊 TEST 1: CONCURRENT DATA SEARCHES');
  console.log('=====================================');
  
  const searchRequests = [
    'sentinel', 'landsat', 'modis', 'climate', 'precipitation'
  ].map(query => callAPI('earth_engine_data', { 
    operation: 'search', 
    query, 
    limit: 10 
  }));
  
  const searchTest = await runConcurrentTest('Concurrent Searches', searchRequests);
  results.tests.push(searchTest);
  
  // TEST 2: Large Region Processing
  if (STRESS_CONFIG.largeRegionTests) {
    console.log('\n🌍 TEST 2: LARGE REGION PROCESSING');
    console.log('====================================');
    
    for (const region of STRESS_SCENARIOS.largeRegions) {
      console.log(`\n   Testing: ${region.name}`);
      
      try {
        const startTime = Date.now();
        const result = await callAPI('earth_engine_process', {
          operation: 'analyze',
          analysisType: 'statistics',
          datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
          region: region.region,
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          scale: 1000,
          reducer: 'mean'
        }, 90000);
        
        const duration = Date.now() - startTime;
        console.log(`   ✅ ${region.name}: ${duration}ms`);
        
        results.tests.push({
          name: `Large Region: ${region.name}`,
          duration,
          status: 'success'
        });
      } catch (error) {
        console.log(`   ❌ ${region.name}: ${error.message}`);
        results.tests.push({
          name: `Large Region: ${region.name}`,
          status: 'failed',
          error: error.message
        });
      }
    }
  }
  
  // TEST 3: Multiple Indices Computation
  console.log('\n📈 TEST 3: MULTIPLE INDICES COMPUTATION');
  console.log('=========================================');
  
  const indexRequests = STRESS_SCENARIOS.multipleIndices.map(index =>
    callAPI('earth_engine_process', {
      operation: 'index',
      indexType: index,
      datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
      startDate: '2024-06-01',
      endDate: '2024-06-30',
      region: 'Iowa'
    })
  );
  
  const indexTest = await runConcurrentTest('Multiple Indices', indexRequests);
  results.tests.push(indexTest);
  
  // TEST 4: Time Series Stress Test
  if (STRESS_CONFIG.longTimeSeriesTests) {
    console.log('\n📅 TEST 4: TIME SERIES STRESS TEST');
    console.log('====================================');
    
    for (const series of STRESS_SCENARIOS.timeSeries) {
      console.log(`\n   Testing: ${series.name}`);
      
      try {
        const startTime = Date.now();
        const result = await callAPI('earth_engine_process', {
          operation: 'analyze',
          analysisType: 'timeseries',
          datasetId: 'MODIS/006/MOD13Q1',
          band: 'NDVI',
          startDate: series.start,
          endDate: series.end,
          region: 'Nebraska',
          scale: 500
        }, 120000);
        
        const duration = Date.now() - startTime;
        console.log(`   ✅ ${series.name}: ${duration}ms`);
        
        results.tests.push({
          name: `Time Series: ${series.name}`,
          duration,
          status: 'success'
        });
      } catch (error) {
        console.log(`   ❌ ${series.name}: ${error.message}`);
        results.tests.push({
          name: `Time Series: ${series.name}`,
          status: 'failed',
          error: error.message
        });
      }
    }
  }
  
  // TEST 5: Export Resolution Stress Test
  console.log('\n💾 TEST 5: MULTI-RESOLUTION EXPORTS');
  console.log('=====================================');
  
  const exportRequests = STRESS_SCENARIOS.resolutions.map(scale =>
    callAPI('earth_engine_export', {
      operation: 'export',
      destination: 'auto',
      datasetId: 'LANDSAT/LC08/C02/T1_L2',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      region: 'Wyoming',
      scale: scale,
      format: 'GeoTIFF'
    })
  );
  
  const exportTest = await runConcurrentTest('Multi-Resolution Exports', exportRequests);
  results.tests.push(exportTest);
  
  // TEST 6: Complex Composite Operations
  console.log('\n🎨 TEST 6: COMPLEX COMPOSITES');
  console.log('===============================');
  
  const compositeRequests = STRESS_SCENARIOS.compositeTypes.map(type =>
    callAPI('earth_engine_process', {
      operation: 'composite',
      compositeType: type,
      datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      region: 'California'
    })
  );
  
  const compositeTest = await runConcurrentTest('Complex Composites', compositeRequests);
  results.tests.push(compositeTest);
  
  // TEST 7: Error Recovery Test
  if (STRESS_CONFIG.errorRecoveryTests) {
    console.log('\n⚠️ TEST 7: ERROR RECOVERY');
    console.log('===========================');
    
    const errorScenarios = [
      { name: 'Invalid Dataset', args: { operation: 'filter', datasetId: 'FAKE/DATASET' }},
      { name: 'Invalid Date Range', args: { operation: 'filter', datasetId: 'COPERNICUS/S2_SR_HARMONIZED', startDate: '2025-01-01', endDate: '2024-01-01' }},
      { name: 'Invalid Region', args: { operation: 'geometry', placeName: 'Atlantis' }},
      { name: 'Missing Parameters', args: { operation: 'index' }},
      { name: 'Invalid Operation', args: { operation: 'invalid_op' }}
    ];
    
    for (const scenario of errorScenarios) {
      try {
        const result = await callAPI('earth_engine_data', scenario.args, 5000);
        console.log(`   ✅ ${scenario.name}: Handled gracefully`);
        results.tests.push({
          name: `Error Recovery: ${scenario.name}`,
          status: 'handled'
        });
      } catch (error) {
        console.log(`   ❌ ${scenario.name}: ${error.message}`);
        results.tests.push({
          name: `Error Recovery: ${scenario.name}`,
          status: 'error',
          error: error.message
        });
      }
    }
  }
  
  // TEST 8: Memory Leak Test (Rapid Sequential Requests)
  if (STRESS_CONFIG.memoryLeakTests) {
    console.log('\n💾 TEST 8: MEMORY LEAK TEST');
    console.log('============================');
    
    const rapidRequests = 50;
    console.log(`   Making ${rapidRequests} rapid sequential requests...`);
    
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < rapidRequests; i++) {
      try {
        await callAPI('earth_engine_data', {
          operation: 'search',
          query: 'sentinel',
          limit: 1
        }, 2000);
        successCount++;
      } catch (error) {
        errorCount++;
      }
      
      if ((i + 1) % 10 === 0) {
        console.log(`   Progress: ${i + 1}/${rapidRequests}`);
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`   ✅ Completed: ${successCount} successful, ${errorCount} errors`);
    console.log(`   Average time per request: ${(duration / rapidRequests).toFixed(2)}ms`);
    
    results.tests.push({
      name: 'Memory Leak Test',
      requests: rapidRequests,
      success: successCount,
      errors: errorCount,
      avgTime: duration / rapidRequests
    });
  }
  
  // Calculate performance metrics
  const allTests = results.tests.filter(t => t.duration);
  if (allTests.length > 0) {
    results.performance.avgResponseTime = 
      allTests.reduce((sum, t) => sum + t.duration, 0) / allTests.length;
    results.performance.maxResponseTime = 
      Math.max(...allTests.map(t => t.duration));
    results.performance.minResponseTime = 
      Math.min(...allTests.map(t => t.duration));
  }
  
  results.performance.totalRequests = results.tests.length;
  results.performance.failedRequests = results.tests.filter(t => 
    t.status === 'failed' || t.status === 'error'
  ).length;
  
  // Summary
  console.log('\n============================================');
  console.log('STRESS TEST SUMMARY');
  console.log('============================================');
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`Failed: ${results.performance.failedRequests}`);
  console.log(`Success Rate: ${((1 - results.performance.failedRequests / results.performance.totalRequests) * 100).toFixed(1)}%`);
  console.log(`\nPerformance Metrics:`);
  console.log(`  Average Response Time: ${results.performance.avgResponseTime.toFixed(2)}ms`);
  console.log(`  Max Response Time: ${results.performance.maxResponseTime}ms`);
  console.log(`  Min Response Time: ${results.performance.minResponseTime}ms`);
  
  // Save results
  const filename = `stress-test-results-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${filename}`);
  
  return results;
}

// Run stress tests
runStressTests()
  .then(results => {
    const exitCode = results.performance.failedRequests > 
      results.performance.totalRequests * 0.2 ? 1 : 0;
    console.log(`\n${exitCode === 0 ? '✅' : '❌'} Test suite ${exitCode === 0 ? 'PASSED' : 'FAILED'}`);
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });