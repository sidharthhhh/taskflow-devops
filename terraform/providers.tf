provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = var.owner
      Repository  = var.github_repo
    }
  }
}

# Caller identity to retrieve current AWS Account ID
data "aws_caller_identity" "current" {}

# Current AWS Partition and Region
data "aws_partition" "current" {}
data "aws_region" "current" {}
