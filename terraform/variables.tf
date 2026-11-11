# -----------------------------------------------------------------------------
# Core Project Configuration
# -----------------------------------------------------------------------------
variable "aws_region" {
  description = "AWS region for provisioning infrastructure"
  type        = string
  default     = "ap-southeast-2"
}

variable "project_name" {
  description = "Project name prefix used for resource naming and tagging"
  type        = string
  default     = "taskflow"
}

variable "environment" {
  description = "Deployment environment (e.g. prod, staging, dev)"
  type        = string
  default     = "prod"
}

variable "owner" {
  description = "Team or individual owner tag"
  type        = string
  default     = "Sidharth"
}

variable "github_repo" {
  description = "GitHub repository in 'owner/repo' format for tagging & optional OIDC"
  type        = string
  default     = "sidharthhhh/taskflow-devops"
}

# -----------------------------------------------------------------------------
# Network (VPC) Configuration
# -----------------------------------------------------------------------------
variable "vpc_cidr" {
  description = "CIDR block for the dedicated VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones to deploy subnets across"
  type        = list(string)
  default     = ["ap-southeast-2a", "ap-southeast-2b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (EKS nodes & DB)"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

# -----------------------------------------------------------------------------
# EKS Cluster & Node Group Configuration
# -----------------------------------------------------------------------------
variable "cluster_version" {
  description = "Kubernetes control plane version"
  type        = string
  default     = "1.31"
}

variable "node_instance_types" {
  description = "EC2 instance types for the EKS managed node group"
  type        = list(string)
  default     = ["t3.micro"]
}

variable "node_desired_size" {
  description = "Desired number of worker nodes (4 t3.micro nodes = 16 pod slots for all microservices)"
  type        = number
  default     = 4
}

variable "node_min_size" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 6
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "CIDR blocks allowed to access the EKS cluster public API endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# -----------------------------------------------------------------------------
# ECR Configuration (All Polyglot Microservice Repositories)
# -----------------------------------------------------------------------------
variable "ecr_repositories" {
  description = "List of Amazon ECR repositories for TaskFlow microservices and frontend"
  type        = list(string)
  default = [
    "taskflow-app",
    "taskflow-auth-service",
    "taskflow-analytics-service",
    "taskflow-scheduler-service",
    "taskflow-notification-service",
    "taskflow-audit-service",
    "taskflow-frontend"
  ]
}

variable "ecr_image_tag_mutability" {
  description = "Tag mutability setting for ECR repository (MUTABLE or IMMUTABLE)"
  type        = string
  default     = "MUTABLE"
}

# -----------------------------------------------------------------------------
# Budget & Alerting Configuration
# -----------------------------------------------------------------------------
variable "enable_budget" {
  description = "Enable AWS Budget for cost guardrails"
  type        = bool
  default     = true
}

variable "monthly_budget_limit" {
  description = "Monthly budget limit in USD"
  type        = string
  default     = "25.0"
}

variable "budget_alert_email" {
  description = "Email address to receive budget alerts"
  type        = string
  default     = "devops-alerts@example.com"
}
