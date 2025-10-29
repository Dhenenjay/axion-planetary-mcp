#!/bin/bash
# AWS Setup Script - Initial configuration

set -e

echo "🔧 Setting up AWS infrastructure..."

# Check AWS CLI installation
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first."
    exit 1
fi

# Configure AWS profile
echo "📝 Configuring AWS profile..."
aws configure set region us-east-1
aws configure set output json

# Create S3 bucket for Terraform state
echo "🪣 Creating S3 bucket for Terraform state..."
aws s3 mb s3://axion-planetary-terraform-state --region us-east-1 || true

# Enable versioning on state bucket
aws s3api put-bucket-versioning \
  --bucket axion-planetary-terraform-state \
  --versioning-configuration Status=Enabled

echo "✅ AWS setup complete!"
