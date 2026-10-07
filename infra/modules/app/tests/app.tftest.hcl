# The staging application layer, checked offline. AWS is mocked (infra/tests/mocks/aws). The
# random provider is the real one: mock providers cannot mock ephemeral resources, and random runs
# locally, so it never reaches an account.

mock_provider "aws" {
  source = "../../tests/mocks/aws"
}

# The shared mock gives every role and secret the same ARN; distinct ARNs let the IAM tests tell
# them apart.
override_resource {
  target = aws_iam_role.execution["runtime"]
  values = { arn = "arn:aws:iam::123456789012:role/quad-staging-runtime-exec", name = "quad-staging-runtime-exec" }
}

override_resource {
  target = aws_iam_role.execution["web"]
  values = { arn = "arn:aws:iam::123456789012:role/quad-staging-web-exec", name = "quad-staging-web-exec" }
}

override_resource {
  target = aws_iam_role.execution["clamav"]
  values = { arn = "arn:aws:iam::123456789012:role/quad-staging-clamav-exec", name = "quad-staging-clamav-exec" }
}

override_resource {
  target = aws_iam_role.execution["migrate"]
  values = { arn = "arn:aws:iam::123456789012:role/quad-staging-migrate-exec", name = "quad-staging-migrate-exec" }
}

override_resource {
  target = aws_iam_role.task["api"]
  values = { arn = "arn:aws:iam::123456789012:role/quad-staging-api-task", name = "quad-staging-api-task" }
}

override_resource {
  target = aws_iam_role.task["worker"]
  values = { arn = "arn:aws:iam::123456789012:role/quad-staging-worker-task", name = "quad-staging-worker-task" }
}

override_resource {
  target = aws_iam_role.deploy
  values = { arn = "arn:aws:iam::123456789012:role/quad-staging-deploy" }
}

override_resource {
  target = aws_secretsmanager_secret.app["SESSION_SECRET"]
  values = { arn = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:quad-staging/env/SESSION_SECRET-AbCdEf" }
}

override_resource {
  target = aws_secretsmanager_secret.app["LINK_SIGNING_SECRET"]
  values = { arn = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:quad-staging/env/LINK_SIGNING_SECRET-AbCdEf" }
}

override_resource {
  target = aws_secretsmanager_secret.app["SENTRY_DSN"]
  values = { arn = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:quad-staging/env/SENTRY_DSN-AbCdEf" }
}

override_resource {
  target = aws_secretsmanager_secret.app["OTEL_EXPORTER_OTLP_HEADERS"]
  values = { arn = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:quad-staging/env/OTEL_EXPORTER_OTLP_HEADERS-AbCdEf" }
}

variables {
  name               = "quad-staging"
  vpc_id             = "vpc-0123456789abcdef0"
  private_subnet_ids = ["subnet-0aaaaaaaaaaaaaaa1", "subnet-0bbbbbbbbbbbbbbb2", "subnet-0ccccccccccccccc3"]

  data_client_security_group_id = "sg-0c11e7c11e7c11e70"
  env_secret_arns = {
    DATABASE_URL          = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:quad-staging/env/DATABASE_URL-AbCdEf"
    DATABASE_PLATFORM_URL = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:quad-staging/env/DATABASE_PLATFORM_URL-AbCdEf"
    DATABASE_OWNER_URL    = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:quad-staging/env/DATABASE_OWNER_URL-AbCdEf"
    REDIS_URL             = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:quad-staging/env/REDIS_URL-AbCdEf"
  }
  db_master_secret_arn = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:rds!db-00000000-0000-4000-8000-000000000000-AbCdEf"
  db_instance_address  = "quad-staging.c0mockmockmo.ap-south-1.rds.amazonaws.com"
  private_bucket_name  = "quad-staging-private"
  private_bucket_arn   = "arn:aws:s3:::quad-staging-private"
  public_bucket_name   = "quad-staging-public"
  data_kms_key_arn     = "arn:aws:kms:ap-south-1:123456789012:key/11111111-1111-4111-8111-111111111111"
  field_kms_key_arn    = "arn:aws:kms:ap-south-1:123456789012:key/22222222-2222-4222-8222-222222222222"

  alb_security_group_id = "sg-0a1b0a1b0a1b0a1b0"
  target_group_arns = {
    api        = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:targetgroup/quad-staging-api/0000000000000001"
    api_socket = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:targetgroup/quad-staging-api-socket/0000000000000002"
    staff      = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:targetgroup/quad-staging-staff/0000000000000003"
    console    = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:targetgroup/quad-staging-console/0000000000000004"
  }

  ses_identity_arn           = "arn:aws:ses:ap-south-1:123456789012:identity/mail.quad-edu.com"
  ses_configuration_set_name = "quad-staging"
  ses_events_topic_arn       = "arn:aws:sns:ap-south-1:123456789012:quad-staging-ses-events"

  tooling_account_id = "210987654321"
}

# Assertions compare structured values through jsonencode, because Terraform's == is
# type-sensitive (a tuple literal never equals a list or set attribute).

run "oidc_trust_is_this_repo_main_and_staging_only" {
  command = apply

  assert {
    condition     = length(jsondecode(aws_iam_role.deploy.assume_role_policy).Statement) == 1
    error_message = "The deploy role must have exactly one trust statement."
  }

  assert {
    condition = (
      jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:prishanmaduka/educo:environment:staging:ref:refs/heads/main" &&
      jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com" &&
      jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Action == "sts:AssumeRoleWithWebIdentity" &&
      jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Principal.Federated == aws_iam_openid_connect_provider.github.arn &&
      !can(jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Condition.StringLike)
    )
    error_message = "The deploy role trusts only this repository's staging environment on main, with the sts audience."
  }

  assert {
    condition = (
      length(jsondecode(aws_iam_role.plan.assume_role_policy).Statement) == 1 &&
      jsondecode(aws_iam_role.plan.assume_role_policy).Statement[0].Condition.StringLike["token.actions.githubusercontent.com:sub"] == "repo:prishanmaduka/educo:pull_request:ref:refs/pull/*" &&
      jsondecode(aws_iam_role.plan.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com" &&
      !can(jsondecode(aws_iam_role.plan.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"])
    )
    error_message = "The plan role trusts only this repository's pull requests (StringLike on refs/pull/*)."
  }

  assert {
    condition = (
      length(jsondecode(aws_iam_role.apply.assume_role_policy).Statement) == 1 &&
      jsondecode(aws_iam_role.apply.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:prishanmaduka/educo:environment:infra-staging:ref:refs/heads/main" &&
      jsondecode(aws_iam_role.apply.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com" &&
      !can(jsondecode(aws_iam_role.apply.assume_role_policy).Statement[0].Condition.StringLike)
    )
    error_message = "The apply role trusts only this repository's infra-staging environment on main."
  }

  assert {
    condition = (
      aws_iam_openid_connect_provider.github.url == "https://token.actions.githubusercontent.com" &&
      jsonencode(aws_iam_openid_connect_provider.github.client_id_list) == jsonencode(["sts.amazonaws.com"])
    )
    error_message = "The OIDC provider is GitHub Actions with the sts audience only."
  }
}

run "runtime_cannot_act_as_owner_or_master" {
  command = apply

  assert {
    condition = (
      contains(flatten([for s in jsondecode(aws_iam_role_policy.execution["runtime"].policy).Statement : s.Resource]), var.env_secret_arns["DATABASE_URL"]) &&
      !contains(flatten([for s in jsondecode(aws_iam_role_policy.execution["runtime"].policy).Statement : s.Resource]), var.env_secret_arns["DATABASE_OWNER_URL"]) &&
      !strcontains(aws_iam_role_policy.execution["runtime"].policy, var.db_master_secret_arn)
    )
    error_message = "runtime-exec reads DATABASE_URL but never DATABASE_OWNER_URL or the RDS-managed master secret (ruling R-db-admin)."
  }

  assert {
    condition = alltrue(flatten([
      for service in ["api", "worker", "staff", "console", "clamav"] : [
        for container in jsondecode(aws_ecs_task_definition.this[service].container_definitions) : [
          for secret in try(container.secrets, []) :
          !contains(["DATABASE_OWNER_URL", "DATABASE_ADMIN_URL", "DATABASE_ADMIN_USER", "DATABASE_ADMIN_PASSWORD"], secret.name)
        ]
      ]
    ]))
    error_message = "No runtime container may get the owner URL or the admin credentials."
  }

  assert {
    condition = (
      aws_ecs_task_definition.this["api"].execution_role_arn == aws_iam_role.execution["runtime"].arn &&
      aws_ecs_task_definition.this["worker"].execution_role_arn == aws_iam_role.execution["runtime"].arn &&
      aws_ecs_task_definition.this["staff"].execution_role_arn == aws_iam_role.execution["web"].arn &&
      aws_ecs_task_definition.this["console"].execution_role_arn == aws_iam_role.execution["web"].arn &&
      aws_ecs_task_definition.this["clamav"].execution_role_arn == aws_iam_role.execution["clamav"].arn
    )
    error_message = "api and worker use runtime-exec, staff and console web-exec, clamav clamav-exec."
  }

  assert {
    condition = (
      jsonencode(sort(flatten([for s in jsondecode(aws_iam_role_policy.execution["web"].policy).Statement : s.Resource if contains(flatten([s.Action]), "secretsmanager:GetSecretValue")]))) ==
      jsonencode(sort([aws_secretsmanager_secret.app["SENTRY_DSN"].arn, aws_secretsmanager_secret.app["OTEL_EXPORTER_OTLP_HEADERS"].arn])) &&
      !strcontains(aws_iam_role_policy.execution["clamav"].policy, "secretsmanager") &&
      !strcontains(aws_iam_role_policy.execution["clamav"].policy, "kms:")
    )
    error_message = "web-exec reads only SENTRY_DSN and the OTLP headers; clamav-exec reads no secret."
  }

  assert {
    condition = (
      jsonencode(flatten([for s in jsondecode(aws_iam_role_policy.execution["runtime"].policy).Statement : s.Resource if contains(flatten([s.Action]), "ecr:BatchGetImage")])) == jsonencode([aws_ecr_repository.this["api"].arn]) &&
      jsonencode(sort(flatten([for s in jsondecode(aws_iam_role_policy.execution["web"].policy).Statement : s.Resource if contains(flatten([s.Action]), "ecr:BatchGetImage")]))) == jsonencode(sort([aws_ecr_repository.this["staff"].arn, aws_ecr_repository.this["console"].arn])) &&
      jsonencode(sort(flatten([for s in jsondecode(aws_iam_role_policy.execution["web"].policy).Statement : s.Resource if contains(flatten([s.Action]), "logs:PutLogEvents")]))) == jsonencode(sort(["${aws_cloudwatch_log_group.this["staff"].arn}:*", "${aws_cloudwatch_log_group.this["console"].arn}:*"]))
    )
    error_message = "Each execution role pulls only its images and writes only its log groups."
  }

  assert {
    condition = alltrue([
      for policy in aws_iam_role_policy.task :
      !strcontains(lower(policy.policy), "rds") && !strcontains(policy.policy, "secretsmanager")
    ])
    error_message = "No task role may have an rds or rds-db action, or read a secret."
  }

  assert {
    condition = (
      aws_ecs_task_definition.this["staff"].task_role_arn == null &&
      aws_ecs_task_definition.this["console"].task_role_arn == null &&
      aws_ecs_task_definition.this["clamav"].task_role_arn == null &&
      aws_ecs_task_definition.this["api"].task_role_arn == aws_iam_role.task["api"].arn &&
      aws_ecs_task_definition.this["worker"].task_role_arn == aws_iam_role.task["worker"].arn
    )
    error_message = "Only the api and worker tasks have task roles."
  }
}

run "db_bootstrap_reads_the_rds_managed_master_secret" {
  command = apply

  assert {
    condition = (
      jsonencode({ for s in jsondecode(aws_ecs_task_definition.this["db-bootstrap"].container_definitions)[0].secrets : s.name => s.valueFrom if startswith(s.name, "DATABASE_ADMIN_") }) ==
      jsonencode({
        DATABASE_ADMIN_PASSWORD = "${var.db_master_secret_arn}:password::"
        DATABASE_ADMIN_USER     = "${var.db_master_secret_arn}:username::"
      })
    )
    error_message = "db-bootstrap maps the master secret's username and password JSON keys."
  }

  assert {
    condition = (
      { for e in jsondecode(aws_ecs_task_definition.this["db-bootstrap"].container_definitions)[0].environment : e.name => e.value }["DATABASE_ADMIN_HOST"] == var.db_instance_address &&
      { for e in jsondecode(aws_ecs_task_definition.this["db-bootstrap"].container_definitions)[0].environment : e.name => e.value }["DATABASE_ADMIN_PORT"] == "5432" &&
      { for e in jsondecode(aws_ecs_task_definition.this["db-bootstrap"].container_definitions)[0].environment : e.name => e.value }["NODE_EXTRA_CA_CERTS"] == "/app/certs/rds-global-bundle.pem" &&
      !contains([for e in jsondecode(aws_ecs_task_definition.this["db-bootstrap"].container_definitions)[0].environment : e.name], "DATABASE_ADMIN_URL")
    )
    error_message = "db-bootstrap connects directly to the RDS instance on 5432 with the RDS CA bundle, and has no admin URL."
  }

  assert {
    condition = (
      jsonencode(sort([for s in jsondecode(aws_ecs_task_definition.this["db-bootstrap"].container_definitions)[0].secrets : s.name])) ==
      jsonencode(["DATABASE_ADMIN_PASSWORD", "DATABASE_ADMIN_USER", "DATABASE_OWNER_URL", "DATABASE_PLATFORM_URL", "DATABASE_URL"])
    )
    error_message = "db-bootstrap gets the admin user and password and the three role URLs."
  }

  assert {
    condition = (
      strcontains(aws_iam_role_policy.execution["migrate"].policy, var.db_master_secret_arn) &&
      alltrue([for role, policy in aws_iam_role_policy.execution : !strcontains(policy.policy, var.db_master_secret_arn) if role != "migrate"]) &&
      alltrue([for policy in aws_iam_role_policy.task : !strcontains(policy.policy, var.db_master_secret_arn)]) &&
      !strcontains(aws_iam_role_policy.deploy.policy, var.db_master_secret_arn)
    )
    error_message = "Only migrate-exec names the RDS-managed master secret."
  }

  assert {
    condition = anytrue([
      for s in jsondecode(aws_iam_role_policy.execution["migrate"].policy).Statement :
      s.Effect == "Allow" && contains(flatten([s.Action]), "kms:Decrypt") && contains(flatten([s.Resource]), var.data_kms_key_arn)
    ])
    error_message = "migrate-exec may decrypt with the data key that encrypts the master secret."
  }

  assert {
    condition = alltrue([
      for task in ["migrate", "seed", "db-bootstrap"] :
      aws_ecs_task_definition.this[task].execution_role_arn == aws_iam_role.execution["migrate"].arn && aws_ecs_task_definition.this[task].task_role_arn == null
    ])
    error_message = "The one-off tasks use migrate-exec and have no task role."
  }
}

run "api_runs_behind_two_proxies" {
  command = apply

  assert {
    condition = (
      { for e in jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].environment : e.name => e.value }["TRUST_PROXY_HOPS"] == "2" &&
      { for e in jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].environment : e.name => e.value }["APP_ENV"] == "staging" &&
      { for e in jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].environment : e.name => e.value }["SES_SNS_TOPIC_ARN"] == var.ses_events_topic_arn &&
      { for e in jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].environment : e.name => e.value }["CLAMAV_HOST"] == "clamav.quad-staging.internal"
    )
    error_message = "The api trusts two proxy hops (CloudFront and the ALB), runs as staging, accepts SES events from the dns module's topic and finds clamav by Cloud Map."
  }

  assert {
    condition = (
      jsonencode(sort([for e in jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].environment : e.name])) ==
      jsonencode(sort([
        "APP_ENV", "NODE_ENV", "TRUST_PROXY_HOPS", "PUBLIC_WEB_URL", "CONSOLE_URL", "API_PORT",
        "S3_REGION", "S3_BUCKET_PRIVATE", "S3_BUCKET_PUBLIC", "CDN_URL", "CLAMAV_HOST", "CLAMAV_PORT",
        "EMAIL_PROVIDER", "SES_REGION", "SES_CONFIGURATION_SET", "SES_SNS_TOPIC_ARN", "EMAIL_FROM_DOMAIN",
        "OTEL_SERVICE_NAME", "SENTRY_ENVIRONMENT", "KMS_KEY_ID",
      ])) &&
      jsonencode(sort([for s in jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].secrets : s.name])) ==
      jsonencode(sort([
        "DATABASE_URL", "DATABASE_PLATFORM_URL", "REDIS_URL", "SESSION_SECRET", "LINK_SIGNING_SECRET",
        "SENTRY_DSN", "OTEL_EXPORTER_OTLP_HEADERS",
      ]))
    )
    error_message = "The api gets exactly spec 02's runtime variables; with no OTLP endpoint, OTEL_EXPORTER_OTLP_ENDPOINT is left out."
  }

  assert {
    condition = alltrue([
      for service in ["api", "worker"] :
      { for e in jsondecode(aws_ecs_task_definition.this[service].container_definitions)[0].environment : e.name => e.value }["KMS_KEY_ID"] == var.field_kms_key_arn
    ])
    error_message = "The api and worker encrypt fields with the field key (KMS_KEY_ID)."
  }

  assert {
    condition = (
      jsonencode(sort([for e in jsondecode(aws_ecs_task_definition.this["staff"].container_definitions)[0].environment : e.name])) ==
      jsonencode(["APP_ENV", "HOSTNAME", "OTEL_SERVICE_NAME", "PORT", "SENTRY_ENVIRONMENT"]) &&
      { for e in jsondecode(aws_ecs_task_definition.this["staff"].container_definitions)[0].environment : e.name => e.value }["HOSTNAME"] == "0.0.0.0" &&
      jsonencode(sort([for s in jsondecode(aws_ecs_task_definition.this["console"].container_definitions)[0].secrets : s.name])) ==
      jsonencode(["OTEL_EXPORTER_OTLP_HEADERS", "SENTRY_DSN"]) &&
      { for e in jsondecode(aws_ecs_task_definition.this["console"].container_definitions)[0].environment : e.name => e.value }["PORT"] == "3001"
    )
    error_message = "staff and console get only APP_ENV, HOSTNAME (0.0.0.0), PORT, SENTRY_DSN, SENTRY_ENVIRONMENT and OTEL_*."
  }

  assert {
    condition = (
      { for e in jsondecode(aws_ecs_task_definition.this["seed"].container_definitions)[0].environment : e.name => e.value }["APP_ENV"] == "staging" &&
      jsondecode(aws_ecs_task_definition.this["seed"].container_definitions)[0].command == ["node", "dist/seed.js"]
    )
    error_message = "The seed task passes APP_ENV=staging; the seed refuses anything but local or staging."
  }

  assert {
    condition = alltrue([
      for service in ["api", "worker", "staff", "console"] :
      { for s in jsondecode(aws_ecs_task_definition.this[service].container_definitions)[0].secrets : s.name => s.valueFrom }["SENTRY_DSN"] == "${aws_secretsmanager_secret.app["SENTRY_DSN"].arn}:${service == "worker" ? "api" : service}::"
    ])
    error_message = "Each service reads its own SENTRY_DSN key (the worker shares the api's)."
  }
}

run "otel_endpoint_is_passed_when_set" {
  command = apply

  variables {
    otel_exporter_endpoint = "https://otlp.example.com"
  }

  assert {
    condition = alltrue([
      for service in ["api", "worker", "staff", "console"] :
      { for e in jsondecode(aws_ecs_task_definition.this[service].container_definitions)[0].environment : e.name => e.value }["OTEL_EXPORTER_OTLP_ENDPOINT"] == "https://otlp.example.com"
    ])
    error_message = "Every Node service gets OTEL_EXPORTER_OTLP_ENDPOINT when it is set."
  }
}

run "task_definitions_are_hardened" {
  command = apply

  assert {
    condition = alltrue([
      for key, definition in aws_ecs_task_definition.this : alltrue([
        for container in jsondecode(definition.container_definitions) :
        container.readonlyRootFilesystem == true && container.linuxParameters.initProcessEnabled == true &&
        !contains(["", "0", "root", "0:0"], container.user) && container.essential == true &&
        container.logConfiguration.logDriver == "awslogs" &&
        container.logConfiguration.options["awslogs-group"] == "/quad/staging/${key}"
      ]) && definition.network_mode == "awsvpc" && jsonencode(definition.requires_compatibilities) == jsonencode(["FARGATE"]) &&
      one(definition.runtime_platform).operating_system_family == "LINUX" && one(definition.runtime_platform).cpu_architecture == "X86_64"
    ])
    error_message = "Every container runs read-only, non-root, with an init process, logging to /quad/staging/<task>, on Fargate Linux x86_64."
  }

  assert {
    condition = (
      jsonencode(sort([for m in jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].mountPoints : m.containerPath])) == jsonencode(["/tmp"]) &&
      jsonencode(sort([for m in jsondecode(aws_ecs_task_definition.this["worker"].container_definitions)[0].mountPoints : m.containerPath])) == jsonencode(["/tmp"]) &&
      jsonencode(sort([for m in jsondecode(aws_ecs_task_definition.this["staff"].container_definitions)[0].mountPoints : m.containerPath])) == jsonencode(["/app/apps/staff/.next/cache", "/tmp"]) &&
      jsonencode(sort([for m in jsondecode(aws_ecs_task_definition.this["console"].container_definitions)[0].mountPoints : m.containerPath])) == jsonencode(["/app/apps/console/.next/cache", "/tmp"]) &&
      jsonencode(sort([for m in jsondecode(aws_ecs_task_definition.this["clamav"].container_definitions)[0].mountPoints : m.containerPath])) == jsonencode(["/run/clamav", "/tmp", "/var/lib/clamav"])
    )
    error_message = "Writable paths are ephemeral volumes: /tmp everywhere, .next/cache for the web apps, and the signature and run folders for clamav."
  }

  assert {
    condition = alltrue([
      for key, definition in aws_ecs_task_definition.this : alltrue([
        for container in jsondecode(definition.container_definitions) : alltrue([
          for mount in container.mountPoints : contains([for volume in definition.volume : volume.name], mount.sourceVolume)
        ])
      ])
    ])
    error_message = "Every mount point uses a volume of its task definition."
  }

  assert {
    condition = (
      jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].healthCheck.command[0] == "CMD" &&
      strcontains(jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].healthCheck.command[3], "http://127.0.0.1:4000/api/v1/health/live") &&
      jsonencode(jsondecode(aws_ecs_task_definition.this["worker"].container_definitions)[0].healthCheck) == jsonencode({
        command = ["CMD", "node", "dist/worker-health.js"], interval = 30, retries = 3, startPeriod = 60, timeout = 5
      }) &&
      strcontains(jsondecode(aws_ecs_task_definition.this["staff"].container_definitions)[0].healthCheck.command[3], "/healthz") &&
      jsondecode(aws_ecs_task_definition.this["clamav"].container_definitions)[0].healthCheck.command == ["CMD", "clamdcheck.sh"]
    )
    error_message = "ECS ignores the image HEALTHCHECK, so each long-running container repeats it."
  }

  assert {
    condition = (
      jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].user == "1000:1000" &&
      jsondecode(aws_ecs_task_definition.this["clamav"].container_definitions)[0].user == "100:101"
    )
    error_message = "The api and web images run as node (1000) and clamav as clamav (100:101)."
  }

  assert {
    condition = alltrue([
      for key, size in var.services :
      aws_ecs_task_definition.this[key].cpu == tostring(size.cpu) && aws_ecs_task_definition.this[key].memory == tostring(size.memory)
    ])
    error_message = "Each service's task size comes from var.services."
  }

  assert {
    condition = alltrue([
      for key, definition in aws_ecs_task_definition.this :
      endswith(jsondecode(definition.container_definitions)[0].image, ":bootstrap")
    ])
    error_message = "The first task definitions use var.image_tag."
  }
}

run "services_roll_back" {
  command = apply

  assert {
    condition = alltrue([
      for service in aws_ecs_service.this :
      one(service.deployment_circuit_breaker).enable && one(service.deployment_circuit_breaker).rollback
    ])
    error_message = "Every service has the deployment circuit breaker with rollback."
  }

  assert {
    condition = (
      length(aws_ecs_service.this["api"].load_balancer) == 2 &&
      jsonencode(sort([for lb in aws_ecs_service.this["api"].load_balancer : lb.target_group_arn])) == jsonencode(sort([var.target_group_arns["api"], var.target_group_arns["api_socket"]])) &&
      alltrue([for lb in aws_ecs_service.this["api"].load_balancer : lb.container_name == "api" && lb.container_port == 4000]) &&
      one(aws_ecs_service.this["staff"].load_balancer).target_group_arn == var.target_group_arns["staff"] &&
      one(aws_ecs_service.this["staff"].load_balancer).container_port == 3000 &&
      one(aws_ecs_service.this["console"].load_balancer).target_group_arn == var.target_group_arns["console"] &&
      one(aws_ecs_service.this["console"].load_balancer).container_port == 3001 &&
      length(aws_ecs_service.this["worker"].load_balancer) == 0 && length(aws_ecs_service.this["clamav"].load_balancer) == 0
    )
    error_message = "api registers with api and api_socket, staff with staff, console with console."
  }

  assert {
    condition = alltrue([
      for service in aws_ecs_service.this :
      one(service.network_configuration).assign_public_ip == false &&
      jsonencode(sort(one(service.network_configuration).subnets)) == jsonencode(sort(var.private_subnet_ids)) &&
      service.desired_count == 1 && service.launch_type == "FARGATE"
    ])
    error_message = "Every service runs on Fargate in the private subnets without a public IP."
  }

  assert {
    condition = (
      jsonencode(sort(one(aws_ecs_service.this["api"].network_configuration).security_groups)) == jsonencode(sort([aws_security_group.tasks.id, var.data_client_security_group_id, aws_security_group.clamav_clients.id])) &&
      jsonencode(sort(one(aws_ecs_service.this["worker"].network_configuration).security_groups)) == jsonencode(sort([aws_security_group.tasks.id, var.data_client_security_group_id, aws_security_group.clamav_clients.id])) &&
      jsonencode(one(aws_ecs_service.this["staff"].network_configuration).security_groups) == jsonencode([aws_security_group.tasks.id]) &&
      jsonencode(one(aws_ecs_service.this["console"].network_configuration).security_groups) == jsonencode([aws_security_group.tasks.id]) &&
      jsonencode(one(aws_ecs_service.this["clamav"].network_configuration).security_groups) == jsonencode([aws_security_group.clamav.id]) &&
      jsonencode(split(",", aws_ssm_parameter.deploy["security_groups"].value)) == jsonencode([aws_security_group.tasks.id, var.data_client_security_group_id])
    )
    error_message = "api and worker attach the tasks, data client and clamav client groups; staff and console only tasks; clamav only its own; the one-off tasks tasks and data client."
  }

  assert {
    condition     = one(aws_ecs_service.this["clamav"].service_registries).registry_arn == aws_service_discovery_service.clamav.arn
    error_message = "clamav registers in Cloud Map."
  }
}

run "only_the_alb_reaches_the_tasks_and_only_scanners_reach_clamav" {
  command = apply

  assert {
    condition = (
      jsonencode(sort([for rule in aws_vpc_security_group_ingress_rule.tasks : "${rule.security_group_id}<-${rule.referenced_security_group_id}:${rule.from_port}-${rule.to_port}"])) ==
      jsonencode(sort([
        "${aws_security_group.tasks.id}<-${var.alb_security_group_id}:4000-4000",
        "${aws_security_group.tasks.id}<-${var.alb_security_group_id}:3000-3000",
        "${aws_security_group.tasks.id}<-${var.alb_security_group_id}:3001-3001",
        "${aws_security_group.clamav.id}<-${aws_security_group.clamav_clients.id}:3310-3310",
      ]))
    )
    error_message = "The tasks group admits only the ALB on 4000, 3000 and 3001; clamav admits only the clamav clients on 3310."
  }

  assert {
    condition = (
      jsonencode(sort([for rule in aws_vpc_security_group_egress_rule.tasks : "${rule.security_group_id}->${coalesce(rule.cidr_ipv4, rule.referenced_security_group_id)}:${rule.from_port}"])) ==
      jsonencode(sort([
        "${aws_security_group.tasks.id}->0.0.0.0/0:443",
        "${aws_security_group.clamav.id}->0.0.0.0/0:443",
        "${aws_security_group.clamav_clients.id}->${aws_security_group.clamav.id}:3310",
      ]))
    )
    error_message = "Tasks and clamav send only HTTPS out; the clamav clients reach only clamd."
  }

  assert {
    condition     = aws_service_discovery_private_dns_namespace.this.name == "quad-staging.internal" && aws_service_discovery_service.clamav.name == "clamav"
    error_message = "clamav answers at clamav.quad-staging.internal."
  }
}

run "deploy_role_passes_only_its_roles" {
  command = apply

  assert {
    condition = (
      jsonencode(sort(flatten([for s in jsondecode(aws_iam_role_policy.deploy.policy).Statement : s.Resource if contains(flatten([s.Action]), "iam:PassRole")]))) ==
      jsonencode(sort(concat([for role in aws_iam_role.execution : role.arn], [aws_iam_role.task["api"].arn, aws_iam_role.task["worker"].arn]))) &&
      length(distinct(flatten([for s in jsondecode(aws_iam_role_policy.deploy.policy).Statement : s.Resource if contains(flatten([s.Action]), "iam:PassRole")]))) == 6
    )
    error_message = "iam:PassRole is on the four execution roles and the two task roles only."
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role_policy.deploy.policy).Statement :
      try(s.Condition.StringEquals["iam:PassedToService"], "") == "ecs-tasks.amazonaws.com" if contains(flatten([s.Action]), "iam:PassRole")
    ])
    error_message = "The deploy role passes roles only to ECS tasks."
  }

  assert {
    condition = (
      jsonencode(sort(flatten([for s in jsondecode(aws_iam_role_policy.deploy.policy).Statement : s.Resource if contains(flatten([s.Action]), "ecr:PutImage")]))) ==
      jsonencode(sort([for repo in aws_ecr_repository.this : repo.arn])) &&
      alltrue([for s in jsondecode(aws_iam_role_policy.deploy.policy).Statement : s.Effect == "Allow"]) &&
      !strcontains(aws_iam_role_policy.deploy.policy, "secretsmanager") &&
      jsonencode(flatten([for s in jsondecode(aws_iam_role_policy.deploy.policy).Statement : s.Resource if contains(flatten([s.Action]), "ssm:GetParameters")])) ==
      jsonencode(["arn:aws:ssm:ap-south-1:123456789012:parameter/quad/staging/deploy/*"])
    )
    error_message = "The deploy role pushes only to the four repositories, reads only the deploy parameters, and no secret."
  }
}

run "plan_and_apply_roles_reach_state_through_the_tooling_roles" {
  command = apply

  assert {
    condition = (
      aws_iam_role_policy_attachment.plan_read_only.policy_arn == "arn:aws:iam::aws:policy/ReadOnlyAccess" &&
      aws_iam_role_policy_attachment.apply_admin.policy_arn == "arn:aws:iam::aws:policy/AdministratorAccess"
    )
    error_message = "plan is ReadOnlyAccess and apply is AdministratorAccess."
  }

  assert {
    condition = (
      jsonencode(sort(flatten([for s in jsondecode(aws_iam_role_policy.plan.policy).Statement : s.Resource if s.Effect == "Allow" && contains(flatten([s.Action]), "sts:AssumeRole")]))) ==
      jsonencode(sort(["arn:aws:iam::210987654321:role/quad-terraform-state-read-staging", "arn:aws:iam::210987654321:role/quad-dns-read"])) &&
      jsonencode(sort(flatten([for s in jsondecode(aws_iam_role_policy.apply.policy).Statement : s.Resource if s.Effect == "Allow" && contains(flatten([s.Action]), "sts:AssumeRole")]))) ==
      jsonencode(sort(["arn:aws:iam::210987654321:role/quad-terraform-state-rw-staging", "arn:aws:iam::210987654321:role/quad-dns-records-staging"]))
    )
    error_message = "plan assumes the staging state-read and dns-read roles; apply the staging state-rw and dns-records roles."
  }

  assert {
    condition = alltrue([
      for action in [
        "secretsmanager:GetSecretValue", "ssm:GetParameter*", "kms:Decrypt",
        "logs:GetLogEvents", "logs:FilterLogEvents", "logs:StartQuery", "logs:StartLiveTail", "logs:Unmask",
        "rds:DownloadDBLogFilePortion", "rds:DownloadCompleteDBLogFile",
        ] : anytrue([
          for s in jsondecode(aws_iam_role_policy.plan.policy).Statement : s.Effect == "Deny" && contains(flatten([s.Action]), action)
      ])
    ])
    error_message = "The plan role explicitly denies secret and parameter values, decryption, log events and database log files."
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role_policy.plan.policy).Statement :
      s.Effect == "Deny" ? (jsonencode(s.Resource) == jsonencode(["*"]) && !can(s.NotResource)) : true
    ])
    error_message = "Every plan role deny covers every resource (ruling R-pr-plan: no carve-out)."
  }
}

run "secrets_are_write_only" {
  command = apply

  assert {
    condition = alltrue(flatten([
      [for v in aws_secretsmanager_secret_version.generated : nonsensitive(v.secret_string == null && v.secret_binary == null) && v.secret_string_wo_version != null],
      [for v in aws_secretsmanager_secret_version.placeholder : nonsensitive(v.secret_string == null && v.secret_binary == null) && v.secret_string_wo_version != null],
    ]))
    error_message = "No secret version may set secret_string or secret_binary: secrets are written only through secret_string_wo."
  }

  assert {
    condition = (
      jsonencode(sort([for s in aws_secretsmanager_secret.app : s.name])) ==
      jsonencode(sort(["quad-staging/env/SESSION_SECRET", "quad-staging/env/LINK_SIGNING_SECRET", "quad-staging/env/SENTRY_DSN", "quad-staging/env/OTEL_EXPORTER_OTLP_HEADERS"])) &&
      alltrue([for s in aws_secretsmanager_secret.app : s.kms_key_id == var.data_kms_key_arn])
    )
    error_message = "The four app secrets live at <name>/env/<NAME>, encrypted with the data key."
  }

  assert {
    condition = (
      jsonencode(sort(keys(aws_secretsmanager_secret_version.generated))) == jsonencode(["LINK_SIGNING_SECRET", "SESSION_SECRET"]) &&
      jsonencode(sort(keys(aws_secretsmanager_secret_version.placeholder))) == jsonencode(["OTEL_EXPORTER_OTLP_HEADERS", "SENTRY_DSN"])
    )
    error_message = "SESSION_SECRET and LINK_SIGNING_SECRET are generated; SENTRY_DSN and OTEL_EXPORTER_OTLP_HEADERS start as placeholders set by hand."
  }
}

run "raising_a_secret_version_rewrites_only_that_secret" {
  command = apply

  variables {
    app_secret_versions = { SESSION_SECRET = 2, LINK_SIGNING_SECRET = 1 }
  }

  assert {
    condition = (
      aws_secretsmanager_secret_version.generated["SESSION_SECRET"].secret_string_wo_version == 2 &&
      aws_secretsmanager_secret_version.generated["LINK_SIGNING_SECRET"].secret_string_wo_version == 1
    )
    error_message = "Each generated secret has its own write-only version."
  }
}

run "migrate_task_uses_owner_url" {
  command = apply

  assert {
    condition = (
      contains([for s in jsondecode(aws_ecs_task_definition.this["migrate"].container_definitions)[0].secrets : s.name], "DATABASE_OWNER_URL") &&
      jsondecode(aws_ecs_task_definition.this["migrate"].container_definitions)[0].command == ["node", "dist/migrate.js"] &&
      { for e in jsondecode(aws_ecs_task_definition.this["migrate"].container_definitions)[0].environment : e.name => e.value }["NODE_EXTRA_CA_CERTS"] == "/app/certs/rds-global-bundle.pem" &&
      jsondecode(aws_ecs_task_definition.this["db-bootstrap"].container_definitions)[0].command == ["node", "dist/db-bootstrap.js"]
    )
    error_message = "migrate runs node dist/migrate.js with DATABASE_OWNER_URL and the RDS CA bundle."
  }

  assert {
    condition = (
      jsonencode(sort(flatten([for s in jsondecode(aws_iam_role_policy.execution["migrate"].policy).Statement : s.Resource if contains(flatten([s.Action]), "secretsmanager:GetSecretValue")]))) ==
      jsonencode(sort([var.env_secret_arns["DATABASE_OWNER_URL"], var.env_secret_arns["DATABASE_URL"], var.env_secret_arns["DATABASE_PLATFORM_URL"], var.db_master_secret_arn]))
    )
    error_message = "migrate-exec reads only the three role URLs and the master secret."
  }
}

run "images_are_immutable_scanned_and_encrypted" {
  command = apply

  assert {
    condition = (
      jsonencode(sort([for repo in aws_ecr_repository.this : repo.name])) == jsonencode(["quad/api", "quad/clamav", "quad/console", "quad/staff"]) &&
      alltrue([
        for repo in aws_ecr_repository.this :
        repo.image_tag_mutability == "IMMUTABLE" && one(repo.image_scanning_configuration).scan_on_push && one(repo.encryption_configuration).encryption_type == "KMS"
      ])
    )
    error_message = "The four repositories have immutable tags, scan on push and KMS encryption."
  }

  assert {
    condition = alltrue([
      for policy in aws_ecr_lifecycle_policy.this :
      jsondecode(policy.policy).rules[0].selection.countNumber == 30 && jsondecode(policy.policy).rules[0].selection.countType == "imageCountMoreThan"
    ])
    error_message = "Each repository keeps the last 30 images."
  }

  assert {
    condition = (
      jsondecode(aws_ecs_task_definition.this["worker"].container_definitions)[0].image == "${aws_ecr_repository.this["api"].repository_url}:bootstrap" &&
      jsondecode(aws_ecs_task_definition.this["seed"].container_definitions)[0].image == "${aws_ecr_repository.this["api"].repository_url}:bootstrap"
    )
    error_message = "The worker and the one-off tasks run the api image."
  }
}

run "deploy_settings_are_in_ssm" {
  command = apply

  assert {
    condition = (
      jsonencode(sort([for p in aws_ssm_parameter.deploy : p.name])) == jsonencode(sort([
        for key in ["cluster", "subnets", "security_groups", "services", "task_families", "ecr_registry"] : "/quad/staging/deploy/${key}"
      ])) &&
      alltrue([for p in aws_ssm_parameter.deploy : p.type == "String"])
    )
    error_message = "The deploy settings are plain String parameters under /quad/staging/deploy/."
  }

  assert {
    condition = (
      jsonencode(sort(keys(jsondecode(aws_ssm_parameter.deploy["task_families"].value)))) ==
      jsonencode(["api", "clamav", "console", "db-bootstrap", "migrate", "seed", "staff", "worker"]) &&
      aws_ssm_parameter.deploy["subnets"].value == join(",", var.private_subnet_ids) &&
      aws_ssm_parameter.deploy["ecr_registry"].value == "123456789012.dkr.ecr.ap-south-1.amazonaws.com"
    )
    error_message = "task_families includes the one-off tasks; subnets is comma-separated; ecr_registry is the account's registry."
  }
}

run "log_groups_are_per_task_and_encrypted" {
  command = apply

  assert {
    condition = (
      jsonencode(sort([for group in aws_cloudwatch_log_group.this : group.name])) == jsonencode(sort([
        for key in ["api", "worker", "staff", "console", "clamav", "migrate", "seed", "db-bootstrap"] : "/quad/staging/${key}"
      ])) &&
      alltrue([for group in aws_cloudwatch_log_group.this : group.retention_in_days == 30 && group.kms_key_id == aws_kms_key.logs.arn])
    )
    error_message = "Each task logs to /quad/staging/<task> for 30 days, encrypted with the logs key."
  }

  assert {
    condition = (
      aws_ecs_cluster.this.name == "quad-staging" &&
      one([for setting in aws_ecs_cluster.this.setting : setting.value if setting.name == "containerInsights"]) == "enabled"
    )
    error_message = "The cluster has Container Insights."
  }
}

run "github_names_cannot_widen_the_trust" {
  command = plan

  variables {
    github_repository        = "prishanmaduka/*"
    github_environment       = "staging:ref:refs/heads/*"
    github_infra_environment = "*"
  }

  expect_failures = [var.github_repository, var.github_environment, var.github_infra_environment]
}
