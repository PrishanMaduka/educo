# Redis 7.1 for BullMQ, sessions, rate limits and the worker heartbeat (spec 20). It must never
# evict keys, because queues must not lose jobs. The auth token is write-only
# (`auth_token_wo`), so it is never in Terraform state; secrets.tf writes the same token into
# REDIS_URL in the same apply. ElastiCache IAM authentication is not used: its tokens expire
# every 15 minutes and ioredis (the API and BullMQ client) has no built-in way to refresh them.

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name}-redis"
  subnet_ids = var.private_subnet_ids

  tags = local.tags
}

resource "aws_elasticache_parameter_group" "this" {
  name   = "${var.name}-redis7"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }

  tags = local.tags
}

resource "aws_elasticache_replication_group" "this" {
  #checkov:skip=CKV_AWS_31:The auth token is set through the write-only auth_token_wo, which Checkov does not read; TLS is required.
  #checkov:skip=CKV2_AWS_50:Staging Redis is one node (redis_replicas = 0, D28); a replica turns on failover and Multi-AZ (M12).
  replication_group_id = "${var.name}-redis"
  description          = "${var.name} queues, sessions and rate limits"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.this.name
  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [aws_security_group.redis.id]

  num_cache_clusters         = 1 + var.redis_replicas
  automatic_failover_enabled = var.redis_replicas > 0
  multi_az_enabled           = var.redis_replicas > 0

  at_rest_encryption_enabled = true
  kms_key_id                 = aws_kms_key.data.arn
  transit_encryption_enabled = true
  transit_encryption_mode    = "required"
  auth_token_wo              = ephemeral.random_password.redis.result
  auth_token_wo_version      = var.redis_auth_token_version

  auto_minor_version_upgrade = true
  maintenance_window         = "sun:21:30-sun:22:30"
  snapshot_retention_limit   = 1
  snapshot_window            = "18:00-19:00"

  tags = local.tags
}
