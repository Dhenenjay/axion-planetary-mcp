# GCP to AWS Migration Guide

**Status:** In Progress  
**Start Date:** October 2025  
**Expected Completion:** Q4 2025

## Overview

This document outlines the migration strategy from Google Cloud Platform (GCP) to Amazon Web Services (AWS) for the Axion Planetary MCP project.

## Migration Mapping

| GCP Service | AWS Service | Status |
|-------------|-------------|--------|
| Google Cloud Storage (GCS) | Amazon S3 | Planning |
| Cloud Functions | AWS Lambda | Planning |
| Google Kubernetes Engine (GKE) | Amazon ECS | Planning |
| Cloud SQL | Amazon RDS | Planning |
| Cloud CDN | Amazon CloudFront | Planning |
| Cloud Pub/Sub | Amazon SNS/SQS | Planning |
| Cloud Run | AWS Fargate | Planning |

## Directory Structure

```
infrastructure/
├── aws/                    # New AWS configurations
│   └── cloudformation.yml  # Infrastructure as Code
├── gcp-legacy/            # Old GCP configs (for reference)
│   └── app.yaml           # Deprecated App Engine config
└── terraform/             # Terraform for multi-cloud management
    └── main.tf            # Main infrastructure definition
```

## Deployment

### AWS Deployment
```bash
chmod +x deploy/deploy-aws.sh
./deploy/deploy-aws.sh
```

### Terraform
```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

## Rollback Plan

GCP infrastructure will remain operational during migration. In case of issues:

1. Revert DNS to GCP endpoints
2. Scale down AWS resources
3. Document issues encountered
4. Plan remediation

## Cost Analysis

- **Current GCP Spend:** ~$XXX/month
- **Projected AWS Spend:** ~$XXX/month
- **Expected Savings:** ~XX%

## Timeline

- **Phase 1 (Nov 2025):** Infrastructure setup
- **Phase 2 (Dec 2025):** Data migration
- **Phase 3 (Q1 2026):** Traffic cutover
- **Phase 4 (Q2 2026):** GCP decommission

## Team

- **Migration Lead:** TBD
- **AWS Architect:** TBD
- **DevOps:** TBD

## Notes

- All new features should target AWS infrastructure
- GCP resources will be sunset in phases
- Maintain documentation throughout migration
