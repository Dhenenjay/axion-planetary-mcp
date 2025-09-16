import * as ee from '@google/earthengine';
import { z } from 'zod';

// Type definitions for the return types
interface MapImageResult {
  url: string;
  mapId: string;
  token: string;
}

interface EarthEngineError {
  error: string;
  message: string;
}

/**
 * Initialize and authenticate with Earth Engine
 * @param privateKeyJson JSON string of service account private key
 * @returns Promise that resolves when authenticated and initialized
 */
export const initializeEarthEngine = async (privateKeyJson: string): Promise<{ success: boolean, message?: string }> => {
  try {
    // Parse the private key JSON
    const privateKey = JSON.parse(privateKeyJson);
    
    // Authenticate using the private key
    return new Promise((resolve, reject) => {
      ee.data.authenticateViaPrivateKey(
        privateKey,
        () => {
          // Initialize Earth Engine
          ee.initialize(
            null,
            null,
            () => {
              resolve({ success: true });
            },
            (err: Error) => {
              reject({ success: false, message: `Initialization error: ${err.message}` });
            }
          );
        },
        (err: Error) => {
          reject({ success: false, message: `Authentication error: ${err.message}` });
        }
      );
    });
  } catch (error) {
    return { 
      success: false, 
      message: `Error initializing Earth Engine: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Get a map visualization for a dataset
 * @param datasetId Earth Engine dataset ID (e.g., 'USGS/SRTMGL1_003')
 * @param visParams Visualization parameters (min, max, palette, bands)
 * @returns Promise with map URL and token
 */
export const getDatasetVisualization = async (
  datasetId: string,
  visParams: Record<string, any> = {}
): Promise<MapImageResult | EarthEngineError> => {
  try {
    const image = new ee.Image(datasetId);
    
    return new Promise((resolve) => {
      try {
        const map = image.getMap(visParams) as any;
        if (!map) {
          resolve({ 
            error: 'VISUALIZATION_ERROR', 
            message: 'Earth Engine returned null or undefined result. The dataset may not be accessible or you may need to authenticate first.' 
          });
          return;
        }
        // Convert the Earth Engine map object to our expected format
        resolve({
          url: map.urlFormat || '',
          mapId: map.mapid || '',
          token: map.token || map.mapid || ''
        });
      } catch (callbackError) {
        resolve({ 
          error: 'VISUALIZATION_ERROR', 
          message: `Error in visualization callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}` 
        });
      }
    });
  } catch (error) {
    return { 
      error: 'VISUALIZATION_ERROR', 
      message: `Error generating visualization: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Get image info for a dataset
 * @param datasetId Earth Engine dataset ID
 * @returns Promise with image information
 */
export const getImageInfo = async (datasetId: string): Promise<any | EarthEngineError> => {
  try {
    const image = new ee.Image(datasetId);
    
    return new Promise((resolve) => {
      try {
        image.getInfo((info: any) => {
          // Check if info is undefined or null
          if (!info) {
            resolve({ 
              error: 'IMAGE_INFO_ERROR', 
              message: 'Earth Engine returned null or undefined info. The dataset may not be accessible or you may need to authenticate first.' 
            });
            return;
          }
          resolve(info);
        });
      } catch (callbackError) {
        resolve({ 
          error: 'IMAGE_INFO_ERROR', 
          message: `Error in getInfo callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}` 
        });
      }
    });
  } catch (error) {
    return { 
      error: 'IMAGE_INFO_ERROR', 
      message: `Error getting image info: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Compute statistics for an image in a region
 * @param datasetId Earth Engine dataset ID
 * @param geometry GeoJSON geometry for the region
 * @param scale Scale in meters
 * @returns Promise with statistics
 */
export const computeImageStats = async (
  datasetId: string,
  geometry: any,
  scale: number = 1000
): Promise<any | EarthEngineError> => {
  try {
    const image = new ee.Image(datasetId);
    const region = new ee.Geometry(geometry);
    
    return new Promise((resolve) => {
      try {
        image.reduceRegion({
          reducer: ee.Reducer.mean(),
          geometry: region,
          scale: scale
        }).getInfo((stats: any) => {
          // Check if stats is undefined or null
          if (!stats) {
            resolve({ 
              error: 'STATS_ERROR', 
              message: 'Earth Engine returned null or undefined stats. The dataset may not be accessible, the region might be invalid, or you may need to authenticate first.' 
            });
            return;
          }
          resolve(stats);
        });
      } catch (callbackError) {
        resolve({ 
          error: 'STATS_ERROR', 
          message: `Error in reduceRegion callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}` 
        });
      }
    });
  } catch (error) {
    return { 
      error: 'STATS_ERROR', 
      message: `Error computing statistics: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Search Earth Engine datasets
 * @param query Search query
 * @returns Promise with search results
 */
export const searchDatasets = async (query: string): Promise<any | EarthEngineError> => {
  try {
    return new Promise((resolve) => {
      try {
        ee.data.getAssetRoots((roots: any) => {
          // Check if roots is undefined or null
          if (!roots) {
            resolve({ 
              error: 'SEARCH_ERROR', 
              message: 'Earth Engine returned null or undefined results. You may need to authenticate first.' 
            });
            return;
          }
          resolve(roots);
        });
      } catch (callbackError) {
        resolve({ 
          error: 'SEARCH_ERROR', 
          message: `Error in getAssetRoots callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}` 
        });
      }
    });
  } catch (error) {
    return { 
      error: 'SEARCH_ERROR', 
      message: `Error searching datasets: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

// Schema definitions for parameters
export const PrivateKeySchema = z.string().describe('JSON string containing the service account private key');
export const DatasetIdSchema = z.string().describe('Earth Engine dataset ID (e.g., "USGS/SRTMGL1_003")');
export const VisParamsSchema = z.record(z.any()).optional().describe('Visualization parameters (min, max, palette, bands)');
export const GeometrySchema = z.any().describe('GeoJSON geometry object representing a region');
export const ScaleSchema = z.number().optional().describe('Scale in meters for computations');
export const QuerySchema = z.string().describe('Search query for datasets'); 