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
