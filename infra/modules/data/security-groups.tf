# `client` is attached to the tasks that use the data layer (Task 12) and has no ingress. The
# database, proxy and Redis groups admit only `client` (and the database also the proxy), never a
# CIDR. Every group's rules are separate resources, so none keeps the default allow-all egress.

resource "aws_security_group" "client" {
  #checkov:skip=CKV2_AWS_5:Attached to the ECS tasks by the app module (Task 12), not in this module.
  name        = "${var.name}-data-client"
  description = "Tasks that use the database or Redis"
  vpc_id      = var.vpc_id

  tags = merge(local.tags, { Name = "${var.name}-data-client" })
}

resource "aws_security_group" "db" {
  name        = "${var.name}-db"
  description = "PostgreSQL: from data clients and the proxy only"
  vpc_id      = var.vpc_id

  tags = merge(local.tags, { Name = "${var.name}-db" })
}

resource "aws_security_group" "proxy" {
  #checkov:skip=CKV2_AWS_5:Attached to aws_db_proxy.this (vpc_security_group_ids), which this check does not follow.
  name        = "${var.name}-db-proxy"
  description = "RDS Proxy: from data clients only"
  vpc_id      = var.vpc_id

  tags = merge(local.tags, { Name = "${var.name}-db-proxy" })
}

resource "aws_security_group" "redis" {
  name        = "${var.name}-redis"
  description = "Redis: from data clients only"
  vpc_id      = var.vpc_id

  tags = merge(local.tags, { Name = "${var.name}-redis" })
}

# --- Ingress ---

# Every ingress rule of the data groups is in this one map, so the tests see all of them. Runtime
# tasks reach the database through the proxy; migrate, seed and db-bootstrap connect directly
# (spec 20: migrations do not use the proxy).
locals {
  ingress = {
    db_from_client    = { group = aws_security_group.db.id, from = aws_security_group.client.id, port = 5432 }
    db_from_proxy     = { group = aws_security_group.db.id, from = aws_security_group.proxy.id, port = 5432 }
    proxy_from_client = { group = aws_security_group.proxy.id, from = aws_security_group.client.id, port = 5432 }
    redis_from_client = { group = aws_security_group.redis.id, from = aws_security_group.client.id, port = 6379 }
  }
}

resource "aws_vpc_security_group_ingress_rule" "data" {
  for_each = local.ingress

  security_group_id            = each.value.group
  description                  = replace(each.key, "_", " ")
  referenced_security_group_id = each.value.from
  ip_protocol                  = "tcp"
  from_port                    = each.value.port
  to_port                      = each.value.port

  tags = local.tags
}

# --- Egress ---

resource "aws_vpc_security_group_egress_rule" "client" {
  for_each = {
    proxy = { group = aws_security_group.proxy.id, port = 5432 }
    db    = { group = aws_security_group.db.id, port = 5432 }
    redis = { group = aws_security_group.redis.id, port = 6379 }
  }

  security_group_id            = aws_security_group.client.id
  description                  = "To the ${each.key} group"
  referenced_security_group_id = each.value.group
  ip_protocol                  = "tcp"
  from_port                    = each.value.port
  to_port                      = each.value.port

  tags = local.tags
}

resource "aws_vpc_security_group_egress_rule" "proxy_to_db" {
  security_group_id            = aws_security_group.proxy.id
  description                  = "PostgreSQL to the database"
  referenced_security_group_id = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432

  tags = local.tags
}

# The proxy fetches its auth secrets from Secrets Manager through the VPC's interface endpoint.
resource "aws_vpc_security_group_egress_rule" "proxy_to_endpoints" {
  security_group_id            = aws_security_group.proxy.id
  description                  = "HTTPS to the VPC interface endpoints (Secrets Manager)"
  referenced_security_group_id = var.endpoints_security_group_id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443

  tags = local.tags
}
