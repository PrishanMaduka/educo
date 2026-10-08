# Only what differs between a plan and an apply, or what the first apply must change, is a
# variable. Every other staging value is a module argument in main.tf.

variable "dns_role_arn" {
  type        = string
  description = "The tooling account's DNS role that aws.dns assumes: vars.TF_DNS_READ_ROLE_ARN for plans, vars.TF_STAGING_DNS_WRITE_ROLE_ARN for applies. Its account is the tooling account."

  validation {
    condition     = can(regex("^arn:aws:iam::[0-9]{12}:role/[A-Za-z0-9+=,.@_/-]+$", var.dns_role_arn))
    error_message = "dns_role_arn must be an IAM role ARN."
  }
}

variable "otel_exporter_endpoint" {
  type        = string
  description = "OTEL_EXPORTER_OTLP_ENDPOINT for every service (the Grafana Cloud OTLP gateway); empty leaves tracing off."
  default     = ""
}

variable "desired_count" {
  type        = number
  description = "Tasks per service when Terraform creates the services. The first apply passes 0, because no image is pushed yet. The services ignore later changes: the deploy workflow owns the count afterwards."
  default     = 1

  validation {
    condition     = var.desired_count >= 0 && floor(var.desired_count) == var.desired_count
    error_message = "desired_count must be a whole number of 0 or more."
  }
}
