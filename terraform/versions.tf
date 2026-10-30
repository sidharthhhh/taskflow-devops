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
  # Remote Backend Configuration (Uncomment after running terraform/bootstrap)
  # S3 bucket name must match your Account ID: taskflow-prod-tfstate-666952271651
  # ---------------------------------------------------------------------------
  # backend "s3" {
  #   bucket       = "taskflow-prod-tfstate-666952271651"
  #   key          = "taskflow/terraform.tfstate"
  #   region       = "ap-southeast-2"
  #   use_lockfile = true
  #   encrypt      = true
  # }
}
