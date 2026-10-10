# The staging composition (network → data → edge → dns → app, plus the overview dashboard),
# checked offline. Every aws provider is mocked (infra/tests/mocks/aws): the default one in
# ap-south-1, aws.us_east_1 (CloudFront certificate and WAF) and aws.dns (the tooling account's
# zone). The random provider is the real one: mock providers cannot mock ephemeral resources, and
# random runs locally, so it never reaches an account. A run that applies at all proves the whole
# graph builds without a dependency cycle.

mock_provider "aws" {
  source = "../../tests/mocks/aws"
}

mock_provider "aws" {
  alias  = "us_east_1"
  source = "../../tests/mocks/aws"
}

mock_provider "aws" {
  alias  = "dns"
  source = "../../tests/mocks/aws"
}

# The edge module creates one validation record per certificate domain, so the mocked
# certificates need real-looking validation options.
override_resource {
  target = module.edge.aws_acm_certificate.origin
  values = {
    arn = "arn:aws:acm:ap-south-1:123456789012:certificate/00000000-0000-4000-8000-000000000001"
    domain_validation_options = [
      { domain_name = "origin.staging.quad-edu.com", resource_record_name = "_o1.origin.staging.quad-edu.com.", resource_record_type = "CNAME", resource_record_value = "_v1.acm-validations.aws." },
      { domain_name = "staging.quad-edu.com", resource_record_name = "_w1.staging.quad-edu.com.", resource_record_type = "CNAME", resource_record_value = "_v2.acm-validations.aws." },
      { domain_name = "console.staging.quad-edu.com", resource_record_name = "_c1.console.staging.quad-edu.com.", resource_record_type = "CNAME", resource_record_value = "_v3.acm-validations.aws." },
    ]
  }
}

override_resource {
  target = module.edge.aws_acm_certificate.cloudfront
  values = {
    arn = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-4000-8000-000000000002"
    domain_validation_options = [
      { domain_name = "staging.quad-edu.com", resource_record_name = "_w1.staging.quad-edu.com.", resource_record_type = "CNAME", resource_record_value = "_v2.acm-validations.aws." },
      { domain_name = "console.staging.quad-edu.com", resource_record_name = "_c1.console.staging.quad-edu.com.", resource_record_type = "CNAME", resource_record_value = "_v3.acm-validations.aws." },
    ]
  }
}

# Easy DKIM always gives three tokens; the mock would give none.
override_resource {
  target = module.dns.aws_sesv2_email_identity.mail
  values = {
    arn = "arn:aws:ses:ap-south-1:123456789012:identity/mail.quad-edu.com"
    dkim_signing_attributes = {
      tokens = ["abcdefghijklmnopqrstuvwxyz000001", "abcdefghijklmnopqrstuvwxyz000002", "abcdefghijklmnopqrstuvwxyz000003"]
    }
  }
}

# A distinct distribution ARN, so the key policy test cannot pass on the shared mock value alone.
override_resource {
  target = module.edge.aws_cloudfront_distribution.this
  values = {
    arn            = "arn:aws:cloudfront::123456789012:distribution/ESTAGINGOVERVIEW"
    id             = "ESTAGINGOVERVIEW"
    domain_name    = "d222222abcdef8.cloudfront.net"
    hosted_zone_id = "Z2FDTNDATAQYW2"
  }
}

# Two members, so the dashboard test shows one Redis metric per member cluster.
override_resource {
  target = module.data.aws_elasticache_replication_group.this
  values = {
    arn                      = "arn:aws:elasticache:ap-south-1:123456789012:replicationgroup:quad-staging-redis"
    id                       = "quad-staging-redis"
    primary_endpoint_address = "master.quad-staging-redis.abcdef.aps1.cache.amazonaws.com"
    member_clusters          = ["quad-staging-redis-002", "quad-staging-redis-001"]
  }
}

# The plan role's DNS role in the example tooling account 111111111111 (envs/global).
variables {
  dns_role_arn = "arn:aws:iam::111111111111:role/quad-dns-read"
}

run "dashboard_shows_target_5xx" {
  command = apply

  assert {
    condition     = aws_cloudwatch_dashboard.overview.dashboard_name == "quad-staging-overview"
    error_message = "The dashboard must be quad-staging-overview."
  }

  assert {
    condition = anytrue([
      for widget in jsondecode(aws_cloudwatch_dashboard.overview.dashboard_body).widgets :
      strcontains(jsonencode(try(widget.properties.metrics, [])), "\"HTTPCode_Target_5XX_Count\"")
    ])
    error_message = "A dashboard widget must chart HTTPCode_Target_5XX_Count."
  }
}

run "edge_serves_the_staging_hosts" {
  command = apply

  assert {
    condition     = jsonencode(sort(tolist(module.edge.cloudfront_aliases))) == jsonencode(["console.staging.quad-edu.com", "staging.quad-edu.com"])
    error_message = "CloudFront must answer for staging.quad-edu.com and console.staging.quad-edu.com."
  }
}

run "api_knows_its_public_url" {
  command = apply

  assert {
    condition     = module.app.api_environment["PUBLIC_WEB_URL"] == "https://staging.quad-edu.com"
    error_message = "The api task must have PUBLIC_WEB_URL=https://staging.quad-edu.com."
  }
}

run "ses_events_go_to_the_staging_webhook" {
  command = apply

  assert {
    condition     = module.dns.ses_webhook_endpoint == "https://staging.quad-edu.com/api/v1/webhooks/ses"
    error_message = "SNS must deliver SES events to https://staging.quad-edu.com/api/v1/webhooks/ses."
  }
}

# Mock providers skip the aws provider's own diff logic, which merges default_tags into tags_all,
# so a mocked tags_all is always {}. This run checks the tags all three aws providers share
# (providers.tf); the network and data module tests check the service tag.
run "default_tags_name_env_owner_and_cost_centre" {
  command = apply

  assert {
    condition     = jsonencode(local.default_tags) == jsonencode({ "cost-centre" = "quad-staging", env = "staging", owner = "platform" })
    error_message = "The providers' default_tags must be env = staging, owner = platform and cost-centre = quad-staging."
  }
}

run "network_and_data_take_the_staging_wiring" {
  command = apply

  assert {
    condition     = length(module.network.endpoint_subnet_ids) == 1 && module.network.endpoint_subnet_ids[0] == module.network.private_subnet_ids[0]
    error_message = "Ruling R-endpoints: staging puts the interface endpoints in one zone."
  }

  # data takes the distribution ARN while edge takes the public bucket from data; this run applying
  # at all shows Terraform found no cycle.
  assert {
    condition = jsonencode([
      for s in jsondecode(module.data.data_kms_key_policy).Statement : s.Condition.ArnEquals["aws:SourceArn"]
      if try(s.Principal.Service, "") == "cloudfront.amazonaws.com"
    ]) == jsonencode([["arn:aws:cloudfront::123456789012:distribution/ESTAGINGOVERVIEW"]])
    error_message = "The data key policy must let exactly the staging distribution decrypt the public bucket."
  }
}

run "app_takes_the_data_dns_and_tooling_wiring" {
  command = apply

  assert {
    condition = (
      module.app.api_environment["APP_ENV"] == "staging" &&
      module.app.api_environment["TRUST_PROXY_HOPS"] == "2" &&
      module.app.api_environment["CONSOLE_URL"] == "https://console.staging.quad-edu.com" &&
      module.app.api_environment["CDN_URL"] == "https://staging.quad-edu.com/assets" &&
      module.app.api_environment["TURNSTILE_EXPECTED_HOSTNAME"] == "staging.quad-edu.com" &&
      module.app.api_environment["SALES_INBOX"] == "support@quad-edu.com" &&
      module.app.api_environment["SUPPORT_INBOX"] == "support@quad-edu.com"
    )
    error_message = "The api runs as staging behind two proxies, with the staging console and CDN URLs, accepts Turnstile tokens for staging.quad-edu.com only, sends demo request notifications to support@quad-edu.com (OQ2) and gives Quad's own mail that Reply-To."
  }

  assert {
    condition = (
      module.app.api_environment["SES_SNS_TOPIC_ARN"] == module.dns.ses_events_topic_arn &&
      module.app.api_environment["SES_CONFIGURATION_SET"] == module.dns.ses_configuration_set_name &&
      module.app.api_environment["KMS_KEY_ID"] == module.data.field_kms_key_arn &&
      module.app.api_environment["S3_BUCKET_PRIVATE"] == module.data.private_bucket_name &&
      module.app.api_environment["S3_BUCKET_PUBLIC"] == module.data.public_bucket_name
    )
    error_message = "The api must take the SES topic and configuration set from dns, and the field key and buckets from data."
  }

  assert {
    condition     = !contains(keys(module.app.api_environment), "OTEL_EXPORTER_OTLP_ENDPOINT")
    error_message = "Tracing stays off until otel_exporter_endpoint is set."
  }

  assert {
    condition     = local.tooling_account_id == "111111111111"
    error_message = "The tooling account id comes from the DNS role's ARN."
  }

  assert {
    condition = (
      output.deploy_role_arn == module.app.deploy_role_arn &&
      output.plan_role_arn == module.app.plan_role_arn &&
      output.apply_role_arn == module.app.apply_role_arn &&
      output.ecr_repository_urls == module.app.ecr_repository_urls &&
      output.cloudfront_domain_name == "d222222abcdef8.cloudfront.net" &&
      output.name_servers_note == "NS records live in envs/global"
    )
    error_message = "The outputs must carry the app's role ARNs and repositories, the distribution's name and the name servers note."
  }
}

run "otel_endpoint_reaches_the_app" {
  command = apply

  variables {
    otel_exporter_endpoint = "https://otlp.example.com/otlp"
  }

  assert {
    condition     = module.app.api_environment["OTEL_EXPORTER_OTLP_ENDPOINT"] == "https://otlp.example.com/otlp"
    error_message = "otel_exporter_endpoint must reach the api's OTEL_EXPORTER_OTLP_ENDPOINT."
  }
}

run "dashboard_charts_this_environment" {
  command = apply

  assert {
    condition = jsonencode(setsubtract(
      ["RequestCount", "HTTPCode_Target_5XX_Count", "TargetResponseTime", "CPUUtilization", "MemoryUtilization", "DatabaseConnections", "DatabaseMemoryUsagePercentage", "BlockedRequests"],
      flatten([for widget in jsondecode(aws_cloudwatch_dashboard.overview.dashboard_body).widgets : [
        for metric in try(widget.properties.metrics, []) : [for part in metric : part if can(regex("^[A-Za-z0-9_]+$", part))]
      ]])
    )) == jsonencode([])
    error_message = "The dashboard must chart every starter metric by name."
  }

  # Redis publishes per member cluster, so the widget has one metric per member.
  assert {
    condition = jsonencode(sort(flatten([
      for widget in jsondecode(aws_cloudwatch_dashboard.overview.dashboard_body).widgets : [
        for metric in try(widget.properties.metrics, []) : metric[3]
        if try(metric[0], "") == "AWS/ElastiCache" && try(metric[1], "") == "DatabaseMemoryUsagePercentage" && try(metric[2], "") == "CacheClusterId"
      ]
    ]))) == jsonencode(["quad-staging-redis-001", "quad-staging-redis-002"])
    error_message = "The dashboard must chart DatabaseMemoryUsagePercentage for each Redis member cluster, by CacheClusterId."
  }

  assert {
    condition = (
      strcontains(aws_cloudwatch_dashboard.overview.dashboard_body, jsonencode(module.edge.alb_arn_suffix)) &&
      strcontains(aws_cloudwatch_dashboard.overview.dashboard_body, jsonencode(module.data.rds_instance_id)) &&
      alltrue([for service in module.app.ecs_service_names_for_dashboard : strcontains(aws_cloudwatch_dashboard.overview.dashboard_body, jsonencode(service))]) &&
      alltrue([for suffix in values(module.edge.target_group_arn_suffixes) : strcontains(aws_cloudwatch_dashboard.overview.dashboard_body, jsonencode(suffix))])
    )
    error_message = "The dashboard must chart this environment's ALB, target groups, services, database and Redis."
  }

  assert {
    condition = anytrue([
      for widget in jsondecode(aws_cloudwatch_dashboard.overview.dashboard_body).widgets :
      try(widget.properties.region, "") == "us-east-1" && jsonencode(widget.properties.metrics) == jsonencode([["AWS/WAFV2", "BlockedRequests", "WebACL", module.edge.waf_web_acl_name, "Rule", "ALL", { label = "Blocked" }]])
    ])
    error_message = "WAF BlockedRequests must be read from us-east-1, where a CloudFront web ACL publishes its metrics."
  }
}

run "desired_count_must_be_a_whole_number" {
  command = plan

  variables {
    desired_count = -1
  }

  expect_failures = [var.desired_count]
}

run "dns_role_arn_must_be_a_role" {
  command = plan

  variables {
    dns_role_arn = "arn:aws:iam::111111111111:user/someone"
  }

  expect_failures = [var.dns_role_arn]
}

# The dashboard reads the region from the default provider, not a literal: with the provider's
# region overridden, every widget but WAF's (us-east-1) follows it.
run "dashboard_follows_the_provider_region" {
  command = apply

  override_data {
    target = data.aws_region.current
    values = { name = "eu-west-1", region = "eu-west-1" }
  }

  assert {
    condition = alltrue([
      for widget in jsondecode(aws_cloudwatch_dashboard.overview.dashboard_body).widgets :
      widget.properties.region == "eu-west-1" if widget.type == "metric" && try(widget.properties.metrics[0][0], "") != "AWS/WAFV2"
    ])
    error_message = "Every regional widget must take the default provider's region."
  }
}

run "the_apply_role_dns_role_passes_the_check" {
  command = plan

  variables {
    dns_role_arn = "arn:aws:iam::111111111111:role/quad-dns-records-staging"
  }

  assert {
    condition     = local.tooling_account_id == "111111111111"
    error_message = "The write role names the same tooling account."
  }
}

# The plan and apply DNS roles both live in the tooling account (envs/global), and the app's
# plan and apply roles may assume only quad-dns-read and quad-dns-records-staging there.
run "a_dns_role_outside_the_tooling_dns_roles_fails_the_check" {
  command = plan

  variables {
    dns_role_arn = "arn:aws:iam::222222222222:role/quad-staging-admin"
  }

  expect_failures = [check.dns_role_is_a_tooling_dns_role]
}
