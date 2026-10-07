# Per-environment state roles. Plans assume quad-terraform-state-read-<env> and run with
# -lock=false; applies assume quad-terraform-state-rw-<env>. Each trusts the account roots of its
# principals, narrowed to the exact role ARNs by aws:PrincipalArn.

locals {
  kms_via_services = ["s3.${local.region}.amazonaws.com", "dynamodb.${local.region}.amazonaws.com"]

  state_read_trust = {
    for name, environment in var.state_environments : name => jsonencode({
      Version = "2012-10-17"
      Statement = [{
        Sid       = "PlanPrincipalsOnly"
        Effect    = "Allow"
        Principal = { AWS = distinct([for arn in environment.plan_principal_arns : "arn:aws:iam::${split(":", arn)[4]}:root"]) }
        Action    = "sts:AssumeRole"
        Condition = { ArnEquals = { "aws:PrincipalArn" = environment.plan_principal_arns } }
      }]
    })
  }

  state_rw_trust = {
    for name, environment in var.state_environments : name => jsonencode({
      Version = "2012-10-17"
      Statement = [{
        Sid       = "ApplyPrincipalsOnly"
        Effect    = "Allow"
        Principal = { AWS = distinct([for arn in environment.apply_principal_arns : "arn:aws:iam::${split(":", arn)[4]}:root"]) }
        Action    = "sts:AssumeRole"
        Condition = { ArnEquals = { "aws:PrincipalArn" = environment.apply_principal_arns } }
      }]
    })
  }

  # The S3 backend lists workspaces under env:/ during init (there are none), so that prefix is
  # listable too. The digest item <bucket>/<key>-md5 is read even with -lock=false.
  state_read_policy = {
    for name, key in local.state_keys : name => jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Sid       = "ListOwnPrefix"
          Effect    = "Allow"
          Action    = ["s3:ListBucket"]
          Resource  = [local.bucket_arn]
          Condition = { StringLike = { "s3:prefix" = [key, "env:/"] } }
        },
        {
          Sid      = "ReadOwnState"
          Effect   = "Allow"
          Action   = ["s3:GetObject"]
          Resource = ["${local.bucket_arn}/${key}"]
        },
        {
          Sid       = "ReadOwnDigest"
          Effect    = "Allow"
          Action    = ["dynamodb:GetItem"]
          Resource  = [aws_dynamodb_table.locks.arn]
          Condition = { "ForAllValues:StringEquals" = { "dynamodb:LeadingKeys" = ["${var.state_bucket_name}/${key}-md5"] } }
        },
        {
          Sid       = "DecryptThroughStorageOnly"
          Effect    = "Allow"
          Action    = ["kms:Decrypt"]
          Resource  = [aws_kms_key.state.arn]
          Condition = { StringEquals = { "kms:ViaService" = local.kms_via_services } }
        },
      ]
    })
  }

  state_rw_policy = {
    for name, key in local.state_keys : name => jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Sid       = "ListOwnPrefix"
          Effect    = "Allow"
          Action    = ["s3:ListBucket"]
          Resource  = [local.bucket_arn]
          Condition = { StringLike = { "s3:prefix" = ["${key}*", "env:/"] } }
        },
        {
          Sid      = "OwnStateAndLockFile"
          Effect   = "Allow"
          Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
          Resource = ["${local.bucket_arn}/${key}*"]
        },
        {
          Sid      = "OwnLockItems"
          Effect   = "Allow"
          Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
          Resource = [aws_dynamodb_table.locks.arn]
          Condition = {
            "ForAllValues:StringEquals" = {
              "dynamodb:LeadingKeys" = ["${var.state_bucket_name}/${key}", "${var.state_bucket_name}/${key}-md5"]
            }
          }
        },
        {
          Sid       = "UseKeyThroughStorageOnly"
          Effect    = "Allow"
          Action    = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"]
          Resource  = [aws_kms_key.state.arn]
          Condition = { StringEquals = { "kms:ViaService" = local.kms_via_services } }
        },
      ]
    })
  }
}

resource "aws_iam_role" "state_read" {
  for_each = var.state_environments

  name                 = "quad-terraform-state-read-${each.key}"
  description          = "Reads ${each.key} Terraform state for plans (-lock=false)."
  assume_role_policy   = local.state_read_trust[each.key]
  max_session_duration = 3600

  tags = { service = "terraform-state" }
}

resource "aws_iam_role_policy" "state_read" {
  for_each = var.state_environments

  name   = "terraform-state-read"
  role   = aws_iam_role.state_read[each.key].id
  policy = local.state_read_policy[each.key]
}

resource "aws_iam_role" "state_rw" {
  for_each = var.state_environments

  name                 = "quad-terraform-state-rw-${each.key}"
  description          = "Reads, writes and locks ${each.key} Terraform state for applies."
  assume_role_policy   = local.state_rw_trust[each.key]
  max_session_duration = 3600

  tags = { service = "terraform-state" }
}

resource "aws_iam_role_policy" "state_rw" {
  for_each = var.state_environments

  name   = "terraform-state-rw"
  role   = aws_iam_role.state_rw[each.key].id
  policy = local.state_rw_policy[each.key]
}
