variable "aws_region" {
  description = "AWS region for Terraform state infrastructure"
  type        = string
  default     = "ap-southeast-2"
}

variable "project_name" {
  description = "Name of the project used for naming resources"
  type        = string
  default     = "taskflow"
}

variable "environment" {
  description = "Target deployment environment"
  type        = string
  default     = "prod"
}
