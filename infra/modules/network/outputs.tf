output "vpc_id" {
  description = "The VPC id."
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "The VPC's IPv4 CIDR block."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet ids, one per zone, in var.azs order (ALB and NAT gateways)."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet ids, one per zone, in var.azs order (tasks, RDS, Redis, endpoints)."
  value       = aws_subnet.private[*].id
}

output "endpoints_security_group_id" {
  description = "The interface endpoints' security group, for egress rules that must reach them (the RDS Proxy's Secrets Manager calls)."
  value       = aws_security_group.endpoints.id
}
