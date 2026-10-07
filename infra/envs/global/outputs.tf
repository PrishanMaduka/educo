output "zone_id" {
  description = "Route 53 zone id of quad-edu.com."
  value       = aws_route53_zone.root.zone_id
}

output "name_servers" {
  description = "The four name servers to set at the registrar for quad-edu.com."
  value       = aws_route53_zone.root.name_servers
}

output "dns_role_arn" {
  description = "Role environments assume to write their own records (the TF_DNS_ROLE_ARN GitHub variable)."
  value       = aws_iam_role.dns_records.arn
}

output "tooling_plan_role_arn" {
  description = "Role pull requests assume to plan this root (the AWS_TOOLING_PLAN_ROLE_ARN GitHub variable)."
  value       = aws_iam_role.tooling_plan.arn
}
