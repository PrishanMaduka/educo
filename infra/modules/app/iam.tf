# Execution and task roles. Execution roles are what ECS uses to pull the image, write logs and
# read the task's secrets; task roles are what the running code may do.
#   - runtime-exec (api, worker, staff, console, clamav) reads only the runtime secrets.
#   - migrate-exec (migrate, seed, db-bootstrap) reads the three role URLs and the RDS-managed
#     master secret (ruling R-db-admin).
#   - The api and worker task roles use the private bucket, the field key and SES. staff, console,
#     clamav and the one-off tasks have no task role.
# No role here has an rds or rds-db action, and no runtime role can read DATABASE_OWNER_URL or the
# master secret: the running app can never act as the schema owner or the master user, the
# IAM side of quad_app having no BYPASSRLS (D17).

locals {
  runtime_services = toset(keys(var.services))

  runtime_secret_arns = [
    var.env_secret_arns["DATABASE_URL"],
    var.env_secret_arns["DATABASE_PLATFORM_URL"],
    var.env_secret_arns["REDIS_URL"],
    aws_secretsmanager_secret.app["SESSION_SECRET"].arn,
    aws_secretsmanager_secret.app["LINK_SIGNING_SECRET"].arn,
    aws_secretsmanager_secret.app["SENTRY_DSN"].arn,
    aws_secretsmanager_secret.app["OTEL_EXPORTER_OTLP_HEADERS"].arn,
  ]

  one_off_secret_arns = [
    var.env_secret_arns["DATABASE_OWNER_URL"],
    var.env_secret_arns["DATABASE_URL"],
    var.env_secret_arns["DATABASE_PLATFORM_URL"],
    var.db_master_secret_arn,
  ]

  ecs_tasks_trust = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = { "aws:SourceAccount" = local.account_id }
        ArnLike      = { "aws:SourceArn" = "arn:${local.partition}:ecs:${local.region}:${local.account_id}:*" }
      }
    }]
  })

  ecr_token_statement = {
    Sid      = "GetRegistryToken"
    Effect   = "Allow"
    Action   = ["ecr:GetAuthorizationToken"]
    Resource = ["*"]
  }

  ecr_pull_actions = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"]

  # The secrets are encrypted with the data key; ECS decrypts them through Secrets Manager only.
  decrypt_secrets_statement = {
    Sid       = "DecryptSecretsWithTheDataKey"
    Effect    = "Allow"
    Action    = ["kms:Decrypt"]
    Resource  = [var.data_kms_key_arn]
    Condition = { StringEquals = { "kms:ViaService" = "secretsmanager.${local.region}.amazonaws.com" } }
  }

  runtime_exec_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      local.ecr_token_statement,
      {
        Sid      = "PullServiceImages"
        Effect   = "Allow"
        Action   = local.ecr_pull_actions
        Resource = [for repo in aws_ecr_repository.this : repo.arn]
      },
      {
        Sid      = "WriteServiceLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = [for key in sort(local.runtime_services) : "${aws_cloudwatch_log_group.this[key].arn}:*"]
      },
      {
        Sid      = "ReadRuntimeSecrets"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = local.runtime_secret_arns
      },
      local.decrypt_secrets_statement,
    ]
  })

  migrate_exec_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      local.ecr_token_statement,
      {
        Sid      = "PullTheApiImage"
        Effect   = "Allow"
        Action   = local.ecr_pull_actions
        Resource = [aws_ecr_repository.this["api"].arn]
      },
      {
        Sid      = "WriteOneOffLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = [for key in sort(local.one_off_tasks) : "${aws_cloudwatch_log_group.this[key].arn}:*"]
      },
      {
        Sid      = "ReadRoleUrlsAndTheMasterSecret"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = local.one_off_secret_arns
      },
      local.decrypt_secrets_statement,
    ]
  })

  # The private bucket is SSE-KMS with the data key, so object reads and writes also need the key,
  # through S3 only.
  task_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "PrivateBucketObjects"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload"]
        Resource = ["${var.private_bucket_arn}/*"]
      },
      {
        Sid      = "ListPrivateBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [var.private_bucket_arn]
      },
      {
        Sid       = "PrivateBucketEncryption"
        Effect    = "Allow"
        Action    = ["kms:GenerateDataKey", "kms:Decrypt"]
        Resource  = [var.data_kms_key_arn]
        Condition = { StringEquals = { "kms:ViaService" = "s3.${local.region}.amazonaws.com" } }
      },
      {
        Sid      = "FieldEncryption"
        Effect   = "Allow"
        Action   = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"]
        Resource = [var.field_kms_key_arn]
      },
      {
        Sid    = "SendEmail"
        Effect = "Allow"
        Action = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = [
          var.ses_identity_arn,
          "arn:${local.partition}:ses:${local.region}:${local.account_id}:configuration-set/${var.ses_configuration_set_name}",
        ]
      },
    ]
  })
}

# --- Execution roles ---

resource "aws_iam_role" "runtime_exec" {
  name                 = "${var.name}-runtime-exec"
  description          = "ECS execution role of the ${var.name} services: images, logs and runtime secrets."
  assume_role_policy   = local.ecs_tasks_trust
  max_session_duration = 3600

  tags = { service = "app" }
}

resource "aws_iam_role_policy" "runtime_exec" {
  name   = "runtime-exec"
  role   = aws_iam_role.runtime_exec.id
  policy = local.runtime_exec_policy
}

resource "aws_iam_role" "migrate_exec" {
  name                 = "${var.name}-migrate-exec"
  description          = "ECS execution role of the ${var.name} one-off tasks: the api image, logs, role URLs and the RDS master secret."
  assume_role_policy   = local.ecs_tasks_trust
  max_session_duration = 3600

  tags = { service = "app" }
}

resource "aws_iam_role_policy" "migrate_exec" {
  name   = "migrate-exec"
  role   = aws_iam_role.migrate_exec.id
  policy = local.migrate_exec_policy
}

# --- Task roles ---

resource "aws_iam_role" "task" {
  for_each = local.task_roles

  name                 = "${var.name}-${each.key}-task"
  description          = "What the ${each.key} code may do: the private bucket, the field key and SES."
  assume_role_policy   = local.ecs_tasks_trust
  max_session_duration = 3600

  tags = { service = each.key }
}

resource "aws_iam_role_policy" "task" {
  for_each = local.task_roles

  name   = "${each.key}-task"
  role   = aws_iam_role.task[each.key].id
  policy = local.task_policy
}
