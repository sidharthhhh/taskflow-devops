variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes control plane version"
  type        = string
  default     = "1.31"
}

variable "vpc_id" {
  description = "VPC ID where the cluster is deployed"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for managed worker nodes"
  type        = list(string)
}

variable "public_access_cidrs" {
  description = "CIDR blocks allowed to access the EKS cluster public API endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "node_instance_types" {
  description = "EC2 instance types for the EKS managed node group"
  type        = list(string)
  default     = ["t3.micro"]
}

variable "desired_size" {
  description = "Desired number of worker nodes in the node group"
  type        = number
  default     = 2
}

variable "min_size" {
  description = "Minimum number of worker nodes in the node group"
  type        = number
  default     = 2
}

variable "max_size" {
  description = "Maximum number of worker nodes in the node group"
  type        = number
  default     = 4
}

variable "project_name" {
  description = "Project name prefix for tags and naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}
