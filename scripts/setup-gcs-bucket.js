#!/usr/bin/env node

const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');

async function setupGCSBucket() {
  try {
    // Load the service account key
    const keyPath = process.env.EARTH_ENGINE_PRIVATE_KEY || 'C:\\Users\\Dhenenjay\\Downloads\\ee-key.json';
    const projectId = process.env.GCP_PROJECT_ID || 'stoked-flame-455410-k2';
    
    console.log('🚀 Setting up GCS bucket for Earth Engine exports...');
    console.log(`📍 Project ID: ${projectId}`);
    
    // Initialize the Storage client
    const storage = new Storage({
      projectId: projectId,
      keyFilename: keyPath
    });
    
    // List existing buckets to find a unique name
    let bucketName;
    let bucketExists = false;
    let bucket;
    
    try {
      console.log('📋 Checking existing buckets...');
      const [buckets] = await storage.getBuckets();
      const existingBucketNames = buckets.map(b => b.name);
      console.log(`Found ${existingBucketNames.length} existing bucket(s)`);
      
      // Generate a unique bucket name
      const baseName = 'earth-engine-exports';
      bucketName = `${baseName}-${projectId}`;
      
      // Check if base name exists, if so add a number
      if (existingBucketNames.includes(bucketName)) {
        let counter = 1;
        while (existingBucketNames.includes(`${bucketName}-${counter}`)) {
          counter++;
        }
        bucketName = `${bucketName}-${counter}`;
      }
      
      // Check if we already have an earth-engine-exports bucket
      const existingEEBucket = existingBucketNames.find(name => name.startsWith('earth-engine-exports'));
      if (existingEEBucket) {
        bucketName = existingEEBucket;
        bucketExists = true;
        bucket = storage.bucket(bucketName);
        console.log(`✅ Using existing Earth Engine bucket: ${bucketName}`);
      } else {
        console.log(`📦 Will create new bucket: ${bucketName}`);
      }
      
    } catch (error) {
      if (error.message.includes('storage.buckets.list')) {
        console.log('⚠️  No permission to list buckets. Using default name.');
        bucketName = `earth-engine-exports-${projectId}`;
        bucket = storage.bucket(bucketName);
        
        // Check if this specific bucket exists
        try {
          const [exists] = await bucket.exists();
          bucketExists = exists;
          if (exists) {
            console.log(`✅ Bucket ${bucketName} already exists`);
          }
        } catch (e) {
          console.log(`📦 Bucket ${bucketName} doesn't exist or can't be accessed`);
        }
      } else {
        throw error;
      }
    }
    
    if (!bucketExists) {
      try {
        // Create the bucket
        console.log(`📦 Creating bucket ${bucketName}...`);
        const [newBucket] = await storage.createBucket(bucketName, {
          location: 'US',
          storageClass: 'STANDARD',
          iamConfiguration: {
            uniformBucketLevelAccess: {
              enabled: true
            }
          }
        });
        bucket = newBucket;
        console.log(`✅ Bucket ${bucket.name} created successfully`);
      } catch (error) {
        if (error.code === 409) {
          console.log(`ℹ️ Bucket ${bucketName} already exists (409 conflict)`);
          bucket = storage.bucket(bucketName);
        } else if (error.message.includes('storage.buckets.create')) {
          console.error('❌ No permission to create buckets.');
          console.log('\n📋 Required permissions for service account:');
          console.log('   • storage.buckets.list');
          console.log('   • storage.buckets.create');
          console.log('   • storage.buckets.get');
          console.log('   • storage.objects.create');
          console.log('   • storage.objects.delete');
          console.log('\nGrant these via "Storage Admin" role or custom role.');
          process.exit(1);
        } else {
          throw error;
        }
      }
    }
    
    // Set CORS configuration for the bucket
    const corsConfiguration = [{
      origin: ['*'],
      method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
      responseHeader: ['*'],
      maxAgeSeconds: 3600
    }];
    await bucket.setCorsConfiguration(corsConfiguration);
    console.log('✅ CORS configuration set');
    
    // Create exports folder
    const file = bucket.file('exports/.keep');
    await file.save('This folder stores Earth Engine exports');
    console.log('✅ Created exports folder');
    
    // Grant service account permissions
    const serviceAccountEmail = 'earth-engine-runner@stoked-flame-455410-k2.iam.gserviceaccount.com';
    const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
    
    // Add Storage Admin role for the service account
    const binding = {
      role: 'roles/storage.admin',
      members: [`serviceAccount:${serviceAccountEmail}`]
    };
    
    const existingBinding = policy.bindings.find(b => b.role === binding.role);
    if (existingBinding) {
      if (!existingBinding.members.includes(binding.members[0])) {
        existingBinding.members.push(binding.members[0]);
      }
    } else {
      policy.bindings.push(binding);
    }
    
    await bucket.iam.setPolicy(policy);
    console.log(`✅ Granted permissions to ${serviceAccountEmail}`);
    
    console.log('\n🎉 GCS bucket setup complete!');
    console.log(`\n📋 Bucket details:`);
    console.log(`   Name: ${bucketName}`);
    console.log(`   Location: US`);
    console.log(`   URL: gs://${bucketName}`);
    console.log(`   Console: https://console.cloud.google.com/storage/browser/${bucketName}?project=${projectId}`);
    
    console.log(`\n💡 Use this bucket name in your exports:`);
    console.log(`   bucket: "${bucketName}"`);
    
  } catch (error) {
    console.error('❌ Error setting up GCS bucket:', error.message);
    if (error.code === 409) {
      console.log('ℹ️  Bucket name already exists globally. Try a different name.');
    }
    process.exit(1);
  }
}

// Run the setup
setupGCSBucket();
