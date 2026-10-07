output "state_bucket" {
  description = "S3 bucket for Terraform state (the TF_STATE_BUCKET GitHub variable)."
  value       = aws_s3_bucket.state.bucket
}

output "lock_table" {
  description = "DynamoDB table for Terraform state locks (the TF_LOCK_TABLE GitHub variable)."
  value       = aws_dynamodb_table.locks.name
}

output "state_kms_key_arn" {
  description = "Key every backend must pass as -backend-config kms_key_id (the TF_STATE_KMS_KEY_ARN GitHub variable); without it, encrypt = true sends AES256 and the bucket policy refuses the upload."
  value       = aws_kms_key.state.arn
}

output "state_read_role_arns" {
  description = "Per-environment roles plans assume to read state (TF_GLOBAL_STATE_READ_ROLE_ARN, TF_STAGING_STATE_READ_ROLE_ARN)."
  value       = { for name, role in aws_iam_role.state_read : name => role.arn }
}

output "state_rw_role_arns" {
  description = "Per-environment roles applies assume to read, write and lock state (TF_STAGING_STATE_RW_ROLE_ARN)."
  value       = { for name, role in aws_iam_role.state_rw : name => role.arn }
}
