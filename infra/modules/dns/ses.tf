# SES sending from mail.quad-edu.com (spec 20 → Providers, D19, D28). Each environment owns its
# identity, its three Easy DKIM CNAMEs (2048-bit keys) and its configuration set; the shared mail
# records (SPF and DMARC for mail., MX and SPF for the bounce. MAIL FROM domain) are in envs/global
# because their values are the same for every account. The account stays in the SES sandbox until
# production (M12, spec 18), so staging sends only to verified addresses.
#
# Bounces and complaints are published by the configuration set to an SNS topic, which delivers
# the signed SNS envelope (SignatureVersion 2, no raw delivery) to the API's webhook. The webhook
# checks the signature and the topic (SES_SNS_TOPIC_ARN) and confirms the subscription itself.

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

data "aws_region" "current" {}

locals {
  tags        = { service = "email" }
  account_id  = data.aws_caller_identity.current.account_id
  partition   = data.aws_partition.current.partition
  region      = data.aws_region.current.region
  account_arn = "arn:${local.partition}:iam::${local.account_id}:root"

  # Built from the name rather than read from the resource, so the policies are known at plan time.
  configuration_set_arn = "arn:${local.partition}:ses:${local.region}:${local.account_id}:configuration-set/${var.name}"

  # SES publishes to an encrypted topic only if it may use the topic's key. The key is used only
  # through SNS for this topic, so aws:SourceAccount is the guard here; the topic policy narrows the
  # publisher to this configuration set.
  ses_events_key_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AccountAdministersTheKey"
        Effect    = "Allow"
        Principal = { AWS = local.account_arn }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "SesEncryptsEventsForThisAccount"
        Effect    = "Allow"
        Principal = { Service = "ses.amazonaws.com" }
        Action    = ["kms:GenerateDataKey*", "kms:Decrypt"]
        Resource  = "*"
        Condition = { StringEquals = { "aws:SourceAccount" = local.account_id } }
      },
    ]
  })

  # Replaces the default topic policy: within the account, IAM policies still grant access.
  ses_events_topic_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "SesPublishesThisConfigurationSetsEvents"
      Effect    = "Allow"
      Principal = { Service = "ses.amazonaws.com" }
      Action    = "sns:Publish"
      Resource  = aws_sns_topic.ses_events.arn
      Condition = {
        StringEquals = {
          "AWS:SourceAccount" = local.account_id
          "AWS:SourceArn"     = local.configuration_set_arn
        }
      }
    }]
  })
}

# --- Identity, DKIM and MAIL FROM ---

resource "aws_sesv2_email_identity" "mail" {
  email_identity = var.mail_domain
  # Every message publishes events, even one sent without naming the configuration set.
  configuration_set_name = aws_sesv2_configuration_set.this.configuration_set_name

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }

  tags = local.tags
}

# Easy DKIM always gives three tokens. They are unknown until the identity exists, so the records
# are counted rather than keyed by token.
resource "aws_route53_record" "dkim" {
  provider = aws.dns
  count    = 3

  zone_id = var.zone_id
  name    = "${one(aws_sesv2_email_identity.mail.dkim_signing_attributes).tokens[count.index]}._domainkey.${var.mail_domain}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${one(aws_sesv2_email_identity.mail.dkim_signing_attributes).tokens[count.index]}.dkim.amazonses.com"]

  lifecycle {
    precondition {
      condition     = length(one(aws_sesv2_email_identity.mail.dkim_signing_attributes).tokens) == 3
      error_message = "SES Easy DKIM must give exactly three tokens."
    }
  }
}

# The MX and SPF records for mail_from_domain are in envs/global. Until they resolve, SES falls
# back to its own amazonses.com MAIL FROM rather than refusing to send.
resource "aws_sesv2_email_identity_mail_from_attributes" "mail" {
  email_identity         = aws_sesv2_email_identity.mail.email_identity
  mail_from_domain       = var.mail_from_domain
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

# --- Configuration set and events ---

resource "aws_sesv2_configuration_set" "this" {
  configuration_set_name = var.name

  # OPTIONAL, not REQUIRE: a recipient server without STARTTLS would otherwise give a transient
  # failure that never reaches the webhook, and a sign-in code would be lost silently. Revisited in
  # M12 (D28).
  delivery_options {
    tls_policy = "OPTIONAL"
  }

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }

  tags = local.tags
}

resource "aws_kms_key" "ses_events" {
  description             = "${var.name}: encrypts the SES bounce and complaint events topic"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = local.ses_events_key_policy

  tags = merge(local.tags, { Name = "${var.name}-ses-events" })
}

resource "aws_kms_alias" "ses_events" {
  name          = "alias/${var.name}-ses-events"
  target_key_id = aws_kms_key.ses_events.key_id
}

resource "aws_sns_topic" "ses_events" {
  name = "${var.name}-ses-events"
  # SHA256 signatures; the webhook refuses SignatureVersion 1.
  signature_version = 2
  kms_master_key_id = aws_kms_key.ses_events.arn

  tags = local.tags
}

resource "aws_sns_topic_policy" "ses_events" {
  arn    = aws_sns_topic.ses_events.arn
  policy = local.ses_events_topic_policy
}

# SES checks that it can publish when the destination is created, so the policies come first.
resource "aws_sesv2_configuration_set_event_destination" "sns" {
  configuration_set_name = aws_sesv2_configuration_set.this.configuration_set_name
  event_destination_name = "bounces-and-complaints"

  event_destination {
    enabled              = true
    matching_event_types = ["BOUNCE", "COMPLAINT"]

    sns_destination {
      topic_arn = aws_sns_topic.ses_events.arn
    }
  }

  depends_on = [aws_sns_topic_policy.ses_events, aws_kms_key.ses_events]
}

# The webhook answers SNS's SubscriptionConfirmation itself, so Terraform does not wait for it
# (endpoint_auto_confirms = false) and the first apply works before the API is deployed. A pending
# subscription expires after three days; the next apply then subscribes again.
resource "aws_sns_topic_subscription" "webhook" {
  topic_arn              = aws_sns_topic.ses_events.arn
  protocol               = "https"
  endpoint               = var.ses_webhook_url
  raw_message_delivery   = false
  endpoint_auto_confirms = false
}
