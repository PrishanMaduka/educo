variable "name" {
  type        = string
  description = "Resource name prefix, for example quad-staging."
}

variable "vpc_id" {
  type        = string
  description = "The VPC from the network module."
}

variable "vpc_cidr" {
  type        = string
  description = "The VPC CIDR from the network module. The ALB's egress reaches the task ports only inside it."
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnets from the network module, in at least two zones (the ALB)."

  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "public_subnet_ids needs at least two subnets in different zones."
  }
}

variable "zone_id" {
  type        = string
  description = "The quad-edu.com hosted zone (tooling account) that holds the ACM validation records, written through aws.dns."
}

variable "web_domain" {
  type        = string
  description = "The staff portal, API and realtime host (D14)."
  default     = "staging.quad-edu.com"
}

variable "console_domain" {
  type        = string
  description = "The platform console host."
  default     = "console.staging.quad-edu.com"
}

variable "origin_domain" {
  type        = string
  description = "The ALB's own name, which CloudFront calls. Only CloudFront can reach it."
  default     = "origin.staging.quad-edu.com"
}

variable "public_bucket_id" {
  type        = string
  description = "The public assets bucket from the data module; this module owns its policy."
}

variable "public_bucket_arn" {
  type        = string
  description = "The public assets bucket's ARN."
}

variable "public_bucket_regional_domain_name" {
  type        = string
  description = "The public assets bucket's regional domain name (the CloudFront assets origin)."
}

variable "noindex" {
  type        = bool
  description = "Adds X-Robots-Tag: noindex, nofollow at CloudFront (staging). The apps send their own value too, which wins."
  default     = true
}

variable "waf_rate_limit" {
  type        = number
  description = "Requests per IP per 5 minutes before WAF blocks it (spec 20)."
  default     = 2000
}

variable "waf_sensitive_rate_limit" {
  type        = number
  description = "Requests per IP per 5 minutes on /api/v1/auth/* and /api/v1/public/* before WAF blocks it (spec 20)."
  default     = 100
}

variable "geo_block_countries" {
  type        = list(string)
  description = "ISO 3166 alpha-2 country codes WAF blocks. Empty (the default) adds no geo rule."
  default     = []

  validation {
    condition     = alltrue([for code in var.geo_block_countries : can(regex("^[A-Z]{2}$", code))])
    error_message = "geo_block_countries must be two-letter upper-case country codes."
  }
}

variable "alb_idle_timeout" {
  type        = number
  description = "ALB idle timeout in seconds; WebSockets need it above the Socket.IO ping interval (spec 20)."
  default     = 120
}

variable "alb_deletion_protection" {
  type        = bool
  description = "Deletion protection on the ALB. Turn it off only to tear an environment down."
  default     = true
}

variable "origin_secret_slots" {
  type        = list(string)
  description = "Origin secret slots. The ALB accepts every slot's value; CloudFront sends only origin_secret_active's. Rotation adds a slot, switches the active slot, then removes the old one (D28)."
  default     = ["a"]

  validation {
    condition = (
      length(var.origin_secret_slots) >= 1 && length(var.origin_secret_slots) <= 3 &&
      length(distinct(var.origin_secret_slots)) == length(var.origin_secret_slots) &&
      alltrue([for slot in var.origin_secret_slots : can(regex("^[a-z]$", slot))])
    )
    error_message = "origin_secret_slots needs one to three distinct single-letter slots (a listener rule allows five condition values: a host, a path and up to three secrets)."
  }
}

variable "origin_secret_active" {
  type        = string
  description = "The slot whose value CloudFront sends as X-Quad-Origin-Secret."
  default     = "a"

  validation {
    condition     = contains(var.origin_secret_slots, var.origin_secret_active)
    error_message = "origin_secret_active must be one of origin_secret_slots."
  }
}
