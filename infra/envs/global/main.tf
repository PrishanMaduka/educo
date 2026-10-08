locals {
  mail_domain      = "mail.${var.domain}"
  mail_from_domain = "bounce.${local.mail_domain}"
  ses_region       = "ap-south-1"
  # Only SES sends as mail. and bounce.mail., so anything else fails SPF outright.
  ses_spf = "v=spf1 include:amazonses.com -all"
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

# The status page provider (status.<domain>) will need its own CAA record naming its issuer.
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

# Monitoring only until the Google Workspace mail streams are confirmed aligned.
resource "aws_route53_record" "apex_dmarc" {
  zone_id = aws_route53_zone.root.zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DMARC1; p=none; rua=mailto:${var.dmarc_report_address}"]
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
