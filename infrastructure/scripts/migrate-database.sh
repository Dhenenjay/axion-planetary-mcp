#!/bin/bash
# Database Migration Script - Cloud SQL to RDS

set -e

echo "🗄️  Starting database migration..."

# GCP Cloud SQL details
GCP_INSTANCE="axion-planetary-db"
GCP_DATABASE="axion_planetary"

# AWS RDS details
RDS_ENDPOINT="axion-planetary-db.xxxxxxxxx.us-east-1.rds.amazonaws.com"
RDS_DATABASE="axion_planetary"

# Export from Cloud SQL
echo "📤 Exporting from Cloud SQL..."
gcloud sql export sql $GCP_INSTANCE gs://axion-planetary-backups/migration-dump.sql \
  --database=$GCP_DATABASE

# Download dump
echo "⬇️  Downloading dump file..."
gsutil cp gs://axion-planetary-backups/migration-dump.sql /tmp/

# Import to RDS
echo "📥 Importing to RDS..."
psql -h $RDS_ENDPOINT -U postgres -d $RDS_DATABASE -f /tmp/migration-dump.sql

echo "✅ Database migration complete!"
