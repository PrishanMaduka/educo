# WAF on CloudFront (spec 20 → Edge): AWS managed rules, two rate rules, a body-size rule and an
# optional geo block. The API's own Redis rate limits stay in place behind it (spec 16).
# CLOUDFRONT-scoped ACLs live in us-east-1. Every path or host match decodes, then lower-cases,
# so %2F or upper-case tricks cannot step around it.

locals {
  # The AWS rule groups that apply to every request, with the rules that only count. The anonymous
  # IP list (priority 40) and the known bad inputs (priority 60) are written out below: the first
  # is limited to the console, and Checkov looks for both by name (CKV_AWS_192, CKV2_AWS_47), which
  # it cannot do inside a dynamic block.
  #
  # The common rule set's SizeRestrictions_BODY (8 KB) only counts. The API sets its own body
  # limits, and body-size (priority 55) blocks it everywhere else.
  managed_rule_groups = {
    ip-reputation = { priority = 30, group = "AWSManagedRulesAmazonIpReputationList", count = [] }
    common        = { priority = 50, group = "AWSManagedRulesCommonRuleSet", count = ["SizeRestrictions_BODY"] }
    sqli          = { priority = 70, group = "AWSManagedRulesSQLiRuleSet", count = [] }
  }

  # Sign-in, OTP and the tenant-less public endpoints (D16), and console sign-in (ruling
  # R-console-realtime).
  sensitive_path_prefixes = ["/api/v1/auth/", "/api/v1/platform/auth/", "/api/v1/public/"]

  # Cached at the edge and fetched many at a time by each page load.
  static_path_prefixes = ["/_next/static/", "/assets/"]

  match_transformations = [
    { priority = 0, type = "URL_DECODE" },
    { priority = 1, type = "LOWERCASE" },
  ]
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

        scope_down_statement {
          not_statement {
            statement {
              or_statement {
                dynamic "statement" {
                  for_each = local.static_path_prefixes

                  content {
                    byte_match_statement {
                      search_string         = statement.value
                      positional_constraint = "STARTS_WITH"

                      field_to_match {
                        uri_path {}
                      }

                      dynamic "text_transformation" {
                        for_each = local.match_transformations

                        content {
                          priority = text_transformation.value.priority
                          type     = text_transformation.value.type
                        }
                      }
                    }
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
      metric_name                = "${var.name}-rate-all"
      sampled_requests_enabled   = true
    }
  }

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

                  dynamic "text_transformation" {
                    for_each = local.match_transformations

                    content {
                      priority = text_transformation.value.priority
                      type     = text_transformation.value.type
                    }
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

          dynamic "rule_action_override" {
            for_each = rule.value.count

            content {
              name = rule_action_override.value

              action_to_use {
                count {}
              }
            }
          }
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
  # VPNs and privacy relays. HostingProviderIPList only counts: GitHub's hosted runners (Azure)
  # reach the console.
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

        rule_action_override {
          name = "HostingProviderIPList"

          action_to_use {
            count {}
          }
        }

        scope_down_statement {
          byte_match_statement {
            search_string         = var.console_domain
            positional_constraint = "EXACTLY"

            field_to_match {
              single_header {
                name = "host"
              }
            }

            dynamic "text_transformation" {
              for_each = local.match_transformations

              content {
                priority = text_transformation.value.priority
                type     = text_transformation.value.type
              }
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

  # The common rule set labels bodies over 8 KB (its SizeRestrictions_BODY only counts, above).
  # Outside /api/v1/ nothing takes a large body, so those are blocked here; the API applies its own
  # body limits (spec 06).
  rule {
    name     = "body-size"
    priority = 55

    action {
      block {}
    }

    statement {
      and_statement {
        statement {
          label_match_statement {
            scope = "LABEL"
            key   = "awswaf:managed:aws:core-rule-set:SizeRestrictions_Body"
          }
        }

        statement {
          not_statement {
            statement {
              byte_match_statement {
                search_string         = "/api/v1/"
                positional_constraint = "STARTS_WITH"

                field_to_match {
                  uri_path {}
                }

                dynamic "text_transformation" {
                  for_each = local.match_transformations

                  content {
                    priority = text_transformation.value.priority
                    type     = text_transformation.value.type
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
      metric_name                = "${var.name}-body-size"
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
