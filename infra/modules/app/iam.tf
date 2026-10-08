# Execution and task roles. Execution roles are what ECS uses to pull the image, write logs and
# read the task's secrets; task roles are what the running code may do.
#   - runtime-exec (api, worker) reads only the runtime secrets.
#   - web-exec (staff, console) reads only SENTRY_DSN and OTEL_EXPORTER_OTLP_HEADERS.
#   - clamav-exec (clamav) reads no secret.
#   - migrate-exec (migrate, seed, db-bootstrap) reads the three role URLs and the RDS-managed
#     master secret (ruling R-db-admin).
#   - The api and worker task roles use the private bucket, the field key and SES. staff, console,
#     clamav and the one-off tasks have no task role.
# No role here has an rds or rds-db action, and no runtime role can read DATABASE_OWNER_URL or the
# master secret: the running app can never act as the schema owner or the master user, the
# IAM side of quad_app having no BYPASSRLS (D17).

locals {
  # Each execution role: the tasks it serves and the images they run.
  execution_roles = {
    runtime = { tasks = ["api", "worker"], images = ["api"] }
    web     = { tasks = ["staff", "console"], images = ["staff", "console"] }
    clamav  = { tasks = ["clamav"], images = ["clamav"] }
    migrate = { tasks = ["db-bootstrap", "migrate", "seed"], images = ["api"] }
  }
  execution_role_of = merge([for role, spec in local.execution_roles : { for task in spec.tasks : task => role }]...)

  runtime_secret_arns = [
    var.env_secret_arns["DATABASE_URL"],
    var.env_secret_arns["DATABASE_PLATFORM_URL"],
    var.env_secret_arns["REDIS_URL"],
    aws_secretsmanager_secret.app["SESSION_SECRET"].arn,
    aws_secretsmanager_secret.app["LINK_SIGNING_SECRET"].arn,
    aws_secretsmanager_secret.app["FIELD_ENCRYPTION_KEY"].arn,
    aws_secretsmanager_secret.app["JWT_PRIVATE_KEY"].arn,
    aws_secretsmanager_secret.app["JWT_PUBLIC_KEY"].arn,
    aws_secretsmanager_secret.app["SENTRY_DSN"].arn,
    aws_secretsmanager_secret.app["OTEL_EXPORTER_OTLP_HEADERS"].arn,
  ]

  web_secret_arns = [
    aws_secretsmanager_secret.app["SENTRY_DSN"].arn,
    aws_secretsmanager_secret.app["OTEL_EXPORTER_OTLP_HEADERS"].arn,
  ]

  one_off_secret_arns = [
    var.env_secret_arns["DATABASE_OWNER_URL"],
    var.env_secret_arns["DATABASE_URL"],
    var.env_secret_arns["DATABASE_PLATFORM_URL"],
    var.db_master_secret_arn,
    # The seed task's (it shares this role with db-bootstrap and migrate).
    aws_secretsmanager_secret.app["FIELD_ENCRYPTION_KEY"].arn,
    aws_secretsmanager_secret.app["SEED_PASSWORD"].arn,
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

  execution_secret_arns = {
    runtime = local.runtime_secret_arns
    web     = local.web_secret_arns
    clamav  = []
    migrate = local.one_off_secret_arns
  }

  execution_policies = {
    for role, spec in local.execution_roles : role => jsonencode({
      Version = "2012-10-17"
      Statement = concat(
        [
          local.ecr_token_statement,
          {
            Sid      = "PullImages"
            Effect   = "Allow"
            Action   = local.ecr_pull_actions
            Resource = [for image in spec.images : aws_ecr_repository.this[image].arn]
          },
          {
            Sid      = "WriteLogs"
            Effect   = "Allow"
            Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
            Resource = [for task in spec.tasks : "${aws_cloudwatch_log_group.this[task].arn}:*"]
          },
        ],
        # Only roles with secrets read and decrypt them (clamav-exec has none).
        [
          for statement in [
            {
              Sid      = "ReadSecrets"
              Effect   = "Allow"
              Action   = ["secretsmanager:GetSecretValue"]
              Resource = local.execution_secret_arns[role]
            },
            local.decrypt_secrets_statement,
          ] : statement if length(local.execution_secret_arns[role]) > 0
        ],
      )
    })
  }

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

resource "aws_iam_role" "execution" {
  for_each = local.execution_roles

  name                 = "${var.name}-${each.key}-exec"
  description          = "ECS execution role of ${join(", ", each.value.tasks)}: images, logs and their secrets."
  assume_role_policy   = local.ecs_tasks_trust
  max_session_duration = 3600

  tags = { service = "app" }
}

resource "aws_iam_role_policy" "execution" {
  for_each = local.execution_roles

  name   = "${each.key}-exec"
  role   = aws_iam_role.execution[each.key].id
  policy = local.execution_policies[each.key]
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
