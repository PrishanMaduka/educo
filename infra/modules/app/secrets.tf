# App secrets (`<name>/env/<NAME>`, spec 20 → Secrets), kept out of Terraform state (Task 8
# review): every version is written through secret_string_wo.
#   - SESSION_SECRET and LINK_SIGNING_SECRET come from `ephemeral "random_password"` (64
#     alphanumeric characters, one draw each, so they differ). Raising app_secret_versions[NAME]
#     writes a new value in the next apply; restart the api and worker afterwards.
#   - SENTRY_DSN and OTEL_EXPORTER_OTLP_HEADERS are set by hand (README). Terraform writes a
#     placeholder version once, so the tasks can start before they are set: ECS refuses a secret
#     without a current version, and Secrets Manager refuses an empty string. The placeholder is
#     a JSON object whose keys hold empty strings, and the task definitions read one key each
#     (`<arn>:<key>::`), so the apps see an empty variable, which they treat as unset. Its
#     write-only version never changes, so Terraform never overwrites a value set by hand.
#     SENTRY_DSN has one key per Sentry project: api (the api and the worker), staff and console.

locals {
  generated_app_secrets = toset(["SESSION_SECRET", "LINK_SIGNING_SECRET"])

  placeholder_app_secrets = {
    SENTRY_DSN                 = jsonencode({ api = "", staff = "", console = "" })
    OTEL_EXPORTER_OTLP_HEADERS = jsonencode({ value = "" })
  }

  app_secret_names = concat(sort(local.generated_app_secrets), sort(keys(local.placeholder_app_secrets)))
}

ephemeral "random_password" "app" {
  for_each = local.generated_app_secrets

  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  #checkov:skip=CKV2_AWS_57:Generated secrets rotate by raising app_secret_versions, the others are set by hand; Secrets Manager rotation arrives with production in M12.
  for_each = toset(local.app_secret_names)

  name                    = "${var.name}/env/${each.key}"
  description             = "${each.key} for the Quad services"
  kms_key_id              = var.data_kms_key_arn
  recovery_window_in_days = 7

  tags = { service = "app" }
}

resource "aws_secretsmanager_secret_version" "generated" {
  for_each = local.generated_app_secrets

  secret_id                = aws_secretsmanager_secret.app[each.key].id
  secret_string_wo         = ephemeral.random_password.app[each.key].result
  secret_string_wo_version = var.app_secret_versions[each.key]
}

resource "aws_secretsmanager_secret_version" "placeholder" {
  for_each = local.placeholder_app_secrets

  secret_id                = aws_secretsmanager_secret.app[each.key].id
  secret_string_wo         = each.value
  secret_string_wo_version = 1
}
