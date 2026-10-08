# One repository per image (spec 20, D28): the api image also runs the worker and the one-off
# tasks. Tags are immutable, so a tag always means one image, and every push is scanned. The
# AWS-managed ECR key encrypts the layers; ECR grants itself its use, so pulls and pushes need no
# KMS permission.

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  partition  = data.aws_partition.current.partition
  region     = data.aws_region.current.region

  repositories = {
    api     = "quad/api"
    staff   = "quad/staff"
    console = "quad/console"
    clamav  = "quad/clamav"
  }

  ecr_registry = "${local.account_id}.dkr.ecr.${local.region}.amazonaws.com"

  keep_last_30_images = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 30 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 30
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_ecr_repository" "this" {
  for_each = local.repositories

  name                 = each.value
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = { service = each.key }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = local.repositories

  repository = aws_ecr_repository.this[each.key].name
  policy     = local.keep_last_30_images
}
