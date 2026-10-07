output "state_bucket" {
  description = "S3 bucket for Terraform state (the TF_STATE_BUCKET GitHub variable)."
  value       = aws_s3_bucket.state.bucket
}

output "lock_table" {
  description = "DynamoDB table for Terraform state locks (the TF_LOCK_TABLE GitHub variable)."
  value       = aws_dynamodb_table.locks.name
}

output "state_role_arn" {
  description = "Role the S3 backend assumes to reach state and locks (the TF_STATE_ROLE_ARN GitHub variable)."
  value       = aws_iam_role.state.arn
}
