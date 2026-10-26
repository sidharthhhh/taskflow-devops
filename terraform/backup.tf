# -----------------------------------------------------------------------------
# S3 Backup Bucket for Automated PostgreSQL pg_dump Snapshots
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "backups" {
  bucket        = "${var.project_name}-${var.environment}-backups-${data.aws_caller_identity.current.account_id}"
  force_destroy = false

  tags = {
    Name        = "${var.project_name}-database-backups"
    Project     = var.project_name
    Environment = var.environment
    Purpose     = "Disaster-Recovery"
  }
}

# Versioning to protect against accidental deletion or corruption
resource "aws_s3_bucket_versioning" "backup_versioning" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enforce Server-Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "backup_encryption" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "backup_pab" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle management: transition older backups to Glacier and expire after 30 days
resource "aws_s3_bucket_lifecycle_configuration" "backup_lifecycle" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire-old-backups"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 14
    }
  }
}

# IAM Policy for Kubernetes pg_dump CronJob (IRSA) to write backups to S3
resource "aws_iam_policy" "backup_writer" {
  name        = "${var.project_name}-${var.environment}-backup-writer-policy"
  description = "Allows PostgreSQL backup CronJob to write database dumps to S3"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:AbortMultipartUpload"
        ]
        Resource = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*"
        ]
      }
    ]
  })
}
