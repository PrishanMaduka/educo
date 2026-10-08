# The staging edge (spec 20 → Edge, D14, D28): CloudFront with WAF in front of one ALB, the ACM
# certificates both need, and the public bucket's policy. CloudFront and WAF certificates live in
# us-east-1 (aws.us_east_1); the validation records go to the tooling account's zone (aws.dns).
# The environment root configures the providers and their default tags.
terraform {
  required_version = "1.16.5"

  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "6.67.0"
      configuration_aliases = [aws.us_east_1, aws.dns]
    }
    random = {
      source  = "hashicorp/random"
      version = "3.9.1"
    }
  }
}
