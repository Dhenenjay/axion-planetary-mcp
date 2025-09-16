import ee from '@google/earthengine';
import { register, z } from '../registry';
import { parseAoi } from '@/src/utils/geo';

/**
 * Export to Google Cloud Storage instead of Drive
 * Works with service accounts
 */
register({
  name: 'export_image_to_cloud_storage',
  description: 'Export satellite imagery composite as GeoTIFF + boundary GeoJSON to Google Cloud Storage',
  input: z.object({
    collection: z.string().describe('Collection ID (e.g., COPERNICUS/S2_SR_HARMONIZED)'),
    start_date: z.string().describe('Start date (YYYY-MM-DD)'),
    end_date: z.string().describe('End date (YYYY-MM-DD)'),
    region: z.string().describe('Place name (e.g., Los Angeles)'),
    scale: z.number().default(30).describe('Resolution in meters'),
    bucket: z.string().default('earth-engine-exports-stoked-flame-455410-k2').describe('GCS bucket name'),
    folder: z.string().default('exports').describe('Folder path in bucket')
  }),
  output: z.object({
    success: z.boolean(),
    imageTasks: z.array(z.object({
      taskId: z.string(),
      fileName: z.string(),
      type: z.string(),
      gcsUrl: z.string()
    })).optional(),
    exportedFiles: z.object({
      geoTiff: z.array(z.object({
        fileName: z.string(),
        taskId: z.string(),
        gcsUrl: z.string()
      })),
      geoJson: z.array(z.object({
        fileName: z.string(),
        taskId: z.string(),
        gcsUrl: z.string()
      }))
    }).optional(),
    message: z.string(),
    shapefileData: z.any().optional()
  }),
  handler: async ({ collection, start_date, end_date, region, scale, bucket, folder }) => {
    try {
      console.log(`[GCS Export] Starting dual export for ${region}`);
      
      // Get project ID from environment
      const projectId = process.env.GCP_PROJECT_ID || process.env.EARTH_ENGINE_PROJECT_ID || 'stoked-flame-455410-k2';
      
      // Use default bucket if not provided
      if (!bucket) {
        bucket = `earth-engine-exports-${projectId}`;
        console.log(`[GCS Export] No bucket specified, using default: ${bucket}`);
      }
      
      // Use default folder if not provided
      if (!folder) {
        folder = 'exports';
      }
      
      // Auto-setup: Ensure bucket exists
      console.log(`[GCS Export] Checking bucket: ${bucket}`);
      try {
        // Import Google Cloud Storage if needed for bucket setup
        const { Storage } = require('@google-cloud/storage');
        const keyPath = process.env.EARTH_ENGINE_PRIVATE_KEY || 'C:\\Users\\Dhenenjay\\Downloads\\ee-key.json';
        
        const storage = new Storage({
          projectId: projectId,
          keyFilename: keyPath
        });
        
        const bucketObj = storage.bucket(bucket);
        const [exists] = await bucketObj.exists();
        
        if (!exists) {
          console.log(`[GCS Export] Bucket doesn't exist. Creating ${bucket}...`);
          try {
            await storage.createBucket(bucket, {
              location: 'US',
              storageClass: 'STANDARD'
            });
            console.log(`[GCS Export] ✅ Created bucket: ${bucket}`);
            
            // Create exports folder
            const file = bucketObj.file(`${folder}/.keep`);
            await file.save('Earth Engine exports folder');
            console.log(`[GCS Export] ✅ Created folder: ${folder}`);
          } catch (error: any) {
            if (error.code === 409) {
              console.log(`[GCS Export] Bucket already exists (maybe in another project)`);
            } else if (error.message?.includes('storage.buckets.create')) {
              return {
                success: false,
                message: `❌ Cannot create bucket. Please grant Storage Admin role to your service account:\n\n` +
                        `gcloud projects add-iam-policy-binding ${projectId} \\\n` +
                        `  --member="serviceAccount:earth-engine-runner@${projectId}.iam.gserviceaccount.com" \\\n` +
                        `  --role="roles/storage.admin"\n\n` +
                        `Then try the export again.`
              };
            } else {
              console.error(`[GCS Export] Bucket creation error: ${error.message}`);
            }
          }
        } else {
          console.log(`[GCS Export] ✅ Bucket exists: ${bucket}`);
        }
      } catch (setupError: any) {
        console.log(`[GCS Export] Bucket setup warning: ${setupError.message}`);
        // Continue anyway - Earth Engine might have its own access
      }
      
      // Parse the region to get geometry
      let originalGeometry;
      let shapefileGeoJson;
      try {
        originalGeometry = await parseAoi(region);
        console.log(`[GCS Export] Got geometry for ${region}`);
        
        // Get the shapefile boundary as GeoJSON
        try {
          shapefileGeoJson = await originalGeometry.getInfo();
          console.log(`[GCS Export] Got shapefile GeoJSON`);
        } catch (e) {
          console.log(`[GCS Export] Could not get full shapefile, will use bounds`);
        }
      } catch (error) {
        console.error(`[GCS Export] Failed to parse region: ${error}`);
        return {
          success: false,
          message: `Failed to find region: ${region}`
        };
      }
      
      // Get bounds for export region to avoid ENAMETOOLONG error
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
        console.log('[GCS Export] Using rectangular bounds for image export');
      } catch (e) {
        console.error('[GCS Export] Could not get bounds:', e);
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
        
        console.log('[GCS Export] Collection filtered');
      } catch (error) {
        console.error(`[GCS Export] Collection error: ${error}`);
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
        console.log('[GCS Export] Composite created');
      } catch (error) {
        console.error(`[GCS Export] Composite error: ${error}`);
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
      const gcsBasePath = `gs://${bucket}/${folder}`;
      
      // Task 1: Export the image (rectangular bounds)
      try {
        const imageTask = ee.batch.Export.image.toCloudStorage({
          image: composite,
          description: `export_image_${sanitizedRegion}_${timestamp}`,
          bucket: bucket,
          fileNamePrefix: `${folder}/${imageFileName}`,
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
        const gcsUrl = `${gcsBasePath}/${imageFileName}.tif`;
        
        tasks.push({
          taskId: imageTaskId,
          fileName: `${imageFileName}.tif`,
          type: 'GeoTIFF Image (Rectangular Bounds)',
          gcsUrl: gcsUrl
        });
        
        console.log(`[GCS Export] Image task started: ${imageTaskId}`);
        console.log(`[GCS Export] Image will be available at: ${gcsUrl}`);
      } catch (error) {
        console.error(`[GCS Export] Image export error: ${error}`);
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
          
          const shapeTask = ee.batch.Export.table.toCloudStorage({
            collection: shapefileCollection,
            description: `export_shape_${sanitizedRegion}_${timestamp}`,
            bucket: bucket,
            fileNamePrefix: `${folder}/${shapeFileName}`,
            fileFormat: 'GeoJSON'
          });
          
          shapeTask.start();
          // @ts-ignore
          const shapeTaskId = shapeTask.id || `shape_${timestamp}`;
          const gcsUrl = `${gcsBasePath}/${shapeFileName}.geojson`;
          
          tasks.push({
            taskId: shapeTaskId,
            fileName: `${shapeFileName}.geojson`,
            type: 'GeoJSON Boundary (Exact Shapefile)',
            gcsUrl: gcsUrl
          });
          
          console.log(`[GCS Export] Shapefile task started: ${shapeTaskId}`);
          console.log(`[GCS Export] Boundary will be available at: ${gcsUrl}`);
        } catch (error) {
          console.error(`[GCS Export] Shapefile export error: ${error}`);
        }
      }
      
      if (tasks.length > 0) {
        // Separate image and boundary tasks for clarity
        const imageTasks = tasks.filter(t => t.type.includes('GeoTIFF'));
        const boundaryTasks = tasks.filter(t => t.type.includes('GeoJSON'));
        
        let detailedMessage = `✅ Export to GCS started successfully!\n\n`;
        
        if (imageTasks.length > 0) {
          detailedMessage += `📸 SATELLITE IMAGERY (GeoTIFF):\n`;
          imageTasks.forEach(t => {
            detailedMessage += `   • ${t.fileName} - Cloud-optimized GeoTIFF with satellite composite\n`;
            detailedMessage += `     Task ID: ${t.taskId}\n`;
            detailedMessage += `     GCS URL: ${t.gcsUrl}\n`;
          });
          detailedMessage += `\n`;
        }
        
        if (boundaryTasks.length > 0) {
          detailedMessage += `🗺️ BOUNDARY FILE (GeoJSON):\n`;
          boundaryTasks.forEach(t => {
            detailedMessage += `   • ${t.fileName} - Exact shapefile boundary\n`;
            detailedMessage += `     Task ID: ${t.taskId}\n`;
            detailedMessage += `     GCS URL: ${t.gcsUrl}\n`;
          });
          detailedMessage += `\n`;
        }
        
        detailedMessage += `📁 GCS Bucket: ${bucket}\n`;
        detailedMessage += `📂 Folder: ${folder}\n`;
        detailedMessage += `⏱️ Files will appear in 5-15 minutes\n\n`;
        detailedMessage += `💡 TIP: You can download files using:\n`;
        detailedMessage += `   gsutil cp ${gcsBasePath}/*.tif .\n`;
        detailedMessage += `   gsutil cp ${gcsBasePath}/*.geojson .\n\n`;
        detailedMessage += `Or view in Cloud Console:\n`;
        detailedMessage += `   https://console.cloud.google.com/storage/browser/${bucket}/${folder}?project=${projectId}`;
        
        return {
          success: true,
          imageTasks: tasks,
          exportedFiles: {
            geoTiff: imageTasks.map(t => ({ 
              fileName: t.fileName, 
              taskId: t.taskId,
              gcsUrl: t.gcsUrl
            })),
            geoJson: boundaryTasks.map(t => ({ 
              fileName: t.fileName, 
              taskId: t.taskId,
              gcsUrl: t.gcsUrl
            }))
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
      console.error(`[GCS Export] Unexpected error: ${error}`);
      return {
        success: false,
        message: `Unexpected error: ${error}`
      };
    }
  }
});
