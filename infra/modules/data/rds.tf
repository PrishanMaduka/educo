# PostgreSQL 16 behind RDS Proxy (spec 20 → Infrastructure, D28). RDS manages the quad_admin
# master password in its own secret (ruling R-db-admin), so no master password is ever in
# Terraform state, and there is no DATABASE_ADMIN_URL secret.

locals {
  db_identifier  = "${var.name}-db"
  db_log_exports = ["postgresql", "upgrade"]

  rds_monitoring_trust_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = { StringEquals = { "aws:SourceAccount" = local.account_id } }
    }]
  })

  proxy_trust_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = { StringEquals = { "aws:SourceAccount" = local.account_id } }
    }]
  })

  # The proxy reads only the two runtime role secrets, never quad_owner's or the master secret.
  proxy_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadTheRuntimeRoleSecrets"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [for role in local.proxied_roles : aws_secretsmanager_secret.role[role].arn]
      },
      {
        Sid       = "DecryptThemThroughSecretsManager"
        Effect    = "Allow"
        Action    = ["kms:Decrypt"]
        Resource  = aws_kms_key.data.arn
        Condition = { StringEquals = { "kms:ViaService" = "secretsmanager.${local.region}.amazonaws.com" } }
      },
    ]
  })
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-db"
  subnet_ids = var.private_subnet_ids

  tags = local.tags
}

resource "aws_db_parameter_group" "this" {
  # A prefix, so create_before_destroy can build the replacement before the instance moves to it.
  name_prefix = "${var.name}-postgres16-"
  family      = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "500"
  }

  # Slow-query and error log lines never carry bind values, which can be personal data.
  parameter {
    name  = "log_parameter_max_length"
    value = "0"
  }

  parameter {
    name  = "log_parameter_max_length_on_error"
    value = "0"
  }

  # Defence in depth: db-bootstrap sends only SCRAM verifiers (Task 2), but no statement text,
  # and so no ALTER ROLE ... PASSWORD, is logged.
  parameter {
    name  = "log_statement"
    value = "none"
  }

  tags = local.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_cloudwatch_log_group" "rds" {
  #checkov:skip=CKV_AWS_338:Staging keeps database logs for log_retention_days (30); production retention is an M12 decision.
  for_each = toset(local.db_log_exports)

  name              = "/aws/rds/instance/${local.db_identifier}/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.data.arn

  tags = local.tags
}

resource "aws_iam_role" "rds_monitoring" {
  name               = "${var.name}-rds-monitoring"
  assume_role_policy = local.rds_monitoring_trust_policy

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:${local.partition}:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_db_instance" "this" {
  #checkov:skip=CKV_AWS_157:Staging is single-AZ (var.multi_az, D28); production turns Multi-AZ on in M12.
  identifier     = local.db_identifier
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class
  db_name        = var.db_name

  username                      = "quad_admin"
  manage_master_user_password   = true
  master_user_secret_kms_key_id = aws_kms_key.data.arn
  # Allows IAM database authentication for M12 (spec 20); no principal has rds-db:connect yet.
  iam_database_authentication_enabled = true

  storage_type          = "gp3"
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.data.arn

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = var.multi_az
  parameter_group_name   = aws_db_parameter_group.this.name
  ca_cert_identifier     = "rds-ca-rsa2048-g1"

  backup_retention_period   = var.backup_retention_days
  backup_window             = "19:00-20:00"
  maintenance_window        = "sun:20:30-sun:21:30"
  copy_tags_to_snapshot     = true
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.db_identifier}-final"

  auto_minor_version_upgrade      = true
  enabled_cloudwatch_logs_exports = local.db_log_exports
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.data.arn
  monitoring_interval             = 60
  monitoring_role_arn             = aws_iam_role.rds_monitoring.arn

  tags = merge(local.tags, { Name = local.db_identifier })

  depends_on = [aws_cloudwatch_log_group.rds, aws_iam_role_policy_attachment.rds_monitoring]
}

# --- RDS Proxy (D28: Secrets Manager password auth with TLS in staging; IAM auth is M12) ---

resource "aws_iam_role" "proxy" {
  name               = "${var.name}-db-proxy"
  assume_role_policy = local.proxy_trust_policy

  tags = local.tags
}

resource "aws_iam_role_policy" "proxy" {
  name   = "read-role-secrets"
  role   = aws_iam_role.proxy.id
  policy = local.proxy_policy
}

resource "aws_db_proxy" "this" {
  name                   = "${var.name}-db"
  engine_family          = "POSTGRESQL"
  require_tls            = true
  role_arn               = aws_iam_role.proxy.arn
  vpc_subnet_ids         = var.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.proxy.id]
  idle_client_timeout    = 1800
  debug_logging          = false

  dynamic "auth" {
    for_each = toset(local.proxied_roles)

    content {
      description               = auth.key
      auth_scheme               = "SECRETS"
      secret_arn                = aws_secretsmanager_secret.role[auth.key].arn
      iam_auth                  = "DISABLED"
      client_password_auth_type = "POSTGRES_SCRAM_SHA_256"
    }
  }

  tags = local.tags

  depends_on = [aws_iam_role_policy.proxy]
}

resource "aws_db_proxy_default_target_group" "this" {
  db_proxy_name = aws_db_proxy.this.name

  connection_pool_config {
    max_connections_percent      = 90
    max_idle_connections_percent = 50
    connection_borrow_timeout    = 120
  }
}

resource "aws_db_proxy_target" "this" {
  db_proxy_name          = aws_db_proxy.this.name
  target_group_name      = aws_db_proxy_default_target_group.this.name
  db_instance_identifier = aws_db_instance.this.identifier
}
