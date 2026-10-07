# CloudFront is the only public entry (spec 20 → Edge, D14). One distribution serves both hosts:
#   /api/v1/* and /socket.io/*  → ALB, uncached, every viewer header (Host and the WebSocket
#                                 upgrade headers included), cookie and query string, all methods;
#   /_next/static/*             → ALB, cached per host (hashed file names);
#   /assets/*                   → the public bucket through origin access control, cached;
#   everything else             → ALB, uncached, as for the API.
# No edge function sits in the chain, so the API sees exactly two proxies (TRUST_PROXY_HOPS=2).

locals {
  # AWS managed policies, by their published ids (CloudFront Developer Guide, "Use managed cache
  # policies" and "Use managed origin request policies"). These ids are the same in every account.
  #   CachingDisabled  - no caching, nothing in the cache key;
  #   CachingOptimized - long TTLs, compressed objects, no cookies or query strings in the key;
  #   AllViewer        - every viewer header (Host and the WebSocket upgrade headers included),
  #                      cookie and query string goes to the origin.
  managed_cache_policy_caching_disabled    = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  managed_cache_policy_caching_optimized   = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  managed_origin_request_policy_all_viewer = "216adef6-5c7f-47e4-b989-5492eafa07d3"

  all_methods    = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
  cached_methods = ["GET", "HEAD"]

  # In CloudFront's precedence order. cache = null means uncached with every viewer value.
  ordered_behaviours = [
    { path = "/api/v1/*", origin = "alb", cache = null },
    { path = "/socket.io/*", origin = "alb", cache = null },
    { path = "/_next/static/*", origin = "alb", cache = aws_cloudfront_cache_policy.static.id },
    { path = "/assets/*", origin = "assets", cache = local.managed_cache_policy_caching_optimized },
  ]

  public_bucket_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontRead"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${var.public_bucket_arn}/*"
        Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.this.arn } }
      },
      {
        Sid       = "DenyRequestsWithoutTls"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [var.public_bucket_arn, "${var.public_bucket_arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
    ]
  })
}

# Next's static files: CachingOptimized's settings plus the Host header in the cache key. Both
# hosts serve /_next/static/* from the same ALB, and only the Host header (which a cache key
# header also forwards) lets rule 20 send console files to the console; without it the ALB sees
# origin_domain and every file comes from staff, cached once for both hosts.
resource "aws_cloudfront_cache_policy" "static" {
  name        = "${var.name}-static"
  comment     = "CachingOptimized, keyed by host"
  min_ttl     = 1
  default_ttl = 86400
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "whitelist"

      headers {
        items = ["Host"]
      }
    }

    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "assets" {
  name                              = "${var.name}-assets"
  description                       = "CloudFront reads the public assets bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# HSTS for every response, and on staging X-Robots-Tag as a second layer behind the apps' own
# header (override = false keeps theirs). Nothing is removed from origin responses.
resource "aws_cloudfront_response_headers_policy" "this" {
  name    = "${var.name}-headers"
  comment = "HSTS${var.noindex ? " and noindex" : ""}"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
  }

  dynamic "custom_headers_config" {
    for_each = var.noindex ? [1] : []

    content {
      items {
        header   = "X-Robots-Tag"
        value    = "noindex, nofollow"
        override = false
      }
    }
  }
}

resource "aws_cloudfront_distribution" "this" {
  #checkov:skip=CKV_AWS_86:staging; production logging arrives in M12.
  #checkov:skip=CKV_AWS_310:One ALB origin in one region; origin failover arrives with production (M12) if a second region does.
  #checkov:skip=CKV_AWS_374:The geo block list lives in WAF (geo_block_countries), kept empty by default (spec 20).
  #checkov:skip=CKV_AWS_305:No default root object: the staff app serves / itself.
  enabled         = true
  is_ipv6_enabled = true
  comment         = var.name
  aliases         = [var.web_domain, var.console_domain]
  http_version    = "http2and3"
  price_class     = "PriceClass_200"
  web_acl_id      = aws_wafv2_web_acl.this.arn

  origin {
    origin_id   = "alb"
    domain_name = var.origin_domain

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 60
    }

    custom_header {
      name  = local.origin_secret_header
      value = random_password.origin_secret.result
    }
  }

  origin {
    origin_id                = "assets"
    domain_name              = var.public_bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.assets.id
  }

  dynamic "ordered_cache_behavior" {
    for_each = local.ordered_behaviours

    content {
      path_pattern               = ordered_cache_behavior.value.path
      target_origin_id           = ordered_cache_behavior.value.origin
      viewer_protocol_policy     = "redirect-to-https"
      compress                   = true
      allowed_methods            = ordered_cache_behavior.value.cache == null ? local.all_methods : local.cached_methods
      cached_methods             = local.cached_methods
      cache_policy_id            = coalesce(ordered_cache_behavior.value.cache, local.managed_cache_policy_caching_disabled)
      origin_request_policy_id   = ordered_cache_behavior.value.cache == null ? local.managed_origin_request_policy_all_viewer : null
      response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id
    }
  }

  default_cache_behavior {
    target_origin_id           = "alb"
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
    allowed_methods            = local.all_methods
    cached_methods             = local.cached_methods
    cache_policy_id            = local.managed_cache_policy_caching_disabled
    origin_request_policy_id   = local.managed_origin_request_policy_all_viewer
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cloudfront.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = merge(local.tags, { Name = var.name })
}

# The public bucket's policy (the data module leaves it to edge): only this distribution may read
# objects, and every request without TLS is refused.
resource "aws_s3_bucket_policy" "public" {
  bucket = var.public_bucket_id
  policy = local.public_bucket_policy
}
