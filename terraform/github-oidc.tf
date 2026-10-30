# =============================================================================
# GitHub Actions Keyless OIDC Authentication
# NOTE: Commented out because AWS Organization SCP (policy/p-cue8c1s7) explicitly
# denies iam:CreateOpenIDConnectProvider.
# For CI/CD deployments, GitHub Actions uses standard AWS credentials
# (AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY) stored in GitHub repository secrets.
# =============================================================================

# data "tls_certificate" "github_actions" {
#   url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
# }

# resource "aws_iam_openid_connect_provider" "github" {
#   url             = "https://token.actions.githubusercontent.com"
#   client_id_list  = ["sts.amazonaws.com"]
#   thumbprint_list = [data.tls_certificate.github_actions.certificates[0].sha1_fingerprint]
#   tags = {
#     Name        = "${var.project_name}-github-oidc-provider"
#     Project     = var.project_name
#     Environment = var.environment
#   }
# }

# data "aws_iam_policy_document" "github_actions_trust" {
#   statement {
#     effect  = "Allow"
#     actions = ["sts:AssumeRoleWithWebIdentity"]
#     principals {
#       type        = "Federated"
#       identifiers = [aws_iam_openid_connect_provider.github.arn]
#     }
#     condition {
#       test     = "StringEquals"
#       variable = "token.actions.githubusercontent.com:aud"
#       values   = ["sts.amazonaws.com"]
#     }
#     condition {
#       test     = "StringLike"
#       variable = "token.actions.githubusercontent.com:sub"
#       values   = ["repo:${var.github_repo}:*"]
#     }
#   }
# }

# resource "aws_iam_role" "github_actions" {
#   name               = "${var.project_name}-${var.environment}-github-actions-role"
#   assume_role_policy = data.aws_iam_policy_document.github_actions_trust.json
#   tags = {
#     Name        = "${var.project_name}-github-actions-role"
#     Project     = var.project_name
#     Environment = var.environment
#   }
# }
