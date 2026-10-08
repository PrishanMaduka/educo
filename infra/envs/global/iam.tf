data "aws_caller_identity" "current" {}

locals {
  github_oidc_host = "token.actions.githubusercontent.com"

  # Read access every DNS role needs: the zone's records and tags, change status, and the zone
  # lookups by name (which IAM cannot scope to a resource).
  dns_read_statements = [
    {
      Sid      = "ReadZone"
      Effect   = "Allow"
      Action   = ["route53:ListResourceRecordSets", "route53:GetHostedZone", "route53:ListTagsForResource"]
      Resource = [aws_route53_zone.root.arn]
    },
    {
      Sid      = "WaitForChanges"
      Effect   = "Allow"
      Action   = ["route53:GetChange"]
      Resource = ["arn:aws:route53:::change/*"]
    },
    {
      Sid      = "FindZoneByName"
      Effect   = "Allow"
      Action   = ["route53:ListHostedZones", "route53:ListHostedZonesByName"]
      Resource = ["*"]
    },
  ]

  dns_write_trust = {
    for name, arns in var.dns_writer_principal_arns : name => jsonencode({
      Version = "2012-10-17"
      Statement = [{
        Sid       = "ApplyPrincipalsOnly"
        Effect    = "Allow"
        Principal = { AWS = distinct([for arn in arns : "arn:aws:iam::${split(":", arn)[4]}:root"]) }
        Action    = "sts:AssumeRole"
        Condition = { ArnEquals = { "aws:PrincipalArn" = arns } }
      }]
    })
  }

  # An environment writes only its own A, AAAA and CNAME records (aliases, ACM validation, DKIM).
  # ForAllValues passes when a key is missing, so each key also has a Null = false guard.
  dns_write_policy = {
    for name, _ in var.dns_writer_principal_arns : name => jsonencode({
      Version = "2012-10-17"
      Statement = concat([{
        Sid      = "WriteOwnRecords"
        Effect   = "Allow"
        Action   = ["route53:ChangeResourceRecordSets"]
        Resource = [aws_route53_zone.root.arn]
        Condition = {
          "ForAllValues:StringEquals" = {
            "route53:ChangeResourceRecordSetsRecordTypes" = ["A", "AAAA", "CNAME"]
            "route53:ChangeResourceRecordSetsActions"     = ["CREATE", "UPSERT", "DELETE"]
          }
          "ForAllValues:StringLike" = {
            "route53:ChangeResourceRecordSetsNormalizedRecordNames" = var.dns_writer_names[name]
          }
          Null = {
            "route53:ChangeResourceRecordSetsRecordTypes"           = "false"
            "route53:ChangeResourceRecordSetsActions"               = "false"
            "route53:ChangeResourceRecordSetsNormalizedRecordNames" = "false"
          }
        }
      }], local.dns_read_statements)
    })
  }

  dns_read_trust = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PlanPrincipalsOnly"
      Effect    = "Allow"
      Principal = { AWS = distinct([for arn in var.dns_reader_principal_arns : "arn:aws:iam::${split(":", arn)[4]}:root"]) }
      Action    = "sts:AssumeRole"
      Condition = { ArnEquals = { "aws:PrincipalArn" = var.dns_reader_principal_arns } }
    }]
  })

  dns_read_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = local.dns_read_statements
  })

  tooling_plan_trust = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PullRequestsOfThisRepository"
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "${local.github_oidc_host}:aud" = "sts.amazonaws.com" }
        StringLike   = { "${local.github_oidc_host}:sub" = "repo:${var.github_repository}:pull_request:ref:refs/pull/*" }
      }
    }]
  })

  # ReadOnlyAccess plus explicit denies, rather than a hand-written read list: a plan refreshes
  # whatever the provider version reads, so a scoped list drifts and breaks plans, while a deny
  # always wins. The denies remove what ReadOnlyAccess would expose: state objects (reached only
  # through quad-terraform-state-read-global), parameter and secret values, and decryption.
  tooling_plan_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AssumeGlobalStateReadRole"
        Effect   = "Allow"
        Action   = ["sts:AssumeRole"]
        Resource = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/quad-terraform-state-read-global"]
      },
      {
        Sid      = "NoDirectStateReads"
        Effect   = "Deny"
        Action   = ["s3:GetObject", "s3:GetObjectVersion"]
        Resource = ["arn:aws:s3:::${var.state_bucket_name}/*"]
      },
      {
        Sid      = "NoSecretValues"
        Effect   = "Deny"
        Action   = ["ssm:GetParameter*", "secretsmanager:GetSecretValue", "kms:Decrypt"]
        Resource = ["*"]
      },
    ]
  })
}

# --- DNS roles: one write role per environment, one shared read role for plans ---

resource "aws_iam_role" "dns_write" {
  for_each = var.dns_writer_principal_arns

  name                 = "quad-dns-records-${each.key}"
  description          = "Writes ${each.key}'s own records in ${var.domain}; assumed by its apply roles."
  assume_role_policy   = local.dns_write_trust[each.key]
  max_session_duration = 3600

  tags = { service = "dns" }
}

resource "aws_iam_role_policy" "dns_write" {
  for_each = var.dns_writer_principal_arns

  name   = "dns-records"
  role   = aws_iam_role.dns_write[each.key].id
  policy = local.dns_write_policy[each.key]
}

resource "aws_iam_role" "dns_read" {
  name                 = "quad-dns-read"
  description          = "Reads ${var.domain} for plans; assumed by the plan roles."
  assume_role_policy   = local.dns_read_trust
  max_session_duration = 3600

  tags = { service = "dns" }
}

resource "aws_iam_role_policy" "dns_read" {
  name   = "dns-read"
  role   = aws_iam_role.dns_read.id
  policy = local.dns_read_policy
}

# --- GitHub OIDC and the pull request plan role for this root ---

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://${local.github_oidc_host}"
  client_id_list = ["sts.amazonaws.com"]

  tags = { service = "ci" }
}

resource "aws_iam_role" "tooling_plan" {
  name                 = "quad-tooling-plan"
  description          = "terraform plan for infra/envs/global from this repository's pull requests."
  assume_role_policy   = local.tooling_plan_trust
  max_session_duration = 3600

  tags = { service = "ci" }
}

resource "aws_iam_role_policy_attachment" "tooling_plan_read_only" {
  role       = aws_iam_role.tooling_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

resource "aws_iam_role_policy" "tooling_plan" {
  name   = "state-read-and-secret-denies"
  role   = aws_iam_role.tooling_plan.id
  policy = local.tooling_plan_policy
}
