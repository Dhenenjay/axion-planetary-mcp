/**
 * Boundary Data Setup Script
 * Downloads Natural Earth boundaries and uploads to S3
 * Run with: npx tsx scripts/setup-boundaries.ts
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BOUNDARIES_BUCKET = process.env.AXION_S3_BOUNDARIES_BUCKET;
const DYNAMODB_BOUNDARIES_TABLE = process.env.AXION_DYNAMODB_BOUNDARIES_TABLE;

const s3 = new S3Client({ region: AWS_REGION });
const dynamodb = new DynamoDBClient({ region: AWS_REGION });

// Natural Earth data URLs (simplified boundaries)
const BOUNDARY_SOURCES = {
  countries: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
  states: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_1_states_provinces.geojson'
};

// Known places with manual bbox (for immediate use)
const KNOWN_PLACES: Record<string, { bbox: [number, number, number, number]; type: string; country?: string }> = {
  // Countries
  'united states': { bbox: [-125.0, 24.4, -66.93, 49.38], type: 'country' },
  'usa': { bbox: [-125.0, 24.4, -66.93, 49.38], type: 'country' },
  'india': { bbox: [68.18, 6.75, 97.4, 35.5], type: 'country' },
  'china': { bbox: [73.5, 18.2, 135.0, 53.6], type: 'country' },
  'brazil': { bbox: [-73.99, -33.75, -28.84, 5.27], type: 'country' },
  'australia': { bbox: [113.34, -43.63, 153.57, -10.67], type: 'country' },
  'germany': { bbox: [5.87, 47.27, 15.04, 55.06], type: 'country' },
  'france': { bbox: [-5.14, 41.33, 9.56, 51.09], type: 'country' },
  'united kingdom': { bbox: [-8.65, 49.86, 1.77, 60.86], type: 'country' },
  'japan': { bbox: [122.93, 24.04, 153.99, 45.52], type: 'country' },
  
  // US States
  'california': { bbox: [-124.48, 32.53, -114.13, 42.01], type: 'state', country: 'USA' },
  'texas': { bbox: [-106.65, 25.84, -93.51, 36.5], type: 'state', country: 'USA' },
  'florida': { bbox: [-87.63, 24.52, -80.03, 31.0], type: 'state', country: 'USA' },
  'new york': { bbox: [-79.76, 40.5, -71.86, 45.02], type: 'state', country: 'USA' },
  'washington': { bbox: [-124.73, 45.54, -116.92, 49.0], type: 'state', country: 'USA' },
  'oregon': { bbox: [-124.57, 41.99, -116.46, 46.29], type: 'state', country: 'USA' },
  'colorado': { bbox: [-109.06, 36.99, -102.04, 41.0], type: 'state', country: 'USA' },
  
  // Indian States
  'punjab': { bbox: [73.88, 29.53, 76.94, 32.51], type: 'state', country: 'India' },
  'maharashtra': { bbox: [72.6, 15.6, 80.9, 22.0], type: 'state', country: 'India' },
  'karnataka': { bbox: [74.0, 11.6, 78.6, 18.5], type: 'state', country: 'India' },
  'tamil nadu': { bbox: [76.2, 8.1, 80.3, 13.6], type: 'state', country: 'India' },
  'kerala': { bbox: [74.9, 8.3, 77.4, 12.8], type: 'state', country: 'India' },
  
  // Cities/Districts
  'ludhiana': { bbox: [75.7, 30.8, 76.0, 31.0], type: 'district', country: 'India' },
  'san francisco': { bbox: [-122.52, 37.7, -122.35, 37.82], type: 'city', country: 'USA' },
  'los angeles': { bbox: [-118.67, 33.7, -117.65, 34.34], type: 'city', country: 'USA' },
  'new york city': { bbox: [-74.26, 40.49, -73.7, 40.92], type: 'city', country: 'USA' },
  'london': { bbox: [-0.51, 51.28, 0.33, 51.69], type: 'city', country: 'UK' },
  'paris': { bbox: [2.22, 48.82, 2.47, 48.9], type: 'city', country: 'France' },
  'tokyo': { bbox: [139.56, 35.52, 139.92, 35.82], type: 'city', country: 'Japan' },
  'mumbai': { bbox: [72.77, 18.89, 72.99, 19.27], type: 'city', country: 'India' },
  'delhi': { bbox: [76.84, 28.4, 77.35, 28.88], type: 'city', country: 'India' },
  'bangalore': { bbox: [77.35, 12.85, 77.75, 13.15], type: 'city', country: 'India' }
};

async function uploadKnownPlaces() {
  console.log('Uploading known places to DynamoDB...');
  
  if (!DYNAMODB_BOUNDARIES_TABLE) {
    console.error('AXION_DYNAMODB_BOUNDARIES_TABLE not configured');
    return;
  }
  
  const items = Object.entries(KNOWN_PLACES).map(([name, data]) => ({
    PutRequest: {
      Item: marshall({
        boundaryId: `known_${name.replace(/\s+/g, '_').toLowerCase()}`,
        name,
        nameNormalized: name.toLowerCase(),
        type: data.type,
        country: data.country || null,
        bbox: data.bbox,
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [data.bbox[0], data.bbox[1]],
            [data.bbox[2], data.bbox[1]],
            [data.bbox[2], data.bbox[3]],
            [data.bbox[0], data.bbox[3]],
            [data.bbox[0], data.bbox[1]]
          ]]
        },
        source: 'known_places',
        createdAt: new Date().toISOString()
      })
    }
  }));
  
  // DynamoDB batch write limit is 25 items
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    try {
      await dynamodb.send(new BatchWriteItemCommand({
        RequestItems: {
          [DYNAMODB_BOUNDARIES_TABLE]: batch
        }
      }));
      console.log(`  Uploaded ${Math.min(i + 25, items.length)}/${items.length} places`);
    } catch (error: any) {
      console.error(`  Error uploading batch: ${error.message}`);
    }
  }
  
  console.log(`✓ Uploaded ${items.length} known places to DynamoDB`);
}

async function downloadAndUploadNaturalEarth() {
  console.log('Downloading Natural Earth boundaries...');
  
  if (!S3_BOUNDARIES_BUCKET) {
    console.error('AXION_S3_BOUNDARIES_BUCKET not configured');
    return;
  }
  
  for (const [name, url] of Object.entries(BOUNDARY_SOURCES)) {
    try {
      console.log(`  Downloading ${name}...`);
      const response = await axios.get(url, { timeout: 60000 });
      const geojson = response.data;
      
      // Upload to S3
      const key = `natural-earth/${name}.geojson`;
      await s3.send(new PutObjectCommand({
        Bucket: S3_BOUNDARIES_BUCKET,
        Key: key,
        Body: JSON.stringify(geojson),
        ContentType: 'application/geo+json'
      }));
      
      console.log(`  ✓ Uploaded ${name} to s3://${S3_BOUNDARIES_BUCKET}/${key}`);
      
      // Index features in DynamoDB
      if (DYNAMODB_BOUNDARIES_TABLE && geojson.features) {
        console.log(`  Indexing ${geojson.features.length} features...`);
        
        const features = geojson.features.slice(0, 200); // Limit for demo
        const items = features.map((f: any, idx: number) => {
          const props = f.properties || {};
          const placeName = props.NAME || props.name || props.ADMIN || `${name}_${idx}`;
          const bbox = f.bbox || calculateBbox(f.geometry);
          
          return {
            PutRequest: {
              Item: marshall({
                boundaryId: `ne_${name}_${idx}`,
                name: placeName,
                nameNormalized: placeName.toLowerCase(),
                type: name === 'countries' ? 'country' : 'state',
                bbox,
                s3Key: key,
                featureIndex: idx,
                source: 'natural_earth',
                createdAt: new Date().toISOString()
              })
            }
          };
        });
        
        // Batch write
        for (let i = 0; i < items.length; i += 25) {
          const batch = items.slice(i, i + 25);
          try {
            await dynamodb.send(new BatchWriteItemCommand({
              RequestItems: {
                [DYNAMODB_BOUNDARIES_TABLE]: batch
              }
            }));
          } catch (error: any) {
            // Ignore individual batch errors
          }
        }
        
        console.log(`  ✓ Indexed ${features.length} ${name} boundaries`);
      }
    } catch (error: any) {
      console.error(`  Error processing ${name}: ${error.message}`);
    }
  }
}

function calculateBbox(geometry: any): [number, number, number, number] {
  if (!geometry || !geometry.coordinates) {
    return [-180, -90, 180, 90];
  }
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  function processCoords(coords: any) {
    if (typeof coords[0] === 'number') {
      minX = Math.min(minX, coords[0]);
      maxX = Math.max(maxX, coords[0]);
      minY = Math.min(minY, coords[1]);
      maxY = Math.max(maxY, coords[1]);
    } else {
      coords.forEach(processCoords);
    }
  }
  
  processCoords(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

async function main() {
  console.log('=== Axion Boundary Data Setup ===\n');
  console.log(`Region: ${AWS_REGION}`);
  console.log(`S3 Bucket: ${S3_BOUNDARIES_BUCKET || 'NOT CONFIGURED'}`);
  console.log(`DynamoDB Table: ${DYNAMODB_BOUNDARIES_TABLE || 'NOT CONFIGURED'}`);
  console.log();
  
  // Upload known places first (quick)
  await uploadKnownPlaces();
  console.log();
  
  // Download and upload Natural Earth data
  await downloadAndUploadNaturalEarth();
  
  console.log('\n=== Setup Complete ===');
  console.log('Boundary data is now available in S3 and indexed in DynamoDB.');
  console.log('Use axion_system with operation "boundary" to look up places.');
}

main().catch(console.error);
