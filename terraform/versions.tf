terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # ---------------------------------------------------------------------------
  # Remote Backend Configuration (AWS S3 Bucket + DynamoDB State Locking)
  # ---------------------------------------------------------------------------
  backend "s3" {
    bucket         = "taskflow-prod-tfstate"
    key            = "taskflow/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "taskflow-prod-tflocks"
    encrypt        = true
  }
}
