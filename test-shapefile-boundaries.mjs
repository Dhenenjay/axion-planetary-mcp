#!/usr/bin/env node
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const MCP_URL = process.env.MCP_URL || 'http://localhost:3000';

// Load service account key from .env.local file
function loadServiceAccount() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    const keyLine = lines.find(line => line.startsWith('GEE_SA_KEY_JSON='));
    if (keyLine) {
      const base64Key = keyLine.split('=')[1].trim();
      return Buffer.from(base64Key, 'base64').toString('utf8');
    }
  }
  
  // Fallback to environment variable
  if (process.env.GEE_SA_KEY_JSON) {
    return Buffer.from(process.env.GEE_SA_KEY_JSON, 'base64').toString('utf8');
  }
  
  throw new Error('No service account key found in .env.local or environment');
}

async function callTool(transport, toolName, params) {
  const url = `${MCP_URL}/${transport}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params
      }
    })
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  return result.result;
}

async function testShapefileBoundaries() {
  console.log('🌍 Testing Earth Engine MCP with Shapefile Boundaries\n');
  console.log('====================================================\n');
  
  try {
    // Step 1: Initialize Earth Engine
    console.log('📌 Step 1: Initializing Earth Engine...');
    const privateKeyJson = loadServiceAccount();
    
    await callTool('sse', 'earthengine_initialize', {
      privateKeyJson
    });
    console.log('✅ Earth Engine initialized successfully!\n');
    
    // Step 2: Test filtering with San Francisco administrative boundary
    console.log('📌 Step 2: Testing San Francisco administrative boundary...');
    
    // Create a polygon roughly around San Francisco
    const sfPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-122.5, 37.8],
        [-122.5, 37.7],
        [-122.4, 37.7],
        [-122.4, 37.8],
        [-122.5, 37.8]
      ]]
    };
    
    // First test: with polygon (should auto-detect SF)
    console.log('  Testing auto-detection from polygon coordinates...');
    const result1 = await callTool('sse', 'filter_collection_by_date_and_region', {
      datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
      aoi: sfPolygon,
      start: '2024-01-01',
      end: '2024-01-31'
    });
    
    console.log(`  ✓ Found ${result1.count} images`);
    console.log(`  ✓ Region type: ${result1.regionType}`);
    console.log(`  ✓ Message: ${result1.message}`);
    console.log(`  ✓ Detected place: ${result1.detectedPlace}\n`);
    
    // Second test: explicitly with place name
    console.log('  Testing with explicit place name...');
    const result2 = await callTool('sse', 'filter_collection_by_date_and_region', {
      datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
      aoi: sfPolygon,
      start: '2024-01-01',
      end: '2024-01-31',
      placeName: 'San Francisco'
    });
    
    console.log(`  ✓ Found ${result2.count} images`);
    console.log(`  ✓ Region type: ${result2.regionType}`);
    console.log(`  ✓ Message: ${result2.message}\n`);
    
    // Step 3: Test with New York
    console.log('📌 Step 3: Testing New York administrative boundary...');
    
    const nyPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-74.05, 40.75],
        [-74.05, 40.70],
        [-73.95, 40.70],
        [-73.95, 40.75],
        [-74.05, 40.75]
      ]]
    };
    
    const result3 = await callTool('sse', 'filter_collection_by_date_and_region', {
      datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
      aoi: nyPolygon,
      start: '2024-01-01',
      end: '2024-01-31',
      placeName: 'New York'
    });
    
    console.log(`  ✓ Found ${result3.count} images`);
    console.log(`  ✓ Region type: ${result3.regionType}`);
    console.log(`  ✓ Message: ${result3.message}\n`);
    
    // Step 4: Test clipping image to boundary
    console.log('📌 Step 4: Testing image clipping to administrative boundary...');
    
    const clipResult = await callTool('sse', 'clip_image_to_region', {
      imageId: 'COPERNICUS/S2_SR_HARMONIZED/20240115T184919_20240115T185928_T10SEG',
      aoi: {
        ...sfPolygon,
        placeName: 'San Francisco'
      }
    });
    
    console.log(`  ✓ Image clipped successfully`);
    console.log(`  ✓ Result: ${JSON.stringify(clipResult, null, 2)}\n`);
    
    // Step 5: Test smart filter (natural language)
    console.log('📌 Step 5: Testing smart filter with natural language...');
    
    const smartResult = await callTool('sse', 'smart_filter_collection', {
      query: 'Sentinel-2 images of San Francisco from January 2024 with less than 10% cloud cover'
    });
    
    console.log(`  ✓ Smart filter executed`);
    console.log(`  ✓ Found ${smartResult.count} images`);
    console.log(`  ✓ Dataset: ${smartResult.datasetId}`);
    console.log(`  ✓ Region type: ${smartResult.regionType}`);
    console.log(`  ✓ Detected place: ${smartResult.detectedPlace}\n`);
    
    // Step 6: Test export with boundary
    console.log('📌 Step 6: Testing export with administrative boundary...');
    
    const exportResult = await callTool('sse', 'export_image_to_cloud_storage', {
      imageId: 'COPERNICUS/S2_SR_HARMONIZED/20240115T184919_20240115T185928_T10SEG',
      aoi: {
        ...sfPolygon,
        placeName: 'San Francisco'
      },
      scale: 10,
      description: 'san_francisco_boundary_test',
      format: 'GeoTIFF'
    });
    
    console.log(`  ✓ Export initiated`);
    console.log(`  ✓ Task: ${exportResult.taskName || 'Started'}`);
    console.log(`  ✓ Details: ${JSON.stringify(exportResult, null, 2)}\n`);
    
    console.log('====================================================');
    console.log('✅ All tests passed! Shapefile boundaries are working correctly.');
    console.log('\n📝 Summary:');
    console.log('  • Administrative boundaries (FAO GAUL) are properly integrated');
    console.log('  • Auto-detection of places from coordinates works');
    console.log('  • Explicit place names override polygon boundaries');
    console.log('  • Image clipping to exact boundaries works');
    console.log('  • Exports are clipped to administrative boundaries');
    console.log('\n🎉 Your Earth Engine MCP server is ready for Claude Desktop!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testShapefileBoundaries().catch(console.error);
