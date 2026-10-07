# Security properties of the Terraform state root, checked offline with a mocked AWS provider.

mock_provider "aws" {
  source = "../tests/mocks/aws"
}

variables {
  trusted_account_ids = ["111111111111", "222222222222"]
}

run "state_bucket_is_private" {
  command = apply

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.state.block_public_acls,
      aws_s3_bucket_public_access_block.state.block_public_policy,
      aws_s3_bucket_public_access_block.state.ignore_public_acls,
      aws_s3_bucket_public_access_block.state.restrict_public_buckets,
    ])
    error_message = "All four public access blocks must be on for the state bucket."
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.state.bucket == aws_s3_bucket.state.id
    error_message = "The public access block must belong to the state bucket."
  }

  assert {
    condition     = one(aws_s3_bucket_ownership_controls.state.rule).object_ownership == "BucketOwnerEnforced"
    error_message = "The state bucket must disable ACLs (BucketOwnerEnforced)."
  }
}

run "state_bucket_is_versioned_and_encrypted_with_kms" {
  command = apply

  assert {
    condition     = one(aws_s3_bucket_versioning.state.versioning_configuration).status == "Enabled"
    error_message = "State bucket versioning must be Enabled."
  }

  assert {
    condition     = one(one(aws_s3_bucket_server_side_encryption_configuration.state.rule).apply_server_side_encryption_by_default).sse_algorithm == "aws:kms"
    error_message = "The state bucket must use SSE-KMS."
  }

  assert {
    condition     = one(one(aws_s3_bucket_server_side_encryption_configuration.state.rule).apply_server_side_encryption_by_default).kms_master_key_id == aws_kms_key.state.arn
    error_message = "The state bucket must use the state KMS key."
  }

  assert {
    condition     = aws_kms_key.state.enable_key_rotation
    error_message = "The state KMS key must rotate."
  }
}

run "state_bucket_refuses_plain_http" {
  command = apply

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_s3_bucket_policy.state.policy).Statement :
      statement.Effect == "Deny"
      && statement.Principal == "*"
      && statement.Action == "s3:*"
      && try(statement.Condition.Bool["aws:SecureTransport"], "") == "false"
      && contains(statement.Resource, aws_s3_bucket.state.arn)
      && contains(statement.Resource, "${aws_s3_bucket.state.arn}/*")
    ])
    error_message = "The state bucket policy must deny every request with aws:SecureTransport = false."
  }
}

run "lock_table_is_encrypted_with_pitr" {
  command = apply

  assert {
    condition     = aws_dynamodb_table.locks.hash_key == "LockID"
    error_message = "The lock table hash key must be LockID."
  }

  assert {
    condition     = one([for a in aws_dynamodb_table.locks.attribute : a.type if a.name == "LockID"]) == "S"
    error_message = "LockID must be a string attribute."
  }

  assert {
    condition     = aws_dynamodb_table.locks.billing_mode == "PAY_PER_REQUEST"
    error_message = "The lock table must be on-demand."
  }

  assert {
    condition     = one(aws_dynamodb_table.locks.point_in_time_recovery).enabled
    error_message = "The lock table must have point-in-time recovery."
  }

  assert {
    condition = (
      one(aws_dynamodb_table.locks.server_side_encryption).enabled
      && one(aws_dynamodb_table.locks.server_side_encryption).kms_key_arn == aws_kms_key.state.arn
    )
    error_message = "The lock table must be encrypted with the state KMS key."
  }
}

run "state_role_trusts_only_the_named_accounts" {
  command = apply

  assert {
    condition     = aws_iam_role.state.name == "quad-terraform-state"
    error_message = "The state role must be named quad-terraform-state."
  }

  assert {
    condition = alltrue([
      for statement in jsondecode(aws_iam_role.state.assume_role_policy).Statement :
      statement.Action == "sts:AssumeRole" && statement.Effect == "Allow"
    ])
    error_message = "The state role trust may only allow sts:AssumeRole."
  }

  assert {
    condition = sort(flatten([
      for statement in jsondecode(aws_iam_role.state.assume_role_policy).Statement :
      statement.Principal.AWS
    ])) == tolist(["arn:aws:iam::111111111111:root", "arn:aws:iam::222222222222:root"])
    error_message = "The state role must trust exactly the given accounts, and never *."
  }
}

run "state_role_reaches_only_state_objects_and_lock_items" {
  command = apply

  assert {
    condition = sort(distinct(flatten([
      for statement in jsondecode(aws_iam_role_policy.state.policy).Statement :
      statement.Resource if anytrue([for action in statement.Action : startswith(action, "s3:") && action != "s3:ListBucket"])
    ]))) == tolist(["${aws_s3_bucket.state.arn}/*/terraform.tfstate*"])
    error_message = "State object access must be limited to */terraform.tfstate*."
  }

  assert {
    condition = sort(distinct(flatten([
      for statement in jsondecode(aws_iam_role_policy.state.policy).Statement :
      statement.Resource if anytrue([for action in statement.Action : startswith(action, "dynamodb:")])
    ]))) == tolist([aws_dynamodb_table.locks.arn])
    error_message = "Lock access must be limited to the lock table."
  }

  assert {
    condition = alltrue(flatten([
      for statement in jsondecode(aws_iam_role_policy.state.policy).Statement :
      [for resource in flatten([statement.Resource]) : resource != "*"]
    ]))
    error_message = "No state role statement may use Resource *."
  }
}

run "refuses_a_wildcard_trusted_account" {
  command = plan

  variables {
    trusted_account_ids = ["*"]
  }

  expect_failures = [var.trusted_account_ids]
}

run "refuses_an_empty_trusted_account_list" {
  command = plan

  variables {
    trusted_account_ids = []
  }

  expect_failures = [var.trusted_account_ids]
}
