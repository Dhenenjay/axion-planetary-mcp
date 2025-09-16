import ee from '@google/earthengine';
import { JWT } from 'google-auth-library';
import { decodeSaJson } from '../auth/index';
import * as fs from 'fs/promises';

let initialized = false;

export async function initEarthEngineWithSA(){
  if (initialized) return;
  
  let sa;
  
  // Try to load from file path first (preferred method for public users)
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    try {
      const keyContent = await fs.readFile(keyPath, 'utf-8');
      sa = JSON.parse(keyContent);
      console.log(`Loaded service account from: ${keyPath}`);
      
      // Auto-set project ID and email for other parts of the app
      process.env.GCP_PROJECT_ID = sa.project_id;
      process.env.GCP_SERVICE_ACCOUNT_EMAIL = sa.client_email;
    } catch (error) {
      console.error(`Could not load service account key from ${keyPath}:`, error);
      // Fall back to encoded JSON method
      const decoded = decodeSaJson();
      if (decoded.useFile) {
        throw new Error(`Cannot read service account file: ${keyPath}`);
      }
      sa = decoded;
    }
  } else {
    // Fall back to encoded JSON in env variable
    const decoded = decodeSaJson();
    if (decoded.useFile) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set. Please set it to your service account key file path.');
    }
    sa = decoded;
  }
  
  const jwt = new JWT({ 
    email: sa.client_email, 
    key: sa.private_key, 
    scopes: [
      'https://www.googleapis.com/auth/earthengine',
      'https://www.googleapis.com/auth/devstorage.read_write'
    ]
  });
  
  const creds = await jwt.authorize();
  
  await new Promise<void>((resolve, reject) => 
    ee.data.authenticateViaPrivateKey(sa, () => { 
      ee.initialize(null, null, () => { 
        initialized = true; 
        console.log(`Earth Engine initialized! Project: ${sa.project_id}`);
        resolve(); 
      }, reject); 
    }, reject)
  );
}

export function ensureEE(){ if(!initialized) throw new Error('Earth Engine not initialized'); }

export async function getTileService(image: any, vis: any){
  ensureEE();
  // @ts-ignore
  const map = image.getMap(vis);
  return { mapId: map.mapid, tileUrlTemplate: map.urlFormat, ttlSeconds: 3600, visParams: vis };
}
