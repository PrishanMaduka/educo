# The Terraform state root for the tooling account (spec 20, D28). The first apply keeps its state
# locally; a break-glass administrator then migrates it into the bucket this root creates, at
# bootstrap/terraform.tfstate, which no per-environment state role can reach (infra/README.md).
terraform {
  required_version = "1.16.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.67.0"
    }
  }
}

provider "aws" {
  region = "ap-south-1"

  default_tags {
    tags = {
      env           = "tooling"
      owner         = "platform"
      "cost-centre" = "quad-tooling"
    }
  }
}
