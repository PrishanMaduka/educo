# WAF on CloudFront (spec 20 → Edge): AWS managed rules, two rate rules and an optional geo block.
# The API's own Redis rate limits stay in place behind it (spec 16). CLOUDFRONT-scoped ACLs live
# in us-east-1.

locals {
  # The AWS rule groups that apply to every request. The anonymous IP list (priority 40) and the
  # known bad inputs (priority 60) are written out below: the first is limited to the console,
  # and Checkov looks for both by name (CKV_AWS_192, CKV2_AWS_47), which it cannot do inside a
  # dynamic block.
  managed_rule_groups = {
    ip-reputation = { priority = 30, group = "AWSManagedRulesAmazonIpReputationList" }
    common        = { priority = 50, group = "AWSManagedRulesCommonRuleSet" }
    sqli          = { priority = 70, group = "AWSManagedRulesSQLiRuleSet" }
  }

  sensitive_path_prefixes = ["/api/v1/auth/", "/api/v1/public/"]
}

resource "aws_wafv2_web_acl" "this" {
  #checkov:skip=CKV2_AWS_31:staging; production logging arrives in M12.
  provider = aws.us_east_1

  name        = var.name
  description = "Managed rules and rate limits in front of ${var.web_domain} and ${var.console_domain}"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  dynamic "rule" {
    for_each = length(var.geo_block_countries) > 0 ? [var.geo_block_countries] : []

    content {
      name     = "geo-block"
      priority = 0

      action {
        block {}
      }

      statement {
        geo_match_statement {
          country_codes = rule.value
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.name}-geo-block"
        sampled_requests_enabled   = true
      }
    }
  }

  rule {
    name     = "rate-all"
    priority = 10

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit                 = var.waf_rate_limit
        aggregate_key_type    = "IP"
        evaluation_window_sec = 300
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-rate-all"
      sampled_requests_enabled   = true
    }
  }

  # Sign-in, OTP and the tenant-less public endpoints (D16).
  rule {
    name     = "rate-sensitive"
    priority = 20

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit                 = var.waf_sensitive_rate_limit
        aggregate_key_type    = "IP"
        evaluation_window_sec = 300

        scope_down_statement {
          or_statement {
            dynamic "statement" {
              for_each = local.sensitive_path_prefixes

              content {
                byte_match_statement {
                  search_string         = statement.value
                  positional_constraint = "STARTS_WITH"

                  field_to_match {
                    uri_path {}
                  }

                  text_transformation {
                    priority = 0
                    type     = "LOWERCASE"
                  }
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-rate-sensitive"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = local.managed_rule_groups

    content {
      name     = rule.key
      priority = rule.value.priority

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          vendor_name = "AWS"
          name        = rule.value.group
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.name}-${rule.key}"
        sampled_requests_enabled   = true
      }
    }
  }

  # Spec 20: the anonymous IP list applies only to the console host. Parents and staff may use
  # VPNs and privacy relays.
  rule {
    name     = "anonymous-ip"
    priority = 40

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesAnonymousIpList"

        scope_down_statement {
          byte_match_statement {
            search_string         = var.console_domain
            positional_constraint = "EXACTLY"

            field_to_match {
              single_header {
                name = "host"
              }
            }

            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-anonymous-ip"
      sampled_requests_enabled   = true
    }
  }

  # Includes the Log4j (CVE-2021-44228) rules.
  rule {
    name     = "known-bad-inputs"
    priority = 60

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = var.name
    sampled_requests_enabled   = true
  }

  tags = merge(local.tags, { Name = var.name })
}
