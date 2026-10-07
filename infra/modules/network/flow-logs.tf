# VPC flow logs (every accepted and rejected flow) to a CloudWatch log group encrypted with its own
# key. The network module comes before the data module, so it cannot use the data key.

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

locals {
  account_id         = data.aws_caller_identity.current.account_id
  flow_log_group     = "/aws/vpc-flow-logs/${var.name}"
  flow_log_group_arn = "arn:${data.aws_partition.current.partition}:logs:${data.aws_region.current.region}:${local.account_id}:log-group:${local.flow_log_group}"

  flow_log_key_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AccountAdministersTheKey"
        Effect    = "Allow"
        Principal = { AWS = "arn:${data.aws_partition.current.partition}:iam::${local.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "LogsEncryptTheFlowLogGroupOnly"
        Effect    = "Allow"
        Principal = { Service = "logs.${data.aws_region.current.region}.amazonaws.com" }
        Action    = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource  = "*"
        Condition = {
          ArnEquals = { "kms:EncryptionContext:aws:logs:arn" = local.flow_log_group_arn }
        }
      },
    ]
  })

  flow_log_trust_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = { "aws:SourceAccount" = local.account_id }
        ArnLike      = { "aws:SourceArn" = "arn:${data.aws_partition.current.partition}:ec2:${data.aws_region.current.region}:${local.account_id}:vpc-flow-log/*" }
      }
    }]
  })

  flow_log_write_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
      Resource = ["${aws_cloudwatch_log_group.flow_logs.arn}:*"]
    }]
  })
}

resource "aws_kms_key" "flow_logs" {
  description             = "${var.name} VPC flow logs"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = local.flow_log_key_policy

  tags = local.tags
}

resource "aws_kms_alias" "flow_logs" {
  name          = "alias/${var.name}-flow-logs"
  target_key_id = aws_kms_key.flow_logs.key_id
}

resource "aws_cloudwatch_log_group" "flow_logs" {
  #checkov:skip=CKV_AWS_338:Staging keeps flow logs for flow_log_retention_days (30); production retention is an M12 decision.
  name              = local.flow_log_group
  retention_in_days = var.flow_log_retention_days
  kms_key_id        = aws_kms_key.flow_logs.arn

  tags = local.tags
}

resource "aws_iam_role" "flow_logs" {
  name               = "${var.name}-vpc-flow-logs"
  assume_role_policy = local.flow_log_trust_policy

  tags = local.tags
}

resource "aws_iam_role_policy" "flow_logs" {
  name   = "write-flow-logs"
  role   = aws_iam_role.flow_logs.id
  policy = local.flow_log_write_policy
}

resource "aws_flow_log" "this" {
  vpc_id                   = aws_vpc.this.id
  traffic_type             = "ALL"
  log_destination_type     = "cloud-watch-logs"
  log_destination          = aws_cloudwatch_log_group.flow_logs.arn
  iam_role_arn             = aws_iam_role.flow_logs.arn
  max_aggregation_interval = 60

  tags = merge(local.tags, { Name = var.name })
}
