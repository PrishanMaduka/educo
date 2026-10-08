# The staging composition (spec 20 → Infrastructure, D28): network → data → edge → dns → app.
#
# Dependency order. data's key policy names the CloudFront distribution
# (cloudfront_distribution_arns), while edge reads the public bucket from data. Terraform wires
# module inputs and outputs one by one, so this is no cycle: the distribution depends on the
# bucket's regional domain name only, the bucket does not depend on the data key's policy, and the
# key policy waits for the distribution. The staging test applies the whole graph to prove it.
#
# First apply (README → first deploy, step 6): the CI roles do not exist yet, because this apply
# creates them (outputs plan_role_arn and apply_role_arn). A staging administrator runs it, with
# -var desired_count=0 because no image is pushed yet. Then those two ARNs go into bootstrap's
# state_environments.staging and global's dns_reader_principal_arns and
# dns_writer_principal_arns.staging, and the administrator's ARN comes out of both. The services
# ignore later desired_count changes (the deploy workflow owns the count), so a second apply does
# not scale them up: once the bootstrap images are pushed, the deploy workflow, or
# `aws ecs update-service --desired-count 1`, does.

locals {
  name           = "quad-staging"
  environment    = "staging"
  web_domain     = "staging.quad-edu.com"
  console_domain = "console.${local.web_domain}"
  origin_domain  = "origin.${local.web_domain}"
  web_url        = "https://${local.web_domain}"

  # The DNS role lives in the tooling account, which also holds the Terraform state roles, so its
  # account id is the tooling account id. No account id is written into the repository.
  tooling_account_id = split(":", var.dns_role_arn)[4]
}

data "aws_route53_zone" "root" {
  provider = aws.dns

  name = "quad-edu.com"
}

module "network" {
  source = "../../modules/network"

  name = local.name
  # Ruling R-endpoints: the interface endpoints sit in one zone in staging.
  endpoint_subnet_count         = 1
  flow_log_aggregation_interval = 600
}

module "data" {
  source = "../../modules/data"

  name                         = local.name
  vpc_id                       = module.network.vpc_id
  private_subnet_ids           = module.network.private_subnet_ids
  endpoints_security_group_id  = module.network.endpoints_security_group_id
  cloudfront_distribution_arns = [module.edge.cloudfront_distribution_arn]
}

module "edge" {
  source = "../../modules/edge"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
    aws.dns       = aws.dns
    random        = random
  }

  name              = local.name
  vpc_id            = module.network.vpc_id
  vpc_cidr          = module.network.vpc_cidr
  public_subnet_ids = module.network.public_subnet_ids
  zone_id           = data.aws_route53_zone.root.zone_id
  web_domain        = local.web_domain
  console_domain    = local.console_domain
  origin_domain     = local.origin_domain

  public_bucket_id                   = module.data.public_bucket_id
  public_bucket_arn                  = module.data.public_bucket_arn
  public_bucket_regional_domain_name = module.data.public_bucket_regional_domain_name
}

module "dns" {
  source = "../../modules/dns"

  providers = {
    aws     = aws
    aws.dns = aws.dns
  }

  name           = local.name
  zone_id        = data.aws_route53_zone.root.zone_id
  web_domain     = local.web_domain
  console_domain = local.console_domain
  origin_domain  = local.origin_domain

  cloudfront_domain_name    = module.edge.cloudfront_domain_name
  cloudfront_hosted_zone_id = module.edge.cloudfront_hosted_zone_id
  alb_dns_name              = module.edge.alb_dns_name
  alb_zone_id               = module.edge.alb_zone_id

  ses_webhook_url = "${local.web_url}/api/v1/webhooks/ses"
}

module "app" {
  source = "../../modules/app"

  name        = local.name
  environment = local.environment

  vpc_id                        = module.network.vpc_id
  private_subnet_ids            = module.network.private_subnet_ids
  data_client_security_group_id = module.data.client_security_group_id
  env_secret_arns               = module.data.env_secret_arns
  db_master_secret_arn          = module.data.db_master_secret_arn
  db_instance_address           = module.data.db_instance_address
  private_bucket_name           = module.data.private_bucket_name
  private_bucket_arn            = module.data.private_bucket_arn
  public_bucket_name            = module.data.public_bucket_name
  data_kms_key_arn              = module.data.data_kms_key_arn
  field_kms_key_arn             = module.data.field_kms_key_arn

  alb_security_group_id = module.edge.alb_security_group_id
  # This output waits for the listener and its rules, so no service registers with an unused
  # target group.
  target_group_arns = module.edge.target_group_arns

  ses_identity_arn           = module.dns.ses_identity_arn
  ses_configuration_set_name = module.dns.ses_configuration_set_name
  ses_events_topic_arn       = module.dns.ses_events_topic_arn

  tooling_account_id = local.tooling_account_id

  public_web_url = local.web_url
  console_url    = "https://${local.console_domain}"
  cdn_url        = "${local.web_url}/assets"

  desired_count          = var.desired_count
  otel_exporter_endpoint = var.otel_exporter_endpoint
}
