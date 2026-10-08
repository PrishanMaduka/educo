# Three aws providers, all tagging with the same defaults (Global Constraints: env, owner and
# cost-centre come from default_tags; each resource sets service):
#   aws            ap-south-1, the staging account;
#   aws.us_east_1  the CloudFront certificate and the WAF web ACL, which must live in us-east-1;
#   aws.dns        the tooling account's quad-edu.com zone, through var.dns_role_arn (the read role
#                  for plans, the staging write role for applies).
# random needs no configuration.

locals {
  default_tags = {
    env           = "staging"
    owner         = "platform"
    "cost-centre" = "quad-staging"
  }
}

provider "aws" {
  region = "ap-south-1"

  default_tags {
    tags = local.default_tags
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.default_tags
  }
}

provider "aws" {
  alias  = "dns"
  region = "ap-south-1"

  assume_role {
    role_arn     = var.dns_role_arn
    session_name = "quad-staging-dns"
  }

  default_tags {
    tags = local.default_tags
  }
}

provider "random" {}
