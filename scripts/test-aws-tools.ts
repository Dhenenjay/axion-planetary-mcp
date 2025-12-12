/**
 * Test script for AWS-native Axion tools
 * Run with: npx tsx scripts/test-aws-tools.ts
 */

import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

// Import registry first, then tools
import { list, get } from '../src/mcp/registry';

// Import tools to register them
import '../src/mcp/tools-aws';

async function testTools() {
  console.log('=== Axion AWS Tools Test ===\n');
  
  // List registered tools
  const tools = list();
  console.log(`Registered tools (${tools.length}):`);
  tools.forEach(t => console.log(`  - ${t.name}`));
  console.log();
  
  // Test axion_system health check
  console.log('--- Testing axion_system (health) ---');
  try {
    const systemTool = get('axion_system');
    const healthResult = await systemTool.handler({ operation: 'health' });
    console.log('Health check result:');
    console.log(JSON.stringify(healthResult, null, 2));
  } catch (error: any) {
    console.error('Health check failed:', error.message);
  }
  console.log();
  
  // Test axion_data collections
  console.log('--- Testing axion_data (collections) ---');
  try {
    const dataTool = get('axion_data');
    const collectionsResult = await dataTool.handler({ operation: 'collections' });
    console.log('Collections result:');
    console.log(`  Total collections: ${collectionsResult.totalCount}`);
    console.log('  Popular collections:');
    collectionsResult.popularCollections?.forEach((c: any) => {
      console.log(`    - ${c.id}: ${c.description}`);
    });
  } catch (error: any) {
    console.error('Collections failed:', error.message);
  }
  console.log();
  
  // Test axion_data search
  console.log('--- Testing axion_data (search) ---');
  try {
    const dataTool = get('axion_data');
    const searchResult = await dataTool.handler({
      operation: 'search',
      collectionId: 'sentinel-2-l2a',
      bbox: '-122.5,37.5,-122.0,38.0',
      startDate: '2024-06-01',
      endDate: '2024-06-30',
      cloudCoverMax: 20,
      limit: 3
    });
    console.log('Search result:', searchResult.success ? 'SUCCESS' : 'FAILED');
    if (searchResult.success) {
      console.log(`  Found ${searchResult.count} items`);
    } else {
      console.log(`  Error: ${searchResult.error}`);
    }
  } catch (error: any) {
    console.error('Search failed:', error.message);
  }
  console.log();
  
  // Test axion_process NDVI
  console.log('--- Testing axion_process (ndvi) ---');
  try {
    const processTool = get('axion_process');
    const ndviResult = await processTool.handler({
      operation: 'ndvi',
      collectionId: 'sentinel-2-l2a',
      bbox: '-122.5,37.5,-122.0,38.0',
      startDate: '2024-06-01',
      endDate: '2024-06-30',
      cloudCoverMax: 20,
      limit: 2
    });
    console.log('NDVI result:');
    console.log(`  Images found: ${ndviResult.imageCount}`);
    console.log(`  Formula: ${ndviResult.index?.formula}`);
    console.log(`  Sample image: ${ndviResult.sampleImages?.[0]?.itemId}`);
  } catch (error: any) {
    console.error('NDVI failed:', error.message);
  }
  console.log();
  
  // Test axion_export thumbnail
  console.log('--- Testing axion_export (thumbnail) ---');
  try {
    const exportTool = get('axion_export');
    const thumbnailResult = await exportTool.handler({
      operation: 'thumbnail',
      collectionId: 'sentinel-2-l2a',
      bbox: '-122.5,37.5,-122.0,38.0',
      startDate: '2024-06-01',
      endDate: '2024-06-30'
    });
    console.log('Thumbnail result:', thumbnailResult.success ? 'SUCCESS' : 'FAILED');
    if (thumbnailResult.success) {
      console.log(`  Item: ${thumbnailResult.itemId}`);
      console.log(`  Source: ${thumbnailResult.source}`);
    } else {
      console.log(`  Error: ${thumbnailResult.error}`);
    }
  } catch (error: any) {
    console.error('Thumbnail failed:', error.message);
  }
  
  console.log('\n=== All tests completed ===');
}

testTools().catch(console.error);
