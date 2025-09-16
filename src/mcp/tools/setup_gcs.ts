import { register, z } from '../registry';

/**
 * Setup GCS bucket and permissions for Earth Engine exports
 */
register({
  name: 'setup_gcs_for_exports',
  description: 'Setup Google Cloud Storage bucket for Earth Engine exports (one-time setup)',
  input: z.object({
    bucketName: z.string().optional().describe('Custom bucket name (optional)')
  }),
  output: z.object({
    success: z.boolean(),
    bucketName: z.string().optional(),
    message: z.string(),
    instructions: z.string().optional()
  }),
  handler: async ({ bucketName }) => {
    try {
      const { Storage } = require('@google-cloud/storage');
      
      // Get configuration
      const projectId = process.env.GCP_PROJECT_ID || process.env.EARTH_ENGINE_PROJECT_ID || 'stoked-flame-455410-k2';
      const keyPath = process.env.EARTH_ENGINE_PRIVATE_KEY || 'C:\\Users\\Dhenenjay\\Downloads\\ee-key.json';
      const serviceAccountEmail = `earth-engine-runner@${projectId}.iam.gserviceaccount.com`;
      
      console.log('[GCS Setup] Initializing...');
      
      // Initialize storage client
      const storage = new Storage({
        projectId: projectId,
        keyFilename: keyPath
      });
      
      // Determine bucket name
      let finalBucketName = bucketName || `earth-engine-exports-${projectId}`;
      
      try {
        // Try to list buckets to check permissions
        console.log('[GCS Setup] Checking permissions...');
        const [buckets] = await storage.getBuckets();
        console.log(`[GCS Setup] Found ${buckets.length} existing buckets`);
        
        // Check if bucket already exists
        const existingBucket = buckets.find(b => b.name === finalBucketName);
        if (existingBucket) {
          console.log(`[GCS Setup] Bucket already exists: ${finalBucketName}`);
          return {
            success: true,
            bucketName: finalBucketName,
            message: `✅ Bucket already exists and is ready: ${finalBucketName}\n\n` +
                    `You can now use the export tool with this bucket.`
          };
        }
        
        // Create the bucket
        console.log(`[GCS Setup] Creating bucket: ${finalBucketName}`);
        const [bucket] = await storage.createBucket(finalBucketName, {
          location: 'US',
          storageClass: 'STANDARD',
          iamConfiguration: {
            uniformBucketLevelAccess: {
              enabled: true
            }
          }
        });
        
        // Create exports folder
        const file = bucket.file('exports/.keep');
        await file.save('Earth Engine exports folder');
        
        // Set CORS
        await bucket.setCorsConfiguration([{
          origin: ['*'],
          method: ['GET', 'HEAD'],
          responseHeader: ['*'],
          maxAgeSeconds: 3600
        }]);
        
        console.log(`[GCS Setup] ✅ Created bucket: ${finalBucketName}`);
        
        return {
          success: true,
          bucketName: finalBucketName,
          message: `✅ Successfully created GCS bucket!\n\n` +
                  `📦 Bucket: ${finalBucketName}\n` +
                  `📂 Location: US\n` +
                  `🔗 URL: gs://${finalBucketName}\n` +
                  `🌐 Console: https://console.cloud.google.com/storage/browser/${finalBucketName}?project=${projectId}\n\n` +
                  `You can now export Earth Engine data to this bucket!`
        };
        
      } catch (error: any) {
        if (error.message?.includes('storage.buckets.list')) {
          // No list permission, try to create directly
          console.log('[GCS Setup] No list permission, trying direct creation...');
          
          try {
            const [bucket] = await storage.createBucket(finalBucketName, {
              location: 'US',
              storageClass: 'STANDARD'
            });
            
            // Create exports folder
            const file = bucket.file('exports/.keep');
            await file.save('Earth Engine exports folder');
            
            return {
              success: true,
              bucketName: finalBucketName,
              message: `✅ Created bucket: ${finalBucketName}\n\n` +
                      `Note: Limited permissions detected. Bucket was created but some features may be limited.`
            };
            
          } catch (createError: any) {
            if (createError.code === 409) {
              return {
                success: true,
                bucketName: finalBucketName,
                message: `ℹ️ Bucket ${finalBucketName} may already exist. Try using it for exports.`
              };
            }
            throw createError;
          }
        }
        
        if (error.message?.includes('storage.buckets.create')) {
          return {
            success: false,
            message: `❌ Insufficient permissions to create GCS bucket`,
            instructions: `To grant the required permissions, run this command:\n\n` +
                         `gcloud projects add-iam-policy-binding ${projectId} \\\n` +
                         `  --member="serviceAccount:${serviceAccountEmail}" \\\n` +
                         `  --role="roles/storage.admin"\n\n` +
                         `Then try this setup again.`
          };
        }
        
        throw error;
      }
      
    } catch (error: any) {
      console.error('[GCS Setup] Error:', error);
      return {
        success: false,
        message: `❌ Setup failed: ${error.message}`,
        instructions: `Please ensure your service account has Storage Admin permissions:\n\n` +
                     `1. Go to https://console.cloud.google.com/iam-admin/iam\n` +
                     `2. Find your service account\n` +
                     `3. Add the "Storage Admin" role\n` +
                     `4. Try again`
      };
    }
  }
});
