#!/usr/bin/env node

/**
 * Diagnostic script for multi-layer map issue
 * This script tests the MCP server's ability to create maps with multiple layers
 */

const http = require('http');

// Helper function to make HTTP requests
function makeRequest(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/stdio',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

async function testMultiLayerMap() {
  console.log('\n=== Multi-Layer Map Diagnostic Test ===\n');
  
  try {
    // Step 1: Create a composite first
    console.log('Step 1: Creating base composite...');
    const compositeRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'earth_engine_process',
        arguments: {
          operation: 'composite',
          datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
          region: 'Los Angeles',
          startDate: '2024-10-01',
          endDate: '2024-10-31',
          compositeType: 'median'
        }
      },
      id: Date.now()
    };
    
    const compositeResult = await makeRequest(compositeRequest);
    console.log('Composite response received');
    
    if (!compositeResult.result) {
      console.log('Error: No result in composite response');
      throw new Error('Failed to create composite');
    }
    
    let parsedContent;
    if (compositeResult.result.content && compositeResult.result.content[0]) {
      parsedContent = JSON.parse(compositeResult.result.content[0].text);
    } else if (typeof compositeResult.result === 'object') {
      // Result might be directly the content
      parsedContent = compositeResult.result;
    } else {
      console.log('Unexpected result structure:', JSON.stringify(compositeResult.result, null, 2));
      throw new Error('Unexpected composite result structure');
    }
    const compositeKey = parsedContent.compositeKey;
    console.log(`✓ Composite created with key: ${compositeKey}\n`);
    
    // Step 2: Try creating a single-layer map (should work)
    console.log('Step 2: Testing single-layer map...');
    const singleLayerRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'earth_engine_map',
        arguments: {
          operation: 'create',
          input: compositeKey,
          region: 'Los Angeles',
          bands: ['B4', 'B3', 'B2'],
          visParams: {
            min: 0,
            max: 0.3,
            gamma: 1.4
          },
          center: [-118.2437, 34.0522],
          zoom: 10,
          basemap: 'satellite'
        }
      },
      id: Date.now() + 1
    };
    
    const singleLayerResult = await makeRequest(singleLayerRequest);
    console.log('Single layer response received');
    
    if (singleLayerResult.result) {
      let mapContent;
      if (singleLayerResult.result.content && singleLayerResult.result.content[0]) {
        mapContent = JSON.parse(singleLayerResult.result.content[0].text);
      } else {
        mapContent = singleLayerResult.result;
      }
      if (mapContent.success) {
        console.log(`✓ Single-layer map created successfully: ${mapContent.url}\n`);
      } else {
        console.log(`✗ Single-layer map failed: ${mapContent.error}\n`);
      }
    }
    
    // Step 3: Try creating a multi-layer map
    console.log('Step 3: Testing multi-layer map...');
    const multiLayerRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'earth_engine_map',
        arguments: {
          operation: 'create',
          input: compositeKey,
          region: 'Los Angeles',
          layers: [
            {
              name: 'True Color',
              bands: ['B4', 'B3', 'B2'],
              visParams: {
                min: 0,
                max: 0.3,
                gamma: 1.4
              }
            },
            {
              name: 'False Color',
              bands: ['B8', 'B4', 'B3'],
              visParams: {
                min: 0,
                max: 0.3,
                gamma: 1.4
              }
            },
            {
              name: 'Agriculture',
              bands: ['B11', 'B8', 'B2'],
              visParams: {
                min: 0,
                max: 0.3,
                gamma: 1.4
              }
            }
          ],
          center: [-118.2437, 34.0522],
          zoom: 10,
          basemap: 'satellite'
        }
      },
      id: Date.now() + 2
    };
    
    console.log('Sending multi-layer request...');
    console.log('Request details:', JSON.stringify(multiLayerRequest.params.arguments, null, 2));
    
    const multiLayerResult = await makeRequest(multiLayerRequest);
    console.log('Multi-layer response received');
    
    if (multiLayerResult.result) {
      let mapContent;
      if (multiLayerResult.result.content && multiLayerResult.result.content[0]) {
        mapContent = JSON.parse(multiLayerResult.result.content[0].text);
      } else {
        mapContent = multiLayerResult.result;
      }
      if (mapContent.success) {
        console.log(`\n✓ SUCCESS: Multi-layer map created!`);
        console.log(`  Map URL: ${mapContent.url}`);
        console.log(`  Layers: ${mapContent.layers.map(l => l.name).join(', ')}`);
      } else {
        console.log(`\n✗ FAILURE: Multi-layer map failed`);
        console.log(`  Error: ${mapContent.error}`);
        console.log(`  Message: ${mapContent.message}`);
      }
    } else if (multiLayerResult.error) {
      console.log(`\n✗ MCP ERROR:`, multiLayerResult.error);
    }
    
  } catch (error) {
    console.error('\n✗ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('\n=== Diagnostic Test Complete ===\n');
}

// Run the test
testMultiLayerMap().catch(console.error);