# GitHub Actions roles in the staging account (D28). The repository's OIDC subject includes the
# repo, context and ref claims (`include_claim_keys: ["repo","context","ref"]`, a one-time
# setting in the README), so a subject names the repository, the environment or event, and the
# ref. Workflows reference the role ARNs as `vars.*`.
#   - deploy: the `staging` environment on main. Pushes images, registers task definitions,
#     updates services and runs the one-off tasks.
#   - plan: this repository's pull requests. ReadOnlyAccess with explicit denies; it reads state
#     only through the tooling account's state-read role.
#   - apply: the `infra-staging` environment on main. AdministratorAccess; it writes state and
#     DNS through the tooling account's roles (Task 8).

locals {
  github_oidc_host = "token.actions.githubusercontent.com"

  deploy_parameters_arn = "arn:${local.partition}:ssm:${local.region}:${local.account_id}:parameter${local.deploy_parameter_prefix}/*"

  tooling_role_arn = "arn:${local.partition}:iam::${var.tooling_account_id}:role"

  github_trust = {
    for role, subject in {
      deploy = { test = "StringEquals", sub = "repo:${var.github_repository}:environment:${var.github_environment}:ref:refs/heads/main" }
      plan   = { test = "StringLike", sub = "repo:${var.github_repository}:pull_request:ref:refs/pull/*" }
      apply  = { test = "StringEquals", sub = "repo:${var.github_repository}:environment:${var.github_infra_environment}:ref:refs/heads/main" }
      } : role => jsonencode({
        Version = "2012-10-17"
        Statement = [{
          Effect    = "Allow"
          Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
          Action    = "sts:AssumeRoleWithWebIdentity"
          Condition = subject.test == "StringEquals" ? {
            StringEquals = {
              "${local.github_oidc_host}:aud" = "sts.amazonaws.com"
              "${local.github_oidc_host}:sub" = subject.sub
            }
            } : {
            StringEquals = { "${local.github_oidc_host}:aud" = "sts.amazonaws.com" }
            StringLike   = { "${local.github_oidc_host}:sub" = subject.sub }
          }
        }]
    })
  }

  deploy_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "LogInToTheRegistry"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = ["*"]
      },
      {
        Sid    = "PushImages"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer",
          "ecr:DescribeImages",
        ]
        Resource = [for repo in aws_ecr_repository.this : repo.arn]
      },
      {
        # Neither action supports a resource-level permission.
        Sid      = "RegisterTaskDefinitions"
        Effect   = "Allow"
        Action   = ["ecs:RegisterTaskDefinition", "ecs:DescribeTaskDefinition"]
        Resource = ["*"]
      },
      {
        Sid      = "TagWhatTheDeployCreates"
        Effect   = "Allow"
        Action   = ["ecs:TagResource"]
        Resource = ["*"]
        Condition = {
          StringEquals = { "ecs:CreateAction" = ["RegisterTaskDefinition", "RunTask"] }
        }
      },
      {
        Sid      = "UpdateServices"
        Effect   = "Allow"
        Action   = ["ecs:UpdateService", "ecs:DescribeServices"]
        Resource = ["arn:${local.partition}:ecs:${local.region}:${local.account_id}:service/${aws_ecs_cluster.this.name}/*"]
      },
      {
        Sid       = "RunOneOffTasks"
        Effect    = "Allow"
        Action    = ["ecs:RunTask"]
        Resource  = [for key in sort(local.one_off_tasks) : "arn:${local.partition}:ecs:${local.region}:${local.account_id}:task-definition/${local.task_families[key]}:*"]
        Condition = { ArnEquals = { "ecs:cluster" = aws_ecs_cluster.this.arn } }
      },
      {
        Sid      = "WatchTasks"
        Effect   = "Allow"
        Action   = ["ecs:DescribeTasks"]
        Resource = ["arn:${local.partition}:ecs:${local.region}:${local.account_id}:task/${aws_ecs_cluster.this.name}/*"]
      },
      {
        Sid    = "PassTaskRoles"
        Effect = "Allow"
        Action = ["iam:PassRole"]
        Resource = concat(
          [for role in sort(keys(local.execution_roles)) : aws_iam_role.execution[role].arn],
          [for role in sort(local.task_roles) : aws_iam_role.task[role].arn],
        )
        Condition = { StringEquals = { "iam:PassedToService" = "ecs-tasks.amazonaws.com" } }
      },
      {
        Sid      = "ReadDeploySettings"
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = [local.deploy_parameters_arn]
      },
    ]
  })

  # ReadOnlyAccess plus explicit denies, as quad-tooling-plan does (Task 8): a deny always wins.
  # Ruling R-pr-plan: PR plans run with -refresh=false -lock=false, so nothing has to be carved out
  # for a refresh. ReadOnlyAccess would also show log events and database log files, which can
  # hold personal data, so those are denied too.
  plan_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AssumeStateAndDnsReadRoles"
        Effect = "Allow"
        Action = ["sts:AssumeRole"]
        Resource = [
          "${local.tooling_role_arn}/quad-terraform-state-read-${var.environment}",
          "${local.tooling_role_arn}/quad-dns-read",
        ]
      },
      {
        Sid      = "NoSecretOrParameterValuesOrDecryption"
        Effect   = "Deny"
        Action   = ["secretsmanager:GetSecretValue", "ssm:GetParameter*", "kms:Decrypt"]
        Resource = ["*"]
      },
      {
        Sid    = "NoLogContents"
        Effect = "Deny"
        Action = [
          "logs:GetLogEvents", "logs:FilterLogEvents", "logs:StartQuery", "logs:StartLiveTail",
          "logs:Unmask", "rds:DownloadDBLogFilePortion", "rds:DownloadCompleteDBLogFile",
        ]
        Resource = ["*"]
      },
    ]
  })

  apply_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AssumeStateAndDnsWriteRoles"
      Effect = "Allow"
      Action = ["sts:AssumeRole"]
      Resource = [
        "${local.tooling_role_arn}/quad-terraform-state-rw-${var.environment}",
        "${local.tooling_role_arn}/quad-dns-records-${var.environment}",
      ]
    }]
  })
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://${local.github_oidc_host}"
  client_id_list = ["sts.amazonaws.com"]

  tags = { service = "ci" }
}

# --- Deploy ---

resource "aws_iam_role" "deploy" {
  name                 = "${var.name}-deploy"
  description          = "Deploys ${var.name} from the ${var.github_environment} environment on main."
  assume_role_policy   = local.github_trust["deploy"]
  max_session_duration = 3600

  tags = { service = "ci" }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy"
  role   = aws_iam_role.deploy.id
  policy = local.deploy_policy
}

# --- Terraform plan ---

resource "aws_iam_role" "plan" {
  name                 = "${var.name}-plan"
  description          = "terraform plan for infra/envs/${var.environment} from this repository's pull requests."
  assume_role_policy   = local.github_trust["plan"]
  max_session_duration = 3600

  tags = { service = "ci" }
}

resource "aws_iam_role_policy_attachment" "plan_read_only" {
  role       = aws_iam_role.plan.name
  policy_arn = "arn:${local.partition}:iam::aws:policy/ReadOnlyAccess"
}

resource "aws_iam_role_policy" "plan" {
  name   = "state-read-and-secret-denies"
  role   = aws_iam_role.plan.id
  policy = local.plan_policy
}

# --- Terraform apply ---

resource "aws_iam_role" "apply" {
  name                 = "${var.name}-apply"
  description          = "terraform apply for infra/envs/${var.environment} from the ${var.github_infra_environment} environment on main."
  assume_role_policy   = local.github_trust["apply"]
  max_session_duration = 3600

  tags = { service = "ci" }
}

resource "aws_iam_role_policy_attachment" "apply_admin" {
  role       = aws_iam_role.apply.name
  policy_arn = "arn:${local.partition}:iam::aws:policy/AdministratorAccess"
}

resource "aws_iam_role_policy" "apply" {
  name   = "state-and-dns-write"
  role   = aws_iam_role.apply.id
  policy = local.apply_policy
}
