variable "name" {
  type        = string
  description = "Resource name prefix, for example quad-staging. App secrets are named <name>/env/<NAME>."
}

variable "environment" {
  type        = string
  description = "The environment (APP_ENV and SENTRY_ENVIRONMENT): log groups are /quad/<environment>/<service> and deploy settings live under /quad/<environment>/deploy/."
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

# --- Inputs from the network, data, edge and dns modules ---

variable "vpc_id" {
  type        = string
  description = "The VPC from the network module."
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnets from the network module; every task runs in them, without a public IP."

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "private_subnet_ids needs at least two subnets in different zones."
  }
}

variable "data_client_security_group_id" {
  type        = string
  description = "The data module's client group; attached to the tasks of the api image, which use the database and Redis."
}

variable "env_secret_arns" {
  type        = map(string)
  description = "The data module's secret ARNs by variable name: DATABASE_URL, DATABASE_PLATFORM_URL, DATABASE_OWNER_URL and REDIS_URL."

  validation {
    condition     = alltrue([for key in ["DATABASE_URL", "DATABASE_PLATFORM_URL", "DATABASE_OWNER_URL", "REDIS_URL"] : contains(keys(var.env_secret_arns), key)])
    error_message = "env_secret_arns needs DATABASE_URL, DATABASE_PLATFORM_URL, DATABASE_OWNER_URL and REDIS_URL."
  }
}

variable "db_master_secret_arn" {
  type        = string
  description = "The RDS-managed master user secret (JSON keys username and password). Only the migrate-exec execution role reads it, for db-bootstrap (ruling R-db-admin)."
}

variable "db_instance_address" {
  type        = string
  description = "The RDS instance address (not the proxy): db-bootstrap's DATABASE_ADMIN_HOST."
}

variable "private_bucket_name" {
  type        = string
  description = "S3_BUCKET_PRIVATE."
}

variable "private_bucket_arn" {
  type        = string
  description = "The private bucket, which the api and worker task roles read and write."
}

variable "public_bucket_name" {
  type        = string
  description = "S3_BUCKET_PUBLIC."
}

variable "data_kms_key_arn" {
  type        = string
  description = "The data key: it encrypts the secrets (read through the execution roles) and the private bucket (SSE-KMS, through the task roles)."
}

variable "field_kms_key_arn" {
  type        = string
  description = "The field-level encryption key, which the api and worker task roles may encrypt and decrypt with."
}

variable "alb_security_group_id" {
  type        = string
  description = "The edge module's ALB group; the tasks group admits it on the API, staff and console ports."
}

variable "target_group_arns" {
  type        = map(string)
  description = "The edge module's target groups by name: api, api_socket, staff and console."

  validation {
    condition     = alltrue([for key in ["api", "api_socket", "staff", "console"] : contains(keys(var.target_group_arns), key)])
    error_message = "target_group_arns needs api, api_socket, staff and console."
  }
}

variable "ses_identity_arn" {
  type        = string
  description = "The dns module's SES identity; the api and worker task roles may send as it."
}

variable "ses_configuration_set_name" {
  type        = string
  description = "The dns module's SES configuration set (SES_CONFIGURATION_SET)."
}

variable "ses_events_topic_arn" {
  type        = string
  description = "The dns module's SNS topic for SES bounce and complaint events (SES_SNS_TOPIC_ARN)."
}

variable "tooling_account_id" {
  type        = string
  description = "The tooling account, which holds the Terraform state and the DNS zone roles that the plan and apply roles assume."

  validation {
    condition     = can(regex("^[0-9]{12}$", var.tooling_account_id))
    error_message = "tooling_account_id must be a 12-digit account id."
  }
}

# --- URLs and settings ---

variable "public_web_url" {
  type        = string
  description = "PUBLIC_WEB_URL."
  default     = "https://staging.quad-edu.com"
}

variable "console_url" {
  type        = string
  description = "CONSOLE_URL."
  default     = "https://console.staging.quad-edu.com"
}

variable "cdn_url" {
  type        = string
  description = "CDN_URL: the public bucket through CloudFront (/assets/*)."
  default     = "https://staging.quad-edu.com/assets"
}

variable "email_from_domain" {
  type        = string
  description = "EMAIL_FROM_DOMAIN: the SES identity's domain."
  default     = "mail.quad-edu.com"
}

variable "log_retention_days" {
  type        = number
  description = "Days the task log groups keep their events."
  default     = 30
}

variable "image_tag" {
  type        = string
  description = "The image tag of the first task definitions. The deploy workflow registers later revisions, which Terraform ignores."
  default     = "bootstrap"
}

variable "desired_count" {
  type        = number
  description = "Tasks per service. Terraform owns the count (ruling R-desired-count): the first apply passes 0, before any image is pushed, and a later apply scales up. The deploy workflow never changes it."
  default     = 1
}

variable "otel_exporter_endpoint" {
  type        = string
  description = "OTEL_EXPORTER_OTLP_ENDPOINT; empty leaves the variable out, so tracing is off."
  default     = ""
}

variable "services" {
  type = map(object({
    cpu    = number
    memory = number
  }))
  description = "Fargate size of each long-running service (api, worker, staff, console, clamav)."
  default = {
    api     = { cpu = 512, memory = 1024 }
    worker  = { cpu = 512, memory = 1024 }
    staff   = { cpu = 512, memory = 1024 }
    console = { cpu = 256, memory = 512 }
    clamav  = { cpu = 1024, memory = 3072 }
  }

  validation {
    condition     = length(setsubtract(["api", "worker", "staff", "console", "clamav"], keys(var.services))) == 0 && length(var.services) == 5
    error_message = "services needs exactly api, worker, staff, console and clamav."
  }
}

variable "app_secret_versions" {
  type        = map(number)
  description = "Write-only version of each generated app secret (SESSION_SECRET, LINK_SIGNING_SECRET, FIELD_ENCRYPTION_KEY). Raising one writes a new random value in the next apply; restart the api and worker afterwards. FIELD_ENCRYPTION_KEY stays at 1 until M12 (D32)."
  default = {
    SESSION_SECRET       = 1
    LINK_SIGNING_SECRET  = 1
    FIELD_ENCRYPTION_KEY = 1
  }

  validation {
    condition     = length(setsubtract(["SESSION_SECRET", "LINK_SIGNING_SECRET", "FIELD_ENCRYPTION_KEY"], keys(var.app_secret_versions))) == 0
    error_message = "app_secret_versions needs SESSION_SECRET, LINK_SIGNING_SECRET and FIELD_ENCRYPTION_KEY."
  }

  # A new field key would leave every encrypted value unreadable; re-encryption comes with M12's
  # KMS adapter (D32).
  validation {
    condition     = lookup(var.app_secret_versions, "FIELD_ENCRYPTION_KEY", 1) == 1
    error_message = "FIELD_ENCRYPTION_KEY cannot be rotated before M12: keep its version at 1."
  }
}

# --- GitHub OIDC ---

variable "github_repository" {
  type        = string
  description = "GitHub repository (owner/name) whose workflows may assume the deploy, plan and apply roles."
  default     = "prishanmaduka/educo"

  # The value lands in OIDC subjects matched with StringEquals and StringLike, so a wildcard or a
  # stray separator would widen who may assume the roles.
  validation {
    condition     = can(regex("^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})/[A-Za-z0-9._-]{1,100}$", var.github_repository))
    error_message = "github_repository must be owner/name: letters, digits, '.', '_' and '-' only, no wildcard."
  }
}

variable "github_environment" {
  type        = string
  description = "GitHub environment of the deploy job."
  default     = "staging"

  validation {
    condition     = can(regex("^[A-Za-z0-9._-]{1,255}$", var.github_environment))
    error_message = "github_environment must be a GitHub environment name: letters, digits, '.', '_' and '-' only, no wildcard or ':'."
  }
}

variable "github_infra_environment" {
  type        = string
  description = "GitHub environment of the Terraform apply job."
  default     = "infra-staging"

  validation {
    condition     = can(regex("^[A-Za-z0-9._-]{1,255}$", var.github_infra_environment))
    error_message = "github_infra_environment must be a GitHub environment name: letters, digits, '.', '_' and '-' only, no wildcard or ':'."
  }
}
