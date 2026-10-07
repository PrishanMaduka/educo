# Security properties of the Terraform state root, checked offline with a mocked AWS provider.
# The mocked account (infra/tests/mocks/aws) is 123456789012; the example principals below are in
# the example accounts 111111111111 (tooling) and 222222222222 (staging).

mock_provider "aws" {
  source = "../tests/mocks/aws"
}

variables {
  break_glass_principal_arns = ["arn:aws:iam::111111111111:role/quad-break-glass"]
  state_environments = {
    global = {
      plan_principal_arns  = ["arn:aws:iam::111111111111:role/quad-tooling-plan"]
      apply_principal_arns = ["arn:aws:iam::111111111111:role/quad-break-glass"]
    }
    staging = {
      plan_principal_arns  = ["arn:aws:iam::222222222222:role/quad-staging-plan"]
      apply_principal_arns = ["arn:aws:iam::222222222222:role/quad-staging-apply"]
    }
  }
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

  # Every root passes this to the backend as kms_key_id; without it `encrypt = true` sends AES256.
  assert {
    condition     = output.state_kms_key_arn == aws_kms_key.state.arn
    error_message = "The state key ARN must be an output for -backend-config kms_key_id."
  }
}

run "state_key_is_administered_only_through_this_account" {
  command = apply

  assert {
    condition = toset(flatten([
      for statement in jsondecode(aws_kms_key.state.policy).Statement : statement.Principal.AWS
    ])) == toset(["arn:aws:iam::123456789012:root"])
    error_message = "The key policy may name only this account's root (so IAM decides), never * or another account."
  }

  assert {
    condition = alltrue([
      for statement in jsondecode(aws_kms_key.state.policy).Statement : statement.Effect == "Allow"
    ])
    error_message = "The key policy has only the account statement."
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
      && contains(statement.Resource, "arn:aws:s3:::quad-tfstate-tooling")
      && contains(statement.Resource, "arn:aws:s3:::quad-tfstate-tooling/*")
    ])
    error_message = "The state bucket policy must deny every request with aws:SecureTransport = false."
  }
}

run "state_bucket_refuses_uploads_not_encrypted_with_the_state_key" {
  command = apply

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_s3_bucket_policy.state.policy).Statement :
      statement.Effect == "Deny"
      && statement.Principal == "*"
      && toset(flatten([statement.Action])) == toset(["s3:PutObject"])
      && toset(flatten([statement.Resource])) == toset(["arn:aws:s3:::quad-tfstate-tooling/*"])
      && try(statement.Condition.StringNotEqualsIfExists["s3:x-amz-server-side-encryption"], "") == "aws:kms"
    ])
    error_message = "The bucket policy must deny uploads that ask for anything but aws:kms."
  }

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_s3_bucket_policy.state.policy).Statement :
      statement.Effect == "Deny"
      && statement.Principal == "*"
      && toset(flatten([statement.Action])) == toset(["s3:PutObject"])
      && toset(flatten([statement.Resource])) == toset(["arn:aws:s3:::quad-tfstate-tooling/*"])
      && try(statement.Condition.StringNotEqualsIfExists["s3:x-amz-server-side-encryption-aws-kms-key-id"], "") == aws_kms_key.state.arn
    ])
    error_message = "The bucket policy must deny uploads that name a KMS key other than the state key."
  }
}

run "only_state_roles_and_break_glass_touch_state_objects" {
  command = apply

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_s3_bucket_policy.state.policy).Statement :
      statement.Effect == "Deny"
      && statement.Principal == "*"
      && toset(flatten([statement.Action])) == toset(["s3:GetObject*", "s3:PutObject*", "s3:DeleteObject*", "s3:RestoreObject"])
      && toset(flatten([statement.Resource])) == toset(["arn:aws:s3:::quad-tfstate-tooling/*"])
      && toset(try(statement.Condition.ArnNotEquals["aws:PrincipalArn"], [])) == toset([
        "arn:aws:iam::123456789012:role/quad-terraform-state-read-global",
        "arn:aws:iam::123456789012:role/quad-terraform-state-read-staging",
        "arn:aws:iam::123456789012:role/quad-terraform-state-rw-global",
        "arn:aws:iam::123456789012:role/quad-terraform-state-rw-staging",
        "arn:aws:iam::111111111111:role/quad-break-glass",
      ])
    ])
    error_message = "Every object read, write, delete and restore (all versions, tags and ACLs) must be denied to every principal except the state roles and the break-glass roles."
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

run "read_role_trusts_only_the_plan_principals" {
  command = apply

  assert {
    condition     = aws_iam_role.state_read["staging"].name == "quad-terraform-state-read-staging"
    error_message = "The staging read role must be quad-terraform-state-read-staging."
  }

  assert {
    condition = (
      length(jsondecode(aws_iam_role.state_read["staging"].assume_role_policy).Statement) == 1
      && one(jsondecode(aws_iam_role.state_read["staging"].assume_role_policy).Statement).Action == "sts:AssumeRole"
      && toset(flatten([one(jsondecode(aws_iam_role.state_read["staging"].assume_role_policy).Statement).Principal.AWS])) == toset(["arn:aws:iam::222222222222:root"])
      && toset(one(jsondecode(aws_iam_role.state_read["staging"].assume_role_policy).Statement).Condition.ArnEquals["aws:PrincipalArn"]) == toset(["arn:aws:iam::222222222222:role/quad-staging-plan"])
    )
    error_message = "The staging read role must trust only the staging plan role (its account root plus ArnEquals aws:PrincipalArn)."
  }
}

run "read_role_only_reads_its_own_state" {
  command = apply

  # Plans run with -lock=false, so the read role needs no lock writes; the S3 backend still reads
  # the state digest item (<bucket>/<key>-md5) from the lock table.
  assert {
    condition = length(setsubtract(flatten([
      for statement in jsondecode(aws_iam_role_policy.state_read["staging"].policy).Statement : statement.Action
    ]), ["s3:GetObject", "s3:ListBucket", "kms:Decrypt", "dynamodb:GetItem"])) == 0
    error_message = "The read role may only GetObject, ListBucket, kms:Decrypt and dynamodb:GetItem."
  }

  assert {
    condition = toset(flatten([
      for statement in jsondecode(aws_iam_role_policy.state_read["staging"].policy).Statement :
      statement.Resource if contains(statement.Action, "s3:GetObject")
    ])) == toset(["arn:aws:s3:::quad-tfstate-tooling/staging/terraform.tfstate"])
    error_message = "The staging read role may read only staging/terraform.tfstate."
  }

  # Unconditional ListBucket on the bucket, so a missing state object is a 404 (first plan or
  # apply) rather than a 403. It reveals key names only, and objects stay denied by the bucket policy.
  assert {
    condition = (
      length([for statement in jsondecode(aws_iam_role_policy.state_read["staging"].policy).Statement : statement if contains(statement.Action, "s3:ListBucket")]) == 1
      && alltrue([
        for statement in jsondecode(aws_iam_role_policy.state_read["staging"].policy).Statement :
        toset(statement.Action) == toset(["s3:ListBucket"])
        && toset(statement.Resource) == toset(["arn:aws:s3:::quad-tfstate-tooling"])
        && try(statement.Condition, null) == null
        if contains(statement.Action, "s3:ListBucket")
      ])
    )
    error_message = "ListBucket must be one unconditional statement on the state bucket alone."
  }

  assert {
    condition = alltrue([
      for statement in jsondecode(aws_iam_role_policy.state_read["staging"].policy).Statement :
      length(setsubtract(statement.Condition.StringEquals["kms:ViaService"], ["s3.ap-south-1.amazonaws.com", "dynamodb.ap-south-1.amazonaws.com"])) == 0
      && toset(statement.Resource) == toset([aws_kms_key.state.arn])
      if contains(statement.Action, "kms:Decrypt")
    ])
    error_message = "kms:Decrypt must be on the state key and only through S3 or DynamoDB."
  }

  assert {
    condition = alltrue([
      for statement in jsondecode(aws_iam_role_policy.state_read["staging"].policy).Statement :
      toset(statement.Condition["ForAllValues:StringEquals"]["dynamodb:LeadingKeys"]) == toset(["quad-tfstate-tooling/staging/terraform.tfstate-md5"])
      && statement.Condition.Null["dynamodb:LeadingKeys"] == "false"
      if contains(statement.Action, "dynamodb:GetItem")
    ])
    error_message = "The read role may read only its own state digest item, with a Null guard on LeadingKeys."
  }
}

run "rw_role_trusts_only_the_apply_principals" {
  command = apply

  assert {
    condition     = aws_iam_role.state_rw["staging"].name == "quad-terraform-state-rw-staging"
    error_message = "The staging read-write role must be quad-terraform-state-rw-staging."
  }

  assert {
    condition = (
      length(jsondecode(aws_iam_role.state_rw["staging"].assume_role_policy).Statement) == 1
      && toset(flatten([one(jsondecode(aws_iam_role.state_rw["staging"].assume_role_policy).Statement).Principal.AWS])) == toset(["arn:aws:iam::222222222222:root"])
      && toset(one(jsondecode(aws_iam_role.state_rw["staging"].assume_role_policy).Statement).Condition.ArnEquals["aws:PrincipalArn"]) == toset(["arn:aws:iam::222222222222:role/quad-staging-apply"])
    )
    error_message = "The staging read-write role must trust only the staging apply role."
  }
}

run "rw_role_writes_only_its_own_state_and_locks" {
  command = apply

  assert {
    condition = toset(flatten([
      for statement in jsondecode(aws_iam_role_policy.state_rw["staging"].policy).Statement :
      statement.Resource if anytrue([for action in statement.Action : startswith(action, "s3:") && action != "s3:ListBucket"])
    ])) == toset(["arn:aws:s3:::quad-tfstate-tooling/staging/terraform.tfstate*"])
    error_message = "Object access must be limited to staging/terraform.tfstate* (state and .tflock)."
  }

  assert {
    condition = alltrue([
      for statement in jsondecode(aws_iam_role_policy.state_rw["staging"].policy).Statement :
      toset(statement.Resource) == toset([aws_dynamodb_table.locks.arn])
      && toset(statement.Condition["ForAllValues:StringEquals"]["dynamodb:LeadingKeys"]) == toset([
        "quad-tfstate-tooling/staging/terraform.tfstate",
        "quad-tfstate-tooling/staging/terraform.tfstate-md5",
      ])
      && statement.Condition.Null["dynamodb:LeadingKeys"] == "false"
      if anytrue([for action in statement.Action : startswith(action, "dynamodb:")])
    ])
    error_message = "Lock access must be limited to the staging lock and digest items, with a Null guard on LeadingKeys."
  }

  # Unconditional ListBucket on the bucket, so a missing state object is a 404 (first plan or
  # apply) rather than a 403. It reveals key names only, and objects stay denied by the bucket policy.
  assert {
    condition = (
      length([for statement in jsondecode(aws_iam_role_policy.state_rw["staging"].policy).Statement : statement if contains(statement.Action, "s3:ListBucket")]) == 1
      && alltrue([
        for statement in jsondecode(aws_iam_role_policy.state_rw["staging"].policy).Statement :
        toset(statement.Action) == toset(["s3:ListBucket"])
        && toset(statement.Resource) == toset(["arn:aws:s3:::quad-tfstate-tooling"])
        && try(statement.Condition, null) == null
        if contains(statement.Action, "s3:ListBucket")
      ])
    )
    error_message = "ListBucket must be one unconditional statement on the state bucket alone."
  }

  assert {
    condition = alltrue(flatten([
      for statement in jsondecode(aws_iam_role_policy.state_rw["staging"].policy).Statement :
      [for resource in flatten([statement.Resource]) : resource != "*"]
    ]))
    error_message = "No read-write role statement may use Resource *."
  }
}

run "refuses_a_wildcard_principal" {
  command = plan

  variables {
    break_glass_principal_arns = ["arn:aws:iam::111111111111:role/*"]
  }

  expect_failures = [var.break_glass_principal_arns]
}

run "refuses_an_account_root_as_a_principal" {
  command = plan

  variables {
    state_environments = {
      staging = {
        plan_principal_arns  = ["arn:aws:iam::222222222222:root"]
        apply_principal_arns = ["arn:aws:iam::222222222222:role/quad-staging-apply"]
      }
    }
  }

  expect_failures = [var.state_environments]
}

run "refuses_no_break_glass_role" {
  command = plan

  variables {
    break_glass_principal_arns = []
  }

  expect_failures = [var.break_glass_principal_arns]
}
