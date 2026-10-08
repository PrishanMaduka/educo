# TFLint for every Terraform root and module (run by scripts/infra-check.mjs from infra/).
config {
  call_module_type = "local"
}

plugin "aws" {
  enabled = true
  version = "0.49.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}
