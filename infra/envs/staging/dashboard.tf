# The starter dashboard (spec 18 M0b, D28): a CloudWatch dashboard kept as code under
# infra/observability/, until the Grafana Cloud account exists.
data "aws_region" "current" {}

resource "aws_cloudwatch_dashboard" "overview" {
  dashboard_name = "${local.name}-overview"
  dashboard_body = templatefile("${path.module}/../../observability/cloudwatch/overview.json.tftpl", {
    name                  = local.name
    region                = data.aws_region.current.region
    alb_arn_suffix        = module.edge.alb_arn_suffix
    target_groups         = module.edge.target_group_arn_suffixes
    cluster_name          = module.app.cluster_name
    service_names         = module.app.ecs_service_names_for_dashboard
    rds_instance_id       = module.data.rds_instance_id
    redis_member_clusters = module.data.redis_member_clusters
    waf_web_acl_name      = module.edge.waf_web_acl_name
  })
}
