output "client_security_group_id" {
  description = "Attach to every task that uses the database or Redis (app module)."
  value       = aws_security_group.client.id
}

output "db_proxy_endpoint" {
  description = "RDS Proxy endpoint (quad_app and quad_platform)."
  value       = aws_db_proxy.this.endpoint
}

output "db_instance_address" {
  description = "RDS instance address, for direct connections (migrate, seed, db-bootstrap's DATABASE_ADMIN_HOST)."
  value       = aws_db_instance.this.address
}

output "env_secret_arns" {
  description = "Secret ARNs by environment variable name: DATABASE_URL, DATABASE_PLATFORM_URL, DATABASE_OWNER_URL and REDIS_URL."
  value       = { for k, s in aws_secretsmanager_secret.env : k => s.arn }
}

output "db_master_secret_arn" {
  description = "The RDS-managed master user secret (JSON keys username and password), read only by db-bootstrap's execution role (ruling R-db-admin)."
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}

output "private_bucket_name" {
  description = "Private bucket name (S3_BUCKET_PRIVATE)."
  value       = aws_s3_bucket.private.bucket
}

output "private_bucket_arn" {
  description = "Private bucket ARN."
  value       = aws_s3_bucket.private.arn
}

output "public_bucket_name" {
  description = "Public bucket name (S3_BUCKET_PUBLIC)."
  value       = aws_s3_bucket.public.bucket
}

output "public_bucket_arn" {
  description = "Public bucket ARN, for the edge module's bucket policy."
  value       = aws_s3_bucket.public.arn
}

output "public_bucket_id" {
  description = "Public bucket id, for the edge module's bucket policy."
  value       = aws_s3_bucket.public.id
}

output "public_bucket_regional_domain_name" {
  description = "Public bucket regional domain name, the CloudFront origin."
  value       = aws_s3_bucket.public.bucket_regional_domain_name
}

output "data_kms_key_arn" {
  description = "The data key (RDS, S3, Secrets Manager, Redis)."
  value       = aws_kms_key.data.arn
}

output "field_kms_key_arn" {
  description = "The field-level encryption key."
  value       = aws_kms_key.field.arn
}

output "rds_instance_id" {
  description = "RDS instance identifier, for the dashboard."
  value       = aws_db_instance.this.identifier
}

output "redis_replication_group_id" {
  description = "ElastiCache replication group id, for the dashboard."
  value       = aws_elasticache_replication_group.this.id
}

output "data_kms_key_policy" {
  description = "The data key's effective policy (JSON, aws_kms_key_policy.data), so the environment root can check that it names the CloudFront distribution."
  value       = aws_kms_key_policy.data.policy
}

output "redis_member_clusters" {
  description = "The replication group's member cluster ids (<group>-001, …), sorted; the dashboard charts Redis memory per member."
  value       = sort(tolist(aws_elasticache_replication_group.this.member_clusters))
}
