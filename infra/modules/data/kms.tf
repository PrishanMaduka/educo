# Two customer-managed keys (spec 20 → Secrets): `data` encrypts RDS, its logs and Performance
# Insights, the buckets, Secrets Manager and Redis; `field` is for field-level encryption in the
# API (TOTP secrets, safeguarding, medical notes, gateway credentials). Services that act for an
# IAM principal (RDS, S3, Secrets Manager, ElastiCache) use the key through that principal's IAM
# permissions, which the account-root statement delegates to.

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

data "aws_region" "current" {}

locals {
  tags        = { service = "data" }
  account_id  = data.aws_caller_identity.current.account_id
  partition   = data.aws_partition.current.partition
  region      = data.aws_region.current.region
  account_arn = "arn:${local.partition}:iam::${local.account_id}:root"

  account_administers_the_key = {
    Sid       = "AccountAdministersTheKey"
    Effect    = "Allow"
    Principal = { AWS = local.account_arn }
    Action    = "kms:*"
    Resource  = "*"
  }

  data_key_policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      local.account_administers_the_key,
      {
        Sid       = "LogsEncryptTheDatabaseLogGroupsOnly"
        Effect    = "Allow"
        Principal = { Service = "logs.${local.region}.amazonaws.com" }
        Action    = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource  = "*"
        Condition = {
          ArnLike = { "kms:EncryptionContext:aws:logs:arn" = "arn:${local.partition}:logs:${local.region}:${local.account_id}:log-group:/aws/rds/instance/${local.db_identifier}/*" }
        }
      },
    ], local.cloudfront_statements)
  })

  # CloudFront reads the SSE-KMS public bucket through origin access control (edge module). The
  # environment root passes the distribution ARN back in (module.edge.cloudfront_distribution_arn);
  # with none, there is no statement. With the S3 bucket key on, the encryption context is the
  # bucket ARN, so the key opens only the public bucket's objects.
  cloudfront_statements = length(var.cloudfront_distribution_arns) == 0 ? [] : [{
    Sid       = "CloudFrontReadsThePublicBucket"
    Effect    = "Allow"
    Principal = { Service = "cloudfront.amazonaws.com" }
    Action    = "kms:Decrypt"
    Resource  = "*"
    Condition = {
      ArnEquals    = { "aws:SourceArn" = var.cloudfront_distribution_arns }
      StringEquals = { "kms:EncryptionContext:aws:s3:arn" = "arn:${local.partition}:s3:::${var.public_bucket_name}" }
    }
  }]

  field_key_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [local.account_administers_the_key]
  })
}

resource "aws_kms_key" "data" {
  description             = "${var.name} data: RDS, S3, Secrets Manager and Redis"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = local.data_key_policy

  tags = local.tags
}

resource "aws_kms_alias" "data" {
  name          = "alias/${var.name}-data"
  target_key_id = aws_kms_key.data.key_id
}

resource "aws_kms_key" "field" {
  description             = "${var.name} field-level encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = local.field_key_policy

  tags = local.tags
}

resource "aws_kms_alias" "field" {
  name          = "alias/${var.name}-field"
  target_key_id = aws_kms_key.field.key_id
}
