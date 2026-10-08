output "alb_security_group_id" {
  description = "The ALB's security group; the app module's task group admits it on the task ports."
  value       = aws_security_group.alb.id
}

output "alb_dns_name" {
  description = "The ALB's DNS name, for the origin_domain alias record (dns module)."
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "The ALB's hosted zone id, for the origin_domain alias record."
  value       = aws_lb.this.zone_id
}

output "alb_arn_suffix" {
  description = "The ALB's ARN suffix, for CloudWatch metrics."
  value       = aws_lb.this.arn_suffix
}

output "target_group_arns" {
  description = "Target group ARNs by name: api, api_socket, staff and console."
  value       = { for key, group in aws_lb_target_group.this : key => group.arn }

  # ECS refuses to register a service with a target group that no listener uses yet, so the app
  # module's services must wait for the listener and its rules (Task 12 review).
  depends_on = [aws_lb_listener.https, aws_lb_listener_rule.route]
}

output "target_group_arn_suffixes" {
  description = "Target group ARN suffixes by name, for CloudWatch metrics."
  value       = { for key, group in aws_lb_target_group.this : key => group.arn_suffix }
}

output "cloudfront_domain_name" {
  description = "The distribution's domain name, for the web and console alias records."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront's hosted zone id, for alias records."
  value       = aws_cloudfront_distribution.this.hosted_zone_id
}

output "cloudfront_distribution_id" {
  description = "The distribution id."
  value       = aws_cloudfront_distribution.this.id
}

output "cloudfront_distribution_arn" {
  description = "The distribution ARN; the environment root passes it to the data module's cloudfront_distribution_arns so CloudFront can decrypt the public bucket's objects."
  value       = aws_cloudfront_distribution.this.arn
}

output "waf_web_acl_name" {
  description = "The WAF web ACL's name (us-east-1), for the dashboard's BlockedRequests widget."
  value       = aws_wafv2_web_acl.this.name
}

output "cloudfront_aliases" {
  description = "The hosts the distribution answers for (web_domain and console_domain)."
  value       = aws_cloudfront_distribution.this.aliases
}
