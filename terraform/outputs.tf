# -----------------------------------------------------------------------------
# Outputs for CI/CD Pipelines & Kubernetes Workloads
# (Does NOT expose raw database passwords or plaintext credentials)
# -----------------------------------------------------------------------------

output "aws_region" {
  description = "AWS Region where resources are deployed"
  value       = var.aws_region
}

output "vpc_id" {
  description = "The ID of the TaskFlow VPC"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "cluster_name" {
  description = "Name of the provisioned Amazon EKS cluster"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "Endpoint URL of the EKS control plane API server"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority_data
}

output "oidc_provider_arn" {
  description = "ARN of the EKS OIDC identity provider for IRSA"
  value       = module.eks.oidc_provider_arn
}

output "ecr_repository_url" {
  description = "URL of the Amazon ECR repository for taskflow-app"
  value       = module.ecr.repository_url
}

output "ecr_repository_name" {
  description = "Name of the Amazon ECR repository"
  value       = module.ecr.repository_name
}

output "github_actions_role_arn" {
  description = "IAM Role ARN to configure in GitHub Actions for keyless deployment"
  value       = aws_iam_role.github_actions.arn
}

output "backup_bucket_name" {
  description = "S3 bucket name used for PostgreSQL backups"
  value       = aws_s3_bucket.backups.id
}

output "backup_bucket_arn" {
  description = "ARN of the S3 backup bucket"
  value       = aws_s3_bucket.backups.arn
}

output "db_credentials_secret_arn" {
  description = "ARN of the AWS Secrets Manager secret containing database credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "configure_kubectl_command" {
  description = "Command to configure local kubeconfig for the EKS cluster"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}
