#!/bin/bash

# AWS Deployment Script - Migration from GCP
# Date: 2025-10-29

set -e

echo "🚀 Deploying Axion Planetary to AWS..."
echo "📦 Migration Phase: GCP -> AWS"

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
ENVIRONMENT=${ENVIRONMENT:-production}
STACK_NAME="axion-planetary-${ENVIRONMENT}"

# Build application
echo "📦 Building application..."
npm run build

# Deploy CloudFormation stack
echo "☁️  Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-file infrastructure/aws/cloudformation.yml \
  --stack-name $STACK_NAME \
  --parameter-overrides Environment=$ENVIRONMENT \
  --capabilities CAPABILITY_IAM \
  --region $AWS_REGION

# Upload static assets to S3
echo "📤 Uploading static assets to S3..."
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text \
  --region $AWS_REGION)

aws s3 sync ./public s3://$BUCKET_NAME/assets/ --delete

echo "✅ Deployment complete!"
echo "🌐 Stack: $STACK_NAME"
echo "📍 Region: $AWS_REGION"
echo "🪣 Bucket: $BUCKET_NAME"
