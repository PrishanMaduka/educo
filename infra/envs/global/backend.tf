# bucket, dynamodb_table, kms_key_id and assume_role come from -backend-config. CI passes
# vars.TF_STATE_BUCKET, vars.TF_LOCK_TABLE, vars.TF_STATE_KMS_KEY_ARN and, for plans (with
# -lock=false), vars.TF_GLOBAL_STATE_READ_ROLE_ARN. kms_key_id is required: with `encrypt = true`
# alone the backend sends AES256, which the state bucket policy refuses. use_lockfile locks with
# an S3 object alongside the DynamoDB table, which Terraform deprecated in 1.11.
terraform {
  backend "s3" {
    key          = "global/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}
