variable "domain" {
  type        = string
  description = "The one domain every school and app is served from."
  default     = "quad-edu.com"
}

variable "dns_writer_account_ids" {
  type        = list(string)
  description = "AWS account ids (12 digits each) whose principals may assume quad-dns-records to write their own records. Never \"*\"."

  validation {
    condition     = length(var.dns_writer_account_ids) > 0 && alltrue([for id in var.dns_writer_account_ids : can(regex("^[0-9]{12}$", id))])
    error_message = "dns_writer_account_ids must list at least one 12-digit AWS account id, and no wildcard."
  }
}

variable "dmarc_report_address" {
  type        = string
  description = "Mailbox that receives DMARC aggregate reports for mail.<domain>."
  default     = "dmarc-reports@quad-edu.com"

  validation {
    condition     = can(regex("^[^@\\s;]+@[^@\\s;]+\\.[a-z]{2,}$", var.dmarc_report_address))
    error_message = "dmarc_report_address must be an email address."
  }
}

variable "security_contact_address" {
  type        = string
  description = "Mailbox that certificate authorities report refused issuance to (CAA iodef)."
  default     = "security@quad-edu.com"

  validation {
    condition     = can(regex("^[^@\\s\"]+@[^@\\s\"]+\\.[a-z]{2,}$", var.security_contact_address))
    error_message = "security_contact_address must be an email address."
  }
}

variable "github_repository" {
  type        = string
  description = "GitHub repository (owner/name) whose pull requests may assume quad-tooling-plan."
  default     = "prishanmaduka/educo"

  validation {
    condition     = can(regex("^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$", var.github_repository))
    error_message = "github_repository must be owner/name, with no wildcard."
  }
}
