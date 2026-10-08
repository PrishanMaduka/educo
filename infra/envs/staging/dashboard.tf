# The starter dashboard (spec 18 M0b, D28): a CloudWatch dashboard kept as code under
# infra/observability/, until the Grafana Cloud account exists.
resource "aws_cloudwatch_dashboard" "overview" {
  dashboard_name = "${local.name}-overview"
  dashboard_body = templatefile("${path.module}/../../observability/cloudwatch/overview.json.tftpl", {
    name                       = local.name
    region                     = "ap-south-1"
    alb_arn_suffix             = module.edge.alb_arn_suffix
    target_groups              = module.edge.target_group_arn_suffixes
    cluster_name               = module.app.cluster_name
    service_names              = module.app.ecs_service_names_for_dashboard
    rds_instance_id            = module.data.rds_instance_id
    redis_replication_group_id = module.data.redis_replication_group_id
    waf_web_acl_name           = module.edge.waf_web_acl_name
  })
}
