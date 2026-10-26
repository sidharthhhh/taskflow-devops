# -----------------------------------------------------------------------------
# AWS Secrets Manager for TaskFlow Production Database Credentials
# Integrates with External Secrets Operator / Kubernetes Workload Identity
# -----------------------------------------------------------------------------

resource "random_password" "db_password" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${var.project_name}/${var.environment}/db-credentials"
  description             = "Production PostgreSQL credentials for TaskFlow application"
  recovery_window_in_days = 0 # Immediate deletion on destroy for dev/lab environments

  tags = {
    Name        = "${var.project_name}-db-credentials"
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials_val" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "taskflow"
    password = random_password.db_password.result
    dbname   = "taskflowdb"
    port     = 5432
    host     = "postgres-service.taskflow.svc.cluster.local"
  })
}

# IAM Policy for External Secrets Operator / Pod Identity to read credentials
resource "aws_iam_policy" "external_secrets_read" {
  name        = "${var.project_name}-${var.environment}-secrets-read-policy"
  description = "Allows EKS workloads to retrieve database credentials from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = aws_secretsmanager_secret.db_credentials.arn
      }
    ]
  })
}
