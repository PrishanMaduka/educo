output "cluster_name" {
  description = "The ECS cluster name."
  value       = aws_ecs_cluster.this.name
}

output "service_names" {
  description = "ECS service names by service: api, worker, staff, console and clamav."
  value       = { for key, service in aws_ecs_service.this : key => service.name }
}

output "task_families" {
  description = "Task definition families by task, the one-off tasks (migrate, seed, db-bootstrap) included."
  value       = local.task_families
}

output "ecr_repository_urls" {
  description = "ECR repository URLs by image: api, staff, console and clamav."
  value       = { for key, repo in aws_ecr_repository.this : key => repo.repository_url }
}

output "deploy_role_arn" {
  description = "The deploy role (GitHub variable AWS_STAGING_DEPLOY_ROLE_ARN)."
  value       = aws_iam_role.deploy.arn
}

output "plan_role_arn" {
  description = "The Terraform plan role (AWS_STAGING_PLAN_ROLE_ARN); bootstrap's plan_principal_arns and global's dns_reader_principal_arns name it."
  value       = aws_iam_role.plan.arn
}

output "apply_role_arn" {
  description = "The Terraform apply role (AWS_STAGING_APPLY_ROLE_ARN); bootstrap's apply_principal_arns and global's dns_writer_principal_arns.staging name it."
  value       = aws_iam_role.apply.arn
}

output "tasks_security_group_id" {
  description = "The tasks security group."
  value       = aws_security_group.tasks.id
}

output "ecs_service_names_for_dashboard" {
  description = "ECS service names, in a stable order, for the dashboard's CPU and memory widgets."
  value       = [for key in sort(keys(aws_ecs_service.this)) : aws_ecs_service.this[key].name]
}

output "api_environment" {
  description = "The plain (non-secret) environment of the api's first task definition, by name. Secrets are ARNs in the task definition and never appear here."
  value       = { for variable in jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].environment : variable.name => variable.value }
}
