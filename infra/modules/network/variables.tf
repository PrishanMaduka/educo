variable "name" {
  type        = string
  description = "Resource name prefix, for example quad-staging."
}

variable "cidr" {
  type        = string
  description = "The VPC's IPv4 CIDR block. Each subnet takes a /20 of it."
  default     = "10.40.0.0/16"

  validation {
    condition     = can(cidrsubnet(var.cidr, 4, 15))
    error_message = "cidr must be an IPv4 block of /16 or larger, so it splits into /20 subnets."
  }
}

variable "azs" {
  type        = list(string)
  description = "Availability zones, one public and one private subnet in each."
  default     = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]

  validation {
    condition     = length(var.azs) >= 2 && length(var.azs) <= 8 && length(distinct(var.azs)) == length(var.azs)
    error_message = "azs must list two to eight distinct availability zones."
  }
}

variable "nat_gateway_count" {
  type        = number
  description = "NAT gateways: 1 in staging (shared by every zone), one per zone in production (M12)."
  default     = 1

  validation {
    condition     = var.nat_gateway_count >= 1 && var.nat_gateway_count <= length(var.azs) && floor(var.nat_gateway_count) == var.nat_gateway_count
    error_message = "nat_gateway_count must be a whole number from 1 to the number of zones."
  }
}

variable "interface_endpoints" {
  type        = list(string)
  description = "AWS services reached through interface endpoints (com.amazonaws.<region>.<service>) instead of the NAT gateway."
  default     = ["ecr.api", "ecr.dkr", "secretsmanager", "logs", "ssm"]
}

variable "flow_log_retention_days" {
  type        = number
  description = "Days to keep VPC flow logs."
  default     = 30
}
