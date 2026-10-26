# Amazon ECR Repository for TaskFlow Container Images
resource "aws_ecr_repository" "app_repo" {
  name                 = var.repository_name
  image_tag_mutability = var.image_tag_mutability

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name        = var.repository_name
    Project     = var.project_name
    Environment = var.environment
  }
}

# Automated ECR Lifecycle Policy
# - Retains last 30 tagged deployment images
# - Deletes untagged/dangling images older than 14 days to minimize registry storage costs
resource "aws_ecr_lifecycle_policy" "cleanup_policy" {
  repository = aws_ecr_repository.app_repo.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Remove untagged dangling images older than 14 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Retain at most 30 recent tagged release images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "sha-", "prod-", "release-"]
          countType     = "imageCountMoreThan"
          countNumber   = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
