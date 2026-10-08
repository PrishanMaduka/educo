# The ECS cluster, its services, Cloud Map, the task log groups and the tasks security group.
# Terraform creates the services with the first task definitions; the deploy workflow registers
# later revisions and owns the task count, so both are ignored after creation (D28).

locals {
  # Every task definition, long-running services and one-off tasks alike, keyed by its name.
  task_names = concat(keys(var.services), ["migrate", "seed", "db-bootstrap"])

  # Load balancer registrations per service (ruling R-sticky: api_socket is the sticky group).
  load_balancers = {
    api     = [{ target_group = "api", port = 4000 }, { target_group = "api_socket", port = 4000 }]
    staff   = [{ target_group = "staff", port = 3000 }]
    console = [{ target_group = "console", port = 3001 }]
    worker  = []
    clamav  = []
  }

  # Security groups per task:
  #   - tasks: the ALB's way in to api, staff and console, and HTTPS out;
  #   - the data client group: the api image's tasks, which use the database and Redis;
  #   - clamav_clients: the api and worker, which scan uploads; clamav admits only this group;
  #   - clamav: clamav alone (3310 in, HTTPS out for signature updates).
  security_groups = {
    api            = [aws_security_group.tasks.id, var.data_client_security_group_id, aws_security_group.clamav_clients.id]
    worker         = [aws_security_group.tasks.id, var.data_client_security_group_id, aws_security_group.clamav_clients.id]
    migrate        = [aws_security_group.tasks.id, var.data_client_security_group_id]
    seed           = [aws_security_group.tasks.id, var.data_client_security_group_id]
    "db-bootstrap" = [aws_security_group.tasks.id, var.data_client_security_group_id]
    staff          = [aws_security_group.tasks.id]
    console        = [aws_security_group.tasks.id]
    clamav         = [aws_security_group.clamav.id]
  }

  log_group_prefix = "/quad/${var.environment}"

  logs_key_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AccountAdministersTheKey"
        Effect    = "Allow"
        Principal = { AWS = "arn:${local.partition}:iam::${local.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "LogsEncryptTheTaskLogGroupsOnly"
        Effect    = "Allow"
        Principal = { Service = "logs.${local.region}.amazonaws.com" }
        Action    = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource  = "*"
        Condition = {
          ArnLike = { "kms:EncryptionContext:aws:logs:arn" = "arn:${local.partition}:logs:${local.region}:${local.account_id}:log-group:${local.log_group_prefix}/*" }
        }
      },
    ]
  })
}

# --- Cluster and service discovery ---

resource "aws_ecs_cluster" "this" {
  name = var.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { service = "app" }
}

resource "aws_service_discovery_private_dns_namespace" "this" {
  name        = "${var.name}.internal"
  description = "Private names for ${var.name} services (clamav)"
  vpc         = var.vpc_id

  tags = { service = "app" }
}

resource "aws_service_discovery_service" "clamav" {
  name = "clamav"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.this.id
    routing_policy = "MULTIVALUE"

    dns_records {
      type = "A"
      ttl  = 10
    }
  }

  tags = { service = "clamav" }
}

# --- Logs: /quad/<environment>/<task>, encrypted with a key of their own ---

resource "aws_kms_key" "logs" {
  description             = "${var.name} task logs"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = local.logs_key_policy

  tags = { service = "app" }
}

resource "aws_kms_alias" "logs" {
  name          = "alias/${var.name}-task-logs"
  target_key_id = aws_kms_key.logs.key_id
}

resource "aws_cloudwatch_log_group" "this" {
  #checkov:skip=CKV_AWS_338:Staging keeps task logs for log_retention_days (30); production retention is an M12 decision.
  for_each = toset(local.task_names)

  name              = "${local.log_group_prefix}/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.logs.arn

  tags = { service = each.key }
}

# --- Security groups ---

resource "aws_security_group" "tasks" {
  #checkov:skip=CKV2_AWS_5:Attached to the ECS services and one-off tasks through local.security_groups (network_configuration and the deploy settings), which this check does not follow.
  name        = "${var.name}-tasks"
  description = "ECS tasks: the task ports from the ALB, HTTPS out"
  vpc_id      = var.vpc_id

  tags = { service = "app", Name = "${var.name}-tasks" }
}

resource "aws_security_group" "clamav_clients" {
  #checkov:skip=CKV2_AWS_5:Attached to the ECS services and one-off tasks through local.security_groups (network_configuration and the deploy settings), which this check does not follow.
  name        = "${var.name}-clamav-clients"
  description = "Tasks that scan uploads with clamd (api, worker)"
  vpc_id      = var.vpc_id

  tags = { service = "app", Name = "${var.name}-clamav-clients" }
}

resource "aws_security_group" "clamav" {
  #checkov:skip=CKV2_AWS_5:Attached to the ECS services and one-off tasks through local.security_groups (network_configuration and the deploy settings), which this check does not follow.
  name        = "${var.name}-clamav"
  description = "clamd: 3310 from the clamav clients only, HTTPS out for signature updates"
  vpc_id      = var.vpc_id

  tags = { service = "clamav", Name = "${var.name}-clamav" }
}

resource "aws_vpc_security_group_ingress_rule" "tasks" {
  for_each = {
    api_from_alb       = { group = aws_security_group.tasks.id, from = var.alb_security_group_id, port = 4000 }
    staff_from_alb     = { group = aws_security_group.tasks.id, from = var.alb_security_group_id, port = 3000 }
    console_from_alb   = { group = aws_security_group.tasks.id, from = var.alb_security_group_id, port = 3001 }
    clamd_from_clients = { group = aws_security_group.clamav.id, from = aws_security_group.clamav_clients.id, port = 3310 }
  }

  security_group_id            = each.value.group
  description                  = replace(each.key, "_", " ")
  referenced_security_group_id = each.value.from
  ip_protocol                  = "tcp"
  from_port                    = each.value.port
  to_port                      = each.value.port

  tags = { service = "app" }
}

# HTTPS out reaches the interface endpoints (ECR, Secrets Manager, Logs), S3 through its gateway
# endpoint, and SES, SNS, Sentry, the OTLP collector and the ClamAV mirror through NAT. The
# database and Redis rules are on the data client group.
# Trivy AWS-0104 (egress to 0.0.0.0/0): accepted, port 443 only; SES, SNS, Sentry, the OTLP
# collector and the ClamAV mirror have no fixed address ranges.
#trivy:ignore:AWS-0104
resource "aws_vpc_security_group_egress_rule" "tasks" {
  for_each = {
    https             = { group = aws_security_group.tasks.id, cidr = "0.0.0.0/0", to = null, port = 443, description = "HTTPS to AWS endpoints and the internet" }
    clamav_https      = { group = aws_security_group.clamav.id, cidr = "0.0.0.0/0", to = null, port = 443, description = "HTTPS to AWS endpoints and the signature mirror" }
    clients_to_clamav = { group = aws_security_group.clamav_clients.id, cidr = null, to = aws_security_group.clamav.id, port = 3310, description = "clamd" }
  }

  security_group_id            = each.value.group
  description                  = each.value.description
  cidr_ipv4                    = each.value.cidr
  referenced_security_group_id = each.value.to
  ip_protocol                  = "tcp"
  from_port                    = each.value.port
  to_port                      = each.value.port

  tags = { service = "app" }
}

# --- Services ---

resource "aws_ecs_service" "this" {
  for_each = var.services

  name                               = each.key
  cluster                            = aws_ecs_cluster.this.id
  task_definition                    = aws_ecs_task_definition.this[each.key].arn
  desired_count                      = var.desired_count
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = length(local.load_balancers[each.key]) > 0 ? 60 : null
  enable_ecs_managed_tags            = true
  propagate_tags                     = "SERVICE"
  wait_for_steady_state              = false

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = local.security_groups[each.key]
    assign_public_ip = false
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  dynamic "load_balancer" {
    for_each = local.load_balancers[each.key]

    content {
      target_group_arn = var.target_group_arns[load_balancer.value.target_group]
      container_name   = each.key
      container_port   = load_balancer.value.port
    }
  }

  dynamic "service_registries" {
    for_each = each.key == "clamav" ? [1] : []

    content {
      registry_arn = aws_service_discovery_service.clamav.arn
    }
  }

  tags = { service = each.key }

  # A new service's first tasks must find their roles' permissions and their network rules in
  # place; IAM and the rules are otherwise created in parallel with the service.
  depends_on = [
    aws_iam_role_policy.execution,
    aws_iam_role_policy.task,
    aws_vpc_security_group_ingress_rule.tasks,
    aws_vpc_security_group_egress_rule.tasks,
  ]

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
}
