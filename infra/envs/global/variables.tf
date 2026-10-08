variable "domain" {
  type        = string
  description = "The one domain every school and app is served from."
  default     = "quad-edu.com"
}

variable "dns_writer_names" {
  type        = map(list(string))
  description = <<-EOT
    Per environment, the record names (route53 normalized names, StringLike: "*" is any characters
    and may only be the whole first label) its quad-dns-records-<env> role may write. Never the
    apex, console, www, status or the shared mail names, nor a wildcard over them.
  EOT
  default = {
    # Aliases and the origin name, their ACM validation CNAMEs, and the SES DKIM CNAMEs (Tasks 10, 11).
    staging = ["staging.quad-edu.com", "*.staging.quad-edu.com", "*._domainkey.mail.quad-edu.com"]
  }

  validation {
    condition = alltrue([
      for pattern in flatten(values(var.dns_writer_names)) :
      can(regex("^(\\*\\.)?[a-z0-9_-]+(\\.[a-z0-9_-]+)*$", pattern))
      && endswith(pattern, ".${var.domain}")
      && !contains([
        var.domain, "console.${var.domain}", "www.${var.domain}", "status.${var.domain}",
        "mail.${var.domain}", "bounce.mail.${var.domain}", "_dmarc.${var.domain}", "_dmarc.mail.${var.domain}",
      ], trimprefix(pattern, "*."))
    ])
    error_message = "Each dns_writer_names entry must be a name under the domain, with \"*\" only as the whole first label, and must not be or cover the apex, console, www, status or the shared mail names."
  }
}

variable "dns_writer_principal_arns" {
  type        = map(list(string))
  description = "Per environment (a key of dns_writer_names), the exact apply role ARNs that may assume quad-dns-records-<env>."

  validation {
    condition = length(var.dns_writer_principal_arns) > 0 && alltrue(flatten([
      for name, arns in var.dns_writer_principal_arns : [
        contains(keys(var.dns_writer_names), name),
        length(arns) > 0,
        [for arn in arns : can(regex("^arn:aws:iam::[0-9]{12}:role/[A-Za-z0-9+=,.@_/-]+$", arn))],
      ]
    ]))
    error_message = "Each dns_writer_principal_arns entry must name an environment in dns_writer_names and list at least one exact role ARN (no wildcard or account root)."
  }
}

variable "dns_reader_principal_arns" {
  type        = list(string)
  description = "Exact plan role ARNs that may assume quad-dns-read."

  validation {
    condition     = length(var.dns_reader_principal_arns) > 0 && alltrue([for arn in var.dns_reader_principal_arns : can(regex("^arn:aws:iam::[0-9]{12}:role/[A-Za-z0-9+=,.@_/-]+$", arn))])
    error_message = "dns_reader_principal_arns must list at least one exact role ARN (no wildcard or account root)."
  }
}

variable "state_bucket_name" {
  type        = string
  description = "The Terraform state bucket (infra/bootstrap), which quad-tooling-plan may not read directly."
  default     = "quad-tfstate-tooling"
}

variable "dmarc_report_address" {
  type        = string
  description = "Mailbox that receives DMARC aggregate reports for the apex and mail.<domain>."
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
