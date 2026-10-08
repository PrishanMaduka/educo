output "cloudfront_domain_name" {
  description = "The distribution's domain name (staging.quad-edu.com and console.staging.quad-edu.com alias it)."
  value       = module.edge.cloudfront_domain_name
}

output "deploy_role_arn" {
  description = "GitHub variable AWS_STAGING_DEPLOY_ROLE_ARN."
  value       = module.app.deploy_role_arn
}

output "plan_role_arn" {
  description = "GitHub variable AWS_STAGING_PLAN_ROLE_ARN; also bootstrap's state_environments.staging.plan_principal_arns and global's dns_reader_principal_arns."
  value       = module.app.plan_role_arn
}

output "apply_role_arn" {
  description = "GitHub variable AWS_STAGING_APPLY_ROLE_ARN; also bootstrap's state_environments.staging.apply_principal_arns and global's dns_writer_principal_arns.staging."
  value       = module.app.apply_role_arn
}

output "ecr_repository_urls" {
  description = "ECR repository URLs by image: api, staff, console and clamav."
  value       = module.app.ecr_repository_urls
}

output "name_servers_note" {
  description = "Where the quad-edu.com name servers come from."
  value       = "NS records live in envs/global"
}
