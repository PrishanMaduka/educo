# The ALB (spec 20 → Edge, D14). Only CloudFront can reach it: its security group admits 443 only
# from CloudFront's origin-facing prefix list, and every forwarding rule also requires the origin
# secret that CloudFront adds as X-Quad-Origin-Secret. Anything else, including a direct request to
# origin_domain, gets the listener default: 403 with the body "Forbidden" (scripts/smoke.mjs
# --origin checks exactly that). The API does no check of its own (D28).
#
# The proxy chain is exactly CloudFront → ALB → task, which TRUST_PROXY_HOPS=2 relies on:
# CloudFront appends the viewer to X-Forwarded-For and the ALB appends CloudFront.

locals {
  tags = { service = "edge" }

  origin_secret_header = "X-Quad-Origin-Secret"

  # The values every listener rule accepts (all slots) and the one CloudFront sends.
  origin_secret_values = [for slot in sort(var.origin_secret_slots) : random_password.origin_secret[slot].result]
  origin_secret_sent   = random_password.origin_secret[var.origin_secret_active].result

  target_groups = {
    api        = { port = 4000, health = "/api/v1/health/ready", sticky = false }
    api_socket = { port = 4000, health = "/api/v1/health/ready", sticky = true }
    staff      = { port = 3000, health = "/healthz", sticky = false }
    console    = { port = 3001, health = "/healthz", sticky = false }
  }

  # D14 and spec 20: the console host goes to the console, except its platform API (sign-in
  # included, under /api/v1/platform/auth/) and its realtime connection (ruling
  # R-console-realtime); then /api/v1/* and /socket.io/* go to the api, and everything else to
  # staff.
  routes = {
    console-platform-api = { priority = 10, hosts = [var.console_domain], paths = ["/api/v1/platform/*"], target = "api" }
    console-socket-io    = { priority = 15, hosts = [var.console_domain], paths = ["/socket.io/*"], target = "api_socket" }
    console              = { priority = 20, hosts = [var.console_domain], paths = [], target = "console" }
    api                  = { priority = 30, hosts = [], paths = ["/api/v1/*"], target = "api" }
    socket-io            = { priority = 40, hosts = [], paths = ["/socket.io/*"], target = "api_socket" }
    staff                = { priority = 50, hosts = [], paths = ["/*"], target = "staff" }
  }
}

# One secret per slot (origin_secret_slots). Alphanumeric only: listener rule header values treat
# * and ? as wildcards. The ALB compares header values case-insensitively, so 48 characters from
# an effective 36-character alphabet give about 248 bits, far beyond guessing. The secrets are in
# Terraform state, because CloudFront's custom header and the listener rule condition have no
# write-only form (D28). Rotation without downtime takes three applies (D28): add a slot, make it
# active once CloudFront has deployed, then remove the old slot.
resource "random_password" "origin_secret" {
  for_each = toset(var.origin_secret_slots)

  length  = 48
  special = false
}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  name        = "${var.name}-alb"
  description = "ALB: HTTPS from CloudFront origin-facing addresses only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTPS from CloudFront"
    protocol        = "tcp"
    from_port       = 443
    to_port         = 443
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  }

  egress {
    description = "Staff and console tasks"
    protocol    = "tcp"
    from_port   = 3000
    to_port     = 3001
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "API tasks"
    protocol    = "tcp"
    from_port   = 4000
    to_port     = 4000
    cidr_blocks = [var.vpc_cidr]
  }

  tags = merge(local.tags, { Name = "${var.name}-alb" })
}

# Trivy AWS-0053 (public load balancer): CloudFront calls the ALB over the internet; its security
# group admits only CloudFront's origin-facing prefix list, and every rule requires the origin secret.
#trivy:ignore:AWS-0053
resource "aws_lb" "this" {
  #checkov:skip=CKV_AWS_91:staging; production logging arrives in M12.
  #checkov:skip=CKV2_AWS_28:WAF is attached to the CloudFront distribution, the only way in; the ALB admits only CloudFront.
  name               = var.name
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  idle_timeout               = var.alb_idle_timeout
  drop_invalid_header_fields = true
  enable_deletion_protection = var.alb_deletion_protection
  xff_header_processing_mode = "append"

  tags = merge(local.tags, { Name = var.name })
}

resource "aws_lb_target_group" "this" {
  #checkov:skip=CKV_AWS_378:TLS ends at the ALB; it reaches the tasks over HTTP inside the VPC (spec 20).
  for_each = local.target_groups

  name                 = "${var.name}-${replace(each.key, "_", "-")}"
  port                 = each.value.port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = 30

  health_check {
    path                = each.value.health
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  # Spec 20: the Socket.IO long-polling fallback needs every request of a session on one task.
  # Ruling R-sticky: the ALB's own cookie (AWSALB), for one day, so the app sets no cookie.
  dynamic "stickiness" {
    for_each = each.value.sticky ? [1] : []

    content {
      enabled         = true
      type            = "lb_cookie"
      cookie_duration = 86400
    }
  }

  tags = merge(local.tags, { Name = "${var.name}-${replace(each.key, "_", "-")}" })
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.origin.certificate_arn

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }

  tags = local.tags
}

resource "aws_lb_listener_rule" "route" {
  for_each = local.routes

  listener_arn = aws_lb_listener.https.arn
  priority     = each.value.priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this[each.value.target].arn
  }

  condition {
    http_header {
      http_header_name = local.origin_secret_header
      values           = local.origin_secret_values
    }
  }

  dynamic "condition" {
    for_each = length(each.value.hosts) > 0 ? [each.value.hosts] : []

    content {
      host_header {
        values = condition.value
      }
    }
  }

  dynamic "condition" {
    for_each = length(each.value.paths) > 0 ? [each.value.paths] : []

    content {
      path_pattern {
        values = condition.value
      }
    }
  }

  tags = merge(local.tags, { Name = "${var.name}-${each.key}" })
}
