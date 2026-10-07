# Shared mock values for `mock_provider "aws"` in every `terraform test` under infra/.
# A mocked provider invents random strings for computed attributes; the ones below feed arguments
# whose format the provider checks (ARNs, URLs, ids), so they get valid example values instead.
# The account is the documentation example 123456789012. Add an entry whenever `terraform test`
# reports an invalid mock value.

# --- IAM and KMS ---

mock_resource "aws_iam_role" {
  defaults = {
    arn       = "arn:aws:iam::123456789012:role/mock-role"
    unique_id = "AROAMOCKMOCKMOCKMOCK1"
  }
}

mock_resource "aws_iam_policy" {
  defaults = {
    arn = "arn:aws:iam::123456789012:policy/mock-policy"
  }
}

mock_resource "aws_iam_openid_connect_provider" {
  defaults = {
    arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
  }
}

mock_resource "aws_kms_key" {
  defaults = {
    arn    = "arn:aws:kms:ap-south-1:123456789012:key/00000000-0000-4000-8000-000000000000"
    key_id = "00000000-0000-4000-8000-000000000000"
  }
}

# --- Storage, logs and secrets ---

mock_resource "aws_s3_bucket" {
  defaults = {
    arn                         = "arn:aws:s3:::mock-bucket"
    bucket_domain_name          = "mock-bucket.s3.amazonaws.com"
    bucket_regional_domain_name = "mock-bucket.s3.ap-south-1.amazonaws.com"
  }
}

mock_resource "aws_dynamodb_table" {
  defaults = {
    arn = "arn:aws:dynamodb:ap-south-1:123456789012:table/mock-table"
  }
}

mock_resource "aws_secretsmanager_secret" {
  defaults = {
    arn = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:mock-secret-AbCdEf"
  }
}

mock_resource "aws_cloudwatch_log_group" {
  defaults = {
    arn = "arn:aws:logs:ap-south-1:123456789012:log-group:mock-log-group"
  }
}

# --- Databases and caches ---

mock_resource "aws_db_instance" {
  defaults = {
    arn     = "arn:aws:rds:ap-south-1:123456789012:db:mock-db"
    address = "mock-db.c0mockmockmo.ap-south-1.rds.amazonaws.com"
    master_user_secret = [{
      kms_key_id    = "arn:aws:kms:ap-south-1:123456789012:key/00000000-0000-4000-8000-000000000000"
      secret_arn    = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:rds!db-00000000-0000-4000-8000-000000000000-AbCdEf"
      secret_status = "active"
    }]
  }
}

mock_resource "aws_db_proxy" {
  defaults = {
    arn      = "arn:aws:rds:ap-south-1:123456789012:db-proxy:prx-0123456789abcdef0"
    endpoint = "mock-db.proxy-c0mockmockmo.ap-south-1.rds.amazonaws.com"
  }
}

# RDS requires the target group name to start with a letter; the real value is always "default".
mock_resource "aws_db_proxy_default_target_group" {
  defaults = {
    name = "default"
  }
}

mock_resource "aws_elasticache_replication_group" {
  defaults = {
    arn                      = "arn:aws:elasticache:ap-south-1:123456789012:replicationgroup:mock-redis"
    primary_endpoint_address = "master.mock-redis.abcdef.aps1.cache.amazonaws.com"
  }
}

# --- Messaging ---

mock_resource "aws_sns_topic" {
  defaults = {
    arn = "arn:aws:sns:ap-south-1:123456789012:mock-topic"
  }
}

# --- Load balancing, certificates and edge ---

mock_resource "aws_lb" {
  defaults = {
    arn        = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:loadbalancer/app/mock-alb/0123456789abcdef"
    arn_suffix = "app/mock-alb/0123456789abcdef"
    dns_name   = "mock-alb-123456789.ap-south-1.elb.amazonaws.com"
    zone_id    = "ZP97RAFLXTNZK"
  }
}

mock_resource "aws_lb_target_group" {
  defaults = {
    arn        = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:targetgroup/mock-tg/0123456789abcdef"
    arn_suffix = "targetgroup/mock-tg/0123456789abcdef"
  }
}

mock_resource "aws_lb_listener" {
  defaults = {
    arn = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:listener/app/mock-alb/0123456789abcdef/0123456789abcdef"
  }
}

mock_resource "aws_acm_certificate" {
  defaults = {
    arn = "arn:aws:acm:ap-south-1:123456789012:certificate/00000000-0000-4000-8000-000000000000"
  }
}

mock_resource "aws_cloudfront_distribution" {
  defaults = {
    arn            = "arn:aws:cloudfront::123456789012:distribution/EMOCKDISTRIBUTION"
    id             = "EMOCKDISTRIBUTION"
    domain_name    = "d111111abcdef8.cloudfront.net"
    hosted_zone_id = "Z2FDTNDATAQYW2"
  }
}

mock_resource "aws_wafv2_web_acl" {
  defaults = {
    arn = "arn:aws:wafv2:us-east-1:123456789012:global/webacl/mock-acl/00000000-0000-4000-8000-000000000000"
  }
}

# --- Containers ---

mock_resource "aws_ecs_cluster" {
  defaults = {
    arn = "arn:aws:ecs:ap-south-1:123456789012:cluster/mock-cluster"
  }
}

mock_resource "aws_ecs_task_definition" {
  defaults = {
    arn                  = "arn:aws:ecs:ap-south-1:123456789012:task-definition/mock-task:1"
    arn_without_revision = "arn:aws:ecs:ap-south-1:123456789012:task-definition/mock-task"
    revision             = 1
  }
}

mock_resource "aws_ecs_service" {
  defaults = {
    arn = "arn:aws:ecs:ap-south-1:123456789012:service/mock-cluster/mock-service"
  }
}

mock_resource "aws_service_discovery_private_dns_namespace" {
  defaults = {
    arn         = "arn:aws:servicediscovery:ap-south-1:123456789012:namespace/ns-0123456789abcdef"
    id          = "ns-0123456789abcdef"
    hosted_zone = "Z0123456789MOCKNS"
  }
}

mock_resource "aws_service_discovery_service" {
  defaults = {
    arn = "arn:aws:servicediscovery:ap-south-1:123456789012:service/srv-0123456789abcdef"
    id  = "srv-0123456789abcdef"
  }
}

mock_resource "aws_ecr_repository" {
  defaults = {
    arn            = "arn:aws:ecr:ap-south-1:123456789012:repository/mock/repository"
    repository_url = "123456789012.dkr.ecr.ap-south-1.amazonaws.com/mock/repository"
    registry_id    = "123456789012"
  }
}

# --- DNS ---

mock_resource "aws_route53_zone" {
  defaults = {
    zone_id      = "Z0123456789MOCKZONE"
    arn          = "arn:aws:route53:::hostedzone/Z0123456789MOCKZONE"
    name_servers = ["ns-1.awsdns-01.org", "ns-2.awsdns-02.co.uk", "ns-3.awsdns-03.com", "ns-4.awsdns-04.net"]
  }
}

# --- Data sources ---

mock_data "aws_caller_identity" {
  defaults = {
    account_id = "123456789012"
    arn        = "arn:aws:iam::123456789012:user/mock"
    user_id    = "AIDAMOCKMOCKMOCKMOCK1"
  }
}

mock_data "aws_region" {
  defaults = {
    name   = "ap-south-1"
    region = "ap-south-1"
  }
}

mock_data "aws_partition" {
  defaults = {
    partition  = "aws"
    dns_suffix = "amazonaws.com"
  }
}

mock_data "aws_route53_zone" {
  defaults = {
    zone_id = "Z0123456789MOCKZONE"
    arn     = "arn:aws:route53:::hostedzone/Z0123456789MOCKZONE"
    name    = "quad-edu.com"
  }
}

mock_data "aws_ec2_managed_prefix_list" {
  defaults = {
    id  = "pl-0123456789abcdef0"
    arn = "arn:aws:ec2:ap-south-1:aws:prefix-list/pl-0123456789abcdef0"
  }
}
