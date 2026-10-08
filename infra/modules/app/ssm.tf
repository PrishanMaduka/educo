# Deploy settings for the staging deploy workflow (D28): the workflow assumes the deploy role and
# reads these, so no AWS id lives in GitHub variables. Plain String parameters: none is a secret.

locals {
  deploy_parameter_prefix = "/quad/${var.environment}/deploy"

  deploy_parameters = {
    cluster      = aws_ecs_cluster.this.name
    subnets      = join(",", var.private_subnet_ids)
    ecr_registry = local.ecr_registry
    # The one-off tasks use the database, so they get the tasks and data client groups.
    security_groups = join(",", local.security_groups["migrate"])
    services        = jsonencode({ for key, service in aws_ecs_service.this : key => service.name })
    task_families   = jsonencode(local.task_families)
  }
}

resource "aws_ssm_parameter" "deploy" {
  #checkov:skip=CKV2_AWS_34:Deploy settings (names, ids and a registry host) are not secrets, so they need no KMS key.
  for_each = local.deploy_parameters

  name        = "${local.deploy_parameter_prefix}/${each.key}"
  description = "Deploy setting ${each.key} for the ${var.environment} deploy workflow"
  type        = "String"
  value       = each.value

  tags = { service = "ci" }
}
