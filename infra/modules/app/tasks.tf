# The first task definitions (Fargate, awsvpc, Linux x86_64). Every container runs as a non-root
# user with a read-only root file system and an init process; the paths it writes are ephemeral
# volumes. ECS ignores an image's HEALTHCHECK, so each long-running container repeats its image's
# check here. Environment variables follow spec 02; values marked secret come from Secrets
# Manager through the execution role.

locals {
  one_off_tasks = toset(["migrate", "seed", "db-bootstrap"])
  task_roles    = toset(["api", "worker"])

  rds_ca_bundle = "/app/certs/rds-global-bundle.pem"

  otel_endpoint = var.otel_exporter_endpoint == "" ? {} : { OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_exporter_endpoint }

  # Spec 02's runtime variables for the api and the worker (D28: TRUST_PROXY_HOPS=2 behind
  # CloudFront and the ALB).
  node_environment = merge({
    APP_ENV               = var.environment
    NODE_ENV              = "production"
    TRUST_PROXY_HOPS      = "2"
    PUBLIC_WEB_URL        = var.public_web_url
    CONSOLE_URL           = var.console_url
    API_PORT              = "4000"
    S3_REGION             = local.region
    S3_BUCKET_PRIVATE     = var.private_bucket_name
    S3_BUCKET_PUBLIC      = var.public_bucket_name
    CDN_URL               = var.cdn_url
    CLAMAV_HOST           = "clamav.${aws_service_discovery_private_dns_namespace.this.name}"
    CLAMAV_PORT           = "3310"
    EMAIL_PROVIDER        = "ses"
    SES_REGION            = local.region
    SES_CONFIGURATION_SET = var.ses_configuration_set_name
    SES_SNS_TOPIC_ARN     = var.ses_events_topic_arn
    EMAIL_FROM_DOMAIN     = var.email_from_domain
    SENTRY_ENVIRONMENT    = var.environment
    # Field-level encryption uses FIELD_ENCRYPTION_KEY (a generated secret, below) in every
    # environment until M12's KMS adapter reads KMS_KEY_ID; it is passed now, unused (spec 02, D32).
    KMS_KEY_ID = var.field_kms_key_arn
    # The hostname Turnstile siteverify must report for a demo form token (D57).
    TURNSTILE_EXPECTED_HOSTNAME = var.turnstile_expected_hostname
    # Where demo request notifications go (D57, OQ2); not a secret.
    SALES_INBOX = var.sales_inbox
  }, local.otel_endpoint)

  sentry_dsn_arn = aws_secretsmanager_secret.app["SENTRY_DSN"].arn
  otel_headers   = { OTEL_EXPORTER_OTLP_HEADERS = "${aws_secretsmanager_secret.app["OTEL_EXPORTER_OTLP_HEADERS"].arn}:value::" }
  field_key_arn  = aws_secretsmanager_secret.app["FIELD_ENCRYPTION_KEY"].arn

  runtime_secrets = merge({
    DATABASE_URL          = var.env_secret_arns["DATABASE_URL"]
    DATABASE_PLATFORM_URL = var.env_secret_arns["DATABASE_PLATFORM_URL"]
    REDIS_URL             = var.env_secret_arns["REDIS_URL"]
    SESSION_SECRET        = aws_secretsmanager_secret.app["SESSION_SECRET"].arn
    LINK_SIGNING_SECRET   = aws_secretsmanager_secret.app["LINK_SIGNING_SECRET"].arn
    FIELD_ENCRYPTION_KEY  = local.field_key_arn
    JWT_PRIVATE_KEY       = "${aws_secretsmanager_secret.app["JWT_PRIVATE_KEY"].arn}:value::"
    JWT_PUBLIC_KEY        = "${aws_secretsmanager_secret.app["JWT_PUBLIC_KEY"].arn}:value::"
    TURNSTILE_SECRET_KEY  = "${aws_secretsmanager_secret.app["TURNSTILE_SECRET_KEY"].arn}:value::"
    SENTRY_DSN            = "${local.sentry_dsn_arn}:api::"
  }, local.otel_headers)

  one_off_environment = {
    APP_ENV             = var.environment
    NODE_ENV            = "production"
    NODE_EXTRA_CA_CERTS = local.rds_ca_bundle
  }

  # The images' own HEALTHCHECK commands (docker/api.Dockerfile, docker/web.Dockerfile).
  web_health = {
    command     = ["CMD", "node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
    interval    = 15
    timeout     = 5
    startPeriod = 20
    retries     = 3
  }

  node_user = "1000:1000"

  # Server components call the API through the public origin (CloudFront routes /api/v1) until
  # M12 adds service discovery (OQ16, spec 02 "Web server (run time)").
  api_internal_url = var.public_web_url

  tasks = {
    api = {
      cpu         = var.services.api.cpu
      memory      = var.services.api.memory
      image       = "api"
      user        = local.node_user
      command     = null
      ports       = [4000]
      environment = merge(local.node_environment, { OTEL_SERVICE_NAME = "quad-api" })
      secrets     = local.runtime_secrets
      volumes     = { tmp = "/tmp" }
      health = {
        command     = ["CMD", "node", "-e", "fetch('http://127.0.0.1:4000/api/v1/health/live').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
        interval    = 15
        timeout     = 5
        startPeriod = 30
        retries     = 3
      }
    }
    worker = {
      cpu         = var.services.worker.cpu
      memory      = var.services.worker.memory
      image       = "api"
      user        = local.node_user
      command     = ["node", "--enable-source-maps", "dist/worker.js"]
      ports       = []
      environment = merge(local.node_environment, { OTEL_SERVICE_NAME = "quad-worker" })
      secrets     = local.runtime_secrets
      volumes     = { tmp = "/tmp" }
      health = {
        command     = ["CMD", "node", "dist/worker-health.js"]
        interval    = 30
        timeout     = 5
        startPeriod = 60
        retries     = 3
      }
    }
    staff = {
      cpu         = var.services.staff.cpu
      memory      = var.services.staff.memory
      image       = "staff"
      user        = local.node_user
      command     = null
      ports       = [3000]
      environment = merge({ APP_ENV = var.environment, HOSTNAME = "0.0.0.0", PORT = "3000", SENTRY_ENVIRONMENT = var.environment, OTEL_SERVICE_NAME = "quad-staff", API_INTERNAL_URL = local.api_internal_url }, local.otel_endpoint)
      secrets     = merge({ SENTRY_DSN = "${local.sentry_dsn_arn}:staff::" }, local.otel_headers)
      volumes     = { tmp = "/tmp", next-cache = "/app/apps/staff/.next/cache" }
      health      = local.web_health
    }
    console = {
      cpu         = var.services.console.cpu
      memory      = var.services.console.memory
      image       = "console"
      user        = local.node_user
      command     = null
      ports       = [3001]
      environment = merge({ APP_ENV = var.environment, HOSTNAME = "0.0.0.0", PORT = "3001", SENTRY_ENVIRONMENT = var.environment, OTEL_SERVICE_NAME = "quad-console", API_INTERNAL_URL = local.api_internal_url }, local.otel_endpoint)
      secrets     = merge({ SENTRY_DSN = "${local.sentry_dsn_arn}:console::" }, local.otel_headers)
      volumes     = { tmp = "/tmp", next-cache = "/app/apps/console/.next/cache" }
      health      = local.web_health
    }
    # The official image's /init-unprivileged runs freshclam and clamd as clamav (docker/clamav).
    # ECS caps the start period at 300 s (the image asks for 360 s).
    clamav = {
      cpu         = var.services.clamav.cpu
      memory      = var.services.clamav.memory
      image       = "clamav"
      user        = "100:101"
      command     = null
      ports       = [3310]
      environment = {}
      secrets     = {}
      volumes     = { tmp = "/tmp", clamav-db = "/var/lib/clamav", clamav-run = "/run/clamav" }
      health = {
        command     = ["CMD", "clamdcheck.sh"]
        interval    = 30
        timeout     = 10
        startPeriod = 300
        retries     = 3
      }
    }
    # One-off tasks of the deploy (spec 20): db-bootstrap, then migrate; seed by hand on staging.
    migrate = {
      cpu         = 256
      memory      = 512
      image       = "api"
      user        = local.node_user
      command     = ["node", "dist/migrate.js"]
      ports       = []
      environment = local.one_off_environment
      secrets     = { DATABASE_OWNER_URL = var.env_secret_arns["DATABASE_OWNER_URL"] }
      volumes     = { tmp = "/tmp" }
      health      = null
    }
    # The seed refuses any APP_ENV but local and staging, so the task must pass it. It sets
    # SEED_PASSWORD (set by hand) and, on staging, no authenticators (D55); the field key is the
    # api's, checked like the api checks it.
    seed = {
      cpu         = 512
      memory      = 1024
      image       = "api"
      user        = local.node_user
      command     = ["node", "dist/seed.js"]
      ports       = []
      environment = local.one_off_environment
      secrets = {
        DATABASE_OWNER_URL   = var.env_secret_arns["DATABASE_OWNER_URL"]
        FIELD_ENCRYPTION_KEY = local.field_key_arn
        SEED_PASSWORD        = "${aws_secretsmanager_secret.app["SEED_PASSWORD"].arn}:value::"
      }
      volumes = { tmp = "/tmp" }
      health  = null
    }
    # Ruling R-db-admin: the master user and password come from the RDS-managed secret's JSON
    # keys; the host is the RDS instance itself, not the proxy.
    db-bootstrap = {
      cpu     = 256
      memory  = 512
      image   = "api"
      user    = local.node_user
      command = ["node", "dist/db-bootstrap.js"]
      ports   = []
      environment = merge(local.one_off_environment, {
        DATABASE_ADMIN_HOST = var.db_instance_address
        DATABASE_ADMIN_PORT = "5432"
      })
      secrets = {
        DATABASE_ADMIN_USER     = "${var.db_master_secret_arn}:username::"
        DATABASE_ADMIN_PASSWORD = "${var.db_master_secret_arn}:password::"
        DATABASE_OWNER_URL      = var.env_secret_arns["DATABASE_OWNER_URL"]
        DATABASE_URL            = var.env_secret_arns["DATABASE_URL"]
        DATABASE_PLATFORM_URL   = var.env_secret_arns["DATABASE_PLATFORM_URL"]
      }
      volumes = { tmp = "/tmp" }
      health  = null
    }
  }

  task_families = { for key in local.task_names : key => "${var.name}-${key}" }
}

resource "aws_ecs_task_definition" "this" {
  for_each = local.tasks

  family                   = local.task_families[each.key]
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.execution[local.execution_role_of[each.key]].arn
  task_role_arn            = contains(local.task_roles, each.key) ? aws_iam_role.task[each.key].arn : null
  # The deploy workflow registers later revisions; keep the old ones when Terraform replaces this.
  skip_destroy = true

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  dynamic "volume" {
    for_each = each.value.volumes

    content {
      name = volume.key
    }
  }

  container_definitions = jsonencode([merge(
    {
      name                   = each.key
      image                  = "${aws_ecr_repository.this[each.value.image].repository_url}:${var.image_tag}"
      essential              = true
      user                   = each.value.user
      readonlyRootFilesystem = true
      linuxParameters        = { initProcessEnabled = true }
      environment            = [for key in sort(keys(each.value.environment)) : { name = key, value = each.value.environment[key] }]
      secrets                = [for key in sort(keys(each.value.secrets)) : { name = key, valueFrom = each.value.secrets[key] }]
      portMappings           = [for port in each.value.ports : { containerPort = port, protocol = "tcp" }]
      mountPoints            = [for name in sort(keys(each.value.volumes)) : { sourceVolume = name, containerPath = each.value.volumes[name], readOnly = false }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.this[each.key].name
          awslogs-region        = local.region
          awslogs-stream-prefix = each.key
        }
      }
    },
    each.value.command == null ? {} : { command = each.value.command },
    each.value.health == null ? {} : { healthCheck = each.value.health },
  )])

  tags = { service = each.key }
}
