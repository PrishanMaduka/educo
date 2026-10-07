# The staging data layer (spec 20 → Infrastructure, D28): KMS keys, PostgreSQL behind RDS Proxy,
# Redis, the two buckets, and the database and Redis secrets. The environment root configures
# the providers and their default tags.
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
