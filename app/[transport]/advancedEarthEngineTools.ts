import * as ee from '@google/earthengine';
import { z } from 'zod';

// Re-export the basic initialization function
import { initializeEarthEngine } from './earthengineTools';
export { initializeEarthEngine };

// Type definitions
interface EarthEngineError {
  error: string;
  message: string;
}

/**
 * Get an Earth Engine image collection
 * @param collectionId ID of the collection (e.g., "COPERNICUS/S2")
 * @returns Promise with image collection info
 */
export const getImageCollection = async (collectionId: string): Promise<any | EarthEngineError> => {
  try {
    const collection = new ee.ImageCollection(collectionId);
    
    return new Promise((resolve, reject) => {
      collection.getInfo((info: any) => {
        resolve(info);
      });
    });
  } catch (error) {
    return { 
      error: 'COLLECTION_ERROR', 
      message: `Error getting collection: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Filter an image collection by date range
 * @param collectionId ID of the collection
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @returns Promise with filtered collection info
 */
export const filterCollectionByDate = async (
  collectionId: string,
  startDate: string,
  endDate: string
): Promise<any | EarthEngineError> => {
  try {
    const collection = new ee.ImageCollection(collectionId)
      .filterDate(startDate, endDate);
    
    return new Promise((resolve, reject) => {
      collection.getInfo((info: any) => {
        resolve(info);
      });
    });
  } catch (error) {
    return { 
      error: 'FILTER_DATE_ERROR', 
      message: `Error filtering by date: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Filter an image collection by geographic bounds
 * @param collectionId ID of the collection
 * @param geometry GeoJSON geometry for the region
 * @returns Promise with filtered collection info
 */
export const filterCollectionByBounds = async (
  collectionId: string,
  geometry: any
): Promise<any | EarthEngineError> => {
  try {
    const region = new ee.Geometry(geometry);
    const collection = new ee.ImageCollection(collectionId)
      .filterBounds(region);
    
    return new Promise((resolve, reject) => {
      collection.getInfo((info: any) => {
        resolve(info);
      });
    });
  } catch (error) {
    return { 
      error: 'FILTER_BOUNDS_ERROR', 
      message: `Error filtering by bounds: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Filter an image collection by metadata property
 * @param collectionId ID of the collection
 * @param property Property name
 * @param operator Operator for comparison (e.g., "less_than", "equals")
 * @param value Value to compare against
 * @returns Promise with filtered collection info
 */
export const filterCollectionByMetadata = async (
  collectionId: string,
  property: string,
  operator: string,
  value: any
): Promise<any | EarthEngineError> => {
  try {
    const collection = new ee.ImageCollection(collectionId)
      .filterMetadata(property, operator, value);
    
    return new Promise((resolve, reject) => {
      collection.getInfo((info: any) => {
        resolve(info);
      });
    });
  } catch (error) {
    return { 
      error: 'FILTER_METADATA_ERROR', 
      message: `Error filtering by metadata: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Calculate a normalized difference index (e.g., NDVI)
 * @param imageId ID of the image
 * @param bandA First band name
 * @param bandB Second band name
 * @param visParams Visualization parameters
 * @returns Promise with index image map
 */
export const calculateIndex = async (
  imageId: string,
  bandA: string,
  bandB: string,
  visParams: Record<string, any> = {}
): Promise<any | EarthEngineError> => {
  try {
    const image = new ee.Image(imageId)
      .normalizedDifference([bandA, bandB]);
    
    return new Promise((resolve) => {
      try {
        const map = image.getMap(visParams);
        if (!map) {
          resolve({ 
            error: 'INDEX_ERROR', 
            message: 'Earth Engine returned null or undefined result. The dataset may not be accessible, bands may be invalid, or you may need to authenticate first.' 
          });
          return;
        }
        resolve(map);
      } catch (callbackError) {
        resolve({ 
          error: 'INDEX_ERROR', 
          message: `Error in index calculation callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}` 
        });
      }
    });
  } catch (error) {
    return { 
      error: 'INDEX_ERROR', 
      message: `Error calculating index: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Apply a cloud mask to an image using simple cloud score
 * @param landsatImageId ID of a Landsat image
 * @param cloudThreshold Threshold for cloud score (0-100)
 * @param visParams Visualization parameters
 * @returns Promise with masked image map
 */
export const applyCloudMask = async (
  landsatImageId: string,
  cloudThreshold: number,
  visParams: Record<string, any> = {}
): Promise<any | EarthEngineError> => {
  try {
    const image = new ee.Image(landsatImageId);
    const cloudScore = ee.Algorithms.Landsat.simpleCloudScore(image);
    const mask = (cloudScore.select('cloud') as any).lt(cloudThreshold);
    const maskedImage = image.updateMask(mask);
    
    return new Promise((resolve) => {
      try {
        const map = maskedImage.getMap(visParams);
        if (!map) {
          resolve({ 
            error: 'CLOUD_MASK_ERROR', 
            message: 'Earth Engine returned null or undefined result. The dataset may not be accessible or you may need to authenticate first.' 
          });
          return;
        }
        resolve(map);
      } catch (callbackError) {
        resolve({ 
          error: 'CLOUD_MASK_ERROR', 
          message: `Error in cloud mask callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}` 
        });
      }
    });
  } catch (error) {
    return { 
      error: 'CLOUD_MASK_ERROR', 
      message: `Error applying cloud mask: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Create a composite image from a collection (median, mean, etc.)
 * @param collectionId ID of the collection
 * @param method Composite method ('median', 'mean', 'min', 'max', 'mosaic')
 * @param filterParams Optional date and region filters
 * @param visParams Visualization parameters
 * @returns Promise with composite image map
 */
export const createComposite = async (
  collectionId: string,
  method: 'median' | 'mean' | 'min' | 'max' | 'mosaic' = 'median',
  filterParams: {
    startDate?: string,
    endDate?: string,
    geometry?: any,
    cloudCoverMax?: number
  } = {},
  visParams: Record<string, any> = {}
): Promise<any | EarthEngineError> => {
  try {
    let collection = new ee.ImageCollection(collectionId);
    
    // Apply filters if provided
    if (filterParams.startDate && filterParams.endDate) {
      collection = collection.filterDate(filterParams.startDate, filterParams.endDate);
    }
    
    if (filterParams.geometry) {
      const region = new ee.Geometry(filterParams.geometry);
      collection = collection.filterBounds(region);
    }
    
    if (filterParams.cloudCoverMax !== undefined) {
      collection = collection.filterMetadata('CLOUD_COVER', 'less_than', filterParams.cloudCoverMax);
    }
    
    // Create composite based on method
    let composite: ee.Image;
    switch (method) {
      case 'median':
        composite = collection.median();
        break;
      case 'mean':
        composite = collection.mean();
        break;
      case 'min':
        composite = collection.min();
        break;
      case 'max':
        composite = collection.max();
        break;
      case 'mosaic':
        composite = collection.mosaic();
        break;
      default:
        composite = collection.median();
    }
    
    return new Promise((resolve) => {
      try {
        const map = composite.getMap(visParams);
        if (!map) {
          resolve({ 
            error: 'COMPOSITE_ERROR', 
            message: 'Earth Engine returned null or undefined result. The collection may be empty, filters may be too restrictive, or you may need to authenticate first.' 
          });
          return;
        }
        resolve(map);
      } catch (callbackError) {
        resolve({ 
          error: 'COMPOSITE_ERROR', 
          message: `Error in composite callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}` 
        });
      }
    });
  } catch (error) {
    return { 
      error: 'COMPOSITE_ERROR', 
      message: `Error creating composite: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Export an image to Google Drive
 * @param imageId ID of the image or an image object
 * @param exportParams Export parameters (description, folder, region, scale)
 * @returns Promise with export task info
 */
export const exportImageToDrive = async (
  imageId: string,
  exportParams: {
    description: string,
    folder: string,
    region: any,
    scale: number,
    maxPixels?: number
  }
): Promise<any | EarthEngineError> => {
  try {
    const image = new ee.Image(imageId);
    const region = new ee.Geometry(exportParams.region);
    
    try {
      const task = ee.batch.Export.image.toDrive({
        image: image,
        description: exportParams.description,
        folder: exportParams.folder,
        fileNamePrefix: exportParams.description,
        region: region,
        scale: exportParams.scale,
        maxPixels: exportParams.maxPixels || 1e9
      });
      
      task.start();
      
      if (!task || !task.id) {
        return {
          error: 'EXPORT_ERROR',
          message: 'Failed to create export task. You may need to authenticate first.'
        };
      }
      
      return {
        taskId: task.id,
        status: 'STARTED',
        description: exportParams.description
      };
    } catch (taskError) {
      return { 
        error: 'EXPORT_ERROR', 
        message: `Error starting export task: ${taskError instanceof Error ? taskError.message : String(taskError)}` 
      };
    }
  } catch (error) {
    return { 
      error: 'EXPORT_ERROR', 
      message: `Error exporting image: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Get the status of an export task
 * @param taskId ID of the export task
 * @returns Promise with task status
 */
export const getExportTaskStatus = async (
  taskId: string
): Promise<any | EarthEngineError> => {
  try {
    return new Promise((resolve) => {
      try {
        ee.data.getTaskStatus([taskId], (statusResponse: any) => {
          // Check if statusResponse is undefined or null
          if (!statusResponse) {
            resolve({ 
              error: 'TASK_STATUS_ERROR', 
              message: 'Earth Engine returned null or undefined status. The task ID may be invalid or you may need to authenticate first.' 
            });
            return;
          }
          resolve(Array.isArray(statusResponse) ? statusResponse[0] : statusResponse);
        });
      } catch (callbackError) {
        resolve({ 
          error: 'TASK_STATUS_ERROR', 
          message: `Error in task status callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}` 
        });
      }
    });
  } catch (error) {
    return { 
      error: 'TASK_STATUS_ERROR', 
      message: `Error getting task status: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Get all active or completed Earth Engine tasks
 * @returns Promise with list of all tasks
 */
export const getAllExportTasks = async (): Promise<any | EarthEngineError> => {
  try {
    return new Promise((resolve) => {
      try {
        // Use the lower-level API call to get the task list
        ee.data.getTaskList({}, (taskList: any) => {
          // Check if taskList is undefined or null
          if (!taskList) {
            resolve({ 
              error: 'TASK_LIST_ERROR', 
              message: 'Earth Engine returned null or undefined task list. You may need to authenticate first.' 
            });
            return;
          }
          resolve(taskList);
        });
      } catch (callbackError) {
        resolve({ 
          error: 'TASK_LIST_ERROR', 
          message: `Error in task list callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}` 
        });
      }
    });
  } catch (error) {
    return { 
      error: 'TASK_LIST_ERROR', 
      message: `Error getting task list: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Run a time series analysis on an image collection for a region
 * @param collectionId ID of the collection
 * @param geometry GeoJSON geometry for the region
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @param bands Bands to analyze
 * @returns Promise with time series data
 */
export const timeSeriesAnalysis = async (
  collectionId: string,
  geometry: any,
  startDate: string,
  endDate: string,
  bands: string[]
): Promise<any | EarthEngineError> => {
  try {
    const region = new ee.Geometry(geometry);
    const collection = (new ee.ImageCollection(collectionId)
      .filterDate(startDate, endDate)
      .filterBounds(region) as any)
      .select(bands);
    
    // For each image in the collection, calculate the mean value in the region
    const reducer = ee.Reducer.mean();
    
    return new Promise((resolve) => {
      collection.getInfo((collInfo: any) => {
        // Use the date from each image for the time series
        const timeSeries: { date: string, values: Record<string, number> }[] = [];
        
        // Process each image individually to get stats
        const processImages = async () => {
          for (const img of collInfo.features) {
            const imgId = img.id;
            const date = img.properties['system:time_start'];
            const formattedDate = new Date(date).toISOString().split('T')[0];
            
            const image = new ee.Image(imgId);
            const stats = await new Promise<any>((resolveStats) => {
              image.reduceRegion({
                reducer: reducer,
                geometry: region,
                scale: 30 // Adjust scale as needed
              }).getInfo((imgStats: any) => {
                resolveStats(imgStats);
              });
            });
            
            timeSeries.push({
              date: formattedDate,
              values: stats
            });
          }
          
          resolve({
            collectionId,
            startDate,
            endDate,
            bands,
            timeSeries
          });
        };
        
        processImages();
      });
    });
  } catch (error) {
    return { 
      error: 'TIME_SERIES_ERROR', 
      message: `Error in time series analysis: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Create a custom band math expression
 * @param imageId ID of the image
 * @param expression Math expression (e.g., "(b('B4') - b('B3')) / (b('B4') + b('B3'))")
 * @param visParams Visualization parameters
 * @returns Promise with expression result map
 */
export const applyExpression = async (
  imageId: string,
  expression: string,
  visParams: Record<string, any> = {}
): Promise<any | EarthEngineError> => {
  try {
    const image = new ee.Image(imageId);
    const expressionResult = image.expression(expression);
    
    return new Promise((resolve) => {
      try {
        const map = expressionResult.getMap(visParams);
        if (!map) {
          resolve({ 
            error: 'EXPRESSION_ERROR', 
            message: 'Earth Engine returned null or undefined result. The expression may be invalid, the dataset may not be accessible, or you may need to authenticate first.' 
          });
          return;
        }
        resolve(map);
      } catch (callbackError) {
        resolve({ 
          error: 'EXPRESSION_ERROR', 
          message: `Error in expression callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}` 
        });
      }
    });
  } catch (error) {
    return { 
      error: 'EXPRESSION_ERROR', 
      message: `Error applying expression: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Cancel an Earth Engine export task
 * @param taskId ID of the export task
 * @returns Promise with result of the cancellation
 */
export const cancelExportTask = async (
  taskId: string
): Promise<any | EarthEngineError> => {
  try {
    return new Promise((resolve) => {
      try {
        ee.data.cancelTask(taskId, (response: any) => {
          // Check if response is undefined or null
          if (!response) {
            resolve({ 
              error: 'TASK_CANCEL_ERROR', 
              message: 'Earth Engine returned null or undefined response. The task ID may be invalid or you may need to authenticate first.' 
            });
            return;
          }
          resolve({
            taskId,
            success: true,
            status: 'CANCELLED',
            response
          });
        });
      } catch (callbackError) {
        resolve({ 
          error: 'TASK_CANCEL_ERROR', 
          message: `Error in cancel task callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}` 
        });
      }
    });
  } catch (error) {
    return { 
      error: 'TASK_CANCEL_ERROR', 
      message: `Error cancelling task: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

// Schema definitions for parameters
export const CollectionIdSchema = z.string().describe('Earth Engine image collection ID (e.g., "COPERNICUS/S2")');
export const DateSchema = z.string().describe('Date in YYYY-MM-DD format');
export const BandNameSchema = z.string().describe('Band name (e.g., "B4", "B8", "NDVI")');
export const BandNamesSchema = z.array(z.string()).describe('List of band names');
export const MethodSchema = z.enum(['median', 'mean', 'min', 'max', 'mosaic']).describe('Method for composite creation');
export const ExpressionSchema = z.string().describe('Math expression using band values');
export const TaskIdSchema = z.string().describe('Earth Engine export task ID');
export const CloudThresholdSchema = z.number().min(0).max(100).describe('Cloud threshold (0-100)');

// Re-export schemas from basic tools
export {
  PrivateKeySchema,
  DatasetIdSchema,
  VisParamsSchema,
  GeometrySchema,
  ScaleSchema,
  QuerySchema
} from './earthengineTools'; 