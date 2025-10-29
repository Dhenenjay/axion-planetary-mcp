#!/bin/bash
# AWS Deployment Rollback Script

set -e

echo "⏮️  Rolling back AWS deployment..."

AWS_REGION=${AWS_REGION:-us-east-1}
CLUSTER_NAME="axion-planetary-cluster"
SERVICE_NAME="axion-planetary-service"

# Get previous task definition
echo "📋 Fetching previous task definition..."
PREVIOUS_TASK_DEF=$(aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $AWS_REGION \
  --query 'services[0].taskDefinition' \
  --output text)

echo "🔄 Rolling back to: $PREVIOUS_TASK_DEF"

# Update service to previous task definition
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --task-definition $PREVIOUS_TASK_DEF \
  --region $AWS_REGION

echo "✅ Rollback initiated!"
echo "⏳ Waiting for deployment to stabilize..."

aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $AWS_REGION

echo "✅ Rollback complete!"
