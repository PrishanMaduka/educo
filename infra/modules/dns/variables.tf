variable "name" {
  type        = string
  description = "Resource name prefix, for example quad-staging. It also names the SES configuration set."
}

variable "zone_id" {
  type        = string
  description = "The quad-edu.com hosted zone (tooling account), written through aws.dns."
}

variable "web_domain" {
  type        = string
  description = "The staff portal, API and realtime host (D14); an alias to CloudFront."
  default     = "staging.quad-edu.com"
}

variable "console_domain" {
  type        = string
  description = "The platform console host; an alias to CloudFront."
  default     = "console.staging.quad-edu.com"
}

variable "origin_domain" {
  type        = string
  description = "The ALB's own name, which CloudFront calls; an alias to the ALB."
  default     = "origin.staging.quad-edu.com"
}

variable "cloudfront_domain_name" {
  type        = string
  description = "The distribution's domain name (edge module output cloudfront_domain_name)."
}

variable "cloudfront_hosted_zone_id" {
  type        = string
  description = "CloudFront's hosted zone id (edge module output cloudfront_hosted_zone_id)."
}

variable "alb_dns_name" {
  type        = string
  description = "The ALB's DNS name (edge module output alb_dns_name)."
}

variable "alb_zone_id" {
  type        = string
  description = "The ALB's hosted zone id (edge module output alb_zone_id)."
}

variable "mail_domain" {
  type        = string
  description = "The SES sending domain (spec 20 → Providers). Its SPF and DMARC records are in envs/global."
  default     = "mail.quad-edu.com"
}

variable "mail_from_domain" {
  type        = string
  description = "The custom MAIL FROM domain, a subdomain of mail_domain. Its MX and SPF records are in envs/global."
  default     = "bounce.mail.quad-edu.com"

  validation {
    condition     = endswith(var.mail_from_domain, ".${var.mail_domain}")
    error_message = "mail_from_domain must be a subdomain of mail_domain."
  }
}

variable "ses_webhook_url" {
  type        = string
  description = "The API's SES bounce and complaint webhook, which the SNS topic delivers to over HTTPS."
  default     = "https://staging.quad-edu.com/api/v1/webhooks/ses"

  validation {
    condition     = startswith(var.ses_webhook_url, "https://") && endswith(var.ses_webhook_url, "/api/v1/webhooks/ses")
    error_message = "ses_webhook_url must be an https:// URL ending /api/v1/webhooks/ses."
  }
}
