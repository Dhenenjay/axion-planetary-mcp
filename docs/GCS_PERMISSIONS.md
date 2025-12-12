# Google Cloud Storage (GCS) Export Permissions Guide

## Overview
To export Earth Engine data to Google Cloud Storage instead of Google Drive (which doesn't work with service accounts), you need to grant specific permissions to your service account.

## Required Permissions

Your Earth Engine service account needs the following permissions:

### Essential Permissions
- `storage.buckets.list` - List buckets in the project
- `storage.buckets.create` - Create new buckets
- `storage.buckets.get` - Access bucket metadata
- `storage.objects.create` - Upload files to buckets
- `storage.objects.delete` - Delete files from buckets
- `storage.objects.get` - Read files from buckets
- `storage.objects.list` - List files in buckets

### Earth Engine Specific
- `earthengine.computations.create` - Run Earth Engine computations
- `earthengine.computations.get` - Check computation status
- `earthengine.assets.export` - Export Earth Engine assets

## How to Grant Permissions

### Option 1: Using Predefined Roles (Easiest)

Grant the **Storage Admin** role to your service account:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/storage.admin"
```

### Option 2: Using Google Cloud Console

1. Go to [IAM & Admin](https://console.cloud.google.com/iam-admin/iam)
2. Select your project
3. Find your service account (e.g., `earth-engine-runner@PROJECT_ID.iam.gserviceaccount.com`)
4. Click "Edit" (pencil icon)
5. Add Role: **Storage Admin**
6. Click "Save"

### Option 3: Create a Custom Role (More Secure)

Create a custom role with only the necessary permissions:

```bash
gcloud iam roles create earthEngineExporter \
  --project=YOUR_PROJECT_ID \
  --title="Earth Engine Exporter" \
  --description="Allows Earth Engine exports to GCS" \
  --permissions=storage.buckets.list,storage.buckets.create,storage.buckets.get,storage.objects.create,storage.objects.delete,storage.objects.get,storage.objects.list
```

Then grant it to your service account:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="projects/YOUR_PROJECT_ID/roles/earthEngineExporter"
```

## Setting Up the GCS Bucket

Once permissions are granted, run the setup script:

```bash
node scripts/setup-gcs-bucket.js
```

This will:
1. Create a unique bucket for your exports
2. Configure CORS for web access
3. Set up proper permissions
4. Create an exports folder

## Using GCS Exports in Claude Desktop

After setup, you can export to GCS using:

```
export_image_to_cloud_storage
```

Parameters:
- `collection`: Earth Engine collection ID
- `start_date`: Start date (YYYY-MM-DD)
- `end_date`: End date (YYYY-MM-DD)
- `region`: Place name (e.g., "Los Angeles")
- `scale`: Resolution in meters (default: 30)
- `bucket`: GCS bucket name (auto-filled after setup)
- `folder`: Folder in bucket (default: "exports")

## Accessing Your Exports

### Via gsutil
```bash
# List exports
gsutil ls gs://YOUR_BUCKET_NAME/exports/

# Download all exports
gsutil -m cp gs://YOUR_BUCKET_NAME/exports/* .

# Download specific file
gsutil cp gs://YOUR_BUCKET_NAME/exports/filename.tif .
```

### Via Cloud Console
Visit: `https://console.cloud.google.com/storage/browser/YOUR_BUCKET_NAME`

### Making Files Public (Optional)
To share exports publicly:

```bash
# Make a single file public
gsutil acl ch -u AllUsers:R gs://YOUR_BUCKET_NAME/exports/filename.tif

# Make all exports public
gsutil -m acl ch -r -u AllUsers:R gs://YOUR_BUCKET_NAME/exports/
```

Public URL format:
`https://storage.googleapis.com/YOUR_BUCKET_NAME/exports/filename.tif`

## Troubleshooting

### Permission Denied Errors
If you see "Permission denied" errors:
1. Verify the service account has the correct roles
2. Wait 1-2 minutes for permissions to propagate
3. Check the project ID is correct

### Bucket Already Exists
If the bucket name already exists globally:
1. The script will automatically append a number
2. Or you can specify a custom bucket name in the export

### Export Tasks Not Starting
Ensure your service account has Earth Engine permissions:
1. Register at [Earth Engine](https://signup.earthengine.google.com)
2. Add your service account email to your Earth Engine project

## Security Best Practices

1. **Use Uniform Bucket-Level Access**: Enabled by default in our setup
2. **Limit Public Access**: Only make files public when necessary
3. **Use Lifecycle Policies**: Auto-delete old exports to save costs

Example lifecycle policy (delete files after 30 days):
```bash
gsutil lifecycle set -e age:30 gs://YOUR_BUCKET_NAME
```

## Cost Considerations

- **Storage**: ~$0.020 per GB per month (Standard storage)
- **Network**: Free within same region, charges apply for downloads
- **Operations**: Minimal charges for listing/creating objects

Tip: Use lifecycle policies to automatically delete old exports and control costs.
