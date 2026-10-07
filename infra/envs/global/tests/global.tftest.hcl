# The shared zone, its shared records and the cross-account roles, checked offline with a mocked
# AWS provider.

mock_provider "aws" {
  source = "../../tests/mocks/aws"
}

variables {
  dns_writer_account_ids = ["111111111111"]
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
    condition = sort(aws_route53_record.caa.records) == sort([
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
}

run "ses_sending_domain_records" {
  command = apply

  assert {
    condition = (
      aws_route53_record.mail_spf.name == "mail.quad-edu.com"
      && aws_route53_record.mail_spf.type == "TXT"
      && aws_route53_record.mail_spf.records == toset(["v=spf1 include:amazonses.com ~all"])
    )
    error_message = "mail.quad-edu.com must publish the SES SPF record."
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
      && aws_route53_record.bounce_spf.records == toset(["v=spf1 include:amazonses.com ~all"])
    )
    error_message = "The MAIL FROM domain must have the SES feedback MX and SPF."
  }

  assert {
    condition = alltrue([
      for record in [
        aws_route53_record.caa, aws_route53_record.apex_mx, aws_route53_record.apex_spf,
        aws_route53_record.mail_spf, aws_route53_record.mail_dmarc,
        aws_route53_record.bounce_mx, aws_route53_record.bounce_spf,
      ] : record.zone_id == aws_route53_zone.root.zone_id
    ])
    error_message = "Every shared record must be in the quad-edu.com zone."
  }
}

run "dns_role_is_assumable_only_from_the_named_accounts" {
  command = apply

  variables {
    dns_writer_account_ids = ["111111111111", "222222222222"]
  }

  assert {
    condition     = aws_iam_role.dns_records.name == "quad-dns-records"
    error_message = "The DNS role must be named quad-dns-records."
  }

  assert {
    condition = sort(flatten([
      for statement in jsondecode(aws_iam_role.dns_records.assume_role_policy).Statement :
      statement.Principal.AWS if statement.Effect == "Allow"
    ])) == tolist(["arn:aws:iam::111111111111:root", "arn:aws:iam::222222222222:root"])
    error_message = "The DNS role must trust exactly the named accounts, and never *."
  }
}

run "dns_role_writes_only_in_the_zone" {
  command = apply

  # Every action that reads or writes records is limited to the zone ARN alone.
  assert {
    condition = alltrue([
      for statement in jsondecode(aws_iam_role_policy.dns_records.policy).Statement :
      toset(flatten([statement.Resource])) == toset([aws_route53_zone.root.arn])
      if anytrue([for action in statement.Action : contains(["route53:ChangeResourceRecordSets", "route53:ListResourceRecordSets"], action)])
    ])
    error_message = "Record changes must be scoped to the zone ARN only."
  }

  assert {
    condition = length([
      for statement in jsondecode(aws_iam_role_policy.dns_records.policy).Statement : statement
      if contains(statement.Action, "route53:ChangeResourceRecordSets")
    ]) == 1
    error_message = "Exactly one statement may grant ChangeResourceRecordSets."
  }

  # The writable record types exclude NS, SOA, CAA, MX and TXT, so an environment cannot take over
  # the delegation, certificate issuance or the shared mail records.
  assert {
    condition = alltrue([
      for statement in jsondecode(aws_iam_role_policy.dns_records.policy).Statement :
      sort(statement.Condition["ForAllValues:StringEquals"]["route53:ChangeResourceRecordSetsRecordTypes"]) == tolist(["A", "AAAA", "CNAME"])
      if contains(statement.Action, "route53:ChangeResourceRecordSets")
    ])
    error_message = "The DNS role may only write A, AAAA and CNAME records."
  }

  # Only the zone lookups that IAM cannot scope to a resource use "*".
  assert {
    condition = alltrue(flatten([
      for statement in jsondecode(aws_iam_role_policy.dns_records.policy).Statement : [
        for action in statement.Action : contains(["route53:ListHostedZones", "route53:ListHostedZonesByName"], action)
      ] if contains(flatten([statement.Resource]), "*")
    ]))
    error_message = "Only ListHostedZones and ListHostedZonesByName may use Resource *."
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

run "tooling_plan_role_reaches_state_only_through_the_state_role" {
  command = apply

  assert {
    condition = toset(flatten([
      for statement in jsondecode(aws_iam_role_policy.tooling_plan_state.policy).Statement : statement.Action
    ])) == toset(["sts:AssumeRole"])
    error_message = "The plan role's own policy may only add sts:AssumeRole."
  }

  assert {
    condition = toset(flatten([
      for statement in jsondecode(aws_iam_role_policy.tooling_plan_state.policy).Statement : statement.Resource
    ])) == toset(["arn:aws:iam::123456789012:role/quad-terraform-state"])
    error_message = "The plan role may assume only quad-terraform-state in this account."
  }
}

run "refuses_a_wildcard_dns_writer" {
  command = plan

  variables {
    dns_writer_account_ids = ["*"]
  }

  expect_failures = [var.dns_writer_account_ids]
}
