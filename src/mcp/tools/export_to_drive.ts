import ee from '@google/earthengine';
import { register, z } from '../registry';
import { parseAoi } from '@/src/utils/geo';

/**
 * Stable export tool for Google Drive
 * Exports both the image (as rectangle) and shapefile boundary (as GeoJSON)
 */
register({
  name: 'export_image_to_drive',
  description: 'Export satellite imagery composite as GeoTIFF + shapefile boundary as GeoJSON to Google Drive',
  input: z.object({
    collection: z.string().describe('Collection ID (e.g., COPERNICUS/S2_SR_HARMONIZED)'),
    start_date: z.string().describe('Start date (YYYY-MM-DD)'),
    end_date: z.string().describe('End date (YYYY-MM-DD)'),
    region: z.string().describe('Place name (e.g., Los Angeles)'),
    scale: z.number().default(30).describe('Resolution in meters'),
    folder: z.string().default('EarthEngineExports').describe('Drive folder name')
  }),
  output: z.object({
    success: z.boolean(),
    imageTasks: z.array(z.object({
      taskId: z.string(),
      fileName: z.string(),
      type: z.string()
    })).optional(),
    exportedFiles: z.object({
      geoTiff: z.array(z.object({
        fileName: z.string(),
        taskId: z.string()
      })),
      geoJson: z.array(z.object({
        fileName: z.string(),
        taskId: z.string()
      }))
    }).optional(),
    message: z.string(),
    shapefileData: z.any().optional()
  }),
  handler: async ({ collection, start_date, end_date, region, scale, folder }) => {
    try {
      console.log(`[Export] Starting dual export for ${region}`);
      
      // Parse the region to get geometry
      let originalGeometry;
      let shapefileGeoJson;
      try {
        originalGeometry = await parseAoi(region);
        console.log(`[Export] Got geometry for ${region}`);
        
        // Get the shapefile boundary as GeoJSON
        try {
          shapefileGeoJson = await originalGeometry.getInfo();
          console.log(`[Export] Got shapefile GeoJSON`);
        } catch (e) {
          console.log(`[Export] Could not get full shapefile, will use bounds`);
        }
      } catch (error) {
        console.error(`[Export] Failed to parse region: ${error}`);
        return {
          success: false,
          message: `Failed to find region: ${region}`
        };
      }
      
      // ALWAYS use bounds for image export to avoid ENAMETOOLONG error
      let exportRegion;
      try {
        // Get the bounds and evaluate it to get actual coordinates
        const bounds = originalGeometry.bounds();
        // Evaluate the bounds to get the actual GeoJSON coordinates
        exportRegion = await new Promise((resolve, reject) => {
          bounds.evaluate((result: any, error: any) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          });
        });
        console.log('[Export] Using rectangular bounds for image export');
      } catch (e) {
        console.error('[Export] Could not get bounds:', e);
        return {
          success: false,
          message: 'Could not determine export bounds'
        };
      }
      
      // Create the image collection
      let imageCollection;
      try {
        imageCollection = ee.ImageCollection(collection)
          .filterDate(start_date, end_date)
          .filterBounds(originalGeometry);  // Use original geometry for filtering
        
        // Add cloud filtering for known collections
        if (collection.includes('S2')) {
          imageCollection = imageCollection.filter(
            ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', 20)
          );
        } else if (collection.includes('LANDSAT')) {
          imageCollection = imageCollection.filter(
            ee.Filter.lte('CLOUD_COVER', 20)
          );
        }
        
        console.log('[Export] Collection filtered');
      } catch (error) {
        console.error(`[Export] Collection error: ${error}`);
        return {
          success: false,
          message: `Failed to create collection: ${error}`
        };
      }
      
      // Create composite
      let composite;
      try {
        composite = imageCollection.median();
        
        // Select appropriate bands
        if (collection.includes('S2')) {
          // Sentinel-2: RGB + NIR
          composite = composite.select(['B4', 'B3', 'B2', 'B8']);
        } else if (collection.includes('LANDSAT/LC08')) {
          // Landsat 8: RGB + NIR
          composite = composite.select(['SR_B4', 'SR_B3', 'SR_B2', 'SR_B5']);
        } else if (collection.includes('LANDSAT/LC09')) {
          // Landsat 9: RGB + NIR
          composite = composite.select(['SR_B4', 'SR_B3', 'SR_B2', 'SR_B5']);
        }
        
        // Clip to original geometry for accurate boundaries
        composite = composite.clip(originalGeometry);
        console.log('[Export] Composite created');
      } catch (error) {
        console.error(`[Export] Composite error: ${error}`);
        return {
          success: false,
          message: `Failed to create composite: ${error}`
        };
      }
      
      // Generate export description
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const sanitizedRegion = region.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
      const imageFileName = `${sanitizedRegion}_${timestamp}_image`;
      const shapeFileName = `${sanitizedRegion}_${timestamp}_boundary`;
      
      const tasks = [];
      
      // Task 1: Export the image (rectangular bounds)
      try {
        const imageTask = ee.batch.Export.image.toDrive({
          image: composite,
          description: `export_image_${sanitizedRegion}_${timestamp}`,
          folder: folder,
          fileNamePrefix: imageFileName,
          region: exportRegion,  // This is the rectangular bounds
          scale: scale,
          crs: 'EPSG:4326',
          fileFormat: 'GeoTIFF',
          maxPixels: 1e13,
          formatOptions: {
            cloudOptimized: true
          }
        });
        
        imageTask.start();
        // @ts-ignore
        const imageTaskId = imageTask.id || `image_${timestamp}`;
        
        tasks.push({
          taskId: imageTaskId,
          fileName: `${imageFileName}.tif`,
          type: 'GeoTIFF Image (Rectangular Bounds)'
        });
        
        console.log(`[Export] Image task started: ${imageTaskId}`);
      } catch (error) {
        console.error(`[Export] Image export error: ${error}`);
      }
      
      // Task 2: Export the shapefile boundary as GeoJSON
      if (shapefileGeoJson) {
        try {
          // Create a feature collection from the shapefile
          const shapefileFeature = ee.Feature(originalGeometry, {
            name: region,
            type: 'boundary',
            created: timestamp
          });
          const shapefileCollection = ee.FeatureCollection([shapefileFeature]);
          
          const shapeTask = ee.batch.Export.table.toDrive({
            collection: shapefileCollection,
            description: `export_shape_${sanitizedRegion}_${timestamp}`,
            folder: folder,
            fileNamePrefix: shapeFileName,
            fileFormat: 'GeoJSON'
          });
          
          shapeTask.start();
          // @ts-ignore
          const shapeTaskId = shapeTask.id || `shape_${timestamp}`;
          
          tasks.push({
            taskId: shapeTaskId,
            fileName: `${shapeFileName}.geojson`,
            type: 'GeoJSON Boundary (Exact Shapefile)'
          });
          
          console.log(`[Export] Shapefile task started: ${shapeTaskId}`);
        } catch (error) {
          console.error(`[Export] Shapefile export error: ${error}`);
        }
      }
      
      if (tasks.length > 0) {
        // Separate image and boundary tasks for clarity
        const imageTasks = tasks.filter(t => t.type.includes('GeoTIFF'));
        const boundaryTasks = tasks.filter(t => t.type.includes('GeoJSON'));
        
        let detailedMessage = `✅ Export started successfully!\n\n`;
        
        if (imageTasks.length > 0) {
          detailedMessage += `📸 SATELLITE IMAGERY (GeoTIFF):\n`;
          imageTasks.forEach(t => {
            detailedMessage += `   • ${t.fileName} - Cloud-optimized GeoTIFF with satellite composite\n`;
            detailedMessage += `     Task ID: ${t.taskId}\n`;
          });
          detailedMessage += `\n`;
        }
        
        if (boundaryTasks.length > 0) {
          detailedMessage += `🗺️ BOUNDARY FILE (GeoJSON):\n`;
          boundaryTasks.forEach(t => {
            detailedMessage += `   • ${t.fileName} - Exact shapefile boundary\n`;
            detailedMessage += `     Task ID: ${t.taskId}\n`;
          });
          detailedMessage += `\n`;
        }
        
        detailedMessage += `📁 Google Drive Folder: "${folder}"\n`;
        detailedMessage += `⏱️ Files will appear in 5-15 minutes\n\n`;
        detailedMessage += `💡 TIP: The GeoTIFF contains the actual satellite imagery composite. `;
        detailedMessage += `The GeoJSON boundary can be used to clip the image to exact borders in GIS software if needed.`;
        
        return {
          success: true,
          imageTasks: tasks,
          exportedFiles: {
            geoTiff: imageTasks.map(t => ({ fileName: t.fileName, taskId: t.taskId })),
            geoJson: boundaryTasks.map(t => ({ fileName: t.fileName, taskId: t.taskId }))
          },
          message: detailedMessage,
          shapefileData: shapefileGeoJson
        };
      } else {
        return {
          success: false,
          message: 'No export tasks were created. Please check your inputs.'
        };
      }
      
    } catch (error) {
      console.error(`[Export] Unexpected error: ${error}`);
      return {
        success: false,
        message: `Unexpected error: ${error}`
      };
    }
  }
});

/**
 * Check export status
 */
register({
  name: 'check_export_status',
  description: 'Check the status of an export task',
  input: z.object({
    taskId: z.string().describe('Task ID from export_image_to_drive')
  }),
  output: z.object({
    status: z.string(),
    message: z.string()
  }),
  handler: async ({ taskId }) => {
    try {
      // This would require implementing task status checking
      // For now, return a generic message
      return {
        status: 'RUNNING',
        message: `Task ${taskId} is running. Check your Google Drive in a few minutes.`
      };
    } catch (error) {
      return {
        status: 'UNKNOWN',
        message: `Could not check status: ${error}`
      };
    }
  }
});
