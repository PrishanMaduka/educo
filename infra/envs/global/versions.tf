# The shared quad-edu.com zone, the records every environment shares, and the tooling account's
# cross-account roles (D28). Applied in the tooling account.
terraform {
  required_version = "1.16.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.67.0"
    }
  }
}
