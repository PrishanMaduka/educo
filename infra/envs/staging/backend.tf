# bucket, dynamodb_table, kms_key_id and assume_role come from -backend-config:
#   -backend-config bucket=<vars.TF_STATE_BUCKET>
#   -backend-config dynamodb_table=<vars.TF_LOCK_TABLE>
#   -backend-config kms_key_id=<vars.TF_STATE_KMS_KEY_ARN>
#   -backend-config 'assume_role={role_arn="<role>"}'
# where <role> is vars.TF_STAGING_STATE_READ_ROLE_ARN for plans (with -lock=false) and
# vars.TF_STAGING_STATE_RW_ROLE_ARN for applies. kms_key_id is required: with `encrypt = true`
# alone the backend sends AES256, which the state bucket policy refuses. use_lockfile locks with an
# S3 object alongside the DynamoDB table, which Terraform deprecated in 1.11.
terraform {
  backend "s3" {
    key          = "staging/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}
