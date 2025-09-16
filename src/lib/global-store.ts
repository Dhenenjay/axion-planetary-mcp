/**
 * Global singleton store for Earth Engine data
 * Uses global object to ensure persistence across module reloads
 * 
 * IMPORTANT: Earth Engine objects are server-side references, not actual data.
 * We store them directly and they maintain their computation graph.
 */

import ee from '@google/earthengine';

// Use Node.js global object to ensure true singleton
declare global {
  var eeStore: {
    composites: Record<string, any>;
    metadata: Record<string, any>;
    results: Record<string, any>;
    mapSessions: Record<string, any>;
    // Add a cache for EE object serialization
    eeCache: Record<string, { type: string; serialized: any; }>;
  };
}

// Initialize global store if it doesn't exist
if (!global.eeStore) {
  global.eeStore = {
    composites: {},
    metadata: {},
    results: {},
    mapSessions: {},
    eeCache: {}
  };
  console.log('[GlobalStore] Initialized new global store');
}

// Export references to the global store
export const globalCompositeStore = global.eeStore.composites;
export const globalMetadataStore = global.eeStore.metadata;
export const globalResultsStore = global.eeStore.results;
export const globalMapSessions = global.eeStore.mapSessions;
export const globalEECache = global.eeStore.eeCache;

// Helper functions
export function addComposite(key: string, image: any, metadata?: any) {
  // IMPORTANT: Store the Earth Engine object directly
  // Earth Engine objects are computation graphs, not data
  // They maintain their server-side state and methods
  
  // Store the EE object reference
  globalCompositeStore[key] = image;
  
  // Also store metadata about the object type
  if (metadata) {
    globalMetadataStore[key] = {
      ...metadata,
      eeType: image?.constructor?.name || 'unknown',
      hasNormalizedDifference: typeof image?.normalizedDifference === 'function',
      hasSelect: typeof image?.select === 'function',
      hasBandNames: typeof image?.bandNames === 'function'
    };
  }
  
  console.log(`[GlobalStore] Added composite: ${key}`);
  console.log(`[GlobalStore] Total composites: ${Object.keys(globalCompositeStore).length}`);
  
  // Detailed verification
  if (image) {
    const checks = {
      select: typeof image.select === 'function',
      normalizedDifference: typeof image.normalizedDifference === 'function',
      clip: typeof image.clip === 'function',
      visualize: typeof image.visualize === 'function'
    };
    console.log(`[GlobalStore] EE methods for ${key}:`, checks);
    
    if (!checks.normalizedDifference) {
      console.warn(`[GlobalStore] WARNING: ${key} lacks normalizedDifference method!`);
    }
  }
}

export function getComposite(key: string) {
  const composite = globalCompositeStore[key];
  
  if (composite) {
    console.log(`[GlobalStore] Retrieved composite: ${key}`);
    
    // Check if it still has EE methods
    const metadata = globalMetadataStore[key];
    const checks = {
      select: typeof composite.select === 'function',
      normalizedDifference: typeof composite.normalizedDifference === 'function',
      clip: typeof composite.clip === 'function'
    };
    
    console.log(`[GlobalStore] EE methods check for ${key}:`, checks);
    
    if (!checks.normalizedDifference && metadata?.hasNormalizedDifference) {
      console.error(`[GlobalStore] ERROR: ${key} lost normalizedDifference method!`);
      console.log(`[GlobalStore] Composite type:`, composite?.constructor?.name);
      console.log(`[GlobalStore] Composite keys:`, Object.keys(composite || {}));
    }
  } else {
    console.log(`[GlobalStore] Composite ${key} not found`);
    console.log(`[GlobalStore] Available keys: ${getAllCompositeKeys().join(', ')}`);
  }
  
  return composite;
}

export function getAllCompositeKeys() {
  return Object.keys(globalCompositeStore);
}

export function getMetadata(key: string) {
  return globalMetadataStore[key];
}

export function addMapSession(id: string, session: any) {
  globalMapSessions[id] = session;
  console.log(`[GlobalStore] Added map session: ${id}`);
  console.log(`[GlobalStore] Total map sessions: ${Object.keys(globalMapSessions).length}`);
}

export function getMapSession(id: string) {
  console.log(`[GlobalStore] Fetching map session: ${id}`);
  console.log(`[GlobalStore] Available sessions: ${Object.keys(globalMapSessions).join(', ')}`);
  return globalMapSessions[id];
}

export function getAllMapSessions() {
  return globalMapSessions;
}