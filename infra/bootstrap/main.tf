data "aws_caller_identity" "current" {}

locals {
  state_role_name = "quad-terraform-state"

  # The key policy keeps the key manageable through IAM in this account; the state role's own
  # policy grants it use of the key.
  state_key_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AccountAdministersTheKey"
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
      Action    = "kms:*"
      Resource  = "*"
    }]
  })

  state_bucket_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyPlainHttp"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })

  state_role_trust = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "NamedAccountsOnly"
      Effect    = "Allow"
      Principal = { AWS = [for id in var.trusted_account_ids : "arn:aws:iam::${id}:root"] }
      Action    = "sts:AssumeRole"
    }]
  })

  # What the S3 backend needs: list the bucket, read and write state objects and their
  # `.tflock` files (use_lockfile), lock items in DynamoDB, and the key that encrypts both.
  state_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ListStateBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [aws_s3_bucket.state.arn]
      },
      {
        Sid      = "StateObjects"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = ["${aws_s3_bucket.state.arn}/*/terraform.tfstate*"]
      },
      {
        Sid      = "LockItems"
        Effect   = "Allow"
        Action   = ["dynamodb:DescribeTable", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
        Resource = [aws_dynamodb_table.locks.arn]
      },
      {
        Sid      = "StateKey"
        Effect   = "Allow"
        Action   = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
        Resource = [aws_kms_key.state.arn]
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

# --- State role ---

resource "aws_iam_role" "state" {
  name                 = local.state_role_name
  description          = "Reads and writes Terraform state and locks; assumed from the trusted accounts."
  assume_role_policy   = local.state_role_trust
  max_session_duration = 3600

  tags = { service = "terraform-state" }
}

resource "aws_iam_role_policy" "state" {
  name   = "terraform-state"
  role   = aws_iam_role.state.id
  policy = local.state_role_policy
}
