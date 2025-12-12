#!/usr/bin/env node

// Direct test of shapefile functionality
async function testShapefiles() {
  console.log('Testing Shapefile Boundaries...\n');
  
  const testUrl = 'http://localhost:3000/sse';  // SSE endpoint for MCP tools
  
  // Test 1: List available tools
  console.log('1. Listing available tools...');
  const listResponse = await fetch(testUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'tools/list',
      params: {}
    })
  });
  
  const tools = await listResponse.json();
  console.log(`   Found ${tools.tools?.length || 0} tools`);
  
  // Find filter tool
  const filterTool = tools.tools?.find(t => 
    t.name === 'filter_collection_by_date_and_region' || 
    t.name === 'filter_collection'
  );
  console.log(`   Filter tool: ${filterTool?.name || 'NOT FOUND'}\n`);
  
  // Test 2: Call filter with San Francisco coordinates
  console.log('2. Testing San Francisco filter with coordinates...');
  const sfPolygon = {
    type: 'Polygon',
    coordinates: [[
      [-122.75, 37.45],
      [-122.75, 37.85],
      [-122.35, 37.85],
      [-122.35, 37.45],
      [-122.75, 37.45]
    ]]
  };
  
  const filterResponse = await fetch(testUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'tools/call',
      params: {
        name: 'filter_collection_by_date_and_region',
        arguments: {
          datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
          aoi: sfPolygon,
          start: '2024-01-01',
          end: '2024-01-31'
        }
      }
    })
  });
  
  const filterResult = await filterResponse.json();
  console.log('   Result:', JSON.stringify(filterResult, null, 2));
  
  // Check if shapefile was used
  if (filterResult.result?.regionType === 'SHAPEFILE_BOUNDARY') {
    console.log('   ✅ SUCCESS: Using shapefile boundary!');
    console.log(`   Area: ${filterResult.result.area} km²`);
  } else {
    console.log('   ❌ FAILURE: Still using polygon');
    console.log('   Message:', filterResult.result?.message);
  }
  
  // Test 3: Try with explicit place name
  console.log('\n3. Testing with explicit place name...');
  const placeResponse = await fetch(testUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'tools/call',
      params: {
        name: 'filter_collection_by_date_and_region',
        arguments: {
          datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
          aoi: sfPolygon,
          start: '2024-01-01',
          end: '2024-01-31',
          placeName: 'San Francisco'
        }
      }
    })
  });
  
  const placeResult = await placeResponse.json();
  console.log('   Result:', JSON.stringify(placeResult, null, 2));
  
  if (placeResult.result?.regionType === 'SHAPEFILE_BOUNDARY') {
    console.log('   ✅ SUCCESS: Using shapefile boundary!');
  } else {
    console.log('   ❌ FAILURE: Still using polygon');
  }
}

testShapefiles().catch(console.error);
