output "state_bucket_name" {
  description = "Name of the S3 bucket created for Terraform remote state"
  value       = aws_s3_bucket.state_bucket.id
}

output "state_bucket_arn" {
  description = "ARN of the S3 state bucket"
  value       = aws_s3_bucket.state_bucket.arn
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table created for state locking"
  value       = aws_dynamodb_table.state_locks.name
}

output "backend_config_snippet" {
  description = "Backend block snippet to paste into root versions.tf"
  value       = <<-EOT
    backend "s3" {
      bucket         = "${aws_s3_bucket.state_bucket.id}"
      key            = "taskflow/terraform.tfstate"
      region         = "${var.aws_region}"
      dynamodb_table = "${aws_dynamodb_table.state_locks.name}"
      encrypt        = true
    }
  EOT
}
