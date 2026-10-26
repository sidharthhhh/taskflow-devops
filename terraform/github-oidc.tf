# -----------------------------------------------------------------------------
# GitHub Actions Keyless OIDC Authentication
# Eliminates long-lived AWS Access Keys in GitHub Secrets
# -----------------------------------------------------------------------------

data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

# GitHub OIDC Identity Provider in AWS IAM
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_actions.certificates[0].sha1_fingerprint]

  tags = {
    Name        = "${var.project_name}-github-oidc-provider"
    Project     = var.project_name
    Environment = var.environment
  }
}

# Trust Policy scoped strictly to this specific repository
data "aws_iam_policy_document" "github_actions_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:*"]
    }
  }
}

# IAM Role assumed by GitHub Actions runner
resource "aws_iam_role" "github_actions" {
  name               = "${var.project_name}-${var.environment}-github-actions-role"
  assume_role_policy = data.aws_iam_policy_document.github_actions_trust.json

  tags = {
    Name        = "${var.project_name}-github-actions-role"
    Project     = var.project_name
    Environment = var.environment
  }
}

# Policy allowing GitHub Actions to push images to ECR
resource "aws_iam_policy" "github_ecr_push" {
  name        = "${var.project_name}-${var.environment}-github-ecr-push-policy"
  description = "Allows GitHub Actions runner to authenticate and push images to ECR"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetRepositoryPolicy",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
          "ecr:DescribeImages",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = module.ecr.repository_arn
      }
    ]
  })
}

# Policy allowing GitHub Actions to describe EKS cluster for kubeconfig update
resource "aws_iam_policy" "github_eks_deploy" {
  name        = "${var.project_name}-${var.environment}-github-eks-deploy-policy"
  description = "Allows GitHub Actions runner to describe EKS cluster to update kubeconfig"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster",
          "eks:ListClusters"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "github_ecr" {
  policy_arn = aws_iam_policy.github_ecr_push.arn
  role       = aws_iam_role.github_actions.name
}

resource "aws_iam_role_policy_attachment" "github_eks" {
  policy_arn = aws_iam_policy.github_eks_deploy.arn
  role       = aws_iam_role.github_actions.name
}
