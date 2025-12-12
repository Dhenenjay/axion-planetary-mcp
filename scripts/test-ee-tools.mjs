#!/usr/bin/env node
import fetch from 'node-fetch';

const BASE_URL = process.argv[2] || 'http://localhost:3000';

console.log('🌍 Earth Engine MCP Server Test Client');
console.log('=====================================');
console.log(`Server: ${BASE_URL}`);
console.log('');

// Test health endpoint
async function testHealth() {
  console.log('📋 Testing Health Check...');
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    console.log('✅ Health:', data);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

// Test MCP tools via direct API calls (simplified demo)
async function testTools() {
  console.log('\n🔧 Testing Earth Engine Tools...');
  
  const tools = [
    {
      name: 'health_check',
      description: 'Basic server health',
      params: {}
    },
    {
      name: 'auth_check',
      description: 'Earth Engine authentication',
      params: {}
    },
    {
      name: 'search_gee_catalog',
      description: 'Search for Sentinel-2 datasets',
      params: { query: 'sentinel-2' }
    },
    {
      name: 'get_dataset_band_names',
      description: 'Get Sentinel-2 bands',
      params: { datasetId: 'COPERNICUS/S2_SR' }
    },
    {
      name: 'filter_collection_by_date_and_region',
      description: 'Filter Sentinel-2 for San Francisco',
      params: {
        datasetId: 'COPERNICUS/S2_SR',
        aoi: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        },
        start: '2024-01-01',
        end: '2024-12-31'
      }
    }
  ];

  console.log(`\nAvailable tools to test: ${tools.length}`);
  
  for (const tool of tools) {
    console.log(`\n📌 Tool: ${tool.name}`);
    console.log(`   ${tool.description}`);
    console.log(`   Params:`, JSON.stringify(tool.params, null, 2).split('\n').join('\n   '));
  }

  console.log('\n💡 To execute these tools:');
  console.log('   1. Configure your .env.local with Earth Engine credentials');
  console.log('   2. Use an MCP client (Claude Desktop, etc.) connected to:');
  console.log(`      ${BASE_URL}/api/mcp/sse`);
  console.log('   3. Or use the interactive test script: test-interactive.mjs');
}

// Demo workflow
async function demoWorkflow() {
  console.log('\n📊 Example Workflow: NDVI Analysis');
  console.log('===================================');
  
  const workflow = [
    {
      step: 1,
      tool: 'search_gee_catalog',
      description: 'Find Sentinel-2 Surface Reflectance dataset',
      params: { query: 'COPERNICUS S2 SR' }
    },
    {
      step: 2,
      tool: 'filter_collection_by_date_and_region',
      description: 'Filter for summer 2024 in California',
      params: {
        datasetId: 'COPERNICUS/S2_SR',
        aoi: {
          type: 'Polygon',
          coordinates: [[
            [-122.5, 37.5],
            [-122.0, 37.5],
            [-122.0, 38.0],
            [-122.5, 38.0],
            [-122.5, 37.5]
          ]]
        },
        start: '2024-06-01',
        end: '2024-08-31'
      }
    },
    {
      step: 3,
      tool: 'calculate_spectral_index',
      description: 'Calculate NDVI',
      params: {
        imageId: 'COPERNICUS/S2_SR/20240615T183919_20240615T184851_T10SEG',
        index: 'NDVI',
        mapping: {
          nir: 'B8',
          red: 'B4'
        }
      }
    },
    {
      step: 4,
      tool: 'get_map_visualization_url',
      description: 'Generate map tiles for visualization',
      params: {
        imageId: '<ndvi_result>',
        visParams: {
          bands: ['NDVI'],
          min: 0,
          max: 1,
          palette: ['red', 'yellow', 'green']
        }
      }
    },
    {
      step: 5,
      tool: 'calculate_summary_statistics',
      description: 'Get NDVI statistics for the region',
      params: {
        imageId: '<ndvi_result>',
        aoi: { /* same as step 2 */ },
        scale: 10
      }
    }
  ];

  console.log('\nWorkflow Steps:');
  for (const step of workflow) {
    console.log(`\nStep ${step.step}: ${step.tool}`);
    console.log(`  Purpose: ${step.description}`);
    console.log(`  Sample params:`, JSON.stringify(step.params, null, 2).split('\n').slice(0, 5).join('\n  '));
  }

  console.log('\n📝 To run this workflow:');
  console.log('   1. Start the server: pnpm dev');
  console.log('   2. Connect your MCP client');
  console.log('   3. Execute tools in sequence');
  console.log('   4. View results in map tiles or export to GCS');
}

// List all available tools
function listAllTools() {
  console.log('\n📚 Complete Tool List (23 tools)');
  console.log('================================');
  
  const categories = {
    '🔐 Authentication': [
      'health_check - Server health status',
      'auth_check - Verify Earth Engine connection'
    ],
    '🔍 Discovery': [
      'search_gee_catalog - Search datasets',
      'filter_collection_by_date_and_region - Filter collections',
      'get_dataset_band_names - Get band information'
    ],
    '🖼️ Processing': [
      'load_cloud_optimized_geotiff - Load COGs',
      'mask_clouds_from_image - Remove clouds',
      'create_clean_mosaic - Median composites',
      'clip_image_to_region - Spatial clipping',
      'resample_image_to_resolution - Change resolution',
      'calculate_spectral_index - NDVI/EVI/NDWI',
      'detect_change_between_images - Change detection',
      'calculate_slope_and_aspect - Terrain analysis'
    ],
    '📊 Analysis': [
      'calculate_summary_statistics - Regional stats',
      'calculate_zonal_statistics - Multi-zone analysis',
      'create_time_series_chart_for_region - Temporal analysis'
    ],
    '🗺️ Visualization': [
      'get_map_visualization_url - Web map tiles',
      'get_thumbnail_image - Static previews'
    ],
    '💾 Export': [
      'export_image_to_cloud_storage - Export to GCS',
      'get_export_task_status - Monitor exports'
    ],
    '🔧 Advanced': [
      'gee_script_js - Custom JavaScript',
      'gee_sdk_call - Chain operations'
    ]
  };

  for (const [category, tools] of Object.entries(categories)) {
    console.log(`\n${category}`);
    for (const tool of tools) {
      console.log(`  • ${tool}`);
    }
  }
}

// Main execution
async function main() {
  try {
    await testHealth();
    await testTools();
    await demoWorkflow();
    listAllTools();
    
    console.log('\n✨ Test client complete!');
    console.log('\n🚀 Next steps:');
    console.log('   1. Configure .env.local with your Earth Engine credentials');
    console.log('   2. Run: pnpm dev');
    console.log('   3. Connect MCP client to:', `${BASE_URL}/api/mcp/sse`);
    console.log('   4. Start processing satellite imagery!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the test client
main().catch(console.error);
