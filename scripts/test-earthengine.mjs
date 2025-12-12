#!/usr/bin/env node

import fetch from 'node-fetch';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Get server URL from command-line args or use default
const SERVER_URL = process.argv[2] || 'http://localhost:3000';

// Test data - simple visualization request
const TEST_DATASET_ID = 'USGS/SRTMGL1_003';
const TEST_VIS_PARAMS = {
  min: 0,
  max: 3000,
  palette: ['blue', 'green', 'red']
};

// Test geometry - San Francisco area
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

// Function to load private key from file
function loadPrivateKey(filePath) {
  try {
    const privateKeyJson = fs.readFileSync(filePath, 'utf8');
    return privateKeyJson;
  } catch (error) {
    console.error(`Error loading private key from ${filePath}:`, error.message);
    return null;
  }
}

// Function to run demo
async function runDemo() {
  console.log(`🌍 Earth Engine MCP Tools Demo`);
  console.log(`Server URL: ${SERVER_URL}`);
  console.log('---------------------------------------\n');

  // Ask for private key file
  rl.question('Enter path to your service account private key JSON file (leave empty to skip auth): ', async (keyPath) => {
    let isAuthenticated = false;

    // Try to authenticate if a key file was provided
    if (keyPath && keyPath.trim() !== '') {
      const privateKeyJson = loadPrivateKey(path.resolve(keyPath.trim()));
      
      if (privateKeyJson) {
        console.log('\n🔐 Initializing Earth Engine...');
        const authResult = await callMcpTool('earthengine_initialize', { privateKeyJson });
        
        if (authResult) {
          console.log(authResult.content[0].text);
          isAuthenticated = true;
        }
      }
    } else {
      console.log('\n⚠️ Skipping authentication. Some operations may fail without proper authentication.');
    }
    
    // Show menu of operations
    showMenu(isAuthenticated);
  });
}

// Function to show menu
function showMenu(isAuthenticated) {
  console.log('\n📋 Available operations:');
  console.log('  1. Visualize an Earth Engine dataset');
  console.log('  2. Get image information');
  console.log('  3. Compute statistics for a region');
  console.log('  4. Search datasets');
  console.log('  0. Exit');
  
  rl.question('\nEnter operation number: ', async (choice) => {
    switch (choice.trim()) {
      case '1':
        await visualizeDataset();
        break;
      case '2':
        await getImageInfo();
        break;
      case '3':
        await computeStatistics();
        break;
      case '4':
        await searchDatasets();
        break;
      case '0':
        console.log('Exiting demo. Goodbye! 👋');
        rl.close();
        return;
      default:
        console.log('Invalid choice. Please try again.');
        showMenu(isAuthenticated);
        return;
    }
  });
}

// Function to visualize dataset
async function visualizeDataset() {
  rl.question(`Enter dataset ID (default: ${TEST_DATASET_ID}): `, async (datasetId) => {
    if (!datasetId || datasetId.trim() === '') {
      datasetId = TEST_DATASET_ID;
    }
    
    console.log(`\n🖼️ Visualizing dataset: ${datasetId}...`);
    const result = await callMcpTool('earthengine_visualize_dataset', { 
      datasetId: datasetId.trim(),
      visParams: TEST_VIS_PARAMS
    });
    
    if (result) {
      result.content.forEach(item => console.log(item.text));
    }
    
    // Back to menu
    showMenu(true);
  });
}

// Function to get image info
async function getImageInfo() {
  rl.question(`Enter dataset ID (default: ${TEST_DATASET_ID}): `, async (datasetId) => {
    if (!datasetId || datasetId.trim() === '') {
      datasetId = TEST_DATASET_ID;
    }
    
    console.log(`\n📊 Getting info for dataset: ${datasetId}...`);
    const result = await callMcpTool('earthengine_get_image_info', { 
      datasetId: datasetId.trim() 
    });
    
    if (result) {
      result.content.forEach(item => console.log(item.text));
    }
    
    // Back to menu
    showMenu(true);
  });
}

// Function to compute statistics
async function computeStatistics() {
  rl.question(`Enter dataset ID (default: ${TEST_DATASET_ID}): `, async (datasetId) => {
    if (!datasetId || datasetId.trim() === '') {
      datasetId = TEST_DATASET_ID;
    }
    
    console.log(`\n📈 Computing statistics for dataset: ${datasetId}...`);
    const result = await callMcpTool('earthengine_compute_stats', { 
      datasetId: datasetId.trim(),
      geometry: TEST_GEOMETRY,
      scale: 90
    });
    
    if (result) {
      result.content.forEach(item => console.log(item.text));
    }
    
    // Back to menu
    showMenu(true);
  });
}

// Function to search datasets
async function searchDatasets() {
  rl.question('Enter search query: ', async (query) => {
    if (!query || query.trim() === '') {
      console.log('Search query cannot be empty.');
      showMenu(true);
      return;
    }
    
    console.log(`\n🔍 Searching for datasets with query: "${query}"...`);
    const result = await callMcpTool('earthengine_search_datasets', { 
      query: query.trim() 
    });
    
    if (result) {
      result.content.forEach(item => console.log(item.text));
    }
    
    // Back to menu
    showMenu(true);
  });
}

// Start the demo
runDemo(); 