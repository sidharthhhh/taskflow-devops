variable "repository_name" {
  description = "Name of the ECR repository"
  type        = string
  default     = "taskflow-app"
}

variable "image_tag_mutability" {
  description = "Image tag mutability setting (MUTABLE or IMMUTABLE)"
  type        = string
  default     = "MUTABLE"
}

variable "project_name" {
  description = "Project name prefix for tags"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}
