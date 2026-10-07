# The bootstrap root's own state, after the first apply. That apply cannot use this backend because
# the bucket does not exist yet: a break-glass administrator runs it with a git-ignored
# `local_override.tf` holding `terraform { backend "local" {} }`, then deletes the override and runs
# `init -migrate-state` with -backend-config bucket, dynamodb_table and kms_key_id (the outputs).
# Only break-glass roles can reach bootstrap/terraform.tfstate (the bucket policy).
terraform {
  backend "s3" {
    key          = "bootstrap/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}
