data "aws_caller_identity" "current" {}

locals {
  mail_domain      = "mail.${var.domain}"
  mail_from_domain = "bounce.${local.mail_domain}"
  ses_region       = "ap-south-1"
  ses_spf          = "v=spf1 include:amazonses.com ~all"
  github_oidc_host = "token.actions.githubusercontent.com"

  # The roles' trust and permissions are jsonencode locals so the mocked tests can read them.
  dns_role_trust = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "NamedAccountsOnly"
      Effect    = "Allow"
      Principal = { AWS = [for id in var.dns_writer_account_ids : "arn:aws:iam::${id}:root"] }
      Action    = "sts:AssumeRole"
    }]
  })

  # Environments write their own A, AAAA and CNAME records (aliases, ACM validation, DKIM). They
  # cannot change NS, SOA, CAA, MX or TXT, which hold the delegation and the shared records below.
  dns_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "WriteOwnRecords"
        Effect   = "Allow"
        Action   = ["route53:ChangeResourceRecordSets"]
        Resource = [aws_route53_zone.root.arn]
        Condition = {
          "ForAllValues:StringEquals" = {
            "route53:ChangeResourceRecordSetsRecordTypes" = ["A", "AAAA", "CNAME"]
          }
        }
      },
      {
        Sid      = "ReadZone"
        Effect   = "Allow"
        Action   = ["route53:ListResourceRecordSets", "route53:GetHostedZone", "route53:ListTagsForResource"]
        Resource = [aws_route53_zone.root.arn]
      },
      {
        Sid      = "WaitForChanges"
        Effect   = "Allow"
        Action   = ["route53:GetChange"]
        Resource = ["arn:aws:route53:::change/*"]
      },
      {
        # IAM cannot scope zone lookups by name to a resource.
        Sid      = "FindZoneByName"
        Effect   = "Allow"
        Action   = ["route53:ListHostedZones", "route53:ListHostedZonesByName"]
        Resource = ["*"]
      },
    ]
  })

  tooling_plan_trust = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PullRequestsOfThisRepository"
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "${local.github_oidc_host}:aud" = "sts.amazonaws.com" }
        StringLike   = { "${local.github_oidc_host}:sub" = "repo:${var.github_repository}:pull_request:ref:refs/pull/*" }
      }
    }]
  })

  # ReadOnlyAccess cannot decrypt state, so plans reach it through the state role (infra/bootstrap).
  tooling_plan_state_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "AssumeStateRole"
      Effect   = "Allow"
      Action   = ["sts:AssumeRole"]
      Resource = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/quad-terraform-state"]
    }]
  })
}

# --- Zone ---

resource "aws_route53_zone" "root" {
  #checkov:skip=CKV2_AWS_38:DNSSEC needs a us-east-1 KMS key and a DS record at the registrar; it is a production (M12) step.
  #checkov:skip=CKV2_AWS_39:Query logging needs a us-east-1 log group; it is a production (M12) step.
  name    = var.domain
  comment = "Quad: every school and app on one domain (delegated from the registrar by NS)"

  tags = { service = "dns" }

  lifecycle {
    prevent_destroy = true
  }
}

# --- Records every environment shares ---

resource "aws_route53_record" "caa" {
  zone_id = aws_route53_zone.root.zone_id
  name    = var.domain
  type    = "CAA"
  ttl     = 3600
  records = [
    "0 issue \"amazon.com\"",
    "0 issue \"amazontrust.com\"",
    "0 issue \"awstrust.com\"",
    "0 issue \"amazonaws.com\"",
    "0 iodef \"mailto:${var.security_contact_address}\"",
  ]
}

# The apex mail stays with Google Workspace (D19).
resource "aws_route53_record" "apex_mx" {
  zone_id = aws_route53_zone.root.zone_id
  name    = var.domain
  type    = "MX"
  ttl     = 3600
  records = ["1 smtp.google.com"]
}

resource "aws_route53_record" "apex_spf" {
  zone_id = aws_route53_zone.root.zone_id
  name    = var.domain
  type    = "TXT"
  ttl     = 3600
  records = ["v=spf1 include:_spf.google.com ~all"]
}

# SES sending domain (spec 20). Each environment adds its own identity and DKIM CNAMEs.
resource "aws_route53_record" "mail_spf" {
  zone_id = aws_route53_zone.root.zone_id
  name    = local.mail_domain
  type    = "TXT"
  ttl     = 3600
  records = [local.ses_spf]
}

resource "aws_route53_record" "mail_dmarc" {
  zone_id = aws_route53_zone.root.zone_id
  name    = "_dmarc.${local.mail_domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DMARC1; p=quarantine; rua=mailto:${var.dmarc_report_address}"]
}

resource "aws_route53_record" "bounce_mx" {
  zone_id = aws_route53_zone.root.zone_id
  name    = local.mail_from_domain
  type    = "MX"
  ttl     = 3600
  records = ["10 feedback-smtp.${local.ses_region}.amazonses.com"]
}

resource "aws_route53_record" "bounce_spf" {
  zone_id = aws_route53_zone.root.zone_id
  name    = local.mail_from_domain
  type    = "TXT"
  ttl     = 3600
  records = [local.ses_spf]
}

# --- Role that environments assume to write their own records ---

resource "aws_iam_role" "dns_records" {
  name                 = "quad-dns-records"
  description          = "Writes an environment's own records in ${var.domain}; assumed from the named accounts."
  assume_role_policy   = local.dns_role_trust
  max_session_duration = 3600

  tags = { service = "dns" }
}

resource "aws_iam_role_policy" "dns_records" {
  name   = "dns-records"
  role   = aws_iam_role.dns_records.id
  policy = local.dns_role_policy
}

# --- GitHub OIDC and the pull request plan role for this root ---

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://${local.github_oidc_host}"
  client_id_list = ["sts.amazonaws.com"]

  tags = { service = "ci" }
}

resource "aws_iam_role" "tooling_plan" {
  name                 = "quad-tooling-plan"
  description          = "terraform plan for infra/envs/global from this repository's pull requests."
  assume_role_policy   = local.tooling_plan_trust
  max_session_duration = 3600

  tags = { service = "ci" }
}

resource "aws_iam_role_policy_attachment" "tooling_plan_read_only" {
  role       = aws_iam_role.tooling_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

resource "aws_iam_role_policy" "tooling_plan_state" {
  name   = "assume-state-role"
  role   = aws_iam_role.tooling_plan.id
  policy = local.tooling_plan_state_policy
}
