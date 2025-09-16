/**
 * Authentication module for Earth Engine MCP
 * Handles service account key management
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Decode service account JSON from environment variable or file
 */
export function decodeSaJson() {
  // First, try to load from file path (preferred for public users)
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (keyPath) {
    try {
      // This will be handled by the async function in client.ts
      // For now, return a placeholder that signals to use file loading
      return { useFile: true, path: keyPath };
    } catch (error) {
      console.error('Could not use service account key path:', error);
    }
  }
  
  // Fallback: Try to decode from base64 environment variable (legacy)
  const encoded = process.env.GEE_SA_KEY_JSON;
  
  if (encoded) {
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Could not decode service account from GEE_SA_KEY_JSON:', error);
    }
  }
  
  // Last resort: Try to construct from individual env variables
  const email = process.env.GEE_SA_EMAIL || process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  const projectId = process.env.GCP_PROJECT_ID;
  
  if (email && projectId) {
    console.warn('Using partial service account info from environment variables');
    console.warn('This may not work properly. Please set GOOGLE_APPLICATION_CREDENTIALS to your service account key file path.');
    
    return {
      client_email: email,
      project_id: projectId,
      // These would need to be provided somehow - this is a fallback
      private_key: process.env.GEE_SA_PRIVATE_KEY || '',
      private_key_id: process.env.GEE_SA_KEY_ID || 'unknown',
      type: 'service_account',
      client_id: process.env.GEE_SA_CLIENT_ID || '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs'
    };
  }
  
  throw new Error(
    'No service account credentials found. Please set GOOGLE_APPLICATION_CREDENTIALS to your service account key file path. ' +
    'See .env.example for instructions.'
  );
}

/**
 * Load service account from file asynchronously
 */
export async function loadServiceAccountFromFile(filePath: string) {
  try {
    const keyContent = await fs.readFile(filePath, 'utf-8');
    const key = JSON.parse(keyContent);
    
    // Validate required fields
    if (!key.client_email || !key.private_key || !key.project_id) {
      throw new Error('Invalid service account key: missing required fields');
    }
    
    return key;
  } catch (error: any) {
    throw new Error(`Failed to load service account key from ${filePath}: ${error.message}`);
  }
}

/**
 * Get the project ID from environment or service account
 */
export async function getProjectId(): Promise<string> {
  // First check if explicitly set
  if (process.env.GCP_PROJECT_ID && process.env.GCP_PROJECT_ID !== 'auto-detected') {
    return process.env.GCP_PROJECT_ID;
  }
  
  // Try to get from service account file
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    try {
      const sa = await loadServiceAccountFromFile(keyPath);
      return sa.project_id;
    } catch (error) {
      console.error('Could not get project ID from service account:', error);
    }
  }
  
  throw new Error('Could not determine GCP project ID');
}
