output "repository_url" {
  description = "The URL of the created ECR repository"
  value       = aws_ecr_repository.app_repo.repository_url
}

output "repository_arn" {
  description = "The ARN of the created ECR repository"
  value       = aws_ecr_repository.app_repo.arn
}

output "repository_name" {
  description = "The name of the created ECR repository"
  value       = aws_ecr_repository.app_repo.name
}

output "registry_id" {
  description = "The registry ID where the repository was created"
  value       = aws_ecr_repository.app_repo.registry_id
}
