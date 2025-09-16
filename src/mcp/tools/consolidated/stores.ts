/**
 * Singleton stores for Earth Engine data
 * These stores persist across tool invocations
 */

// Global composite store - shared across all tools
export const globalCompositeStore: Record<string, any> = {};

// Global metadata store
export const globalMetadataStore: Record<string, any> = {};

// Global results store for time series and other results
export const globalResultsStore: Record<string, any> = {};

// Global map sessions store
export const globalMapSessions: Record<string, any> = {};

// Helper to add composite
export function addComposite(key: string, image: any, metadata?: any) {
  globalCompositeStore[key] = image;
  if (metadata) {
    globalMetadataStore[key] = metadata;
  }
  console.log(`[Store] Added composite: ${key}`);
  console.log(`[Store] Total composites: ${Object.keys(globalCompositeStore).length}`);
}

// Helper to get composite
export function getComposite(key: string) {
  return globalCompositeStore[key];
}

// Helper to get all composite keys
export function getAllCompositeKeys() {
  return Object.keys(globalCompositeStore);
}

// Helper to get metadata
export function getMetadata(key: string) {
  return globalMetadataStore[key];
}