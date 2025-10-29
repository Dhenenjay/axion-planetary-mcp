#!/bin/bash
# Data Migration Script - GCP to AWS

set -e

echo "📦 Starting data migration from GCP to AWS..."

GCS_BUCKET="gs://axion-planetary-gcp-bucket"
S3_BUCKET="s3://axion-planetary-assets-production"

# Install gsutil if not present
if ! command -v gsutil &> /dev/null; then
    echo "❌ gsutil not found. Please install Google Cloud SDK."
    exit 1
fi

# Sync data from GCS to local
echo "⬇️  Downloading from GCS..."
mkdir -p /tmp/migration-data
gsutil -m rsync -r $GCS_BUCKET /tmp/migration-data/

# Upload to S3
echo "⬆️  Uploading to S3..."
aws s3 sync /tmp/migration-data/ $S3_BUCKET/ --delete

# Cleanup
echo "🧹 Cleaning up..."
rm -rf /tmp/migration-data

echo "✅ Migration complete!"
