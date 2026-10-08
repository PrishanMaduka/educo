# The public names (spec 20 → DNS and certificates). The staff portal and the console alias the
# CloudFront distribution over IPv4 and IPv6; origin_domain aliases the ALB, which only CloudFront
# can reach (it refuses requests without the origin secret header). Each record is A or AAAA under
# staging.quad-edu.com, so it stays inside the quad-dns-records-staging role's allow-list.

locals {
  cloudfront_records = {
    for pair in setproduct([var.web_domain, var.console_domain], ["A", "AAAA"]) :
    "${pair[0]} ${pair[1]}" => { name = pair[0], type = pair[1] }
  }
}

resource "aws_route53_record" "cloudfront" {
  provider = aws.dns
  for_each = local.cloudfront_records

  zone_id = var.zone_id
  name    = each.value.name
  type    = each.value.type

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "origin" {
  provider = aws.dns

  zone_id = var.zone_id
  name    = var.origin_domain
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}
