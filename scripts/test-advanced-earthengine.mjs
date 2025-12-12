#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs';
import readline from 'readline';
import path from 'path';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Get server URL from command-line args or use default
const SERVER_URL = process.argv[2] || 'http://localhost:3000';

// Test area - San Francisco area
const TEST_GEOMETRY = {
  type: "Polygon",
  coordinates: [
    [
      [-122.51, 37.77],
      [-122.51, 37.78],
      [-122.50, 37.78],
      [-122.50, 37.77],
      [-122.51, 37.77]
    ]
  ]
};

// Helper function to make MCP calls
async function callMcpTool(toolName, params) {
  console.log(`\nCalling ${toolName} with params:`, JSON.stringify(params, null, 2));
  
  try {
    const response = await fetch(`${SERVER_URL}/http`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'tool_call',
        tool: {
          name: toolName,
          parameters: params
        }
      }),
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      console.error(await response.text());
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling MCP tool:', error);
    return null;
  }
}

// Main function to run the advanced demo
async function runAdvancedDemo() {
  console.log(`\n🚀 Advanced Earth Engine MCP Tools Demo`);
  console.log(`Server URL: ${SERVER_URL}`);
  console.log('---------------------------------------\n');

  // Ask for private key JSON directly
  rl.question('Enter path to service account private key JSON file (or paste the JSON content directly): ', async (input) => {
    let privateKeyJson = input.trim();
    
    // Check if input is a file path
    if (privateKeyJson.endsWith('.json') && fs.existsSync(path.resolve(privateKeyJson))) {
      try {
        privateKeyJson = fs.readFileSync(path.resolve(privateKeyJson), 'utf8');
        console.log('Loaded service account JSON from file.');
      } catch (error) {
        console.error(`Error loading private key from ${privateKeyJson}:`, error.message);
        process.exit(1);
      }
    } else {
      console.log('Using provided JSON string for authentication.');
    }
    
    // Try to authenticate
    console.log('\n🔐 Initializing Earth Engine with provided service account JSON...');
    const authResult = await callMcpTool('earthengine_initialize', { privateKeyJson });
    
    if (!authResult || !authResult.content[0].text.includes('successfully')) {
      console.error('❌ Authentication failed. Please check your service account JSON and try again.');
      process.exit(1);
    }
    
    console.log('✅ Authentication successful!');
    
    // Demo workflow: a complete processing pipeline for Landsat 8 imagery
    await advancedWorkflow();
  });
}

// Function to demonstrate a complete advanced Earth Engine workflow
async function advancedWorkflow() {
  console.log('\n📋 Demonstrating a complete advanced Earth Engine workflow:');
  console.log('1. Get a Landsat 8 collection');
  console.log('2. Filter by date, bounds, and cloud cover');
  console.log('3. Create a cloud-masked composite');
  console.log('4. Calculate NDVI');
  console.log('5. Perform a time series analysis');
  console.log('6. Apply a custom band expression');
  console.log('7. Export to Google Drive');
  
  rl.question('\nPress Enter to begin the workflow or type "exit" to quit: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      console.log('Exiting demo. Goodbye! 👋');
      rl.close();
      return;
    }
    
    // Step 1: Get Landsat 8 collection
    console.log('\n\n📚 Step 1: Getting information about Landsat 8 collection...');
    const collectionResult = await callMcpTool('earthengine_get_collection', {
      collectionId: 'LANDSAT/LC08/C02/T1_TOA'
    });
    
    if (collectionResult) {
      console.log('\nCollection information:');
      collectionResult.content.forEach(item => console.log(item.text));
    }
    
    // Step 2: Filter collection
    console.log('\n\n🔍 Step 2: Filtering Landsat 8 collection by date, bounds, and cloud cover...');
    
    // Filter by date
    console.log('\n2.1: Filtering by date (2020-01-01 to 2020-12-31)...');
    const dateFilterResult = await callMcpTool('earthengine_filter_by_date', {
      collectionId: 'LANDSAT/LC08/C02/T1_TOA',
      startDate: '2020-01-01',
      endDate: '2020-12-31'
    });
    
    if (dateFilterResult) {
      console.log('\nDate filter results:');
      dateFilterResult.content.forEach(item => console.log(item.text));
    }
    
    // Filter by bounds
    console.log('\n2.2: Filtering by geographic bounds (San Francisco area)...');
    const boundsFilterResult = await callMcpTool('earthengine_filter_by_bounds', {
      collectionId: 'LANDSAT/LC08/C02/T1_TOA',
      geometry: TEST_GEOMETRY
    });
    
    if (boundsFilterResult) {
      console.log('\nBounds filter results:');
      boundsFilterResult.content.forEach(item => console.log(item.text));
    }
    
    // Filter by metadata (cloud cover)
    console.log('\n2.3: Filtering by cloud cover (less than 20%)...');
    const metadataFilterResult = await callMcpTool('earthengine_filter_by_metadata', {
      collectionId: 'LANDSAT/LC08/C02/T1_TOA',
      property: 'CLOUD_COVER',
      operator: 'less_than',
      value: 20
    });
    
    if (metadataFilterResult) {
      console.log('\nMetadata filter results:');
      metadataFilterResult.content.forEach(item => console.log(item.text));
    }
    
    // Step 3: Create cloud-masked composite
    console.log('\n\n☁️ Step 3: Creating a cloud-masked composite image...');
    const compositeResult = await callMcpTool('earthengine_create_composite', {
      collectionId: 'LANDSAT/LC08/C02/T1_TOA',
      method: 'median',
      startDate: '2020-01-01',
      endDate: '2020-12-31',
      geometry: TEST_GEOMETRY,
      cloudCoverMax: 20,
      visParams: {
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 0.3
      }
    });
    
    if (compositeResult) {
      console.log('\nComposite image results:');
      compositeResult.content.forEach(item => console.log(item.text));
    }
    
    let compositeImageId = '';
    if (compositeResult && compositeResult.content && compositeResult.content[0]) {
      const text = compositeResult.content[0].text;
      // Try to extract the image ID if available
      const match = text.match(/Image ID: (.*?)(?:\n|$)/);
      if (match && match[1]) {
        compositeImageId = match[1].trim();
      }
    }
    
    // Step 4: Calculate NDVI
    console.log('\n\n🌱 Step 4: Calculating NDVI (Normalized Difference Vegetation Index)...');
    const ndviResult = await callMcpTool('earthengine_calculate_index', {
      imageId: compositeImageId || 'LANDSAT/LC08/C02/T1_TOA/LC08_044034_20200321',
      bandA: 'B5', // NIR
      bandB: 'B4', // RED
      visParams: {
        min: -1,
        max: 1,
        palette: ['blue', 'white', 'green']
      }
    });
    
    if (ndviResult) {
      console.log('\nNDVI calculation results:');
      ndviResult.content.forEach(item => console.log(item.text));
    }
    
    // Step 5: Time series analysis
    console.log('\n\n📈 Step 5: Performing time series analysis on Landsat 8 data...');
    const timeSeriesResult = await callMcpTool('earthengine_time_series', {
      collectionId: 'LANDSAT/LC08/C02/T1_TOA',
      geometry: TEST_GEOMETRY,
      startDate: '2020-01-01',
      endDate: '2020-12-31',
      bands: ['B4', 'B5']
    });
    
    if (timeSeriesResult) {
      console.log('\nTime series analysis results:');
      timeSeriesResult.content.forEach(item => console.log(item.text));
    }
    
    // Step 6: Apply custom band expression
    console.log('\n\n⚗️ Step 6: Applying a custom band expression (Tasseled Cap Brightness)...');
    const expressionResult = await callMcpTool('earthengine_apply_expression', {
      imageId: compositeImageId || 'LANDSAT/LC08/C02/T1_TOA/LC08_044034_20200321',
      expression: "(0.3029 * b('B2')) + (0.2786 * b('B3')) + (0.4733 * b('B4')) + (0.5599 * b('B5')) + (0.508 * b('B6')) + (0.1872 * b('B7'))",
      visParams: {
        min: 0,
        max: 0.5
      }
    });
    
    if (expressionResult) {
      console.log('\nCustom expression results:');
      expressionResult.content.forEach(item => console.log(item.text));
    }
    
    // Step 7: Export to Google Drive
    console.log('\n\n💾 Step 7: Exporting NDVI results to Google Drive...');
    rl.question('Do you want to export to Google Drive? (yes/no, default: no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        const exportResult = await callMcpTool('earthengine_export_to_drive', {
          imageId: compositeImageId || 'LANDSAT/LC08/C02/T1_TOA/LC08_044034_20200321',
          description: 'NDVI_Landsat8_SF',
          folder: 'Earth_Engine_Exports',
          geometry: TEST_GEOMETRY,
          scale: 30,
          maxPixels: 1e9
        });
        
        if (exportResult) {
          console.log('\nExport results:');
          exportResult.content.forEach(item => console.log(item.text));
          
          // Get task ID for status check
          let taskId = '';
          if (exportResult && exportResult.content && exportResult.content[0]) {
            const text = exportResult.content[0].text;
            const match = text.match(/Task ID: (.*?)(?:\n|$)/);
            if (match && match[1]) {
              taskId = match[1].trim();
              
              // Check task status
              console.log('\nChecking task status...');
              const statusResult = await callMcpTool('earthengine_task_status', {
                taskId: taskId
              });
              
              if (statusResult) {
                console.log('\nTask status:');
                statusResult.content.forEach(item => console.log(item.text));
              }
            }
          }
        }
      } else {
        console.log('Skipping export to Google Drive.');
      }
      
      // Workflow complete
      console.log('\n\n✅ Advanced Earth Engine workflow demonstration complete!');
      console.log('This demo showcased the powerful capabilities of the Earth Engine MCP tools.');
      console.log('You can now use these tools in your own applications.');
      
      rl.close();
    });
  });
}

// Start the demo
runAdvancedDemo(); 