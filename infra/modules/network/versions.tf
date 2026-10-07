# The VPC every staging service runs in (spec 20 → Infrastructure, D28). The environment root
# configures the provider and its default tags.
terraform {
  required_version = "1.16.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.67.0"
    }
  }
}
