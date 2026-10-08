variable "name" {
  type        = string
  description = "Resource name prefix, for example quad-staging. Secrets are named <name>/db/<role> and <name>/env/<NAME>."
}

variable "vpc_id" {
  type        = string
  description = "The VPC from the network module."
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnets from the network module, in at least two zones (RDS, RDS Proxy and Redis)."

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "private_subnet_ids needs at least two subnets in different zones."
  }
}

variable "endpoints_security_group_id" {
  type        = string
  description = "The network module's interface endpoint security group; the RDS Proxy reaches Secrets Manager through it."
}

variable "cloudfront_distribution_arns" {
  type        = list(string)
  description = "CloudFront distributions that may decrypt the public bucket's objects with the data key (origin access control). The environment root passes module.edge.cloudfront_distribution_arn; empty omits the statement."
  default     = []

  validation {
    condition     = alltrue([for arn in var.cloudfront_distribution_arns : can(regex("^arn:aws[a-z-]*:cloudfront::[0-9]{12}:distribution/[A-Z0-9]+$", arn))])
    error_message = "cloudfront_distribution_arns must be exact distribution ARNs, without wildcards."
  }
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class. Staging uses db.t4g.medium; production sizes are M12."
  default     = "db.t4g.medium"
}

variable "multi_az" {
  type        = bool
  description = "Run RDS Multi-AZ. Off in staging, on in production (M12)."
  default     = false
}

variable "backup_retention_days" {
  type        = number
  description = "Days of automated RDS backups."
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 35
    error_message = "backup_retention_days must be 1 to 35, so backups are never off."
  }
}

variable "deletion_protection" {
  type        = bool
  description = "RDS deletion protection."
  default     = true
}

variable "db_name" {
  type        = string
  description = "The application database name."
  default     = "quad"
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache node type."
  default     = "cache.t4g.micro"
}

variable "redis_replicas" {
  type        = number
  description = "Redis replicas besides the primary. 0 in staging (single node); with 1 or more, failover and Multi-AZ turn on."
  default     = 0

  validation {
    condition     = var.redis_replicas >= 0 && var.redis_replicas <= 5 && floor(var.redis_replicas) == var.redis_replicas
    error_message = "redis_replicas must be a whole number from 0 to 5."
  }
}

variable "private_bucket_name" {
  type        = string
  description = "Private bucket: uploads, exports and report PDFs."
  default     = "quad-staging-private"
}

variable "public_bucket_name" {
  type        = string
  description = "Public assets bucket, served only through CloudFront (its bucket policy belongs to the edge module)."
  default     = "quad-staging-public"
}

variable "log_retention_days" {
  type        = number
  description = "Days to keep the exported RDS logs."
  default     = 30
}

variable "db_password_versions" {
  type        = map(number)
  description = "Write-only version per database role (quad_owner, quad_app, quad_platform). Raising a role's number generates a new password and writes it, in the same apply, to the role secret (which RDS Proxy reads) and to every URL secret built from it. Run db-bootstrap afterwards so the database role gets the new password."
  default     = { quad_owner = 1, quad_app = 1, quad_platform = 1 }

  validation {
    condition     = toset(keys(var.db_password_versions)) == toset(["quad_owner", "quad_app", "quad_platform"]) && alltrue([for v in values(var.db_password_versions) : v >= 1 && floor(v) == v])
    error_message = "db_password_versions must give quad_owner, quad_app and quad_platform each a whole number of 1 or more."
  }
}

variable "redis_auth_token_version" {
  type        = number
  description = "Write-only version of the Redis auth token. Raising it generates a new token and writes it, in the same apply, to ElastiCache and to the REDIS_URL secret."
  default     = 1

  validation {
    condition     = var.redis_auth_token_version >= 1 && floor(var.redis_auth_token_version) == var.redis_auth_token_version
    error_message = "redis_auth_token_version must be a whole number of 1 or more."
  }
}
