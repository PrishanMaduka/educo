# The staging records and SES sending, checked offline. Every provider is mocked: aws in
# ap-south-1 and aws.dns (the tooling account's zone), from infra/tests/mocks.

mock_provider "aws" {
  source = "../../tests/mocks/aws"
}

mock_provider "aws" {
  alias  = "dns"
  source = "../../tests/mocks/aws"
}

# Easy DKIM always gives three tokens; the mock would give none.
override_resource {
  target = aws_sesv2_email_identity.mail
  values = {
    arn = "arn:aws:ses:ap-south-1:123456789012:identity/mail.quad-edu.com"
    dkim_signing_attributes = {
      tokens = ["abcdefghijklmnopqrstuvwxyz000001", "abcdefghijklmnopqrstuvwxyz000002", "abcdefghijklmnopqrstuvwxyz000003"]
    }
  }
}

variables {
  name                      = "quad-staging"
  zone_id                   = "Z0123456789MOCKZONE"
  cloudfront_domain_name    = "d111111abcdef8.cloudfront.net"
  cloudfront_hosted_zone_id = "Z2FDTNDATAQYW2"
  alb_dns_name              = "mock-alb-123456789.ap-south-1.elb.amazonaws.com"
  alb_zone_id               = "ZP97RAFLXTNZK"
}

# Assertions compare structured values through jsonencode, because Terraform's == is
# type-sensitive (a tuple literal never equals a list or set attribute).

run "web_and_console_alias_cloudfront_and_origin_aliases_the_alb" {
  command = apply

  assert {
    condition = jsonencode(sort([for record in aws_route53_record.cloudfront : "${record.name} ${record.type}"])) == jsonencode([
      "console.staging.quad-edu.com A", "console.staging.quad-edu.com AAAA",
      "staging.quad-edu.com A", "staging.quad-edu.com AAAA",
    ])
    error_message = "staging and console.staging need A and AAAA records."
  }

  assert {
    condition = alltrue([
      for record in aws_route53_record.cloudfront :
      one(record.alias).zone_id == "Z2FDTNDATAQYW2" && one(record.alias).name == "d111111abcdef8.cloudfront.net"
    ])
    error_message = "The web and console records must alias the distribution in CloudFront's hosted zone."
  }

  assert {
    condition = (
      aws_route53_record.origin.name == "origin.staging.quad-edu.com" &&
      aws_route53_record.origin.type == "A" &&
      one(aws_route53_record.origin.alias).zone_id == "ZP97RAFLXTNZK" &&
      one(aws_route53_record.origin.alias).name == "mock-alb-123456789.ap-south-1.elb.amazonaws.com"
    )
    error_message = "origin.staging must be an A alias to the ALB."
  }
}

# The quad-dns-records-staging role (envs/global) may write only A, AAAA and CNAME records named
# staging.quad-edu.com, *.staging.quad-edu.com or *._domainkey.mail.quad-edu.com. Anything else
# would fail at apply time with AccessDenied.
run "every_record_stays_inside_the_dns_role_allow_list" {
  command = apply

  assert {
    condition = alltrue([
      for record in concat(values(aws_route53_record.cloudfront), [aws_route53_record.origin], aws_route53_record.dkim) :
      record.zone_id == "Z0123456789MOCKZONE" &&
      contains(["A", "AAAA", "CNAME"], record.type) && (
        record.name == "staging.quad-edu.com" ||
        endswith(record.name, ".staging.quad-edu.com") ||
        endswith(record.name, "._domainkey.mail.quad-edu.com")
      )
    ])
    error_message = "Every record must be an A, AAAA or CNAME record inside the staging DNS role's allowed names."
  }
}

run "mail_domain_signs_with_2048_bit_easy_dkim" {
  command = apply

  assert {
    condition     = aws_sesv2_email_identity.mail.email_identity == "mail.quad-edu.com" && one(aws_sesv2_email_identity.mail.dkim_signing_attributes).next_signing_key_length == "RSA_2048_BIT"
    error_message = "The mail.quad-edu.com identity must use 2048-bit Easy DKIM keys."
  }

  assert {
    condition = jsonencode([for record in aws_route53_record.dkim : [record.type, record.name, record.records, record.ttl]]) == jsonencode([
      ["CNAME", "abcdefghijklmnopqrstuvwxyz000001._domainkey.mail.quad-edu.com", ["abcdefghijklmnopqrstuvwxyz000001.dkim.amazonses.com"], 1800],
      ["CNAME", "abcdefghijklmnopqrstuvwxyz000002._domainkey.mail.quad-edu.com", ["abcdefghijklmnopqrstuvwxyz000002.dkim.amazonses.com"], 1800],
      ["CNAME", "abcdefghijklmnopqrstuvwxyz000003._domainkey.mail.quad-edu.com", ["abcdefghijklmnopqrstuvwxyz000003.dkim.amazonses.com"], 1800],
    ])
    error_message = "Each of the three DKIM tokens needs a CNAME <token>._domainkey.mail.quad-edu.com to <token>.dkim.amazonses.com."
  }

  assert {
    condition = length(aws_route53_record.dkim) == 3 && alltrue([
      for record in aws_route53_record.dkim :
      can(regex("^[^.]+\\._domainkey\\.mail\\.quad-edu\\.com$", record.name))
    ])
    error_message = "Each DKIM name must have exactly one label before ._domainkey.mail.quad-edu.com."
  }

  assert {
    condition = (
      aws_sesv2_email_identity_mail_from_attributes.mail.email_identity == "mail.quad-edu.com" &&
      aws_sesv2_email_identity_mail_from_attributes.mail.mail_from_domain == "bounce.mail.quad-edu.com" &&
      aws_sesv2_email_identity_mail_from_attributes.mail.behavior_on_mx_failure == "USE_DEFAULT_VALUE"
    )
    error_message = "MAIL FROM must be bounce.mail.quad-edu.com, falling back to the SES default if its MX is missing."
  }
}

run "bounces_and_complaints_go_to_the_signed_sns_topic" {
  command = apply

  assert {
    condition     = aws_sesv2_configuration_set.this.configuration_set_name == "quad-staging" && aws_sesv2_email_identity.mail.configuration_set_name == "quad-staging"
    error_message = "The configuration set is named after the environment and is the identity's default, so every message publishes events."
  }

  assert {
    condition     = one(aws_sesv2_configuration_set.this.delivery_options).tls_policy == "OPTIONAL"
    error_message = "SES must use TLS when the recipient offers it but still deliver when it does not, so no code is lost silently (REQUIRE is revisited in M12)."
  }

  assert {
    condition = (
      aws_sesv2_configuration_set_event_destination.sns.configuration_set_name == "quad-staging" &&
      one(aws_sesv2_configuration_set_event_destination.sns.event_destination).enabled &&
      jsonencode(sort(one(aws_sesv2_configuration_set_event_destination.sns.event_destination).matching_event_types)) == jsonencode(["BOUNCE", "COMPLAINT"]) &&
      one(one(aws_sesv2_configuration_set_event_destination.sns.event_destination).sns_destination).topic_arn == aws_sns_topic.ses_events.arn
    )
    error_message = "The event destination must send exactly BOUNCE and COMPLAINT to the events topic."
  }

  assert {
    condition     = aws_sns_topic.ses_events.name == "quad-staging-ses-events" && aws_sns_topic.ses_events.signature_version == 2
    error_message = "The topic must sign with SignatureVersion 2 (SHA256), the only version the webhook accepts."
  }

  assert {
    condition     = aws_sns_topic.ses_events.kms_master_key_id == aws_kms_key.ses_events.arn && aws_kms_key.ses_events.enable_key_rotation
    error_message = "The topic must be encrypted with its own rotating KMS key."
  }

  assert {
    condition = (
      aws_sns_topic_subscription.webhook.topic_arn == aws_sns_topic.ses_events.arn &&
      aws_sns_topic_subscription.webhook.protocol == "https" &&
      endswith(aws_sns_topic_subscription.webhook.endpoint, "/api/v1/webhooks/ses") &&
      aws_sns_topic_subscription.webhook.endpoint == "https://staging.quad-edu.com/api/v1/webhooks/ses" &&
      !aws_sns_topic_subscription.webhook.raw_message_delivery
    )
    error_message = "The webhook subscription must be HTTPS to /api/v1/webhooks/ses with the signed SNS envelope (no raw delivery)."
  }

  assert {
    condition     = output.ses_events_topic_arn == aws_sns_topic.ses_events.arn && output.ses_configuration_set_name == "quad-staging" && output.ses_identity_arn == aws_sesv2_email_identity.mail.arn
    error_message = "The outputs must name the topic (SES_SNS_TOPIC_ARN), the configuration set (SES_CONFIGURATION_SET) and the identity."
  }
}

run "only_ses_for_this_configuration_set_publishes_and_uses_the_key" {
  command = apply

  assert {
    condition = jsondecode(aws_sns_topic_policy.ses_events.policy) == {
      Version = "2012-10-17"
      Statement = [{
        Sid       = "SesPublishesThisConfigurationSetsEvents"
        Effect    = "Allow"
        Principal = { Service = "ses.amazonaws.com" }
        Action    = "sns:Publish"
        Resource  = aws_sns_topic.ses_events.arn
        Condition = {
          StringEquals = {
            "AWS:SourceAccount" = "123456789012"
            "AWS:SourceArn"     = "arn:aws:ses:ap-south-1:123456789012:configuration-set/quad-staging"
          }
        }
      }]
    } && aws_sns_topic_policy.ses_events.arn == aws_sns_topic.ses_events.arn
    error_message = "Only SES, for this account's configuration set, may publish to the topic."
  }

  assert {
    condition = jsonencode([
      for statement in jsondecode(aws_kms_key.ses_events.policy).Statement : statement
      if try(statement.Principal.Service, "") == "ses.amazonaws.com"
      ]) == jsonencode([{
        Sid       = "SesEncryptsEventsForThisAccount"
        Effect    = "Allow"
        Principal = { Service = "ses.amazonaws.com" }
        Action    = ["kms:GenerateDataKey*", "kms:Decrypt"]
        Resource  = "*"
        Condition = { StringEquals = { "aws:SourceAccount" = "123456789012" } }
    }])
    error_message = "The key must let SES (this account only) generate data keys and decrypt, which publishing to an encrypted topic needs."
  }

  assert {
    condition = length(jsondecode(aws_kms_key.ses_events.policy).Statement) == 2 && anytrue([
      for statement in jsondecode(aws_kms_key.ses_events.policy).Statement :
      statement.Principal == { AWS = "arn:aws:iam::123456789012:root" } && statement.Action == "kms:*"
    ])
    error_message = "Besides SES, only the account administers the key."
  }
}

run "refuses_a_webhook_url_that_is_not_https" {
  command = plan

  variables {
    ses_webhook_url = "http://staging.quad-edu.com/api/v1/webhooks/ses"
  }

  expect_failures = [var.ses_webhook_url]
}

run "refuses_a_mail_from_domain_outside_the_mail_domain" {
  command = plan

  variables {
    mail_from_domain = "bounce.quad-edu.com"
  }

  expect_failures = [var.mail_from_domain]
}
