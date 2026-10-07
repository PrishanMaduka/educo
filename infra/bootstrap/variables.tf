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

variable "trusted_account_ids" {
  type        = list(string)
  description = "AWS account ids (12 digits each) whose principals may assume quad-terraform-state. Never \"*\"."

  validation {
    condition     = length(var.trusted_account_ids) > 0 && alltrue([for id in var.trusted_account_ids : can(regex("^[0-9]{12}$", id))])
    error_message = "trusted_account_ids must list at least one 12-digit AWS account id, and no wildcard."
  }
}
