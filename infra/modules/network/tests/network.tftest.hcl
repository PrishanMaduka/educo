# The staging VPC, checked offline with a mocked AWS provider (infra/tests/mocks/aws).

mock_provider "aws" {
  source = "../../tests/mocks/aws"
}

variables {
  name = "quad-staging"
}

run "three_public_and_three_private_subnets_across_three_zones" {
  command = apply

  assert {
    condition     = length(aws_subnet.public) == 3 && length(aws_subnet.private) == 3
    error_message = "The VPC must have three public and three private subnets."
  }

  assert {
    condition     = length(distinct(aws_subnet.public[*].availability_zone)) == 3 && length(distinct(aws_subnet.private[*].availability_zone)) == 3
    error_message = "The public and the private subnets must each span three distinct zones."
  }

  assert {
    condition     = alltrue([for s in concat(aws_subnet.public, aws_subnet.private) : s.vpc_id == aws_vpc.this.id])
    error_message = "Every subnet must be in the module's VPC."
  }

  assert {
    condition     = length(distinct(concat(aws_subnet.public[*].cidr_block, aws_subnet.private[*].cidr_block))) == 6
    error_message = "The six subnets must not overlap."
  }

  assert {
    condition     = output.vpc_cidr == "10.40.0.0/16" && output.private_subnet_ids == aws_subnet.private[*].id && output.public_subnet_ids == aws_subnet.public[*].id
    error_message = "The outputs must expose the VPC CIDR and the subnet ids."
  }
}

run "no_subnet_hands_out_public_addresses" {
  command = apply

  assert {
    condition     = alltrue([for s in aws_subnet.private : s.map_public_ip_on_launch == false])
    error_message = "Private subnets must not map public IPs on launch."
  }

  # The ALB and the NAT gateways get their addresses explicitly; nothing else is public.
  assert {
    condition     = alltrue([for s in aws_subnet.public : s.map_public_ip_on_launch == false])
    error_message = "Public subnets must not map public IPs on launch either."
  }
}

run "one_nat_gateway_carries_all_private_egress" {
  command = apply

  assert {
    condition     = length(aws_nat_gateway.this) == 1 && length(aws_eip.nat) == 1
    error_message = "nat_gateway_count = 1 must give exactly one NAT gateway and one Elastic IP."
  }

  assert {
    condition     = contains(aws_subnet.public[*].id, aws_nat_gateway.this[0].subnet_id)
    error_message = "The NAT gateway must sit in a public subnet."
  }

  # The API reaches sns.<region>.amazonaws.com (the SES webhook's certificate and SubscribeURL)
  # and other public AWS endpoints through this route.
  assert {
    condition = alltrue([for r in aws_route.private_default :
    r.destination_cidr_block == "0.0.0.0/0" && r.nat_gateway_id == aws_nat_gateway.this[0].id])
    error_message = "Every private route table must send its default route to the NAT gateway."
  }

  assert {
    condition     = length(aws_route.private_default) == 3 && length(distinct(aws_route_table_association.private[*].route_table_id)) == 3
    error_message = "Each private subnet must have its own route table with a default route."
  }

  assert {
    condition     = aws_route.public_default.gateway_id == aws_internet_gateway.this.id && aws_route.public_default.destination_cidr_block == "0.0.0.0/0"
    error_message = "The public route table must send its default route to the internet gateway."
  }
}

run "three_nat_gateways_spread_one_per_zone" {
  command = apply

  variables {
    nat_gateway_count = 3
  }

  assert {
    condition     = length(aws_nat_gateway.this) == 3 && length(distinct(aws_nat_gateway.this[*].subnet_id)) == 3
    error_message = "nat_gateway_count = 3 must give one NAT gateway in each public subnet."
  }

  assert {
    condition     = alltrue([for i, r in aws_route.private_default : r.nat_gateway_id == aws_nat_gateway.this[i].id])
    error_message = "Each private route table must use the NAT gateway in its own zone."
  }
}

run "nat_gateway_count_must_fit_the_zones" {
  command = plan

  variables {
    nat_gateway_count = 4
  }

  expect_failures = [var.nat_gateway_count]
}

run "default_security_group_allows_nothing" {
  command = apply

  assert {
    condition     = aws_default_security_group.this.vpc_id == aws_vpc.this.id
    error_message = "The module must manage the VPC's default security group."
  }

  assert {
    condition     = length(aws_default_security_group.this.ingress) == 0 && length(aws_default_security_group.this.egress) == 0
    error_message = "The default security group must have no ingress and no egress rules."
  }
}

run "endpoints_stay_inside_the_vpc" {
  command = apply

  assert {
    condition     = aws_vpc_endpoint.s3.vpc_endpoint_type == "Gateway" && aws_vpc_endpoint.s3.service_name == "com.amazonaws.ap-south-1.s3"
    error_message = "S3 must be reached through a gateway endpoint."
  }

  assert {
    condition     = toset(aws_vpc_endpoint.s3.route_table_ids) == toset(aws_route_table.private[*].id)
    error_message = "The S3 gateway endpoint must be on every private route table."
  }

  assert {
    # Ruling R-endpoints: no ssm endpoint (nothing in a task reads SSM; the deploy workflow does).
    condition     = toset(keys(aws_vpc_endpoint.interface)) == toset(["ecr.api", "ecr.dkr", "secretsmanager", "logs"])
    error_message = "The interface endpoints must be ECR (api and dkr), Secrets Manager and Logs."
  }

  assert {
    condition = alltrue([for k, e in aws_vpc_endpoint.interface :
      e.vpc_endpoint_type == "Interface" && e.private_dns_enabled && e.service_name == "com.amazonaws.ap-south-1.${k}" &&
    toset(e.subnet_ids) == toset(aws_subnet.private[*].id) && toset(e.security_group_ids) == toset([aws_security_group.endpoints.id])])
    error_message = "Every interface endpoint must use private DNS, the private subnets and the endpoint security group."
  }

  assert {
    condition = (
      aws_vpc_security_group_ingress_rule.endpoints_https.security_group_id == aws_security_group.endpoints.id &&
      aws_vpc_security_group_ingress_rule.endpoints_https.cidr_ipv4 == "10.40.0.0/16" &&
      aws_vpc_security_group_ingress_rule.endpoints_https.from_port == 443 &&
      aws_vpc_security_group_ingress_rule.endpoints_https.to_port == 443 &&
      aws_vpc_security_group_ingress_rule.endpoints_https.ip_protocol == "tcp"
    )
    error_message = "The endpoint security group must allow only HTTPS from the VPC CIDR."
  }

  assert {
    condition     = length(aws_security_group.endpoints.ingress) == 0 && length(aws_security_group.endpoints.egress) == 0
    error_message = "The endpoint security group must have no inline rules (and so no default egress)."
  }

  assert {
    condition     = output.endpoints_security_group_id == aws_security_group.endpoints.id
    error_message = "endpoints_security_group_id must be the endpoint security group (the data module's proxy egress uses it)."
  }
}

# Ruling R-endpoints: staging puts the interface endpoints in one zone (about USD 32 a month).
run "endpoints_can_sit_in_fewer_zones" {
  command = apply

  variables {
    endpoint_subnet_count = 1
  }

  assert {
    condition     = alltrue([for e in aws_vpc_endpoint.interface : toset(e.subnet_ids) == toset([aws_subnet.private[0].id])])
    error_message = "endpoint_subnet_count = 1 must put every interface endpoint in the first private subnet only."
  }

  assert {
    condition     = jsonencode(output.endpoint_subnet_ids) == jsonencode([aws_subnet.private[0].id])
    error_message = "endpoint_subnet_ids must name the subnets that hold the interface endpoints."
  }

  assert {
    condition     = toset(aws_vpc_endpoint.s3.route_table_ids) == toset(aws_route_table.private[*].id)
    error_message = "The S3 gateway endpoint must still serve every private route table."
  }
}

run "endpoint_subnet_count_must_fit_the_zones" {
  command = plan

  variables {
    endpoint_subnet_count = 4
  }

  expect_failures = [var.endpoint_subnet_count]
}

run "flow_logs_go_to_an_encrypted_log_group" {
  command = apply

  assert {
    condition     = aws_flow_log.this.vpc_id == aws_vpc.this.id && aws_flow_log.this.traffic_type == "ALL" && aws_flow_log.this.max_aggregation_interval == 600
    error_message = "The VPC must log all flows, aggregated every 600 s by default."
  }

  assert {
    condition     = aws_flow_log.this.log_destination == aws_cloudwatch_log_group.flow_logs.arn && aws_flow_log.this.iam_role_arn == aws_iam_role.flow_logs.arn
    error_message = "Flow logs must go to the module's log group through the module's role."
  }

  assert {
    condition     = aws_cloudwatch_log_group.flow_logs.retention_in_days == 30 && aws_cloudwatch_log_group.flow_logs.kms_key_id == aws_kms_key.flow_logs.arn
    error_message = "The flow log group must keep 30 days and use the flow log KMS key."
  }

  assert {
    condition     = aws_kms_key.flow_logs.enable_key_rotation
    error_message = "The flow log KMS key must rotate."
  }

  assert {
    condition = alltrue([for s in jsondecode(aws_iam_role.flow_logs.assume_role_policy).Statement :
    s.Principal == { Service = "vpc-flow-logs.amazonaws.com" } && s.Condition.StringEquals["aws:SourceAccount"] == "123456789012"])
    error_message = "Only VPC Flow Logs in this account may assume the flow log role."
  }

  assert {
    condition = alltrue([for s in jsondecode(aws_iam_role_policy.flow_logs.policy).Statement :
    alltrue([for r in flatten([s.Resource]) : startswith(r, "${aws_cloudwatch_log_group.flow_logs.arn}")])])
    error_message = "The flow log role may write only to its own log group."
  }
}

run "flow_log_aggregation_is_60_or_600_seconds" {
  command = plan

  variables {
    flow_log_aggregation_interval = 120
  }

  expect_failures = [var.flow_log_aggregation_interval]
}

run "every_resource_names_its_service" {
  command = apply

  assert {
    condition = alltrue([for t in concat(
      [aws_vpc.this.tags, aws_internet_gateway.this.tags, aws_flow_log.this.tags, aws_security_group.endpoints.tags],
      aws_subnet.public[*].tags, aws_subnet.private[*].tags, aws_nat_gateway.this[*].tags,
    ) : t.service == "network"])
    error_message = "Every network resource must carry service = network."
  }
}
