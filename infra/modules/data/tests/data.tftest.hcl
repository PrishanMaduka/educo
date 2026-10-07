# The staging data layer, checked offline. AWS is mocked (infra/tests/mocks/aws). The random
# provider is the real one: mock providers cannot mock ephemeral resources, and random runs
# locally, so it never reaches an account.

mock_provider "aws" {
  source = "../../tests/mocks/aws"
}

# The shared mock gives every secret the same ARN; distinct ARNs let the proxy policy test tell
# the role secrets apart.
override_resource {
  target = aws_secretsmanager_secret.role["quad_owner"]
  values = { arn = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:quad-staging/db/quad_owner-AbCdEf" }
}

override_resource {
  target = aws_secretsmanager_secret.role["quad_app"]
  values = { arn = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:quad-staging/db/quad_app-AbCdEf" }
}

override_resource {
  target = aws_secretsmanager_secret.role["quad_platform"]
  values = { arn = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:quad-staging/db/quad_platform-AbCdEf" }
}

variables {
  name               = "quad-staging"
  vpc_id             = "vpc-0123456789abcdef0"
  private_subnet_ids = ["subnet-0aaaaaaaaaaaaaaa1", "subnet-0bbbbbbbbbbbbbbb2", "subnet-0ccccccccccccccc3"]
}

run "database_is_private_encrypted_and_protected" {
  command = apply

  assert {
    condition     = aws_db_instance.this.engine == "postgres" && startswith(aws_db_instance.this.engine_version, "16")
    error_message = "The database must be PostgreSQL 16."
  }

  assert {
    condition     = aws_db_instance.this.storage_encrypted && aws_db_instance.this.kms_key_id == aws_kms_key.data.arn
    error_message = "Storage must be encrypted with the data key."
  }

  assert {
    condition     = !aws_db_instance.this.publicly_accessible
    error_message = "The database must not be publicly accessible."
  }

  assert {
    condition     = aws_db_instance.this.deletion_protection && !aws_db_instance.this.skip_final_snapshot
    error_message = "The database must have deletion protection and keep a final snapshot."
  }

  assert {
    condition     = aws_db_instance.this.backup_retention_period == 7 && aws_db_instance.this.copy_tags_to_snapshot
    error_message = "Staging keeps 7 days of backups, with tags copied to snapshots."
  }

  assert {
    condition = (
      aws_db_instance.this.storage_type == "gp3" && aws_db_instance.this.allocated_storage == 20 &&
      aws_db_instance.this.max_allocated_storage == 100 && aws_db_instance.this.instance_class == "db.t4g.medium" &&
      !aws_db_instance.this.multi_az && aws_db_instance.this.auto_minor_version_upgrade
    )
    error_message = "Staging is a gp3 db.t4g.medium, single-AZ, 20 GB growing to 100 GB, with minor upgrades."
  }

  assert {
    condition     = aws_db_instance.this.performance_insights_enabled && aws_db_instance.this.performance_insights_kms_key_id == aws_kms_key.data.arn
    error_message = "Performance Insights must be on and encrypted with the data key."
  }

  assert {
    condition     = toset(aws_db_instance.this.vpc_security_group_ids) == toset([aws_security_group.db.id])
    error_message = "The database must use only the db security group."
  }
}

run "master_password_is_managed_by_rds_and_never_in_state" {
  command = apply

  assert {
    condition     = aws_db_instance.this.manage_master_user_password == true && aws_db_instance.this.username == "quad_admin"
    error_message = "RDS must manage the quad_admin master password."
  }

  assert {
    condition     = aws_db_instance.this.password == null && aws_db_instance.this.password_wo == null && aws_db_instance.this.password_wo_version == null
    error_message = "Terraform must not set the master password in any form."
  }

  assert {
    condition     = aws_db_instance.this.master_user_secret_kms_key_id == aws_kms_key.data.arn
    error_message = "The RDS-managed master secret must be encrypted with the data key."
  }

  # Ruling R-db-admin: db-bootstrap reads this secret's username and password keys (Task 12).
  assert {
    condition     = output.db_master_secret_arn == aws_db_instance.this.master_user_secret[0].secret_arn
    error_message = "db_master_secret_arn must be the RDS-managed master secret."
  }
}

run "parameter_group_forces_tls_and_keeps_statements_out_of_logs" {
  command = apply

  assert {
    condition     = aws_db_instance.this.parameter_group_name == aws_db_parameter_group.this.name && aws_db_parameter_group.this.family == "postgres16"
    error_message = "The database must use the module's postgres16 parameter group."
  }

  assert {
    condition     = { for p in aws_db_parameter_group.this.parameter : p.name => p.value }["rds.force_ssl"] == "1"
    error_message = "rds.force_ssl must be 1."
  }

  # db-bootstrap sends only SCRAM verifiers (Task 2); this is defence in depth.
  assert {
    condition     = { for p in aws_db_parameter_group.this.parameter : p.name => p.value }["log_statement"] == "none"
    error_message = "log_statement must be none, so no ALTER ROLE ... PASSWORD reaches the logs."
  }

  assert {
    condition     = { for p in aws_db_parameter_group.this.parameter : p.name => p.value }["log_min_duration_statement"] == "500"
    error_message = "log_min_duration_statement must be 500."
  }

  assert {
    condition = alltrue([for k, g in aws_cloudwatch_log_group.rds :
    g.name == "/aws/rds/instance/quad-staging-db/${k}" && g.kms_key_id == aws_kms_key.data.arn && g.retention_in_days == 30])
    error_message = "The exported RDS logs must go to encrypted log groups that keep 30 days."
  }

  assert {
    condition     = toset(aws_db_instance.this.enabled_cloudwatch_logs_exports) == toset(keys(aws_cloudwatch_log_group.rds))
    error_message = "Every exported RDS log must have its log group."
  }
}

run "proxy_requires_tls_and_serves_the_app_and_platform_roles" {
  command = apply

  assert {
    condition     = aws_db_proxy.this.require_tls && aws_db_proxy.this.engine_family == "POSTGRESQL"
    error_message = "The proxy must be PostgreSQL and require TLS."
  }

  assert {
    condition = toset([for a in aws_db_proxy.this.auth : a.secret_arn]) == toset([
      aws_secretsmanager_secret.role["quad_app"].arn, aws_secretsmanager_secret.role["quad_platform"].arn,
    ]) && length(aws_db_proxy.this.auth) == 2
    error_message = "The proxy must authenticate exactly quad_app and quad_platform."
  }

  # D28: password auth in staging; IAM auth arrives with production (M12).
  assert {
    condition = alltrue([for a in aws_db_proxy.this.auth :
    a.auth_scheme == "SECRETS" && a.iam_auth == "DISABLED" && a.client_password_auth_type == "POSTGRES_SCRAM_SHA_256"])
    error_message = "Every proxy auth entry must use its secret with SCRAM and no IAM auth."
  }

  assert {
    condition     = aws_db_proxy_target.this.db_instance_identifier == aws_db_instance.this.identifier && aws_db_proxy_target.this.db_proxy_name == aws_db_proxy.this.name
    error_message = "The proxy must target the module's database."
  }

  assert {
    condition     = toset(aws_db_proxy.this.vpc_security_group_ids) == toset([aws_security_group.proxy.id]) && toset(aws_db_proxy.this.vpc_subnet_ids) == toset(var.private_subnet_ids)
    error_message = "The proxy must sit in the private subnets with the proxy security group."
  }

  assert {
    condition = alltrue([for s in jsondecode(aws_iam_role.proxy.assume_role_policy).Statement :
    s.Principal == { Service = "rds.amazonaws.com" } && s.Condition.StringEquals["aws:SourceAccount"] == "123456789012"])
    error_message = "Only RDS in this account may assume the proxy role."
  }

  assert {
    condition = toset(flatten([for s in jsondecode(aws_iam_role_policy.proxy.policy).Statement : s.Resource if contains(flatten([s.Action]), "secretsmanager:GetSecretValue")])) == toset([
      aws_secretsmanager_secret.role["quad_app"].arn, aws_secretsmanager_secret.role["quad_platform"].arn,
    ])
    error_message = "The proxy role may read only the quad_app and quad_platform secrets."
  }

  assert {
    condition = alltrue([for s in jsondecode(aws_iam_role_policy.proxy.policy).Statement :
      s.Resource == aws_kms_key.data.arn && s.Condition.StringEquals["kms:ViaService"] == "secretsmanager.ap-south-1.amazonaws.com"
    if contains(flatten([s.Action]), "kms:Decrypt")])
    error_message = "The proxy role may decrypt with the data key only through Secrets Manager."
  }
}

run "database_reachable_only_from_client_and_proxy_groups" {
  command = apply

  # Every ingress rule of the data groups, as group <- source:port.
  assert {
    condition = toset([for r in aws_vpc_security_group_ingress_rule.data : "${r.security_group_id}<-${r.referenced_security_group_id}:${r.from_port}-${r.to_port}/${r.ip_protocol}"]) == toset([
      "${aws_security_group.db.id}<-${aws_security_group.client.id}:5432-5432/tcp",
      "${aws_security_group.db.id}<-${aws_security_group.proxy.id}:5432-5432/tcp",
      "${aws_security_group.proxy.id}<-${aws_security_group.client.id}:5432-5432/tcp",
      "${aws_security_group.redis.id}<-${aws_security_group.client.id}:6379-6379/tcp",
    ]) && length(aws_vpc_security_group_ingress_rule.data) == 4
    error_message = "The db group must admit only client and proxy, and the proxy and Redis groups only client."
  }

  assert {
    condition = alltrue([for r in aws_vpc_security_group_ingress_rule.data :
    r.cidr_ipv4 == null && r.cidr_ipv6 == null && r.prefix_list_id == null])
    error_message = "No data security group may admit a CIDR or prefix list."
  }

  assert {
    condition = alltrue([for g in [aws_security_group.client, aws_security_group.db, aws_security_group.proxy, aws_security_group.redis] :
    length(g.ingress) == 0 && length(g.egress) == 0])
    error_message = "The data security groups must have no inline rules (and so no default egress)."
  }

  assert {
    condition     = output.client_security_group_id == aws_security_group.client.id
    error_message = "client_security_group_id must be the client group."
  }
}

run "redis_is_encrypted_with_a_write_only_token" {
  command = apply

  assert {
    condition = (
      aws_elasticache_replication_group.this.engine == "redis" && aws_elasticache_replication_group.this.engine_version == "7.1" &&
      aws_elasticache_replication_group.this.node_type == "cache.t4g.micro" && aws_elasticache_replication_group.this.num_cache_clusters == 1
    )
    error_message = "Staging Redis is a single cache.t4g.micro node running Redis 7.1."
  }

  assert {
    condition     = aws_elasticache_replication_group.this.transit_encryption_enabled && aws_elasticache_replication_group.this.transit_encryption_mode == "required"
    error_message = "Redis must require TLS."
  }

  assert {
    condition     = aws_elasticache_replication_group.this.at_rest_encryption_enabled == "true" && aws_elasticache_replication_group.this.kms_key_id == aws_kms_key.data.arn
    error_message = "Redis must be encrypted at rest with the data key."
  }

  assert {
    condition     = aws_elasticache_replication_group.this.auth_token == null && aws_elasticache_replication_group.this.auth_token_wo_version == var.redis_auth_token_version
    error_message = "The Redis auth token must be write-only, never auth_token."
  }

  assert {
    condition     = { for p in aws_elasticache_parameter_group.this.parameter : p.name => p.value }["maxmemory-policy"] == "noeviction"
    error_message = "Redis must not evict keys (queues must not lose jobs)."
  }

  assert {
    condition     = aws_elasticache_replication_group.this.parameter_group_name == aws_elasticache_parameter_group.this.name
    error_message = "Redis must use the module's parameter group."
  }

  assert {
    condition     = toset(aws_elasticache_replication_group.this.security_group_ids) == toset([aws_security_group.redis.id])
    error_message = "Redis must use only the redis security group."
  }
}

run "redis_with_replicas_fails_over" {
  command = apply

  variables {
    redis_replicas = 1
  }

  assert {
    condition     = aws_elasticache_replication_group.this.num_cache_clusters == 2 && aws_elasticache_replication_group.this.automatic_failover_enabled && aws_elasticache_replication_group.this.multi_az_enabled
    error_message = "A replica must turn on automatic failover and Multi-AZ."
  }
}

run "secrets_are_written_only_through_write_only_attributes" {
  command = apply

  assert {
    condition = alltrue([for v in concat(values(aws_secretsmanager_secret_version.role), values(aws_secretsmanager_secret_version.database_url), [aws_secretsmanager_secret_version.redis_url]) :
    v.secret_string == null && v.secret_binary == null && v.secret_string_wo_version != null])
    error_message = "No secret version may set secret_string or secret_binary: secrets are written only through secret_string_wo."
  }

  assert {
    condition     = toset(keys(aws_secretsmanager_secret.role)) == toset(["quad_owner", "quad_app", "quad_platform"])
    error_message = "Each database role must have its own secret."
  }

  assert {
    condition     = alltrue([for k, s in aws_secretsmanager_secret.role : s.name == "quad-staging/db/${k}" && s.kms_key_id == aws_kms_key.data.arn])
    error_message = "Role secrets must be quad-staging/db/<role>, encrypted with the data key."
  }

  assert {
    condition     = alltrue([for k, s in aws_secretsmanager_secret.env : s.name == "quad-staging/env/${k}" && s.kms_key_id == aws_kms_key.data.arn])
    error_message = "URL secrets must be quad-staging/env/<NAME>, encrypted with the data key."
  }

  # A role's password, its URL and the proxy's copy are written in one apply under one version.
  assert {
    condition = (
      aws_secretsmanager_secret_version.database_url["DATABASE_URL"].secret_string_wo_version == aws_secretsmanager_secret_version.role["quad_app"].secret_string_wo_version &&
      aws_secretsmanager_secret_version.database_url["DATABASE_PLATFORM_URL"].secret_string_wo_version == aws_secretsmanager_secret_version.role["quad_platform"].secret_string_wo_version &&
      aws_secretsmanager_secret_version.database_url["DATABASE_OWNER_URL"].secret_string_wo_version == aws_secretsmanager_secret_version.role["quad_owner"].secret_string_wo_version &&
      aws_secretsmanager_secret_version.redis_url.secret_string_wo_version == aws_elasticache_replication_group.this.auth_token_wo_version
    )
    error_message = "Each URL secret must share its role's (or Redis's) write-only version."
  }
}

run "rotating_one_role_moves_its_secret_and_url_together" {
  command = apply

  variables {
    db_password_versions = { quad_owner = 1, quad_app = 2, quad_platform = 1 }
  }

  assert {
    condition = (
      aws_secretsmanager_secret_version.role["quad_app"].secret_string_wo_version == 2 &&
      aws_secretsmanager_secret_version.database_url["DATABASE_URL"].secret_string_wo_version == 2 &&
      aws_secretsmanager_secret_version.role["quad_platform"].secret_string_wo_version == 1
    )
    error_message = "Bumping quad_app's version must rewrite its role secret and DATABASE_URL, and nothing else."
  }
}

run "password_versions_must_name_every_role" {
  command = plan

  variables {
    db_password_versions = { quad_app = 1 }
  }

  expect_failures = [var.db_password_versions]
}

run "env_secret_arns_are_the_four_urls_and_no_admin_url" {
  command = apply

  assert {
    condition     = toset(keys(output.env_secret_arns)) == toset(["DATABASE_URL", "DATABASE_PLATFORM_URL", "DATABASE_OWNER_URL", "REDIS_URL"])
    error_message = "env_secret_arns must hold exactly the four URL secrets."
  }

  # Ruling R-db-admin: the master user is reached through the RDS-managed secret only.
  assert {
    condition     = !contains(keys(output.env_secret_arns), "DATABASE_ADMIN_URL") && !contains(keys(aws_secretsmanager_secret.env), "DATABASE_ADMIN_URL")
    error_message = "There must be no DATABASE_ADMIN_URL secret."
  }

  assert {
    condition     = alltrue([for k, arn in output.env_secret_arns : arn == aws_secretsmanager_secret.env[k].arn])
    error_message = "env_secret_arns must point at the env secrets."
  }
}

run "buckets_are_private_versioned_and_kms_encrypted" {
  command = apply

  assert {
    condition = alltrue([for b in [aws_s3_bucket_public_access_block.private, aws_s3_bucket_public_access_block.public] :
    b.block_public_acls && b.block_public_policy && b.ignore_public_acls && b.restrict_public_buckets])
    error_message = "Every bucket must have all four public access blocks."
  }

  assert {
    condition     = aws_s3_bucket.private.bucket == "quad-staging-private" && aws_s3_bucket.public.bucket == "quad-staging-public"
    error_message = "The buckets must be quad-staging-private and quad-staging-public."
  }

  assert {
    condition = alltrue([for c in [aws_s3_bucket_ownership_controls.private, aws_s3_bucket_ownership_controls.public] :
    one(c.rule).object_ownership == "BucketOwnerEnforced"])
    error_message = "Both buckets must disable ACLs (BucketOwnerEnforced)."
  }

  assert {
    condition = alltrue([for v in [aws_s3_bucket_versioning.private, aws_s3_bucket_versioning.public] :
    one(v.versioning_configuration).status == "Enabled"])
    error_message = "Both buckets must be versioned."
  }

  assert {
    condition = alltrue([for e in [aws_s3_bucket_server_side_encryption_configuration.private, aws_s3_bucket_server_side_encryption_configuration.public] :
      one(one(e.rule).apply_server_side_encryption_by_default).sse_algorithm == "aws:kms" &&
    one(one(e.rule).apply_server_side_encryption_by_default).kms_master_key_id == aws_kms_key.data.arn])
    error_message = "Both buckets must use SSE-KMS with the data key."
  }
}

run "private_bucket_lifecycle_and_tls_only_policy" {
  command = apply

  assert {
    condition = one([for r in aws_s3_bucket_lifecycle_configuration.private.rule :
    one(r.expiration).days if r.status == "Enabled" && one(r.filter).prefix == "tmp/"]) == 1
    error_message = "Objects under tmp/ must expire after 1 day."
  }

  assert {
    condition = one([for r in aws_s3_bucket_lifecycle_configuration.private.rule :
    one(r.expiration).days if r.status == "Enabled" && one(r.filter).prefix == "exports/"]) == 7
    error_message = "Objects under exports/ must expire after 7 days."
  }

  assert {
    condition = anytrue([for r in aws_s3_bucket_lifecycle_configuration.private.rule :
    r.status == "Enabled" && length(r.noncurrent_version_expiration) == 1 && one(r.noncurrent_version_expiration).noncurrent_days == 30])
    error_message = "Noncurrent versions must expire after 30 days."
  }

  assert {
    condition = anytrue([for s in jsondecode(aws_s3_bucket_policy.private.policy).Statement :
      s.Effect == "Deny" && s.Principal == "*" && s.Action == "s3:*" &&
      toset(s.Resource) == toset([aws_s3_bucket.private.arn, "${aws_s3_bucket.private.arn}/*"]) &&
    s.Condition.Bool["aws:SecureTransport"] == "false"])
    error_message = "The private bucket policy must deny every request without TLS."
  }
}

run "keys_rotate_and_are_administered_by_this_account" {
  command = apply

  assert {
    condition     = aws_kms_key.data.enable_key_rotation && aws_kms_key.field.enable_key_rotation
    error_message = "Both KMS keys must rotate."
  }

  assert {
    condition     = output.data_kms_key_arn == aws_kms_key.data.arn && output.field_kms_key_arn == aws_kms_key.field.arn
    error_message = "The key outputs must be the data and field keys."
  }

  assert {
    condition = alltrue([for k in [aws_kms_key.data, aws_kms_key.field] :
    alltrue([for s in jsondecode(k.policy).Statement : s.Effect == "Allow"])])
    error_message = "The key policies must only allow."
  }

  assert {
    condition = alltrue([for k in [aws_kms_key.data, aws_kms_key.field] :
      alltrue([for s in jsondecode(k.policy).Statement :
    s.Principal == { AWS = "arn:aws:iam::123456789012:root" } if can(s.Principal.AWS)])])
    error_message = "Only this account's root may administer the keys."
  }

  assert {
    condition = toset([for s in jsondecode(aws_kms_key.data.policy).Statement : s.Principal.Service if can(s.Principal.Service)]) == toset([
      "logs.ap-south-1.amazonaws.com", "cloudfront.amazonaws.com",
    ])
    error_message = "Only CloudWatch Logs and CloudFront may use the data key as services."
  }

  # CloudWatch Logs may use the data key only for this database's log groups.
  assert {
    condition = alltrue([for s in jsondecode(aws_kms_key.data.policy).Statement :
      s.Condition.ArnLike["kms:EncryptionContext:aws:logs:arn"] == "arn:aws:logs:ap-south-1:123456789012:log-group:/aws/rds/instance/quad-staging-db/*"
    if try(s.Principal.Service, "") == "logs.ap-south-1.amazonaws.com"])
    error_message = "CloudWatch Logs may use the data key only for the database's log groups."
  }

  # CloudFront (origin access control, edge module) may only decrypt, for this account's
  # distributions.
  assert {
    condition = alltrue([for s in jsondecode(aws_kms_key.data.policy).Statement :
      s.Action == "kms:Decrypt" && s.Condition.ArnLike["aws:SourceArn"] == "arn:aws:cloudfront::123456789012:distribution/*"
    if try(s.Principal.Service, "") == "cloudfront.amazonaws.com"])
    error_message = "CloudFront may only decrypt with the data key, for this account's distributions."
  }

  assert {
    condition     = length([for s in jsondecode(aws_kms_key.field.policy).Statement : s if can(s.Principal.Service)]) == 0
    error_message = "No AWS service principal may use the field key directly."
  }
}

run "outputs_for_the_app_edge_and_dashboard" {
  command = apply

  assert {
    condition = (
      output.db_proxy_endpoint == aws_db_proxy.this.endpoint && output.db_instance_address == aws_db_instance.this.address &&
      output.rds_instance_id == aws_db_instance.this.identifier && output.redis_replication_group_id == aws_elasticache_replication_group.this.id
    )
    error_message = "The database and Redis outputs must point at the module's resources."
  }

  assert {
    condition = (
      output.private_bucket_name == aws_s3_bucket.private.bucket && output.private_bucket_arn == aws_s3_bucket.private.arn &&
      output.public_bucket_name == aws_s3_bucket.public.bucket && output.public_bucket_arn == aws_s3_bucket.public.arn &&
      output.public_bucket_id == aws_s3_bucket.public.id && output.public_bucket_regional_domain_name == aws_s3_bucket.public.bucket_regional_domain_name
    )
    error_message = "The bucket outputs must point at the module's buckets."
  }
}

run "every_resource_names_its_service" {
  command = apply

  assert {
    condition = alltrue([for t in concat(
      [aws_db_instance.this.tags, aws_db_proxy.this.tags, aws_elasticache_replication_group.this.tags, aws_kms_key.data.tags, aws_kms_key.field.tags],
      [aws_s3_bucket.private.tags, aws_s3_bucket.public.tags, aws_security_group.client.tags],
      [for s in values(aws_secretsmanager_secret.env) : s.tags],
    ) : t.service == "data"])
    error_message = "Every data resource must carry service = data."
  }
}
