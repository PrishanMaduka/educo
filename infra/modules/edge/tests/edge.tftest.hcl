# The staging edge (CloudFront, WAF, ACM and the ALB), checked offline. Every provider is mocked:
# aws in ap-south-1, aws.us_east_1 (CloudFront certificate and WAF), aws.dns (the tooling
# account's zone) and random (infra/tests/mocks). The origin secret is an ordinary
# random_password, so the mocked random provider is enough.

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

mock_provider "random" {
  source = "../../tests/mocks/random"
}

# The shared mock gives every target group the same ARN; distinct ARNs let the routing tests tell
# them apart.
override_resource {
  target = aws_lb_target_group.this["api"]
  values = {
    arn        = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:targetgroup/quad-staging-api/0000000000000001"
    arn_suffix = "targetgroup/quad-staging-api/0000000000000001"
  }
}

override_resource {
  target = aws_lb_target_group.this["api_socket"]
  values = {
    arn        = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:targetgroup/quad-staging-api-socket/0000000000000002"
    arn_suffix = "targetgroup/quad-staging-api-socket/0000000000000002"
  }
}

override_resource {
  target = aws_lb_target_group.this["staff"]
  values = {
    arn        = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:targetgroup/quad-staging-staff/0000000000000003"
    arn_suffix = "targetgroup/quad-staging-staff/0000000000000003"
  }
}

override_resource {
  target = aws_lb_target_group.this["console"]
  values = {
    arn        = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:targetgroup/quad-staging-console/0000000000000004"
    arn_suffix = "targetgroup/quad-staging-console/0000000000000004"
  }
}

# ACM's validation records. A domain's record is the same for every certificate the account
# requests, in any region, so both certificates report the same values for the shared names.
override_resource {
  target = aws_acm_certificate.origin
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
  target = aws_acm_certificate.cloudfront
  values = {
    arn = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-4000-8000-000000000002"
    domain_validation_options = [
      { domain_name = "staging.quad-edu.com", resource_record_name = "_w1.staging.quad-edu.com.", resource_record_type = "CNAME", resource_record_value = "_v2.acm-validations.aws." },
      { domain_name = "console.staging.quad-edu.com", resource_record_name = "_c1.console.staging.quad-edu.com.", resource_record_type = "CNAME", resource_record_value = "_v3.acm-validations.aws." },
    ]
  }
}

variables {
  name              = "quad-staging"
  vpc_id            = "vpc-0123456789abcdef0"
  vpc_cidr          = "10.40.0.0/16"
  public_subnet_ids = ["subnet-0aaaaaaaaaaaaaaa1", "subnet-0bbbbbbbbbbbbbbb2", "subnet-0ccccccccccccccc3"]
  zone_id           = "Z0123456789MOCKZONE"

  public_bucket_id                   = "quad-staging-public"
  public_bucket_arn                  = "arn:aws:s3:::quad-staging-public"
  public_bucket_regional_domain_name = "quad-staging-public.s3.ap-south-1.amazonaws.com"
}


# Assertions compare structured values through jsonencode, because Terraform's == is
# type-sensitive (a tuple literal never equals a list or set attribute).

run "alb_refuses_requests_without_the_origin_header" {
  command = apply

  # Review Focus #1: every forwarding rule needs the header CloudFront sends, so a request without
  # it (or with another value) falls through to the listener default.
  assert {
    condition = length(aws_lb_listener_rule.route) == 6 && alltrue([
      for rule in aws_lb_listener_rule.route : anytrue([
        for condition in rule.condition : jsonencode([
          for header in condition.http_header : [header.http_header_name, header.values]
          ]) == jsonencode([["X-Quad-Origin-Secret", [
            one(flatten([
              for origin in aws_cloudfront_distribution.this.origin : [
                for header in origin.custom_header : header.value if header.name == "X-Quad-Origin-Secret"
              ] if origin.origin_id == "alb"
            ]))
        ]]])
      ])
    ])
    error_message = "Every listener rule must require X-Quad-Origin-Secret with the value CloudFront sends."
  }

  assert {
    condition = one(flatten([
      for origin in aws_cloudfront_distribution.this.origin : [
        for header in origin.custom_header : header.value if header.name == "X-Quad-Origin-Secret"
      ] if origin.origin_id == "alb"
    ])) == random_password.origin_secret["a"].result
    error_message = "CloudFront's alb origin must send the origin secret."
  }

  # scripts/smoke.mjs --origin expects exactly this status and body.
  assert {
    condition = (
      aws_lb_listener.https.default_action[0].type == "fixed-response" &&
      aws_lb_listener.https.default_action[0].fixed_response[0].status_code == "403" &&
      aws_lb_listener.https.default_action[0].fixed_response[0].message_body == "Forbidden" &&
      aws_lb_listener.https.default_action[0].fixed_response[0].content_type == "text/plain"
    )
    error_message = "The listener default must be a fixed 403 with the body Forbidden."
  }

  assert {
    condition     = aws_lb_listener.https.protocol == "HTTPS" && aws_lb_listener.https.port == 443 && aws_lb_listener.https.ssl_policy == "ELBSecurityPolicy-TLS13-1-2-2021-06"
    error_message = "The only listener is HTTPS on 443 with the TLS 1.3/1.2 policy."
  }

  # Listener rule header values treat * and ? as wildcards, so the secret has no special
  # characters.
  assert {
    condition     = keys(random_password.origin_secret) == ["a"] && random_password.origin_secret["a"].length == 48 && !random_password.origin_secret["a"].special
    error_message = "By default there is one origin secret slot, a, of 48 characters with no special characters."
  }
}

# M-2: zero-downtime rotation. With two slots the ALB accepts both values while CloudFront sends
# only the active one.
run "rotation_accepts_both_slots_and_sends_only_the_active_one" {
  command = apply

  # A fresh state, so the overridden passwords below are created.
  state_key = "two_origin_secret_slots"

  variables {
    origin_secret_slots  = ["a", "b"]
    origin_secret_active = "b"
  }

  override_resource {
    target = random_password.origin_secret["a"]
    values = { result = "SlotAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
  }

  override_resource {
    target = random_password.origin_secret["b"]
    values = { result = "SlotBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }
  }

  assert {
    condition = length(aws_lb_listener_rule.route) == 6 && alltrue([
      for rule in aws_lb_listener_rule.route : anytrue([
        for condition in rule.condition : jsonencode([
          for header in condition.http_header : [header.http_header_name, sort(header.values)]
          ]) == jsonencode([["X-Quad-Origin-Secret", [
            "SlotAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "SlotBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ]]])
      ])
    ])
    error_message = "During a rotation every listener rule accepts both slots' values."
  }

  assert {
    condition = jsonencode(nonsensitive(flatten([
      for origin in aws_cloudfront_distribution.this.origin : [
        for header in origin.custom_header : [header.name, header.value]
      ] if origin.origin_id == "alb"
    ]))) == jsonencode(["X-Quad-Origin-Secret", "SlotBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"])
    error_message = "CloudFront sends only the active slot's value."
  }

  # The ALB allows five condition values per rule: the busiest rule has a host, a path and every
  # slot's value.
  assert {
    condition = alltrue([
      for rule in aws_lb_listener_rule.route : sum(concat([0], [
        for condition in rule.condition : length(concat(
          flatten([for host in condition.host_header : tolist(host.values)]),
          flatten([for path in condition.path_pattern : tolist(path.values)]),
          flatten([for header in condition.http_header : tolist(header.values)]),
        ))
      ])) <= 5
    ])
    error_message = "No listener rule may have more than five condition values."
  }
}

run "active_slot_must_be_one_of_the_slots" {
  command = plan

  variables {
    origin_secret_slots  = ["a"]
    origin_secret_active = "b"
  }

  expect_failures = [var.origin_secret_active]
}

run "at_most_three_slots" {
  command = plan

  variables {
    origin_secret_slots = ["a", "b", "c", "d"]
  }

  expect_failures = [var.origin_secret_slots]
}

run "socket_io_is_sticky" {
  command = apply

  assert {
    condition = (
      aws_lb_target_group.this["api_socket"].stickiness[0].enabled &&
      aws_lb_target_group.this["api_socket"].stickiness[0].type == "lb_cookie" &&
      aws_lb_target_group.this["api_socket"].stickiness[0].cookie_duration == 86400
    )
    error_message = "The api_socket target group must be sticky on the ALB's own cookie for one day (ruling R-sticky)."
  }

  assert {
    condition = jsonencode([
      for rule in aws_lb_listener_rule.route : [
        flatten([for condition in rule.condition : [for path in condition.path_pattern : path.values]]),
        rule.action[0].target_group_arn,
      ] if contains([15, 40], rule.priority)
      ]) == jsonencode([
      [["/socket.io/*"], aws_lb_target_group.this["api_socket"].arn],
      [["/socket.io/*"], aws_lb_target_group.this["api_socket"].arn],
    ])
    error_message = "Rules 15 (console host) and 40 must send /socket.io/* to api_socket."
  }

  assert {
    condition     = aws_lb.this.idle_timeout == 120
    error_message = "The ALB idle timeout is 120 seconds for WebSockets."
  }
}

run "routes_match_d14" {
  command = apply

  assert {
    condition = jsonencode({
      for rule in aws_lb_listener_rule.route : tostring(rule.priority) => {
        host   = flatten([for condition in rule.condition : [for host in condition.host_header : host.values]])
        path   = flatten([for condition in rule.condition : [for path in condition.path_pattern : path.values]])
        target = rule.action[0].target_group_arn
        type   = rule.action[0].type
      }
      }) == jsonencode({
      "10" = { host = ["console.staging.quad-edu.com"], path = ["/api/v1/platform/*"], target = aws_lb_target_group.this["api"].arn, type = "forward" }
      "15" = { host = ["console.staging.quad-edu.com"], path = ["/socket.io/*"], target = aws_lb_target_group.this["api_socket"].arn, type = "forward" }
      "20" = { host = ["console.staging.quad-edu.com"], path = [], target = aws_lb_target_group.this["console"].arn, type = "forward" }
      "30" = { host = [], path = ["/api/v1/*"], target = aws_lb_target_group.this["api"].arn, type = "forward" }
      "40" = { host = [], path = ["/socket.io/*"], target = aws_lb_target_group.this["api_socket"].arn, type = "forward" }
      "50" = { host = [], path = ["/*"], target = aws_lb_target_group.this["staff"].arn, type = "forward" }
    })
    error_message = "The listener rules must match the D14 routing table."
  }

  assert {
    condition = jsonencode({
      for key, group in aws_lb_target_group.this :
      key => [group.port, group.protocol, group.health_check[0].path, group.target_type, group.deregistration_delay]
      }) == jsonencode({
      api        = [4000, "HTTP", "/api/v1/health/ready", "ip", "30"]
      api_socket = [4000, "HTTP", "/api/v1/health/ready", "ip", "30"]
      console    = [3001, "HTTP", "/healthz", "ip", "30"]
      staff      = [3000, "HTTP", "/healthz", "ip", "30"]
    })
    error_message = "The target groups must use the D14 ports and health checks, ip targets and a 30 s drain."
  }
}

run "alb_only_reachable_from_cloudfront" {
  command = apply

  assert {
    condition = jsonencode([
      for rule in aws_security_group.alb.ingress :
      [rule.protocol, rule.from_port, rule.to_port, rule.prefix_list_ids, [
        for addresses in [rule.cidr_blocks, rule.ipv6_cidr_blocks, rule.security_groups] : addresses == null ? 0 : length(addresses)
      ]]
    ]) == jsonencode([["tcp", 443, 443, [data.aws_ec2_managed_prefix_list.cloudfront.id], [0, 0, 0]]])
    error_message = "The ALB must accept only 443 from CloudFront's origin-facing prefix list, and no CIDR."
  }

  assert {
    condition     = data.aws_ec2_managed_prefix_list.cloudfront.name == "com.amazonaws.global.cloudfront.origin-facing"
    error_message = "The prefix list must be CloudFront's origin-facing list."
  }

  assert {
    condition = jsonencode(sort([
      for rule in aws_security_group.alb.egress : jsonencode([rule.from_port, rule.to_port, rule.cidr_blocks])
      ])) == jsonencode(sort([
      jsonencode([3000, 3001, ["10.40.0.0/16"]]),
      jsonencode([4000, 4000, ["10.40.0.0/16"]]),
    ]))
    error_message = "The ALB may reach only the task ports inside the VPC."
  }

  assert {
    condition     = !aws_lb.this.internal && aws_lb.this.drop_invalid_header_fields && aws_lb.this.enable_deletion_protection
    error_message = "The ALB is internet-facing (behind the prefix list), drops invalid headers and is deletion-protected."
  }
}

run "proxy_chain_is_cloudfront_then_alb" {
  command = apply

  # TRUST_PROXY_HOPS=2: CloudFront appends the viewer, the ALB appends CloudFront, and the task
  # reads the second entry from the right. Nothing else may sit in between or rewrite the header.
  assert {
    condition     = aws_lb.this.xff_header_processing_mode == "append"
    error_message = "The ALB must append to X-Forwarded-For."
  }

  assert {
    condition = jsonencode([
      for origin in aws_cloudfront_distribution.this.origin : origin.domain_name if origin.origin_id == "alb"
    ]) == jsonencode(["origin.staging.quad-edu.com"])
    error_message = "CloudFront must call the ALB directly at origin.staging.quad-edu.com."
  }

  assert {
    condition = alltrue([
      for behaviour in concat(aws_cloudfront_distribution.this.ordered_cache_behavior, aws_cloudfront_distribution.this.default_cache_behavior) :
      length(behaviour.function_association) == 0 && length(behaviour.lambda_function_association) == 0
    ])
    error_message = "No edge function may sit between CloudFront and the ALB."
  }
}

run "api_and_socket_pass_through_uncached" {
  command = apply

  # Managed-CachingDisabled, Managed-AllViewer (every header, including Host and the WebSocket
  # upgrade headers, every cookie and query string) and Managed-CachingOptimized.
  assert {
    condition = jsonencode(merge(
      {
        for behaviour in aws_cloudfront_distribution.this.ordered_cache_behavior : behaviour.path_pattern => [
          behaviour.target_origin_id, behaviour.cache_policy_id, coalesce(behaviour.origin_request_policy_id, "none"), sort(behaviour.allowed_methods),
        ]
      },
      {
        for behaviour in aws_cloudfront_distribution.this.default_cache_behavior : "default" => [
          behaviour.target_origin_id, behaviour.cache_policy_id, coalesce(behaviour.origin_request_policy_id, "none"), sort(behaviour.allowed_methods),
        ]
      },
      )) == jsonencode({
      "/api/v1/*"       = ["alb", "4135ea2d-6df8-44a3-9df3-4b5a84be39ad", "216adef6-5c7f-47e4-b989-5492eafa07d3", ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]]
      "/socket.io/*"    = ["alb", "4135ea2d-6df8-44a3-9df3-4b5a84be39ad", "216adef6-5c7f-47e4-b989-5492eafa07d3", ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]]
      "/_next/static/*" = ["alb", aws_cloudfront_cache_policy.static.id, "none", ["GET", "HEAD"]]
      "/assets/*"       = ["assets", "658327ea-f89d-4fab-a63d-7e88639e58f6", "none", ["GET", "HEAD"]]
      "default"         = ["alb", "4135ea2d-6df8-44a3-9df3-4b5a84be39ad", "216adef6-5c7f-47e4-b989-5492eafa07d3", ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]]
    })
    error_message = "API, Socket.IO and pages go to the ALB uncached with every viewer value and method; static files are cached."
  }

  # Next's static files are cached per host: the Host header is in the cache key, so it also
  # reaches the ALB, which sends console files to the console (rule 20) and the rest to staff.
  assert {
    condition = jsonencode([
      for parameters in aws_cloudfront_cache_policy.static.parameters_in_cache_key_and_forwarded_to_origin : [
        parameters.headers_config[0].header_behavior, parameters.headers_config[0].headers[0].items,
        parameters.cookies_config[0].cookie_behavior, parameters.query_strings_config[0].query_string_behavior,
        parameters.enable_accept_encoding_brotli, parameters.enable_accept_encoding_gzip,
      ]
      ]) == jsonencode([["whitelist", ["Host"], "none", "none", true, true]]) && (
      aws_cloudfront_cache_policy.static.min_ttl == 1 && aws_cloudfront_cache_policy.static.default_ttl == 86400 &&
      aws_cloudfront_cache_policy.static.max_ttl == 31536000
    )
    error_message = "The static cache policy is CachingOptimized with Host in the cache key."
  }

  assert {
    condition     = jsonencode([for behaviour in aws_cloudfront_distribution.this.ordered_cache_behavior : behaviour.path_pattern]) == jsonencode(["/api/v1/*", "/socket.io/*", "/_next/static/*", "/assets/*"])
    error_message = "The ordered behaviours must be the four D14 paths, in this order."
  }

  assert {
    condition = alltrue([
      for behaviour in concat(aws_cloudfront_distribution.this.ordered_cache_behavior, aws_cloudfront_distribution.this.default_cache_behavior) :
      length(behaviour.forwarded_values) == 0
    ])
    error_message = "Every behaviour uses policies, not legacy forwarded values."
  }

  # API clients and Socket.IO must not be redirected (a redirect drops a POST body and an upgrade);
  # they get HTTPS only. Pages and files redirect.
  assert {
    condition = jsonencode(merge(
      { for behaviour in aws_cloudfront_distribution.this.ordered_cache_behavior : behaviour.path_pattern => behaviour.viewer_protocol_policy },
      { for behaviour in aws_cloudfront_distribution.this.default_cache_behavior : "default" => behaviour.viewer_protocol_policy },
      )) == jsonencode({
      "/_next/static/*" = "redirect-to-https"
      "/api/v1/*"       = "https-only"
      "/assets/*"       = "redirect-to-https"
      "/socket.io/*"    = "https-only"
      "default"         = "redirect-to-https"
    })
    error_message = "/api/v1/* and /socket.io/* are HTTPS only; everything else redirects to HTTPS."
  }
}

run "distribution_serves_both_hosts_over_modern_tls" {
  command = apply

  assert {
    condition     = jsonencode(sort(aws_cloudfront_distribution.this.aliases)) == jsonencode(["console.staging.quad-edu.com", "staging.quad-edu.com"])
    error_message = "The aliases are the staff and console hosts."
  }

  assert {
    condition = (
      aws_cloudfront_distribution.this.http_version == "http2and3" &&
      aws_cloudfront_distribution.this.price_class == "PriceClass_200" &&
      aws_cloudfront_distribution.this.viewer_certificate[0].minimum_protocol_version == "TLSv1.2_2021" &&
      aws_cloudfront_distribution.this.viewer_certificate[0].ssl_support_method == "sni-only" &&
      aws_cloudfront_distribution.this.viewer_certificate[0].acm_certificate_arn == aws_acm_certificate.cloudfront.arn
    )
    error_message = "The distribution uses HTTP/2 and 3, PriceClass_200 and the us-east-1 certificate with TLSv1.2_2021."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.web_acl_id == aws_wafv2_web_acl.this.arn
    error_message = "The WAF ACL protects the distribution."
  }

  assert {
    # nonsensitive: the alb origin also carries the origin secret, which marks the whole set.
    condition = jsonencode(nonsensitive([
      for origin in aws_cloudfront_distribution.this.origin : [
        for config in origin.custom_origin_config :
        [config.origin_protocol_policy, config.origin_read_timeout, config.origin_keepalive_timeout, config.origin_ssl_protocols]
      ] if origin.origin_id == "alb"
    ])) == jsonencode([[["https-only", 60, 60, ["TLSv1.2"]]]])
    error_message = "CloudFront reaches the ALB over HTTPS only (TLS 1.2), with 60 s read and keepalive timeouts."
  }

  assert {
    condition = jsonencode([
      for origin in aws_cloudfront_distribution.this.origin : [origin.domain_name, origin.origin_access_control_id] if origin.origin_id == "assets"
    ]) == jsonencode([["quad-staging-public.s3.ap-south-1.amazonaws.com", aws_cloudfront_origin_access_control.assets.id]])
    error_message = "The assets origin is the public bucket, through origin access control."
  }

  assert {
    condition     = output.cloudfront_distribution_arn == aws_cloudfront_distribution.this.arn
    error_message = "The module outputs the distribution ARN for the data key's decrypt statement."
  }

  assert {
    condition     = jsonencode(sort(tolist(output.cloudfront_aliases))) == jsonencode(sort(tolist(aws_cloudfront_distribution.this.aliases)))
    error_message = "cloudfront_aliases must be the distribution's aliases."
  }
}

run "certificates_cover_every_name_tls_is_checked_against" {
  command = apply

  assert {
    condition = (
      aws_acm_certificate.cloudfront.domain_name == "staging.quad-edu.com" &&
      jsonencode(sort(aws_acm_certificate.cloudfront.subject_alternative_names)) == jsonencode(["console.staging.quad-edu.com"])
    )
    error_message = "The us-east-1 certificate covers the staff and console hosts."
  }

  # CloudFront forwards the viewer's Host (AllViewer) and then checks the ALB's certificate
  # against that host, so the origin certificate also names both public hosts.
  assert {
    condition = (
      aws_acm_certificate.origin.domain_name == "origin.staging.quad-edu.com" &&
      jsonencode(sort(aws_acm_certificate.origin.subject_alternative_names)) == jsonencode(["console.staging.quad-edu.com", "staging.quad-edu.com"])
    )
    error_message = "The ALB certificate covers origin.staging.quad-edu.com and both public hosts."
  }

  assert {
    condition     = jsonencode(sort(keys(aws_route53_record.validation))) == jsonencode(["console.staging.quad-edu.com", "origin.staging.quad-edu.com", "staging.quad-edu.com"])
    error_message = "There is one validation record per name."
  }

  assert {
    condition = (
      aws_route53_record.validation["staging.quad-edu.com"].name == "_w1.staging.quad-edu.com." &&
      jsonencode(aws_route53_record.validation["staging.quad-edu.com"].records) == jsonencode(["_v2.acm-validations.aws."]) &&
      aws_route53_record.validation["staging.quad-edu.com"].zone_id == "Z0123456789MOCKZONE" &&
      alltrue([for record in aws_route53_record.validation : record.allow_overwrite])
    )
    error_message = "Validation records carry ACM's name and value, in the zone."
  }

  assert {
    condition = (
      aws_acm_certificate_validation.cloudfront.certificate_arn == aws_acm_certificate.cloudfront.arn &&
      aws_acm_certificate_validation.origin.certificate_arn == aws_acm_certificate.origin.arn
    )
    error_message = "Both certificates wait for validation."
  }

  assert {
    condition     = aws_lb_listener.https.certificate_arn == aws_acm_certificate_validation.origin.certificate_arn
    error_message = "The listener uses the validated ap-south-1 certificate."
  }
}

run "cloudfront_certificate_must_share_the_written_records" {
  command = apply

  # A fresh state, so the certificate is created again with the override below.
  state_key = "mismatched_validation_records"

  override_resource {
    target = aws_acm_certificate.cloudfront
    values = {
      arn = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-4000-8000-000000000002"
      domain_validation_options = [
        { domain_name = "staging.quad-edu.com", resource_record_name = "_other.staging.quad-edu.com.", resource_record_type = "CNAME", resource_record_value = "_v9.acm-validations.aws." },
        { domain_name = "console.staging.quad-edu.com", resource_record_name = "_c1.console.staging.quad-edu.com.", resource_record_type = "CNAME", resource_record_value = "_v3.acm-validations.aws." },
      ]
    }
  }

  expect_failures = [aws_acm_certificate_validation.cloudfront]
}

run "public_bucket_is_readable_only_by_this_distribution_over_tls" {
  command = apply

  assert {
    condition = jsonencode([
      for statement in jsondecode(aws_s3_bucket_policy.public.policy).Statement : statement if statement.Effect == "Allow"
      ]) == jsonencode([{
        Action    = "s3:GetObject"
        Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.this.arn } }
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Resource  = "arn:aws:s3:::quad-staging-public/*"
        Sid       = "AllowCloudFrontRead"
    }])
    error_message = "Only this distribution may read objects, through origin access control."
  }

  assert {
    condition = jsonencode([
      for statement in jsondecode(aws_s3_bucket_policy.public.policy).Statement : statement if statement.Effect == "Deny"
      ]) == jsonencode([{
        Action    = "s3:*"
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
        Effect    = "Deny"
        Principal = "*"
        Resource  = ["arn:aws:s3:::quad-staging-public", "arn:aws:s3:::quad-staging-public/*"]
        Sid       = "DenyRequestsWithoutTls"
    }])
    error_message = "Every request without TLS is denied on the bucket and its objects."
  }

  assert {
    condition     = aws_s3_bucket_policy.public.bucket == "quad-staging-public"
    error_message = "The policy is on the public bucket."
  }
}

run "waf_limits" {
  command = apply

  assert {
    condition = jsonencode({
      for rule in aws_wafv2_web_acl.this.rule : rule.name => [
        for statement in rule.statement[0].rate_based_statement :
        [statement.limit, statement.aggregate_key_type, statement.evaluation_window_sec, length(rule.action[0].block)]
      ] if length(rule.statement[0].rate_based_statement) > 0
      }) == jsonencode({
      rate-all       = [[2000, "IP", 300, 1]]
      rate-sensitive = [[100, "IP", 300, 1]]
    })
    error_message = "The rate limits block per IP over five minutes: 2000 overall and 100 on sensitive paths."
  }

  assert {
    condition = jsonencode(sort(flatten([
      for rule in aws_wafv2_web_acl.this.rule : [
        for statement in rule.statement[0].rate_based_statement[0].scope_down_statement[0].or_statement[0].statement : [
          for match in statement.byte_match_statement :
          "${match.positional_constraint} ${match.search_string} ${join(",", sort([for t in match.text_transformation : "${t.priority}:${t.type}"]))}"
          if length(match.field_to_match[0].uri_path) == 1
        ]
      ] if rule.name == "rate-sensitive"
      ]))) == jsonencode([
      "STARTS_WITH /api/v1/auth/ 0:URL_DECODE,1:LOWERCASE",
      "STARTS_WITH /api/v1/platform/auth/ 0:URL_DECODE,1:LOWERCASE",
      "STARTS_WITH /api/v1/public/ 0:URL_DECODE,1:LOWERCASE",
    ])
    error_message = "The sensitive rate rule covers decoded, lower-cased paths starting /api/v1/auth/, /api/v1/platform/auth/ and /api/v1/public/."
  }

  # Static files are cached at the edge and a page load fetches many, so they do not count
  # against the overall limit.
  assert {
    condition = jsonencode(sort(flatten([
      for rule in aws_wafv2_web_acl.this.rule : [
        for statement in rule.statement[0].rate_based_statement[0].scope_down_statement[0].not_statement[0].statement[0].or_statement[0].statement : [
          for match in statement.byte_match_statement :
          "${match.positional_constraint} ${match.search_string} ${join(",", sort([for t in match.text_transformation : "${t.priority}:${t.type}"]))}"
          if length(match.field_to_match[0].uri_path) == 1
        ]
      ] if rule.name == "rate-all"
      ]))) == jsonencode([
      "STARTS_WITH /_next/static/ 0:URL_DECODE,1:LOWERCASE",
      "STARTS_WITH /assets/ 0:URL_DECODE,1:LOWERCASE",
    ])
    error_message = "The overall rate rule leaves out /_next/static/ and /assets/."
  }

  assert {
    condition = jsonencode(sort(flatten([
      for rule in aws_wafv2_web_acl.this.rule : [
        for statement in rule.statement[0].managed_rule_group_statement : statement.name
      ]
      ]))) == jsonencode(sort([
      "AWSManagedRulesAmazonIpReputationList", "AWSManagedRulesAnonymousIpList", "AWSManagedRulesCommonRuleSet",
      "AWSManagedRulesKnownBadInputsRuleSet", "AWSManagedRulesSQLiRuleSet",
    ]))
    error_message = "The ACL uses the five managed rule groups."
  }

  assert {
    condition = jsonencode(flatten([
      for rule in aws_wafv2_web_acl.this.rule : [
        for match in rule.statement[0].managed_rule_group_statement[0].scope_down_statement[0].byte_match_statement :
        [
          match.search_string, match.positional_constraint, match.field_to_match[0].single_header[0].name,
          join(",", sort([for t in match.text_transformation : "${t.priority}:${t.type}"])),
        ]
      ] if rule.name == "anonymous-ip"
    ])) == jsonencode(["console.staging.quad-edu.com", "EXACTLY", "host", "0:URL_DECODE,1:LOWERCASE"])
    error_message = "The anonymous IP list applies only to the console host (decoded, lower-cased)."
  }

  # I-1: GitHub's hosted runners (Azure) reach the console; the hosting-provider list only counts.
  assert {
    condition = jsonencode(flatten([
      for rule in aws_wafv2_web_acl.this.rule : [
        for override in rule.statement[0].managed_rule_group_statement[0].rule_action_override :
        [override.name, length(override.action_to_use[0].count)]
      ] if rule.name == "anonymous-ip"
    ])) == jsonencode(["HostingProviderIPList", 1])
    error_message = "HostingProviderIPList must count, not block, in the anonymous IP group."
  }

  # I-2: the common rule set's 8 KB body limit only counts, and body-size blocks it outside the
  # API (whose own body limits apply, spec 06).
  assert {
    condition = jsonencode(flatten([
      for rule in aws_wafv2_web_acl.this.rule : [
        for override in rule.statement[0].managed_rule_group_statement[0].rule_action_override :
        [override.name, length(override.action_to_use[0].count)]
      ] if rule.name == "common"
    ])) == jsonencode(["SizeRestrictions_BODY", 1])
    error_message = "SizeRestrictions_BODY must count, not block, in the common rule set."
  }

  assert {
    condition = jsonencode([
      for rule in aws_wafv2_web_acl.this.rule : {
        priority = rule.priority
        block    = length(rule.action[0].block)
        label    = rule.statement[0].and_statement[0].statement[0].label_match_statement[0].key
        scope    = rule.statement[0].and_statement[0].statement[0].label_match_statement[0].scope
        not_api = [
          for match in rule.statement[0].and_statement[0].statement[1].not_statement[0].statement[0].byte_match_statement :
          "${match.positional_constraint} ${match.search_string} ${length(match.field_to_match[0].uri_path)} ${join(",", sort([for t in match.text_transformation : "${t.priority}:${t.type}"]))}"
        ]
      } if rule.name == "body-size"
      ]) == jsonencode([{
        priority = 55
        block    = 1
        label    = "awswaf:managed:aws:core-rule-set:SizeRestrictions_Body"
        scope    = "LABEL"
        not_api  = ["STARTS_WITH /api/v1/ 1 0:URL_DECODE,1:LOWERCASE"]
    }])
    error_message = "body-size (priority 55) blocks the SizeRestrictions_Body label unless the path starts /api/v1/."
  }

  assert {
    condition     = aws_wafv2_web_acl.this.scope == "CLOUDFRONT" && !contains([for rule in aws_wafv2_web_acl.this.rule : rule.name], "geo-block")
    error_message = "The ACL is CloudFront-scoped, with no geo block while the list is empty."
  }

  assert {
    condition = alltrue(concat(
      [for config in aws_wafv2_web_acl.this.visibility_config : config.cloudwatch_metrics_enabled && config.sampled_requests_enabled],
      flatten([for rule in aws_wafv2_web_acl.this.rule : [for config in rule.visibility_config : config.cloudwatch_metrics_enabled]]),
    ))
    error_message = "CloudWatch metrics are on for the ACL and every rule."
  }
}

run "alb_deletion_protection_can_be_turned_off" {
  command = apply

  variables {
    alb_deletion_protection = false
  }

  assert {
    condition     = !aws_lb.this.enable_deletion_protection
    error_message = "alb_deletion_protection = false turns deletion protection off."
  }
}

run "geo_block_exists_only_when_countries_are_listed" {
  command = apply

  variables {
    geo_block_countries = ["KP"]
  }

  assert {
    condition = jsonencode(flatten([
      for rule in aws_wafv2_web_acl.this.rule : [
        for statement in rule.statement[0].geo_match_statement : statement.country_codes
      ] if rule.name == "geo-block"
    ])) == jsonencode(["KP"])
    error_message = "A non-empty list adds the geo block rule."
  }
}

run "staging_is_noindex" {
  command = apply

  assert {
    condition = jsonencode([
      for header in aws_cloudfront_response_headers_policy.this.custom_headers_config[0].items :
      [header.value, header.override] if header.header == "X-Robots-Tag"
    ]) == jsonencode([["noindex, nofollow", false]])
    error_message = "Staging adds X-Robots-Tag: noindex, nofollow without replacing the app's own value."
  }

  assert {
    condition     = length(aws_cloudfront_response_headers_policy.this.remove_headers_config) == 0
    error_message = "CloudFront must not strip response headers (the apps send their own X-Robots-Tag)."
  }

  assert {
    condition = (
      aws_cloudfront_response_headers_policy.this.security_headers_config[0].strict_transport_security[0].access_control_max_age_sec == 63072000 &&
      aws_cloudfront_response_headers_policy.this.security_headers_config[0].strict_transport_security[0].include_subdomains &&
      aws_cloudfront_response_headers_policy.this.security_headers_config[0].strict_transport_security[0].preload
    )
    error_message = "HSTS is max-age=63072000; includeSubDomains; preload."
  }

  assert {
    condition = alltrue([
      for behaviour in concat(aws_cloudfront_distribution.this.ordered_cache_behavior, aws_cloudfront_distribution.this.default_cache_behavior) :
      behaviour.response_headers_policy_id == aws_cloudfront_response_headers_policy.this.id
    ])
    error_message = "Every behaviour uses the response headers policy."
  }
}

run "without_noindex_there_is_no_robots_header" {
  command = apply

  variables {
    noindex = false
  }

  assert {
    condition     = length(aws_cloudfront_response_headers_policy.this.custom_headers_config) == 0
    error_message = "Without noindex there is no custom X-Robots-Tag."
  }
}

run "outputs_name_every_target_group" {
  command = apply

  assert {
    condition = (
      jsonencode(sort(keys(output.target_group_arns))) == jsonencode(["api", "api_socket", "console", "staff"]) &&
      jsonencode(sort(keys(output.target_group_arn_suffixes))) == jsonencode(["api", "api_socket", "console", "staff"])
    )
    error_message = "target_group_arns and target_group_arn_suffixes have the four target groups."
  }

  assert {
    condition     = output.alb_security_group_id == aws_security_group.alb.id && output.alb_arn_suffix == aws_lb.this.arn_suffix
    error_message = "The ALB outputs come from the ALB and its group."
  }

  # The overview dashboard's WAF widget charts BlockedRequests by this name (envs/staging).
  assert {
    condition     = output.waf_web_acl_name == aws_wafv2_web_acl.this.name && output.waf_web_acl_name == "quad-staging"
    error_message = "waf_web_acl_name must be the web ACL's name."
  }
}
