# The staging DNS records and SES sending (spec 20 → DNS and certificates, Providers; D28): the
# CloudFront and ALB alias records, and the SES identity for mail.quad-edu.com with its DKIM
# records, MAIL FROM, configuration set and bounce and complaint events (SNS → the SES webhook).
# Records go to the tooling account's zone through aws.dns, whose role may write only A, AAAA and
# CNAME records under staging.quad-edu.com and *._domainkey.mail.quad-edu.com (envs/global).
# The shared mail records (SPF, DMARC, and the MAIL FROM MX and SPF) live in envs/global.
# The environment root configures the providers and their default tags.
terraform {
  required_version = "1.16.5"

  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "6.67.0"
      configuration_aliases = [aws.dns]
    }
  }
}
