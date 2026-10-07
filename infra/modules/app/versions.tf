# The staging application layer (spec 20 → Infrastructure, D28): ECR, the ECS cluster and its
# services and one-off tasks, their IAM roles and secrets, the deploy settings in SSM, and the
# GitHub OIDC roles that deploy, plan and apply. The environment root configures the providers
# and their default tags.
terraform {
  required_version = "1.16.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.67.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.9.1"
    }
  }
}
