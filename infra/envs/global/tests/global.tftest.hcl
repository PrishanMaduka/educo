# The shared zone, its shared records and the cross-account roles, checked offline with a mocked
# AWS provider. The mocked account is 123456789012; the example staging account is 222222222222.

mock_provider "aws" {
  source = "../../tests/mocks/aws"
}

variables {
  dns_writer_principal_arns = {
    staging = ["arn:aws:iam::222222222222:role/quad-staging-apply"]
  }
  dns_reader_principal_arns = ["arn:aws:iam::222222222222:role/quad-staging-plan"]
}

run "zone_is_quad_edu_com" {
  command = apply

  assert {
    condition     = aws_route53_zone.root.name == "quad-edu.com"
    error_message = "The zone must be quad-edu.com."
  }

  assert {
    condition     = length(output.name_servers) == 4
    error_message = "The name servers to paste at the registrar must be an output."
  }
}

run "only_amazon_issues_certificates" {
  command = apply

  assert {
    condition     = aws_route53_record.caa.name == "quad-edu.com" && aws_route53_record.caa.type == "CAA"
    error_message = "The CAA record must sit at the apex."
  }

  assert {
    condition = aws_route53_record.caa.records == toset([
      "0 issue \"amazon.com\"",
      "0 issue \"amazontrust.com\"",
      "0 issue \"awstrust.com\"",
      "0 issue \"amazonaws.com\"",
      "0 iodef \"mailto:security@quad-edu.com\"",
    ])
    error_message = "CAA must allow exactly the four Amazon issuers, plus the iodef address."
  }
}

run "apex_mail_stays_with_google_workspace" {
  command = apply

  assert {
    condition     = aws_route53_record.apex_mx.name == "quad-edu.com" && aws_route53_record.apex_mx.records == toset(["1 smtp.google.com"])
    error_message = "The apex MX must be Google Workspace (D19)."
  }

  assert {
    condition     = aws_route53_record.apex_spf.records == toset(["v=spf1 include:_spf.google.com ~all"])
    error_message = "The apex SPF must include Google."
  }

  assert {
    condition = (
      aws_route53_record.apex_dmarc.name == "_dmarc.quad-edu.com"
      && strcontains(one(aws_route53_record.apex_dmarc.records), "p=none")
      && strcontains(one(aws_route53_record.apex_dmarc.records), "rua=mailto:dmarc-reports@quad-edu.com")
    )
    error_message = "The apex must publish a monitoring DMARC record (p=none) with reports."
  }
}

run "ses_sending_domain_records" {
  command = apply

  assert {
    condition = (
      aws_route53_record.mail_spf.name == "mail.quad-edu.com"
      && aws_route53_record.mail_spf.type == "TXT"
      && aws_route53_record.mail_spf.records == toset(["v=spf1 include:amazonses.com -all"])
    )
    error_message = "mail.quad-edu.com must publish the SES SPF record with -all."
  }

  assert {
    condition = (
      aws_route53_record.mail_dmarc.name == "_dmarc.mail.quad-edu.com"
      && strcontains(one(aws_route53_record.mail_dmarc.records), "p=quarantine")
      && strcontains(one(aws_route53_record.mail_dmarc.records), "rua=mailto:dmarc-reports@quad-edu.com")
    )
    error_message = "DMARC for mail.quad-edu.com must quarantine and report to the default address."
  }

  assert {
    condition = (
      aws_route53_record.bounce_mx.name == "bounce.mail.quad-edu.com"
      && aws_route53_record.bounce_mx.records == toset(["10 feedback-smtp.ap-south-1.amazonses.com"])
      && aws_route53_record.bounce_spf.name == "bounce.mail.quad-edu.com"
      && aws_route53_record.bounce_spf.records == toset(["v=spf1 include:amazonses.com -all"])
    )
    error_message = "The MAIL FROM domain must have the SES feedback MX and an SPF with -all."
  }

  assert {
    condition = alltrue([
      for record in [
        aws_route53_record.caa, aws_route53_record.apex_mx, aws_route53_record.apex_spf,
        aws_route53_record.apex_dmarc, aws_route53_record.mail_spf, aws_route53_record.mail_dmarc,
        aws_route53_record.bounce_mx, aws_route53_record.bounce_spf,
      ] : record.zone_id == aws_route53_zone.root.zone_id
    ])
    error_message = "Every shared record must be in the quad-edu.com zone."
  }
}

run "dns_write_role_trusts_only_the_environment_apply_roles" {
  command = apply

  assert {
    condition     = aws_iam_role.dns_write["staging"].name == "quad-dns-records-staging"
    error_message = "The staging DNS write role must be quad-dns-records-staging."
  }

  assert {
    condition = (
      length(jsondecode(aws_iam_role.dns_write["staging"].assume_role_policy).Statement) == 1
      && one(jsondecode(aws_iam_role.dns_write["staging"].assume_role_policy).Statement).Action == "sts:AssumeRole"
      && toset(flatten([one(jsondecode(aws_iam_role.dns_write["staging"].assume_role_policy).Statement).Principal.AWS])) == toset(["arn:aws:iam::222222222222:root"])
      && toset(one(jsondecode(aws_iam_role.dns_write["staging"].assume_role_policy).Statement).Condition.ArnEquals["aws:PrincipalArn"]) == toset(["arn:aws:iam::222222222222:role/quad-staging-apply"])
    )
    error_message = "The DNS write role must trust only the staging apply role (account root plus ArnEquals aws:PrincipalArn)."
  }
}

run "dns_write_role_changes_only_its_names_and_types" {
  command = apply

  # Exactly one statement may change records, on the zone ARN only.
  assert {
    condition = length([
      for statement in jsondecode(aws_iam_role_policy.dns_write["staging"].policy).Statement : statement
      if contains(statement.Action, "route53:ChangeResourceRecordSets")
      && toset(flatten([statement.Resource])) == toset([aws_route53_zone.root.arn])
      ]) == 1 && length([
      for statement in jsondecode(aws_iam_role_policy.dns_write["staging"].policy).Statement : statement
      if contains(statement.Action, "route53:ChangeResourceRecordSets")
    ]) == 1
    error_message = "Exactly one statement may change records, scoped to the zone ARN."
  }

  assert {
    condition = alltrue([
      for statement in jsondecode(aws_iam_role_policy.dns_write["staging"].policy).Statement : (
        toset(statement.Condition["ForAllValues:StringEquals"]["route53:ChangeResourceRecordSetsRecordTypes"]) == toset(["A", "AAAA", "CNAME"])
        && toset(statement.Condition["ForAllValues:StringEquals"]["route53:ChangeResourceRecordSetsActions"]) == toset(["CREATE", "UPSERT", "DELETE"])
        && toset(statement.Condition["ForAllValues:StringLike"]["route53:ChangeResourceRecordSetsNormalizedRecordNames"]) == toset([
          "staging.quad-edu.com", "*.staging.quad-edu.com", "*._domainkey.mail.quad-edu.com",
        ])
      ) if contains(statement.Action, "route53:ChangeResourceRecordSets")
    ])
    error_message = "Record changes must be limited to A/AAAA/CNAME, CREATE/UPSERT/DELETE and the staging names."
  }

  # ForAllValues passes when a key is missing, so each key must be present.
  assert {
    condition = alltrue([
      for statement in jsondecode(aws_iam_role_policy.dns_write["staging"].policy).Statement : (
        statement.Condition.Null["route53:ChangeResourceRecordSetsRecordTypes"] == "false"
        && statement.Condition.Null["route53:ChangeResourceRecordSetsActions"] == "false"
        && statement.Condition.Null["route53:ChangeResourceRecordSetsNormalizedRecordNames"] == "false"
      ) if contains(statement.Action, "route53:ChangeResourceRecordSets")
    ])
    error_message = "Each ForAllValues key must have a Null = false guard."
  }

  # Only the zone lookups that IAM cannot scope to a resource use "*".
  assert {
    condition = alltrue(flatten([
      for statement in jsondecode(aws_iam_role_policy.dns_write["staging"].policy).Statement : [
        for action in statement.Action : contains(["route53:ListHostedZones", "route53:ListHostedZonesByName"], action)
      ] if contains(flatten([statement.Resource]), "*")
    ]))
    error_message = "Only ListHostedZones and ListHostedZonesByName may use Resource *."
  }
}

run "staging_cannot_write_the_apex_console_www_or_status" {
  command = apply

  # Glob-matches each allowed StringLike pattern ("*" = any characters) against sample names.
  assert {
    condition = alltrue(flatten([
      for name in [
        "quad-edu.com", "console.quad-edu.com", "www.quad-edu.com", "status.quad-edu.com",
        "mail.quad-edu.com", "_dmarc.quad-edu.com", "bounce.mail.quad-edu.com", "_acme.quad-edu.com",
        "staging.quad-edu.com.evil.example", "xstaging.quad-edu.com",
        ] : [
        for pattern in var.dns_writer_names["staging"] :
        !can(regex("^${replace(replace(pattern, ".", "\\."), "*", ".*")}$", name))
      ]
    ]))
    error_message = "No staging pattern may match the apex, console, www, status or the shared mail names."
  }

  assert {
    condition = alltrue([
      for name in [
        "staging.quad-edu.com", "console.staging.quad-edu.com", "origin.staging.quad-edu.com",
        "_0123abcd.console.staging.quad-edu.com", "abcdefgh._domainkey.mail.quad-edu.com",
        ] : anytrue([
          for pattern in var.dns_writer_names["staging"] :
          can(regex("^${replace(replace(pattern, ".", "\\."), "*", ".*")}$", name))
      ])
    ])
    error_message = "Staging must be able to write its aliases, ACM validation and DKIM records."
  }
}

run "refuses_a_writer_pattern_that_covers_the_apex_or_console" {
  command = plan

  variables {
    dns_writer_names = { staging = ["*.quad-edu.com"] }
  }

  expect_failures = [var.dns_writer_names]
}

run "refuses_writing_console_quad_edu_com" {
  command = plan

  variables {
    dns_writer_names = { staging = ["console.quad-edu.com"] }
  }

  expect_failures = [var.dns_writer_names]
}

run "dns_read_role_is_read_only_and_trusts_only_the_plan_roles" {
  command = apply

  assert {
    condition     = aws_iam_role.dns_read.name == "quad-dns-read"
    error_message = "The DNS read role must be quad-dns-read."
  }

  assert {
    condition = (
      toset(flatten([one(jsondecode(aws_iam_role.dns_read.assume_role_policy).Statement).Principal.AWS])) == toset(["arn:aws:iam::222222222222:root"])
      && toset(one(jsondecode(aws_iam_role.dns_read.assume_role_policy).Statement).Condition.ArnEquals["aws:PrincipalArn"]) == toset(["arn:aws:iam::222222222222:role/quad-staging-plan"])
    )
    error_message = "The DNS read role must trust only the plan roles."
  }

  assert {
    condition = length(setsubtract(flatten([
      for statement in jsondecode(aws_iam_role_policy.dns_read.policy).Statement : statement.Action
      ]), [
      "route53:ListResourceRecordSets", "route53:GetHostedZone", "route53:ListTagsForResource",
      "route53:GetChange", "route53:ListHostedZones", "route53:ListHostedZonesByName",
    ])) == 0
    error_message = "The DNS read role may only read."
  }
}

run "tooling_plan_role_trusts_only_pull_requests_of_this_repository" {
  command = apply

  assert {
    condition     = aws_iam_role.tooling_plan.name == "quad-tooling-plan"
    error_message = "The plan role must be named quad-tooling-plan."
  }

  assert {
    condition     = length(jsondecode(aws_iam_role.tooling_plan.assume_role_policy).Statement) == 1
    error_message = "The plan role must have exactly one trust statement."
  }

  assert {
    condition = (
      one(jsondecode(aws_iam_role.tooling_plan.assume_role_policy).Statement).Action == "sts:AssumeRoleWithWebIdentity"
      && one(jsondecode(aws_iam_role.tooling_plan.assume_role_policy).Statement).Principal.Federated == aws_iam_openid_connect_provider.github.arn
    )
    error_message = "The plan role must be assumed only through the GitHub OIDC provider."
  }

  assert {
    condition     = one(jsondecode(aws_iam_role.tooling_plan.assume_role_policy).Statement).Condition.StringLike["token.actions.githubusercontent.com:sub"] == "repo:prishanmaduka/educo:pull_request:ref:refs/pull/*"
    error_message = "The plan role subject must be this repository's pull requests."
  }

  assert {
    condition     = one(jsondecode(aws_iam_role.tooling_plan.assume_role_policy).Statement).Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com"
    error_message = "The plan role audience must be sts.amazonaws.com."
  }

  assert {
    condition     = aws_iam_role_policy_attachment.tooling_plan_read_only.policy_arn == "arn:aws:iam::aws:policy/ReadOnlyAccess"
    error_message = "The plan role must have ReadOnlyAccess."
  }

  assert {
    condition = (
      aws_iam_openid_connect_provider.github.url == "https://token.actions.githubusercontent.com"
      && toset(aws_iam_openid_connect_provider.github.client_id_list) == toset(["sts.amazonaws.com"])
    )
    error_message = "The GitHub OIDC provider must have the sts.amazonaws.com audience."
  }
}

run "tooling_plan_role_cannot_read_secrets_or_state_directly" {
  command = apply

  assert {
    condition = (
      toset(flatten([
        for statement in jsondecode(aws_iam_role_policy.tooling_plan.policy).Statement : statement.Resource
        if statement.Effect == "Allow"
      ])) == toset(["arn:aws:iam::123456789012:role/quad-terraform-state-read-global"])
      && toset(flatten([
        for statement in jsondecode(aws_iam_role_policy.tooling_plan.policy).Statement : statement.Action
        if statement.Effect == "Allow"
      ])) == toset(["sts:AssumeRole"])
    )
    error_message = "The plan role may only add sts:AssumeRole on quad-terraform-state-read-global."
  }

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_iam_role_policy.tooling_plan.policy).Statement :
      statement.Effect == "Deny"
      && length(setsubtract(["s3:GetObject", "s3:GetObjectVersion"], statement.Action)) == 0
      && toset(statement.Resource) == toset(["arn:aws:s3:::quad-tfstate-tooling/*"])
    ])
    error_message = "The plan role must be denied direct reads of the state bucket."
  }

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_iam_role_policy.tooling_plan.policy).Statement :
      statement.Effect == "Deny"
      && length(setsubtract(["ssm:GetParameter*", "secretsmanager:GetSecretValue", "kms:Decrypt"], statement.Action)) == 0
      && toset(statement.Resource) == toset(["*"])
    ])
    error_message = "The plan role must be denied SSM parameter values, secret values and kms:Decrypt."
  }
}

run "refuses_a_wildcard_dns_principal" {
  command = plan

  variables {
    dns_reader_principal_arns = ["arn:aws:iam::222222222222:role/*"]
  }

  expect_failures = [var.dns_reader_principal_arns]
}

run "refuses_a_writer_without_names" {
  command = plan

  variables {
    dns_writer_principal_arns = { production = ["arn:aws:iam::333333333333:role/quad-production-apply"] }
  }

  expect_failures = [var.dns_writer_principal_arns]
}
