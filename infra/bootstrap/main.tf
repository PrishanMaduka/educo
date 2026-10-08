data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region
  bucket_arn = "arn:aws:s3:::${var.state_bucket_name}"

  # Role ARNs are built from their names so the bucket policy can name them before they exist.
  read_role_arns = { for name, _ in var.state_environments : name => "arn:aws:iam::${local.account_id}:role/quad-terraform-state-read-${name}" }
  rw_role_arns   = { for name, _ in var.state_environments : name => "arn:aws:iam::${local.account_id}:role/quad-terraform-state-rw-${name}" }

  # The S3 backend keys: the state object, its .tflock object (use_lockfile), and in DynamoDB the
  # lock item <bucket>/<key> and the digest item <bucket>/<key>-md5.
  state_keys = { for name, _ in var.state_environments : name => "${name}/terraform.tfstate" }

  # The key policy only hands the key to this account's IAM; the roles' policies grant its use.
  state_key_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AccountAdministersTheKey"
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::${local.account_id}:root" }
      Action    = "kms:*"
      Resource  = "*"
    }]
  })

  state_bucket_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyPlainHttp"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [local.bucket_arn, "${local.bucket_arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
      {
        # `encrypt = true` without kms_key_id sends AES256, which would override the bucket default.
        Sid       = "DenyUploadsNotKms"
        Effect    = "Deny"
        Principal = "*"
        Action    = ["s3:PutObject"]
        Resource  = ["${local.bucket_arn}/*"]
        Condition = { StringNotEqualsIfExists = { "s3:x-amz-server-side-encryption" = "aws:kms" } }
      },
      {
        Sid       = "DenyUploadsWithAnotherKey"
        Effect    = "Deny"
        Principal = "*"
        Action    = ["s3:PutObject"]
        Resource  = ["${local.bucket_arn}/*"]
        Condition = { StringNotEqualsIfExists = { "s3:x-amz-server-side-encryption-aws-kms-key-id" = aws_kms_key.state.arn } }
      },
      {
        # Defence in depth: a broad read policy elsewhere (ReadOnlyAccess) still cannot reach state,
        # any version of it, its tags or ACL, or restore it.
        Sid       = "OnlyStateRolesTouchObjects"
        Effect    = "Deny"
        Principal = "*"
        Action    = ["s3:GetObject*", "s3:PutObject*", "s3:DeleteObject*", "s3:RestoreObject"]
        Resource  = ["${local.bucket_arn}/*"]
        Condition = {
          ArnNotEquals = {
            "aws:PrincipalArn" = concat(values(local.read_role_arns), values(local.rw_role_arns), var.break_glass_principal_arns)
          }
        }
      },
    ]
  })
}

# --- Encryption key ---

resource "aws_kms_key" "state" {
  description             = "Terraform state and lock table"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = local.state_key_policy

  tags = { service = "terraform-state" }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_kms_alias" "state" {
  name          = "alias/quad-terraform-state"
  target_key_id = aws_kms_key.state.key_id
}

# --- State bucket ---

resource "aws_s3_bucket" "state" {
  #checkov:skip=CKV_AWS_18:Access logging needs a separate log bucket; CloudTrail data events for the tooling account arrive with production in M12.
  #checkov:skip=CKV_AWS_144:Cross-region replication of state is a production (M12) decision; versioning and prevent_destroy cover staging.
  #checkov:skip=CKV2_AWS_62:Nothing consumes events from the state bucket.
  bucket = var.state_bucket_name

  tags = { service = "terraform-state" }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    bucket_key_enabled = true

    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.state.arn
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  # Old state versions are the recovery path, so keep the last 20 and anything under 90 days.
  rule {
    id     = "old-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days           = 90
      newer_noncurrent_versions = 20
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.state]
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = local.state_bucket_policy

  depends_on = [aws_s3_bucket_public_access_block.state]
}

# --- Lock table ---

resource "aws_dynamodb_table" "locks" {
  name                        = var.lock_table_name
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "LockID"
  deletion_protection_enabled = true

  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.state.arn
  }

  tags = { service = "terraform-state" }

  lifecycle {
    prevent_destroy = true
  }
}
