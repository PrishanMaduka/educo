output "zone_id" {
  description = "Route 53 zone id of quad-edu.com."
  value       = aws_route53_zone.root.zone_id
}

output "name_servers" {
  description = "The four name servers to set at the registrar for quad-edu.com."
  value       = aws_route53_zone.root.name_servers
}

output "dns_write_role_arns" {
  description = "Per-environment roles applies assume to write their own records (TF_STAGING_DNS_WRITE_ROLE_ARN)."
  value       = { for name, role in aws_iam_role.dns_write : name => role.arn }
}

output "dns_read_role_arn" {
  description = "Role plans assume to read the zone (TF_DNS_READ_ROLE_ARN)."
  value       = aws_iam_role.dns_read.arn
}

output "tooling_plan_role_arn" {
  description = "Role pull requests assume to plan this root (the AWS_TOOLING_PLAN_ROLE_ARN GitHub variable)."
  value       = aws_iam_role.tooling_plan.arn
}
