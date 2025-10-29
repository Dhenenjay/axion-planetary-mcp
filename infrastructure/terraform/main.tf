terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "axion-planetary-terraform-state"
    key    = "infrastructure/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# VPC Configuration
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "axion-planetary-vpc"
    Environment = var.environment
    Migration   = "gcp-to-aws"
  }
}

# ECS Cluster for containerized workloads (replacing GKE)
resource "aws_ecs_cluster" "main" {
  name = "axion-planetary-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Migration = "from-gcp-gke"
  }
}

# RDS for managed database (replacing Cloud SQL)
resource "aws_db_instance" "main" {
  identifier           = "axion-planetary-db"
  engine              = "postgres"
  engine_version      = "15.4"
  instance_class      = "db.t3.micro"
  allocated_storage   = 20
  storage_encrypted   = true
  skip_final_snapshot = true

  tags = {
    Migration = "from-gcp-cloud-sql"
  }
}
