# Two certificates (spec 20 → DNS and certificates): one in us-east-1 for CloudFront's viewers,
# and one in ap-south-1 for the ALB. CloudFront forwards the viewer's Host header (the AllViewer
# origin request policy, which the console host rule and Socket.IO need), and it then checks the
# origin's certificate against that host, not against origin_domain. So the ALB certificate names
# origin_domain and both public hosts.
#
# ACM gives a domain the same validation record for every certificate the account requests, in
# any region, so one record per name validates both certificates. The CloudFront validation checks
# that before waiting, rather than timing out on a record that was never written.

locals {
  certificate_names = [var.origin_domain, var.web_domain, var.console_domain]

  origin_validation_records = toset([
    for option in aws_acm_certificate.origin.domain_validation_options :
    "${option.resource_record_type} ${option.resource_record_name} ${option.resource_record_value}"
  ])
}

resource "aws_acm_certificate" "cloudfront" {
  provider = aws.us_east_1

  domain_name               = var.web_domain
  subject_alternative_names = [var.console_domain]
  validation_method         = "DNS"
  key_algorithm             = "RSA_2048"

  tags = merge(local.tags, { Name = "${var.name}-cloudfront" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate" "origin" {
  domain_name               = var.origin_domain
  subject_alternative_names = [var.web_domain, var.console_domain]
  validation_method         = "DNS"
  key_algorithm             = "RSA_2048"

  tags = merge(local.tags, { Name = "${var.name}-origin" })

  lifecycle {
    create_before_destroy = true
  }
}

# Keyed by name, which is known at plan time; the record itself comes from the certificate.
resource "aws_route53_record" "validation" {
  provider = aws.dns
  for_each = toset(local.certificate_names)

  zone_id = var.zone_id
  name    = one([for option in aws_acm_certificate.origin.domain_validation_options : option.resource_record_name if option.domain_name == each.key])
  type    = one([for option in aws_acm_certificate.origin.domain_validation_options : option.resource_record_type if option.domain_name == each.key])
  records = [one([for option in aws_acm_certificate.origin.domain_validation_options : option.resource_record_value if option.domain_name == each.key])]
  ttl     = 300

  # The record can already exist, for example from an earlier certificate for the same name; it
  # has the same value, so taking it over is safe.
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "origin" {
  certificate_arn         = aws_acm_certificate.origin.arn
  validation_record_fqdns = [for name in local.certificate_names : aws_route53_record.validation[name].fqdn]
}

resource "aws_acm_certificate_validation" "cloudfront" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.cloudfront.arn
  validation_record_fqdns = [for name in [var.web_domain, var.console_domain] : aws_route53_record.validation[name].fqdn]

  lifecycle {
    precondition {
      condition = alltrue([
        for option in aws_acm_certificate.cloudfront.domain_validation_options :
        contains(local.origin_validation_records, "${option.resource_record_type} ${option.resource_record_name} ${option.resource_record_value}")
      ])
      error_message = "The CloudFront certificate's validation records differ from the origin certificate's, so the records this module writes cannot validate it."
    }
  }
}
