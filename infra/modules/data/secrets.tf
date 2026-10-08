# Database and Redis secrets, kept out of Terraform state (Task 8 review). Passwords and the Redis
# token come from `ephemeral "random_password"`, which is never stored, and reach Secrets Manager
# and ElastiCache only through write-only attributes. A write-only value is sent when its
# version changes or its resource is created, so:
#   - each role's secret (which RDS Proxy reads) and every URL secret built from its password
#     share one version, var.db_password_versions[role], and the Redis token and REDIS_URL share
#     var.redis_auth_token_version. Raising a version rewrites all of them from one new value in
#     one apply. Then run db-bootstrap so the database role gets the new password;
#   - when RDS or the proxy is replaced, the URL secrets would keep the old host, so
#     `replace_triggered_by` rewrites every database secret (all three roles, new passwords) in
#     that apply; run db-bootstrap afterwards. Replacing Redis rewrites REDIS_URL with the token
#     the new group is created with;
#   - if an apply fails between two writes of the same version, raise that version and apply
#     again, so every copy holds one value.
# Passwords are alphanumeric (no URL escaping needed, and printable ASCII for db-bootstrap's
# SCRAM verifiers).

locals {
  db_roles      = ["quad_owner", "quad_app", "quad_platform"]
  proxied_roles = ["quad_app", "quad_platform"]

  # URL secrets (`<name>/env/<NAME>`): whole URLs, so the API config is unchanged (D28). The
  # runtime roles go through the proxy; quad_owner (migrate, seed, db-bootstrap) goes directly to
  # RDS. There is no DATABASE_ADMIN_URL (ruling R-db-admin).
  database_urls = {
    DATABASE_URL          = { role = "quad_app", host = aws_db_proxy.this.endpoint }
    DATABASE_PLATFORM_URL = { role = "quad_platform", host = aws_db_proxy.this.endpoint }
    DATABASE_OWNER_URL    = { role = "quad_owner", host = aws_db_instance.this.address }
  }
  env_secret_names = concat(keys(local.database_urls), ["REDIS_URL"])
}

ephemeral "random_password" "db" {
  for_each = toset(local.db_roles)

  length  = 48
  special = false
}

ephemeral "random_password" "redis" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "role" {
  #checkov:skip=CKV2_AWS_57:Rotation is by raising db_password_versions; Secrets Manager rotation (90 days, spec 20) arrives with production in M12.
  for_each = toset(local.db_roles)

  name                    = "${var.name}/db/${each.key}"
  description             = "PostgreSQL role ${each.key}: username and password"
  kms_key_id              = aws_kms_key.data.arn
  recovery_window_in_days = 7

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "role" {
  for_each = toset(local.db_roles)

  secret_id = aws_secretsmanager_secret.role[each.key].id
  secret_string_wo = jsonencode({
    username = each.key
    password = ephemeral.random_password.db[each.key].result
  })
  secret_string_wo_version = var.db_password_versions[each.key]

  lifecycle {
    replace_triggered_by = [aws_db_instance.this.address, aws_db_proxy.this.endpoint]
  }
}

resource "aws_secretsmanager_secret" "env" {
  #checkov:skip=CKV2_AWS_57:Rotated with the role or token version it is built from; Secrets Manager rotation arrives with production in M12.
  for_each = toset(local.env_secret_names)

  name                    = "${var.name}/env/${each.key}"
  description             = "${each.key} for the API, worker and one-off tasks"
  kms_key_id              = aws_kms_key.data.arn
  recovery_window_in_days = 7

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "database_url" {
  for_each = local.database_urls

  secret_id                = aws_secretsmanager_secret.env[each.key].id
  secret_string_wo         = "postgresql://${each.value.role}:${ephemeral.random_password.db[each.value.role].result}@${each.value.host}:5432/${var.db_name}?sslmode=verify-full"
  secret_string_wo_version = var.db_password_versions[each.value.role]

  lifecycle {
    replace_triggered_by = [aws_db_instance.this.address, aws_db_proxy.this.endpoint]
  }
}

resource "aws_secretsmanager_secret_version" "redis_url" {
  secret_id                = aws_secretsmanager_secret.env["REDIS_URL"].id
  secret_string_wo         = "rediss://:${ephemeral.random_password.redis.result}@${aws_elasticache_replication_group.this.primary_endpoint_address}:6379"
  secret_string_wo_version = var.redis_auth_token_version

  lifecycle {
    replace_triggered_by = [aws_elasticache_replication_group.this.primary_endpoint_address]
  }
}
