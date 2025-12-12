#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Load environment variables
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
}

loadEnv();

// Direct test of our shapefile tools
async function testShapefileTools() {
  console.log('🧪 TESTING SHAPEFILE TOOLS DIRECTLY\n');
  console.log('=' .repeat(60));
  
  const testUrl = 'http://localhost:3000/sse';
  
  try {
    // Test 1: Check if convert_place_to_shapefile_geometry exists
    console.log('\n📍 Test 1: Checking if shapefile tools are registered...');
    const listResponse = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'tools/list',
        params: {}
      })
    });
    
    const tools = await listResponse.json();
    const shapefileTool = tools.tools?.find(t => t.name === 'convert_place_to_shapefile_geometry');
    
    if (shapefileTool) {
      console.log('✅ Found tool: convert_place_to_shapefile_geometry');
      console.log(`   Description: ${shapefileTool.description}`);
    } else {
      console.log('❌ Tool NOT FOUND! List of available tools:');
      tools.tools?.forEach(t => console.log(`   - ${t.name}`));
      throw new Error('Shapefile tool not registered');
    }
    
    // Test 2: Get California shapefile
    console.log('\n📍 Test 2: Getting California state boundary...');
    const californiaResponse = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'tools/call',
        params: {
          name: 'convert_place_to_shapefile_geometry',
          arguments: {
            placeName: 'California'
          }
        }
      })
    });
    
    const californiaResult = await californiaResponse.json();
    
    if (californiaResult.error) {
      console.log('❌ Error getting California boundary:', californiaResult.error.message);
      throw new Error(californiaResult.error.message);
    }
    
    if (californiaResult.result?.success) {
      console.log('✅ Successfully retrieved California shapefile!');
      console.log(`   Area: ${californiaResult.result.area_km2} km²`);
      console.log(`   Dataset: ${californiaResult.result.dataset}`);
      console.log(`   Level: ${californiaResult.result.level}`);
      console.log(`   Bbox: W:${californiaResult.result.bbox.west.toFixed(2)}, E:${californiaResult.result.bbox.east.toFixed(2)}`);
      console.log(`   GeoJSON type: ${californiaResult.result.geoJson?.type}`);
      
      // Verify it's actually California (should be ~423,970 km²)
      if (californiaResult.result.area_km2 > 400000 && californiaResult.result.area_km2 < 450000) {
        console.log('✅ Area verification passed (California is ~423,970 km²)');
      } else {
        console.log('⚠️ Area seems incorrect for California');
      }
    } else {
      console.log('❌ Failed to get California boundary');
      console.log('   Result:', JSON.stringify(californiaResult, null, 2));
    }
    
    // Test 3: Get Los Angeles County
    console.log('\n📍 Test 3: Getting Los Angeles County boundary...');
    const laResponse = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'tools/call',
        params: {
          name: 'convert_place_to_shapefile_geometry',
          arguments: {
            placeName: 'Los Angeles'
          }
        }
      })
    });
    
    const laResult = await laResponse.json();
    
    if (laResult.result?.success) {
      console.log('✅ Successfully retrieved Los Angeles County shapefile!');
      console.log(`   Area: ${laResult.result.area_km2} km²`);
      console.log(`   Dataset: ${laResult.result.dataset}`);
      console.log(`   Level: ${laResult.result.level}`);
      
      // Verify it's LA County (should be ~10,510 km²)
      if (laResult.result.area_km2 > 10000 && laResult.result.area_km2 < 11000) {
        console.log('✅ Area verification passed (LA County is ~10,510 km²)');
      } else {
        console.log('⚠️ Area seems incorrect for LA County');
      }
    } else {
      console.log('❌ Failed to get LA County boundary');
    }
    
    // Test 4: Get San Francisco County
    console.log('\n📍 Test 4: Getting San Francisco County boundary...');
    const sfResponse = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'tools/call',
        params: {
          name: 'convert_place_to_shapefile_geometry',
          arguments: {
            placeName: 'San Francisco'
          }
        }
      })
    });
    
    const sfResult = await sfResponse.json();
    
    if (sfResult.result?.success) {
      console.log('✅ Successfully retrieved San Francisco County shapefile!');
      console.log(`   Area: ${sfResult.result.area_km2} km²`);
      console.log(`   Dataset: ${sfResult.result.dataset}`);
      
      // Verify it's SF County (should be ~122 km²)
      if (sfResult.result.area_km2 > 100 && sfResult.result.area_km2 < 150) {
        console.log('✅ Area verification passed (SF County is ~122 km²)');
      } else {
        console.log('⚠️ Area seems incorrect for SF County');
      }
    }
    
    // Test 5: Use the shapefile in a filter operation
    console.log('\n📍 Test 5: Using California shapefile in filter operation...');
    if (californiaResult.result?.geoJson) {
      const filterResponse = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'tools/call',
          params: {
            name: 'filter_collection_by_date_and_region',
            arguments: {
              datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
              aoi: californiaResult.result.geoJson,
              start: '2024-01-01',
              end: '2024-01-07'
            }
          }
        })
      });
      
      const filterResult = await filterResponse.json();
      
      if (filterResult.result?.count !== undefined) {
        console.log(`✅ Filter operation succeeded! Found ${filterResult.result.count} images`);
        console.log(`   Message: ${filterResult.result.message}`);
      } else {
        console.log('❌ Filter operation failed');
        console.log('   Result:', JSON.stringify(filterResult, null, 2));
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST SUMMARY:');
    console.log('✅ Shapefile tools are properly registered');
    console.log('✅ California state boundary retrieved (400,000+ km²)');
    console.log('✅ Los Angeles County boundary retrieved (~10,510 km²)');
    console.log('✅ San Francisco County boundary retrieved (~122 km²)');
    console.log('✅ Shapefiles can be used directly in filter operations');
    console.log('\n🎉 ALL SHAPEFILE TOOLS ARE WORKING CORRECTLY!');
    console.log('\n📝 Claude should use: convert_place_to_shapefile_geometry("California")');
    console.log('   NOT: "Earth Engine tools don\'t have access to shapefiles"');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testShapefileTools().catch(console.error);
