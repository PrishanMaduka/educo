variable "state_bucket_name" {
  type        = string
  description = "Name of the S3 bucket that holds every environment's Terraform state."
  default     = "quad-tfstate-tooling"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.state_bucket_name))
    error_message = "state_bucket_name must be a valid S3 bucket name (lowercase letters, digits and hyphens)."
  }
}

variable "lock_table_name" {
  type        = string
  description = "Name of the DynamoDB table that holds Terraform state locks."
  default     = "quad-terraform-locks"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]{3,255}$", var.lock_table_name))
    error_message = "lock_table_name must be a valid DynamoDB table name."
  }
}

variable "state_environments" {
  type = map(object({
    plan_principal_arns  = list(string)
    apply_principal_arns = list(string)
  }))
  description = <<-EOT
    One entry per Terraform root whose state lives at <name>/terraform.tfstate (global, staging).
    plan_principal_arns may assume quad-terraform-state-read-<name>; apply_principal_arns may assume
    quad-terraform-state-rw-<name>. Each is an exact IAM role ARN: no wildcard and no account root.
  EOT

  validation {
    condition     = length(var.state_environments) > 0 && alltrue([for name in keys(var.state_environments) : can(regex("^[a-z][a-z0-9-]{1,30}$", name)) && name != "bootstrap"])
    error_message = "state_environments needs at least one entry, each named in lowercase letters, digits and hyphens, and none named bootstrap (break-glass only)."
  }

  validation {
    condition = alltrue(flatten([
      for environment in values(var.state_environments) : [
        length(environment.plan_principal_arns) > 0,
        length(environment.apply_principal_arns) > 0,
        [for arn in concat(environment.plan_principal_arns, environment.apply_principal_arns) : can(regex("^arn:aws:iam::[0-9]{12}:role/[A-Za-z0-9+=,.@_/-]+$", arn))],
      ]
    ]))
    error_message = "Every environment needs at least one plan and one apply principal, each an exact role ARN (arn:aws:iam::<12 digits>:role/<name>), with no wildcard or account root."
  }
}

variable "break_glass_principal_arns" {
  type        = list(string)
  description = "Exact IAM role ARNs of the administrators who may still read and write state objects directly (the bootstrap apply and state migration, recovery). Never a wildcard or an account root."

  validation {
    condition     = length(var.break_glass_principal_arns) > 0 && alltrue([for arn in var.break_glass_principal_arns : can(regex("^arn:aws:iam::[0-9]{12}:role/[A-Za-z0-9+=,.@_/-]+$", arn))])
    error_message = "break_glass_principal_arns must list at least one exact role ARN (arn:aws:iam::<12 digits>:role/<name>), with no wildcard or account root."
  }
}
