import dotenv from 'dotenv';
// Load default .env then override with .env.local if present
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

// AWS Region
export const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// STAC Endpoint
export const STAC_ENDPOINT = process.env.AXION_STAC_ENDPOINT || 'https://earth-search.aws.element84.com/v1';

// S3 Buckets
export const S3_EXPORTS_BUCKET = process.env.AXION_S3_EXPORTS_BUCKET || '';
export const S3_TILES_BUCKET = process.env.AXION_S3_TILES_BUCKET || '';
export const S3_BOUNDARIES_BUCKET = process.env.AXION_S3_BOUNDARIES_BUCKET || '';

// Legacy alias
export const EXPORTS_BUCKET = S3_EXPORTS_BUCKET;

// DynamoDB Tables
export const DYNAMODB_SESSIONS_TABLE = process.env.AXION_DYNAMODB_SESSIONS_TABLE || '';
export const DYNAMODB_TASKS_TABLE = process.env.AXION_DYNAMODB_TASKS_TABLE || '';
export const DYNAMODB_BOUNDARIES_TABLE = process.env.AXION_DYNAMODB_BOUNDARIES_TABLE || '';
export const DYNAMODB_CACHE_TABLE = process.env.AXION_DYNAMODB_CACHE_TABLE || '';

// Default STAC collections
export const DEFAULT_COLLECTIONS = [
  'sentinel-2-l2a',
  'landsat-c2-l2',
  'sentinel-1-grd'
];

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

// Check if AWS is configured
export function isAwsConfigured(): boolean {
  return !!(S3_EXPORTS_BUCKET && DYNAMODB_SESSIONS_TABLE);
}
