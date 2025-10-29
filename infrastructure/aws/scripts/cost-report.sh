#!/bin/bash
# AWS Cost Monitoring Script

set -e

echo "💰 Fetching AWS cost report..."

START_DATE=$(date -d "1 month ago" +%Y-%m-%d)
END_DATE=$(date +%Y-%m-%d)

aws ce get-cost-and-usage \
  --time-period Start=$START_DATE,End=$END_DATE \
  --granularity MONTHLY \
  --metrics "BlendedCost" "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --output table

echo ""
echo "📊 Cost breakdown by service for the last month"
