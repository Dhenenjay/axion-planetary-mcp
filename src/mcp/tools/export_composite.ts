import ee from '@google/earthengine';
import { register, z } from '../registry';
import { parseAoi } from '@/src/utils/geo';

/**
 * Enhanced export tool that can handle composites and large geometries
 */
register({
  name: 'export_composite_to_drive',
  description: 'Export a composite image or collection to Google Drive as GeoTIFF (handles large regions)',
  input: z.object({
    collection: z.string().describe('Collection ID like COPERNICUS/S2_SR_HARMONIZED'),
    start_date: z.string().describe('Start date in YYYY-MM-DD format'),
    end_date: z.string().describe('End date in YYYY-MM-DD format'),
    region: z.union([z.string(), z.any()]).describe('Place name or GeoJSON'),
    scale: z.number().default(10).describe('Resolution in meters'),
    folder: z.string().default('EarthEngine').describe('Google Drive folder'),
    fileNamePrefix: z.string().optional().describe('File name prefix'),
    maxCloudCover: z.number().default(20).describe('Maximum cloud cover percentage'),
    bands: z.array(z.string()).optional().describe('Bands to export'),
    format: z.enum(['GeoTIFF', 'TFRecord']).default('GeoTIFF')
  }),
  output: z.object({
    success: z.boolean(),
    taskId: z.string().optional(),
    message: z.string(),
    exportUrl: z.string().optional()
  }),
  handler: async ({ 
    collection, 
    start_date, 
    end_date, 
    region, 
    scale, 
    folder, 
    fileNamePrefix,
    maxCloudCover,
    bands,
    format
  }) => {
    try {
      console.log(`Creating composite for ${region}...`);
      
      // Parse the region
      let geometry;
      if (typeof region === 'string') {
        // It's a place name - get the geometry
        geometry = await parseAoi(region);
      } else {
        // It's already a geometry
        geometry = new ee.Geometry(region);
      }
      
      // Create the image collection
      let imageCollection = ee.ImageCollection(collection)
        .filterDate(start_date, end_date)
        .filterBounds(geometry);
      
      // Add cloud filter for Sentinel-2
      if (collection.includes('S2')) {
        imageCollection = imageCollection.filter(
          ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', maxCloudCover)
        );
      } else if (collection.includes('LANDSAT')) {
        imageCollection = imageCollection.filter(
          ee.Filter.lte('CLOUD_COVER', maxCloudCover)
        );
      }
      
      // Create composite (median to remove clouds)
      let composite = imageCollection.median();
      
      // Select bands if specified
      if (bands && bands.length > 0) {
        composite = composite.select(bands);
      } else {
        // Default bands for common datasets
        if (collection.includes('S2')) {
          composite = composite.select(['B4', 'B3', 'B2', 'B8', 'B11', 'B12']); // RGB + NIR + SWIR
        } else if (collection.includes('LANDSAT')) {
          composite = composite.select(['SR_B4', 'SR_B3', 'SR_B2', 'SR_B5', 'SR_B6', 'SR_B7']);
        }
      }
      
      // Clip to region
      composite = composite.clip(geometry);
      
      // Generate file name
      const timestamp = new Date().toISOString().slice(0, 10);
      const prefix = fileNamePrefix || `composite_${region}_${timestamp}`;
      
      // For large geometries, we need to simplify or use bounds
      let exportGeometry = geometry;
      try {
        // Try to get the bounds instead of the full geometry for export
        exportGeometry = geometry.bounds();
        console.log('Using bounds for export to avoid ENAMETOOLONG error');
      } catch (e) {
        console.log('Using original geometry');
      }
      
      // Create export task
      const exportTask = ee.batch.Export.image.toDrive({
        image: composite,
        description: prefix,
        folder: folder,
        fileNamePrefix: prefix,
        region: exportGeometry,
        scale: scale,
        crs: 'EPSG:4326',
        fileFormat: format,
        maxPixels: 1e13,
        formatOptions: {
          cloudOptimized: true
        }
      });
      
      // Start the export
      exportTask.start();
      
      // Get task ID
      // @ts-ignore
      const taskId = exportTask.id;
      
      return {
        success: true,
        taskId: taskId,
        message: `Export started successfully! Check your Google Drive folder "${folder}" in a few minutes for file "${prefix}".`,
        exportUrl: `https://code.earthengine.google.com/tasks`
      };
      
    } catch (error: any) {
      console.error('Export error:', error);
      return {
        success: false,
        message: `Export failed: ${error.message}`
      };
    }
  }
});

/**
 * Alternative: Export to Cloud Storage (GCS)
 */
register({
  name: 'export_composite_to_gcs',
  description: 'Export a composite to Google Cloud Storage (better for large regions)',
  input: z.object({
    collection: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    region: z.union([z.string(), z.any()]),
    scale: z.number().default(10),
    bucket: z.string().default('earth-engine-exports'),
    fileNamePrefix: z.string().optional(),
    maxCloudCover: z.number().default(20)
  }),
  output: z.object({
    success: z.boolean(),
    taskId: z.string().optional(),
    message: z.string(),
    gcsPath: z.string().optional()
  }),
  handler: async ({ 
    collection, 
    start_date, 
    end_date, 
    region, 
    scale, 
    bucket,
    fileNamePrefix,
    maxCloudCover
  }) => {
    try {
      // Parse the region
      let geometry;
      if (typeof region === 'string') {
        geometry = await parseAoi(region);
      } else {
        geometry = new ee.Geometry(region);
      }
      
      // Create collection and composite
      let imageCollection = ee.ImageCollection(collection)
        .filterDate(start_date, end_date)
        .filterBounds(geometry);
      
      if (collection.includes('S2')) {
        imageCollection = imageCollection.filter(
          ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', maxCloudCover)
        );
      }
      
      const composite = imageCollection.median().clip(geometry);
      
      // Use bounds for export to avoid ENAMETOOLONG
      const exportGeometry = geometry.bounds();
      
      // Generate file name
      const timestamp = Date.now();
      const prefix = fileNamePrefix || `composite_${timestamp}`;
      
      // Create export task
      const exportTask = ee.batch.Export.image.toCloudStorage({
        image: composite,
        description: prefix,
        bucket: bucket,
        fileNamePrefix: prefix,
        region: exportGeometry,
        scale: scale,
        crs: 'EPSG:4326',
        fileFormat: 'GeoTIFF',
        maxPixels: 1e13,
        formatOptions: {
          cloudOptimized: true
        }
      });
      
      // Start the export
      exportTask.start();
      
      // @ts-ignore
      const taskId = exportTask.id;
      
      return {
        success: true,
        taskId: taskId,
        message: `Export to GCS started! File will be available at gs://${bucket}/${prefix}`,
        gcsPath: `gs://${bucket}/${prefix}.tif`
      };
      
    } catch (error: any) {
      return {
        success: false,
        message: `Export failed: ${error.message}`
      };
    }
  }
});
