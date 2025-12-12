# Quick Setup: GCS Exports for Earth Engine MCP

## Why GCS Instead of Google Drive?

Service accounts cannot export to Google Drive (no storage quota). Google Cloud Storage (GCS) is the recommended solution for programmatic exports.

## Quick Setup (5 minutes)

### Step 1: Grant Storage Permissions

Run this command in Google Cloud Shell or with `gcloud` CLI:

```bash
# Replace with your actual values
PROJECT_ID="stoked-flame-455410-k2"
SERVICE_ACCOUNT="earth-engine-runner@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant Storage Admin role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.admin"
```

### Step 2: Create the Bucket

After granting permissions, run:

```bash
cd earth-engine-mcp
node scripts/setup-gcs-bucket.js
```

This will create a bucket named `earth-engine-exports-YOUR_PROJECT_ID`.

### Step 3: Update Claude Desktop Config

The tool `export_image_to_cloud_storage` is already configured in your MCP server. Just restart Claude Desktop to use it.

## Using the Export Tool

In Claude Desktop, you can now export imagery:

```
"Export Sentinel-2 imagery of Los Angeles from January 2024 to GCS"
```

The tool will:
1. Create a cloud-free composite
2. Export as Cloud-Optimized GeoTIFF
3. Also export the boundary as GeoJSON
4. Provide download links

## Accessing Your Exports

### Option 1: Direct Download Links
The export will provide direct GCS URLs like:
```
gs://earth-engine-exports-PROJECT_ID/exports/Los_Angeles_20240109_image.tif
```

### Option 2: Cloud Console
Visit: https://console.cloud.google.com/storage/browser/earth-engine-exports-PROJECT_ID

### Option 3: gsutil Command Line
```bash
# List all exports
gsutil ls gs://earth-engine-exports-PROJECT_ID/exports/

# Download a file
gsutil cp gs://earth-engine-exports-PROJECT_ID/exports/*.tif .
```

## Troubleshooting

### "Permission Denied" Error
- Wait 2 minutes after granting permissions
- Verify the service account has Storage Admin role in IAM console

### "Bucket doesn't exist" Error  
- Make sure you ran `node scripts/setup-gcs-bucket.js`
- Check if the bucket name matches your project ID

### Export Tasks Not Starting
- Check Earth Engine quotas
- Verify the region name is valid
- Try a smaller date range or lower resolution

## Default Settings

- **Bucket**: `earth-engine-exports-YOUR_PROJECT_ID`
- **Folder**: `exports`
- **Resolution**: 30m (Landsat) or 10m (Sentinel-2)
- **Format**: Cloud-Optimized GeoTIFF
- **Cloud Filter**: 20% max cloud cover

## Cost Estimate

- Small exports (< 1GB): ~$0.02/month storage
- Typical export: 100-500 MB
- Downloads: Free within Google Cloud, ~$0.12/GB external

## Next Steps

1. Set up lifecycle rules to auto-delete old exports
2. Create public URLs for sharing (optional)
3. Integrate with your GIS workflow

See [Full GCS Permissions Guide](docs/GCS_PERMISSIONS.md) for advanced configuration.
