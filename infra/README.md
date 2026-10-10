# Quad infrastructure

The Terraform that runs Quad on AWS (spec 20, decision D28 in spec 02). Staging is written and
validated offline, but it has never been applied: no AWS, Firebase, Sentry, Apple or Google account
exists yet. This file is the checklist for the first real deploy, the runbooks that go with it,
and the list of what has been proven only offline.

Contents:
1. [Layout and the validation commands](#1-layout-and-the-validation-commands)
2. [First deploy checklist](#2-first-deploy-checklist)
3. [First deploy checks](#3-first-deploy-checks)
4. [Runbooks](#4-runbooks)
5. [Accounts and keys to create](#5-accounts-and-keys-to-create)
6. [What CI does](#6-what-ci-does)
7. [Validation gaps](#7-validation-gaps)
8. [Open questions](#8-open-questions)
9. [Accepted risks for staging](#9-accepted-risks-for-staging)

Placeholders: `<tooling>` and `<staging>` are the 12-digit AWS account ids, `<state_bucket>`,
`<lock_table>` and `<state_kms_key_arn>` are outputs of `infra/bootstrap`, and `<you>` is your
GitHub user name. No account id is ever committed.

## 1. Layout and the validation commands

```
infra/
├── toolchain.json        # Terraform and provider versions, with the pinned SHA256SUMS hashes
├── .terraform-version    # 1.16.5, read by CI
├── .tflint.hcl, .checkov.yaml
├── bootstrap/            # tooling account: state bucket, lock table, state KMS key, state roles
├── envs/
│   ├── global/           # tooling account: the quad-edu.com zone, shared records, DNS roles, tooling plan role
│   └── staging/          # staging account: network → data → edge → dns → app, and the dashboard
├── modules/              # network, data, edge, dns, app (each with tests/<module>.tftest.hcl)
├── observability/        # cloudwatch/overview.json.tftpl, the starter dashboard
└── tests/mocks/          # shared mock values for terraform test
```

Every check runs without AWS. `scripts/infra-check.mjs` removes every `AWS_*` variable and sets
`AWS_EC2_METADATA_DISABLED=true` before it runs Terraform, and the tests use mocked providers.

```bash
pnpm infra:tools                                      # download Terraform and the providers, check every hash
eval "$(node scripts/terraform-mirror.mjs --print-env)"   # put that Terraform and the mirror on this shell
pnpm infra:check                                      # fmt, init -backend=false, validate, terraform test, then tflint and checkov if on PATH
node scripts/infra-check.mjs --only infra/modules/edge  # one root or module
```

`infra:check` runs tflint and checkov only when they are on `PATH`. Locally checkov lives in a
virtual environment: `python3 -m venv .cache/checkov && .cache/checkov/bin/pip install checkov==3.3.25`,
then `PATH="$PWD/.cache/checkov/bin:$PATH" pnpm infra:check`. CI sets `QUAD_REQUIRE_INFRA_TOOLS=1`, so
there a missing scanner fails the run.

## 2. First deploy checklist

Do these in order. Each step says who runs it and where. Run the Terraform steps from the
repository root, on `main`, with the pinned Terraform (`pnpm infra:tools` and the `eval` line
above) and your Identity Center credentials (`aws sso login --profile <profile>` and
`export AWS_PROFILE=<profile>`). Never put an account id or a secret into a committed file.

### Step 1. Create the AWS accounts

1. Sign up for a new AWS account to be the **management account** (it holds only Organizations,
   billing and Identity Center). Turn on MFA for its root user and store the root credentials in
   the team password manager.
2. In that account, open **AWS Organizations → Create an organization**, then create the two member
   accounts (they are named `tooling` and `staging` everywhere in this repository):
   ```bash
   aws organizations create-account --email aws-tooling@quad-edu.com --account-name tooling
   aws organizations create-account --email aws-staging@quad-edu.com --account-name staging
   aws organizations list-accounts --query 'Accounts[].[Name,Id]' --output table   # note <tooling> and <staging>
   ```
3. Turn on **IAM Identity Center** in `ap-south-1` (IAM Identity Center → Enable). Create a user for
   each administrator, with MFA required.
4. Set up the budget alarm: **Billing and Cost Management → Budgets → Create budget → Monthly cost
   budget**, USD 300 for staging (spec 20) with alerts at 80% actual and 100% forecast to a Quad
   mailbox. Turn on **Cost allocation tags** for `env`, `service`, `owner` and `cost-centre` once
   the first resources carry them.

### Step 2. Create the administrator roles and copy their ARNs

1. In IAM Identity Center, create a permission set from the AWS managed policy
   `AdministratorAccess` (keep the default name `AdministratorAccess`, session 1 hour).
2. Assign it to the administrators in **both** the `tooling` and the `staging` account
   (AWS accounts → select the account → Assign users or groups).
3. Identity Center then creates a role named `AWSReservedSSO_AdministratorAccess_<hash>` in each
   account. Copy each one's full ARN, **path included**, from IAM, signed in to that account:
   ```bash
   aws iam list-roles --path-prefix /aws-reserved/sso.amazonaws.com/ \
     --query "Roles[?starts_with(RoleName, 'AWSReservedSSO_AdministratorAccess_')].RoleName" --output text
   aws iam get-role --role-name AWSReservedSSO_AdministratorAccess_<hash> --query Role.Arn --output text
   # arn:aws:iam::<tooling>:role/aws-reserved/sso.amazonaws.com/<region>/AWSReservedSSO_AdministratorAccess_<hash>
   ```
   Do **not** copy it from `aws sts get-caller-identity`: that returns the assumed-role session
   ARN without the path, which the state bucket policy would not match. Below, `<tooling admin
   role>` and `<staging admin role>` are these two ARNs.
4. If the permission set is ever recreated, the hash changes and the bucket policy no longer
   matches. The tooling account's root user can still rewrite the bucket policy to recover.

### Step 3. Bootstrap the state bucket (tooling account, as the tooling administrator)

The bootstrap root creates the state bucket `quad-tfstate-tooling`, the lock table
`quad-terraform-locks`, the state KMS key and the per-environment state roles. Its own state then
moves into that bucket at `bootstrap/terraform.tfstate`, which only break-glass roles can reach.

1. The bucket does not exist yet, so the first apply uses local state. Create the git-ignored file
   `infra/bootstrap/local_override.tf`:
   ```bash
   printf 'terraform {\n  backend "local" {}\n}\n' > infra/bootstrap/local_override.tf
   git check-ignore infra/bootstrap/local_override.tf   # must print the path
   ```
2. First apply. This one command lists the principals for both the tooling and the staging
   account; the staging roles do not exist yet, which IAM accepts because the trust policies match
   them by ARN:
   ```bash
   terraform -chdir=infra/bootstrap init
   terraform -chdir=infra/bootstrap apply \
     -var 'break_glass_principal_arns=["<tooling admin role>"]' \
     -var 'state_environments={global={plan_principal_arns=["arn:aws:iam::<tooling>:role/quad-tooling-plan"],apply_principal_arns=["<tooling admin role>"]},staging={plan_principal_arns=["arn:aws:iam::<staging>:role/quad-staging-plan"],apply_principal_arns=["arn:aws:iam::<staging>:role/quad-staging-apply"]}}'
   terraform -chdir=infra/bootstrap output
   ```
   Keep the output: `state_bucket`, `lock_table`, `state_kms_key_arn`, `state_read_role_arns` and
   `state_rw_role_arns`. Every later bootstrap apply must pass the same two `-var` values (with the
   changes steps 6 and 6c describe); keep the exact command in the team password manager next to
   the ARNs.
3. Move the state into the bucket. No `assume_role` here: only break-glass roles can reach
   `bootstrap/terraform.tfstate`.
   ```bash
   rm infra/bootstrap/local_override.tf
   terraform -chdir=infra/bootstrap init -migrate-state \
     -backend-config bucket=<state_bucket> \
     -backend-config dynamodb_table=<lock_table> \
     -backend-config kms_key_id=<state_kms_key_arn>
   # answer "yes" to copy the state, then:
   rm -f infra/bootstrap/terraform.tfstate infra/bootstrap/terraform.tfstate.backup
   terraform -chdir=infra/bootstrap plan   # same -var values as above: expect no changes
   ```
   `kms_key_id` is required on every backend: with `encrypt = true` alone the backend asks for
   AES256, and the bucket policy refuses the upload.

### Step 4. Apply the global root and delegate quad-edu.com (tooling account)

The global root creates the `quad-edu.com` hosted zone and its shared records (CAA, the apex Google
Workspace MX and SPF, DMARC, the `mail.` and `bounce.mail.` records), the DNS roles and the
tooling plan role.

1. Before you delegate, list the records the domain uses today at the registrar (`dig any
   quad-edu.com`, and MX, TXT and CNAME records for any subdomain in use, such as Google Workspace
   verification). Anything not in `infra/envs/global` must be added there first, or it stops
   resolving when the name servers change. That includes the GitHub Pages records if the
   pre-launch site must stay up ([Pre-launch site](#pre-launch-site-github-pages)).
2. As the tooling administrator:
   ```bash
   terraform -chdir=infra/envs/global init \
     -backend-config bucket=<state_bucket> \
     -backend-config dynamodb_table=<lock_table> \
     -backend-config kms_key_id=<state_kms_key_arn> \
     -backend-config 'assume_role={role_arn="<state_rw_role_arns.global>"}'
   terraform -chdir=infra/envs/global apply \
     -var 'dns_writer_principal_arns={staging=["arn:aws:iam::<staging>:role/quad-staging-apply"]}' \
     -var 'dns_reader_principal_arns=["arn:aws:iam::<staging>:role/quad-staging-plan"]'
   terraform -chdir=infra/envs/global output
   ```
   If `init` refuses the `assume_role` line, see [the backend syntax check](#backend-assume_role-syntax).
3. At the registrar for `quad-edu.com`, replace the name servers with the four in the
   `name_servers` output. Then wait until the delegation is visible (minutes to 48 hours):
   ```bash
   dig +short NS quad-edu.com            # must list the four Route 53 name servers
   dig +short NS quad-edu.com @8.8.8.8   # and the same from a public resolver
   ```
   Do not start step 6 before this: the staging certificates validate through this zone.

### Step 5. Set up GitHub (repository admin)

The repository `prishanmaduka/educo` is **public**, so job logs and pull request comments are
world-readable, and the protections below must exist before any role ARN becomes a variable.

1. **OIDC subject template.** The AWS trust policies match subjects of the form
   `repo:prishanmaduka/educo:environment:staging:ref:refs/heads/main`, which GitHub issues only
   with the claim keys `repo`, `context` and `ref`. Set it once:
   ```bash
   scripts/github-oidc-subject.sh            # gh api PUT repos/prishanmaduka/educo/actions/oidc/customization/sub
   # or by hand:
   gh api --method PUT repos/prishanmaduka/educo/actions/oidc/customization/sub \
     --input - <<< '{"use_default":false,"include_claim_keys":["repo","context","ref"]}'
   gh api repos/prishanmaduka/educo/actions/oidc/customization/sub   # check it took effect
   ```
2. **Actions settings** (Settings → Actions → General):
   - Workflow permissions: **Read repository contents and packages permissions** (the workflows ask
     for more per job):
     `gh api --method PUT repos/prishanmaduka/educo/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false`
   - Fork pull request workflows: **Require approval for all external contributors**, and keep
     **Send write tokens to workflows from fork pull requests** off (and **Send secrets** off).
   - Never add a workflow triggered by `pull_request_target`: it runs fork code with this
     repository's token and secrets. `infra.yml` plans only on `pull_request` from this repository.
3. **Environments** (ruling R-env-approvals). All three have **Deployment branches: main only** (a
   selected-branches rule for `main`): without it, a workflow file on any branch could ask for the
   environment.

   | Environment | Used by | Required reviewers |
   |---|---|---|
   | `staging` | the deploy jobs (`build-push`, `migrate`, `deploy`, `seed`) | **none**, so a merge to `main` deploys staging with no manual step (spec 18 M0b Accept) |
   | `staging-stores` | `parent-ios` and `parent-android`; holds the fastlane secrets (step 5.6) | yes |
   | `infra-staging` | `infra.yml`'s `apply` and weekly `drift` | yes |

   Get your user id with `gh api users/<you> --jq .id`, then:
   ```bash
   put_env() {  # $1 = environment, $2 = reviewers JSON array
     gh api --method PUT "repos/prishanmaduka/educo/environments/$1" --input - <<EOF
   {"reviewers":$2,
    "deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
   EOF
     gh api --method POST "repos/prishanmaduka/educo/environments/$1/deployment-branch-policies" \
       -f name=main -f type=branch
   }
   put_env staging '[]'
   put_env staging-stores '[{"type":"User","id":<your id>}]'
   put_env infra-staging '[{"type":"User","id":<your id>}]'
   ```
   The smoke job uses no environment (it needs no AWS credentials or secrets). The deploy role's
   path to the database master secret (it can pass `migrate-exec` to `RunTask`;
   [accepted risks](#9-accepted-risks-for-staging)) is limited by `staging` being main-only and by
   the branch protection below, which makes every change to `main` a reviewed pull request. With a
   single maintainer, leave "Prevent self-review" off, or nobody can approve.
4. **Branch protection for `main`**, before `AWS_STAGING_DEPLOY_ROLE_ARN` is set: changes reach
   `main` only through pull requests with an approving review and the CI job names below (the old
   "Verify and build" check no longer exists). Because `staging` has no reviewers, this protection
   is what stands between a change and the deploy role.
   ```bash
   gh api --method PUT repos/prishanmaduka/educo/branches/main/protection --input - <<'EOF'
   {"required_status_checks":{"strict":true,"contexts":["typecheck","lint","unit","codegen","api-integration","e2e-smoke","build"]},
    "enforce_admins":true,
    "required_pull_request_reviews":{"required_approving_review_count":1,"dismiss_stale_reviews":true},
    "restrictions":null,"allow_force_pushes":false,"allow_deletions":false}
   EOF
   ```
   GitHub does not let authors approve their own pull requests, so with a single maintainer use
   `"required_approving_review_count":0` (pull requests and checks still required) until a second
   maintainer exists, and record that as an open gap.
   `images`, `parent-build` and Infra's `checks` also run; add them if you want them required.
5. **Variables.** Leave them unset until the step that produces each value, because every AWS job
   skips (and stays green) while its variable is empty. All are repository variables
   (Settings → Secrets and variables → Actions → Variables, or `gh variable set <NAME> --body
   <value>`). They are ARNs, names and public DSNs, never secrets. These are exactly the `vars.*`
   names the workflows read:

   | Variable | Value | Set in step |
   |---|---|---|
   | `TF_STATE_BUCKET` | bootstrap output `state_bucket` | 6c |
   | `TF_LOCK_TABLE` | bootstrap output `lock_table` | 6c |
   | `TF_STATE_KMS_KEY_ARN` | bootstrap output `state_kms_key_arn` | 6c |
   | `TF_STAGING_STATE_READ_ROLE_ARN` | bootstrap output `state_read_role_arns["staging"]` | 6c |
   | `TF_STAGING_STATE_RW_ROLE_ARN` | bootstrap output `state_rw_role_arns["staging"]` | 6c |
   | `TF_DNS_READ_ROLE_ARN` | global output `dns_read_role_arn` | 6c |
   | `TF_STAGING_DNS_WRITE_ROLE_ARN` | global output `dns_write_role_arns["staging"]` | 6c |
   | `AWS_STAGING_PLAN_ROLE_ARN` | staging output `plan_role_arn` | 6c |
   | `AWS_STAGING_APPLY_ROLE_ARN` | staging output `apply_role_arn` | 6c |
   | `OTEL_EXPORTER_OTLP_ENDPOINT` | the Grafana Cloud OTLP gateway URL (empty leaves tracing off); the staging plan and apply pass it as `-var otel_exporter_endpoint` | 6c, before the plan and apply roles |
   | `AWS_STAGING_DEPLOY_ROLE_ARN` | staging output `deploy_role_arn` | 9 (setting it switches the deploy on) |
   | `SENTRY_DSN_STAFF`, `SENTRY_DSN_CONSOLE` | the `quad-staff` and `quad-console` DSNs (built into the browser bundle) | 10 |
   | `IOS_UPLOAD_ENABLED`, `PLAY_UPLOAD_ENABLED` | `true` once the store accounts and the secrets below exist | [5](#5-accounts-and-keys-to-create) |

   `TF_GLOBAL_STATE_READ_ROLE_ARN` and `AWS_TOOLING_PLAN_ROLE_ARN` are reserved names for a future
   CI plan of `envs/global` (bootstrap output `state_read_role_arns["global"]` and global output
   `tooling_plan_role_arn`). No workflow reads them yet, because `infra.yml` has no global plan
   (its principal lists include Identity Center ARNs that are not variables); the tooling
   administrator plans and applies `envs/global` by hand.

   Set the variables with the outputs, for example:
   ```bash
   gh variable set TF_STATE_BUCKET --body "$(terraform -chdir=infra/bootstrap output -raw state_bucket)"
   gh variable set TF_STAGING_STATE_RW_ROLE_ARN --body "$(terraform -chdir=infra/bootstrap output -json state_rw_role_arns | jq -r .staging)"
   ```
6. **Environment secrets for fastlane** (`staging-stores` environment only; `gh secret set <NAME>
   --env staging-stores`). The lanes read exactly these (`apps/parent/fastlane/README.md`):

   | Secret | Lane | What it is |
   |---|---|---|
   | `MATCH_GIT_URL` | `ios staging` | the private match certificates repository |
   | `MATCH_PASSWORD` | `ios staging` | match's encryption passphrase |
   | `MATCH_GIT_BASIC_AUTHORIZATION` | `ios staging` | base64 of `user:token` with read access to that repository |
   | `ASC_KEY_ID`, `ASC_ISSUER_ID` | `ios staging` | App Store Connect API key id and issuer id |
   | `ASC_KEY_P8_B64` | `ios staging` | base64 of the API key's `.p8` |
   | `GOOGLE_SERVICE_INFO_PLIST_B64` | `ios staging` (optional until M6) | base64 of the `quad-staging` iOS Firebase config |
   | `ANDROID_KEYSTORE_B64` | `android staging` | base64 of the Play upload keystore |
   | `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | `android staging` | the keystore password, key alias and key password |
   | `PLAY_SERVICE_ACCOUNT_JSON` | `android staging` | the Play service account's JSON key (contents) |

   For example `base64 -w0 AuthKey_<id>.p8 | gh secret set ASC_KEY_P8_B64 --env staging-stores`.
   The `staging` environment holds no secrets.

### Step 6. First staging apply, with no services running (staging administrator)

The CI roles `quad-staging-plan`, `quad-staging-apply` and `quad-staging-deploy` are created by this
apply, so a staging administrator runs it once by hand.

**6a. Let the staging administrator reach state and DNS for now.** Add `<staging admin role>` to
`state_environments.staging.apply_principal_arns` in bootstrap and to
`dns_writer_principal_arns.staging` in global, then apply both as the tooling administrator:
```bash
terraform -chdir=infra/bootstrap apply \
  -var 'break_glass_principal_arns=["<tooling admin role>"]' \
  -var 'state_environments={global={plan_principal_arns=["arn:aws:iam::<tooling>:role/quad-tooling-plan"],apply_principal_arns=["<tooling admin role>"]},staging={plan_principal_arns=["arn:aws:iam::<staging>:role/quad-staging-plan"],apply_principal_arns=["arn:aws:iam::<staging>:role/quad-staging-apply","<staging admin role>"]}}'
terraform -chdir=infra/envs/global apply \
  -var 'dns_writer_principal_arns={staging=["arn:aws:iam::<staging>:role/quad-staging-apply","<staging admin role>"]}' \
  -var 'dns_reader_principal_arns=["arn:aws:iam::<staging>:role/quad-staging-plan"]'
```

**6b. Apply staging at zero tasks**, signed in to the staging account as `<staging admin role>`.
`desired_count=0` because no image exists yet (ruling R-desired-count: Terraform owns the count):
```bash
terraform -chdir=infra/envs/staging init \
  -backend-config bucket=<state_bucket> \
  -backend-config dynamodb_table=<lock_table> \
  -backend-config kms_key_id=<state_kms_key_arn> \
  -backend-config 'assume_role={role_arn="<state_rw_role_arns.staging>"}'
terraform -chdir=infra/envs/staging apply \
  -var dns_role_arn=<dns_write_role_arns.staging> \
  -var desired_count=0
terraform -chdir=infra/envs/staging output
```
Expect a long first apply: CloudFront and the certificate validation take 15 to 40 minutes, and the
data key's CloudFront statement waits for the distribution. If the apply stops part-way, run it
again with the same command; if it stopped between two writes of one secret, see
[partial-apply divergence](#partial-apply-divergence).

**6c. Hand over to CI.** Set the GitHub variables from step 5.5 marked "6c" (not
`AWS_STAGING_DEPLOY_ROLE_ARN` yet). Then open a small pull request that touches `infra/`: its
`plan (staging)` job must post a plan summary with no changes. Merge it: `apply (staging)` waits for
an `infra-staging` reviewer and must apply cleanly. Keep `<staging admin role>` listed until
step 13: steps 9 and 10 still use it.

### Step 7. Push the bootstrap images (staging administrator)

The first task definitions point at the tag `bootstrap`. ECR tags are immutable, so push each image
once with that tag, from a machine with Docker:
```bash
registry=$(terraform -chdir=infra/envs/staging output -json ecr_repository_urls | jq -r .api | cut -d/ -f1)
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin "$registry"
node scripts/docker-build.mjs api     --tag "$registry/quad/api:bootstrap"     --push
node scripts/docker-build.mjs clamav  --tag "$registry/quad/clamav:bootstrap"  --push
for app in staff console; do
  node scripts/docker-build.mjs "$app" --tag "$registry/quad/$app:bootstrap" --push \
    --build-arg NEXT_PUBLIC_APP_ENV=staging --build-arg NEXT_PUBLIC_API_URL=https://staging.quad-edu.com
done
```
The worker, migrate, seed and db-bootstrap tasks run the api image.

### Step 8. Bootstrap the database roles, migrate and seed (staging administrator)

First set the app secrets that Terraform leaves as placeholders (D32). The api and worker refuse to
start without an Ed25519 key pair or the Turnstile secret (their config check, D57), and the seed
task refuses to run while `SEED_PASSWORD` is empty (its own check, `seedPasswordRefusal`). Make the
pair on your own machine, store it, then delete the files:
```bash
openssl genpkey -algorithm ed25519 -out jwt-private.pem
openssl pkey -in jwt-private.pem -pubout -out jwt-public.pem
aws secretsmanager put-secret-value --secret-id quad-staging/env/JWT_PRIVATE_KEY \
  --secret-string "$(jq -n --rawfile v jwt-private.pem '{value: $v}')"
aws secretsmanager put-secret-value --secret-id quad-staging/env/JWT_PUBLIC_KEY \
  --secret-string "$(jq -n --rawfile v jwt-public.pem '{value: $v}')"
rm jwt-private.pem jwt-public.pem
read -rs SEED && aws secretsmanager put-secret-value --secret-id quad-staging/env/SEED_PASSWORD \
  --secret-string "$(jq -n --arg v "$SEED" '{value: $v}')"; unset SEED
read -rs TURNSTILE && aws secretsmanager put-secret-value --secret-id quad-staging/env/TURNSTILE_SECRET_KEY \
  --secret-string "$(jq -n --arg v "$TURNSTILE" '{value: $v}')"; unset TURNSTILE
```
The Turnstile secret comes from the Cloudflare Turnstile widget for the public site (Cloudflare
dashboard, Turnstile, the widget's settings). `TURNSTILE_EXPECTED_HOSTNAME` is not a secret: the
module sets it from `turnstile_expected_hostname` (`staging.quad-edu.com` in `envs/staging`).
`SALES_INBOX`, where demo request notifications go, is not a secret either: the module sets it
from `sales_inbox` (`support@quad-edu.com` in `envs/staging`, the owner's choice, OQ2).
`SUPPORT_INBOX`, the Reply-To of Quad's own mail (spec 12), comes from `support_inbox` the same
way (`support@quad-edu.com` in `envs/staging`).
The seed password is the staging password of the seeded sample accounts: 10 characters or more,
and never the local placeholder from `.env.example`. Outside local, the seed refuses that
placeholder or an empty value, and the api refuses the placeholder if it is ever given one.
`FIELD_ENCRYPTION_KEY` needs nothing: Terraform generates it (64 characters; the API needs 32 or
more). Never rotate it before M12's KMS adapter: a new key leaves every encrypted field, such as
the TOTP secrets people set up, unreadable. These secrets keep their hand-set values across applies, like
`SENTRY_DSN` ([check](#placeholder-secrets-stay-untouched)).

Before the first deploy, check:
- [ ] `quad-staging/env/JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` hold one Ed25519 pair (PEM), not the
  `.env.example` pair, which the API recognises and refuses outside local.
- [ ] `quad-staging/env/SEED_PASSWORD` is set: 10 characters or more, not the local placeholder.
- [ ] `quad-staging/env/TURNSTILE_SECRET_KEY` holds the real secret of the Cloudflare widget whose
  hostnames are `quad-edu.com` and `staging.quad-edu.com`, never one of Cloudflare's test secrets
  (`1x…AA`, `2x…AA`, `3x…AA`), which the API refuses outside local (D57).
- [ ] `quad-staging/env/FIELD_ENCRYPTION_KEY` exists (Terraform made it); leave it alone.
- [ ] Nothing sets `DEV_FIXED_OTP` for staging (no task definition, secret or tfvars entry). The api
  refuses to boot with it unless `APP_ENV=local` (D46, D54), so staging sign-in always needs a real
  authenticator code (staff two-step and the console) or a real SMS code (parents).

The staging seed gives the seeded staff and console accounts no authenticator (D55), and prints no
secrets. Each sample person's first sign-in sets two-step up with a phone authenticator app: the
page shows a QR code and a key, the first code turns it on, and then it shows the recovery codes.
The console always asks for this; the staff portal asks wherever the school's two-step rule
covers the person (every seeded staff account today). Running the seed task again clears these
authenticators, which is also how to reset a sample person's two-step until M2.

`scripts/ecs-deploy.mjs` reads the cluster, subnets and security groups from SSM
(`/quad/staging/deploy/*`) and fails unless the one-off task's container exits 0. Run the three
Terraform-registered task definitions in order:
```bash
for task in db-bootstrap migrate seed; do
  arn=$(aws ecs describe-task-definition --task-definition "quad-staging-$task" \
    --query taskDefinition.taskDefinitionArn --output text)
  node scripts/ecs-deploy.mjs run-task --family-arn "$arn" --container "$task" || break
done
```
db-bootstrap connects to RDS directly as the RDS-managed master user (ruling R-db-admin) and creates
`quad_owner`, `quad_app` and `quad_platform`; it fails if `quad_platform` cannot get `BYPASSRLS`
([check](#rds-bypassrls-for-quad_platform)). The seed runs only because its task sets
`APP_ENV=staging`. Logs are in CloudWatch under `/quad/staging/<task>`.

### Step 9. Scale up and run the first deploy

1. Apply staging with the default `desired_count = 1`. Either run the 6b command without
   `-var desired_count=0` (as the staging administrator, if your ARN is still listed) or merge any
   `infra/` change and let `apply (staging)` run. Every service starts on the `bootstrap` images;
   check they become healthy in ECS → Clusters → `quad-staging` → Services.
2. Set `AWS_STAGING_DEPLOY_ROLE_ARN` from the staging output `deploy_role_arn`.
3. Run the deploy by hand from `main` (after CI has passed on that commit):
   `gh workflow run deploy-staging.yml --ref main`, and follow it with `gh run watch` (the
   `staging` environment needs no approval). It builds and pushes the commit's images, runs db-bootstrap and
   migrate, deploys every service, seeds and runs the smoke checks. From now on every green CI run
   on `main` deploys.

### Step 10. Sentry and OpenTelemetry (staging administrator)

1. Put the DSNs and the Grafana OTLP headers into the secrets in the JSON shape the task
   definitions read (each container reads one key; the worker uses `api`):
   ```bash
   aws secretsmanager put-secret-value --secret-id quad-staging/env/SENTRY_DSN \
     --secret-string '{"api":"<quad-api dsn>","staff":"<quad-staff dsn>","console":"<quad-console dsn>"}'
   aws secretsmanager put-secret-value --secret-id quad-staging/env/OTEL_EXPORTER_OTLP_HEADERS \
     --secret-string '{"value":"Authorization=Basic <base64 of instance id:token>"}'
   ```
   Paste the values from a file or a prompt, not from shell history (`history -d`, or a leading
   space with `HISTCONTROL=ignorespace`).
   Do not remove the placeholder versions from Terraform state: the next apply would create them
   again, over the hand-set values. Their write-only value is sent only when
   `secret_string_wo_version` changes, and it is fixed at `1`, so Terraform never writes it again
   ([check](#placeholder-secrets-stay-untouched)).
2. Set `OTEL_EXPORTER_OTLP_ENDPOINT` (if not set in 6c) and `SENTRY_DSN_STAFF` / `SENTRY_DSN_CONSOLE`,
   then let the next infra apply and app deploy pick them up.
3. Force a new deployment of every service, because ECS reads secrets only when a task starts:
   ```bash
   for s in api worker staff console clamav; do
     aws ecs update-service --cluster quad-staging --service "$s" --force-new-deployment > /dev/null
   done
   ```
4. Send a test error from a one-off api task and check it arrives in the `quad-api` project
   (`dist/sentry-test.js` fails unless Sentry accepted it):
   ```bash
   aws ecs run-task --cluster quad-staging --launch-type FARGATE --task-definition quad-staging-api \
     --network-configuration "awsvpcConfiguration={subnets=[$(node scripts/ecs-deploy.mjs setting --name subnets)],securityGroups=[$(node scripts/ecs-deploy.mjs setting --name security_groups)],assignPublicIp=DISABLED}" \
     --overrides '{"containerOverrides":[{"name":"api","command":["node","dist/sentry-test.js"]}]}'
   ```
5. The parent app's staging DSN (`quad-parent`) goes in `apps/parent/env/staging.json` through a
   pull request (DSNs are public keys).
6. Traces: check spans from `quad-api`, `quad-staff` and `quad-console` in Grafana. Spans carry
   `tenant_id` only from M1, when requests have a tenant.

### Step 11. Email (SES)

1. Once the API is up, check the SES events subscription is confirmed (the webhook confirms it
   itself):
   ```bash
   topic=$(aws sns list-topics --query "Topics[?ends_with(TopicArn, ':quad-staging-ses-events')].TopicArn" --output text)
   aws sns list-subscriptions-by-topic --topic-arn "$topic" --query 'Subscriptions[].[Endpoint,SubscriptionArn]'
   ```
   A `SubscriptionArn` of `PendingConfirmation` means it was missed: see
   [the SES runbook](#ses-events-subscription).
2. SES starts in the **sandbox**: it sends only to verified addresses, at most 200 a day. Verify a
   test mailbox (`aws sesv2 create-email-identity --email-identity <you>@quad-edu.com`, then click
   the link) and a mail-tester address. Send a test email from staging to
   `https://www.mail-tester.com` and check SPF, DKIM and DMARC pass, and that the MAIL FROM is
   `bounce.mail.quad-edu.com`.
3. Ask AWS for SES production access (SES → Account dashboard → Request production access) before
   M12, with the use case "transactional school notifications, bounces and complaints handled by a
   webhook into a suppression list".

### Step 12. Store builds

Once the accounts in [section 5](#5-accounts-and-keys-to-create) and the step 5.6 secrets exist, set
`IOS_UPLOAD_ENABLED=true` and/or `PLAY_UPLOAD_ENABLED=true`. On the next deploy, a `staging-stores`
reviewer approves `parent-ios` and `parent-android`, which then upload to TestFlight and the Play
internal track (the AWS deploy does not wait for them). Play uploads are drafts until the app's first release is published
([runbook](#play-draft-promotion)).

### Step 13. Remove the administrator's access to staging state and DNS

Once CI has applied cleanly (6c) and steps 9 to 11 are done, remove `<staging admin role>` from both
lists: run the step 3 bootstrap apply and the step 4 global apply again, exactly as written there
(without the ARN), as the tooling administrator. Then check that `terraform plan` of both roots
shows no changes. To do a one-off staging operation by hand later (a `-replace`, a `state rm`), add
the ARN back the same way (6a) and remove it afterwards.

## 3. First deploy checks

These were proven only on paper or with mocked providers. Check each one during or just after the
first deploy and record the result in the M0b pull request.

**Images and tasks**
- **VOLUME ownership on Fargate.** Fargate fills an ephemeral volume from the image, contents and
  ownership, only at a path the image declares as a `VOLUME`. `aws ecs execute-command` is off, so
  check through the services: clamav becomes healthy without downloading `main.cvd` first (its
  log has no "Updating initial database"), and staff serves `/_next/image` without `EACCES` in its
  log. A root-owned empty volume shows up as `EACCES` or `EROFS`.
- **Empty JSON-key secrets.** Before step 10, the api, worker, staff and console tasks start with
  the placeholder JSON (`{"api":""}` and so on), and their logs show Sentry and tracing off. If ECS
  refuses to start a task with an empty value, do not put a fake DSN in its place (the apps would
  try to send to it): record it and decide how to inject "unset" before M1.
- **Bootstrap tag.** The services start from the `bootstrap` images and the deploy replaces them.
- <a id="placeholder-secrets-stay-untouched"></a>**Placeholder secrets stay untouched.** The first
  `apply (staging)` after step 10 plans no change to
  `module.app.aws_secretsmanager_secret_version.placeholder["SENTRY_DSN"]` or
  `…placeholder["OTEL_EXPORTER_OTLP_HEADERS"]`, nor to the JWT keys, `SEED_PASSWORD` or `TURNSTILE_SECRET_KEY` set in step 8
  (the plan summary lists none of them), and afterwards
  `aws secretsmanager get-secret-value --secret-id quad-staging/env/SENTRY_DSN --query VersionStages`
  still shows the hand-set version as `AWSCURRENT`. If a refresh would move `AWSCURRENT` back to the
  placeholder version, stop and decide before applying (for example a `lifecycle` change in
  `infra/modules/app/secrets.tf`); do not remove the resources from state, which would re-create them.

**Terraform and state**
- <a id="backend-assume_role-syntax"></a>**Backend `assume_role` syntax.** `init
  -backend-config 'assume_role={role_arn="…"}'` and the workflows' `backend.hcl` block form both
  work. If the CLI form is refused, write the same `backend.hcl` file the workflows write and pass
  `-backend-config=backend.hcl`.
- **State roles.** A plan with the read role and `-lock=false` works: S3 `ListBucket` (including the
  `env:/` prefix that `init` lists), `GetItem` on the `-md5` digest item, and no lock call. The apply
  role locks and writes. DynamoDB encryption with the state key needs no caller KMS permission (the
  ViaService grant is there in case it does).
- **`tags_all`** on a real resource has `env`, `owner`, `cost-centre` and `service`
  (`aws ec2 describe-vpcs --filters Name=tag:Name,Values=quad-staging --query 'Vpcs[].Tags'` or
  `terraform state show module.network.aws_vpc.this`). The mocked tests cannot see the provider's
  `default_tags` merge.
- **A tags-only plan replaces no secret version.** Change one tag in a branch: the PR plan summary
  must show no `aws_secretsmanager_secret_version` replaced. If it does, `replace_triggered_by` sees
  an unknown address on an in-place change ([runbook](#replace_triggered_by-edge-cases)).
- **Engine version.** The RDS instance pins `16` (major only); a plan after AWS picks a minor
  version shows no diff on `engine_version`.
- **DNS roles.** `TF_DNS_READ_ROLE_ARN` and `TF_STAGING_DNS_WRITE_ROLE_ARN` are in the tooling
  account (same account id). The staging root's `check "dns_role_is_a_tooling_dns_role"` warns
  otherwise.
- **The dashboard** `quad-staging-overview` (CloudWatch → Dashboards) shows data in every widget.
  CloudWatch validates the body only when it is applied.

**IAM**
- GitHub OIDC: the plan job assumes the plan role only from a same-repository pull request, the
  apply and drift jobs the apply role only from `infra-staging` on `main`, and the deploy jobs the
  deploy role only from `staging` on `main` (custom subject claims, step 5.1). A run from another
  branch fails at `configure-aws-credentials`.
- The deploy role's `RunTask` and `StopTask` are limited by `ecs:cluster` to the staging cluster.
- The api's SES permission is scoped to the identity and the configuration set ARN; sending works.
- `kms:ViaService` grants work for S3 and Secrets Manager (uploads to the private bucket, task
  start reading secrets).
- `quad-dns-records-staging`: `ChangeResourceRecordSetsNormalizedRecordNames` with `StringLike`
  matches the ACM validation and DKIM names, and only A, AAAA and CNAME are allowed.
- The plan role is refused `GetSecretValue`, `ssm:GetParameter*`, `kms:Decrypt` and log reads.
- The state bucket policy matches the Identity Center role ARNs with their path.

**Edge**
- **ACM shared validation record.** One validation record per name serves both the us-east-1 and
  ap-south-1 certificates (the precondition fails clearly if not).
- **CloudFront host-certificate check.** CloudFront forwards the viewer's Host and checks the origin
  certificate against it; the ALB certificate names the web and console hosts, so origin requests
  succeed (no 502).
- **Managed policy ids** (CachingDisabled, CachingOptimized, AllViewer) are accepted.
- **WAF body-size label.** The `body-size` rule matches the label
  `awswaf:managed:aws:core-rule-set:SizeRestrictions_Body`: in WAF → Web ACLs → sampled requests, a
  >8 KB POST outside `/api/v1/` is blocked by `body-size`, and one under `/api/v1/` is not.
- WAF metrics appear on the dashboard's "requests WAF blocked" widget.
- **The ALB is reachable only through CloudFront.** From outside AWS, a direct request times out,
  because the ALB's security group admits only CloudFront's origin-facing prefix list:
  `curl --max-time 10 -sk https://origin.staging.quad-edu.com/` must fail with a timeout (exit 28),
  not answer. Then check the listener in the API:
  ```bash
  alb=$(aws elbv2 describe-load-balancers --names quad-staging --query 'LoadBalancers[0].LoadBalancerArn' --output text)
  listener=$(aws elbv2 describe-listeners --load-balancer-arn "$alb" --query "Listeners[?Port==\`443\`].ListenerArn" --output text)
  aws elbv2 describe-rules --listener-arn "$listener" \
    --query 'Rules[].{priority:Priority,default:IsDefault,action:Actions[0].FixedResponseConfig,header:Conditions[?Field==`http-header`].HttpHeaderConfig.HttpHeaderName}'
  ```
  The default rule's action is a fixed response 403 with the body `Forbidden`, and every other rule
  has an `X-Quad-Origin-Secret` header condition. `pnpm smoke --origin` makes the same 403 check,
  but only from inside the VPC or an address in that prefix list, so the deploy does not run it.

**Data**
- <a id="rds-bypassrls-for-quad_platform"></a>**RDS BYPASSRLS for `quad_platform`.** db-bootstrap
  succeeds: the RDS master user (`rds_superuser`, not a superuser) may create a role with
  `BYPASSRLS`. If RDS refuses, db-bootstrap fails and names the role; stop and decide before M1.
- **RDS Proxy instance class.** The proxy is created and its targets are `AVAILABLE` with
  `db.t4g.medium`
  (`aws rds describe-db-proxy-targets --db-proxy-name quad-staging-db`). If the class is not
  supported, raise `db_instance_class` in the data module call and record it in D28.
- The proxy reaches Secrets Manager (through the endpoint in one zone).
- Slow-query logs carry no bind values (`log_parameter_max_length=0`).

**Email**
- **SES to the KMS-encrypted SNS topic.** The configuration set's event destination is created and a
  bounce from `bounce@simulator.amazonses.com` reaches the webhook (an `email_suppressions` row). If
  SES cannot publish, check the topic key's policy first.
- **SNS subscription confirmed** (step 11.1).

**Toolchain**
- **Cross-check the pinned SHA256 hashes** from a network without the TLS-intercepting proxy, and
  check HashiCorp's GPG signature. For each entry of `infra/toolchain.json`:
  ```bash
  curl -fsSLO https://releases.hashicorp.com/terraform/1.16.5/terraform_1.16.5_SHA256SUMS
  curl -fsSLO https://releases.hashicorp.com/terraform/1.16.5/terraform_1.16.5_SHA256SUMS.sig
  curl -fsSL https://www.hashicorp.com/.well-known/pgp-key.txt | gpg --import
  gpg --verify terraform_1.16.5_SHA256SUMS.sig terraform_1.16.5_SHA256SUMS
  sha256sum terraform_1.16.5_SHA256SUMS   # must equal terraform.sumsSha256
  # the same for terraform-provider-aws/6.67.0 and terraform-provider-random/3.9.1
  ```
  CI downloads the same files over direct TLS against the same pins, so a green `infra.yml` is
  partial evidence already.

## 4. Runbooks

Every staging value is a variable default or a module argument in `infra/envs/staging/main.tf`
(there are no tfvars). "Raise a version" means adding or changing that argument in a pull request;
the merge applies it through `infra.yml` after an `infra-staging` approval.

### Database and Redis secrets

**Rotation order.** Never change the order:
1. Raise the role's entry in `db_password_versions` (in the `module "data"` call, for example
   `db_password_versions = { quad_owner = 1, quad_app = 2, quad_platform = 1 }`), or
   `redis_auth_token_version` for Redis.
2. Apply (merge; `apply (staging)`). One apply writes the role secret that RDS Proxy reads and every
   URL secret built from it from one new value.
3. Run db-bootstrap, so the database role gets the new password (step 8's loop with `db-bootstrap`
   only). Not needed for Redis: ElastiCache takes the token in the apply.
4. Force a new deployment of `api` and `worker`, which read the URLs at start:
   `aws ecs update-service --cluster quad-staging --service api --force-new-deployment` (and
   `worker`). Between steps 2 and 4 new connections from running tasks can fail; do it outside
   school hours.

<a id="replace_triggered_by-edge-cases"></a>**`replace_triggered_by` edge cases.** A write-only value
is sent only when its version changes, so the URL secrets are replaced with their resource:
- replacing the RDS instance or the proxy rewrites all three database secrets with new passwords:
  run db-bootstrap, then restart `api` and `worker`;
- an in-place RDS or proxy update that leaves the address or endpoint unknown in the plan does the
  same (the tags-only check in section 3 shows whether this provider version does it);
- replacing Redis rewrites `REDIS_URL` with the new group's token;
- replacing only the `REDIS_URL` secret version (for example after a `taint`) needs a
  `redis_auth_token_version` raise in the same apply, because otherwise the token is not resent to
  ElastiCache and the URL holds a new token ElastiCache never got.

**ElastiCache ROTATE vs SET.** Token changes use the provider default strategy `ROTATE`, which keeps
the old token valid beside the new one. To retire the old token, add
`auth_token_update_strategy = "SET"` to `aws_elasticache_replication_group.this` in
`infra/modules/data/redis.tf` for one later apply (it is not a variable yet), then remove it.

<a id="partial-apply-divergence"></a>**Partial-apply divergence.** If an apply fails between
writing a role secret and its URL secret (or the Redis token and `REDIS_URL`), the next apply
generates a new value and sends it only to what is still missing, so the copies differ. Raise that
role's version (or the Redis version) and apply again, then run db-bootstrap and restart `api` and
`worker`.

### App secrets and restarting after a rotation

- `SESSION_SECRET` and `LINK_SIGNING_SECRET`: raise `app_secret_versions` (in the `module "app"`
  call, for example
  `app_secret_versions = { SESSION_SECRET = 2, LINK_SIGNING_SECRET = 1, FIELD_ENCRYPTION_KEY = 1 }`),
  apply, then force a new deployment of `api` and `worker`. Everyone is signed out until the
  two-value rotation of spec 20 arrives (M12). A new `SESSION_SECRET` also signs every parent out
  of the app (their refresh tokens are keyed by it) and voids every sign-in code already sent
  (D32, Task 9).
- `FIELD_ENCRYPTION_KEY` is generated too, but must **not** be rotated before M12: a new key would
  leave every encrypted field (TOTP secrets) unreadable. The module refuses a version other than 1.
  M12's KMS adapter brings re-encryption and rotation (D32).
- `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` are set by hand (step 8), always as a pair. The API
  accepts `JWT_PUBLIC_KEY_PREVIOUS` (the old public key) so access tokens signed before a new pair
  keep working for their last 15 minutes; it is not wired into the task definition yet, so until
  then a new pair makes every parent app refresh at once (their refresh tokens stay valid).
- `SEED_PASSWORD` is set by hand (step 8); change it, then run the seed task again.
- `TURNSTILE_SECRET_KEY` is set by hand (step 8). After rotating it in Cloudflare, put the new value
  and force a new deployment of the `api` and `worker`.
- `SENTRY_DSN` and `OTEL_EXPORTER_OTLP_HEADERS` are set by hand (step 10) in the same JSON shape.
  After a change, force a new deployment of every service that reads them (`api`, `worker`,
  `staff`, `console`).
- ECS reads secrets only at task start, so **every** secret change needs a new deployment of the
  services that read it.
- Never `terraform state rm` the placeholder versions: the next apply would re-create them over the
  hand-set values. Their fixed `secret_string_wo_version = 1` keeps Terraform from writing them
  again. If the module is ever re-created from scratch, Terraform writes the placeholder once more:
  set the real value again with `put-secret-value`.

### Origin secret: zero-downtime rotation (three applies)

Each apply is a pull request to the `module "edge"` call in `infra/envs/staging/main.tf`:
1. Add a slot: `origin_secret_slots = ["a", "b"]` (active still `a`). The ALB now accepts both.
2. Switch: `origin_secret_active = "b"`. Wait until the distribution shows **Deployed**
   (`aws cloudfront get-distribution --id <id> --query Distribution.Status`).
3. Remove the old slot: `origin_secret_slots = ["b"]`.

The next rotation adds `a` back with a new value. Never switch and remove in one apply: requests in
flight from edge locations still carrying the old value would get 403.

### SES events subscription

The webhook confirms the SNS subscription itself and Terraform does not wait
(`endpoint_auto_confirms = false`). If the confirmation is missed (the API was not up yet), the
subscription stays pending for 3 days, until SNS deletes it. Once the API is up:
```bash
terraform -chdir=infra/envs/staging apply \
  -replace=module.dns.aws_sns_topic_subscription.webhook \
  -var dns_role_arn=<dns_write_role_arns.staging>
aws sns list-subscriptions-by-topic --topic-arn "$topic"   # step 11.1: must show a real ARN
```
Run it as the staging administrator, added back for the occasion as in step 6a (CI has no way to
pass `-replace`). Alternatively wait: once SNS deletes the pending subscription after 3 days, the
next `apply (staging)` creates it again and the API confirms it. M12 adds a delivery retry policy or a
dead-letter queue, so bounces survive a long API outage.

### Order of an infra apply and an app deploy

`infra.yml`'s apply waits for an `infra-staging` reviewer, while `deploy-staging.yml` starts as soon
as CI is green. They are independent, so an app change that needs new infrastructure (a new secret,
a new permission) can deploy before the apply. Merge the infra change first, approve and let its
apply finish, and only then merge the app change.

### Weekly drift check

`infra.yml`'s `drift` job runs every Monday at 03:17 UTC in the `infra-staging` environment, so it
waits for a reviewer each week. Approve it; it fails when staging has drifted and its summary lists
the resources. Drift that is intended (a hand-set secret) should be removed from state, not
accepted each week.

### Play draft promotion

Until the staging app's first Play release is published, Play accepts only `draft` uploads. After
each `parent-android` run, open Play Console → Quad (staging) → Testing → Internal testing →
the draft release → Review release → Start rollout. Once the first release is published, switch
the lane to `release_status: "completed"` in `apps/parent/fastlane/Fastfile`.

### pnpm deploy lock gate

The api image build runs `scripts/check-deployed-lock.mjs` right after `pnpm deploy`, because pnpm 9's
deploy resolves again instead of reusing the lockfile. If an image build fails with a package that
"is not in pnpm-lock.yaml", the deployed tree drifted from the lockfile: do not skip the check.
Run `pnpm install` and commit the updated `pnpm-lock.yaml` if a dependency changed, or pin the
offending version in `apps/api/package.json`, then rebuild.

### Toolchain pins

`node scripts/terraform-mirror.mjs --record` refuses to replace an existing pin with a different
hash unless `--force` is given. Only use `--force` after cross-checking the new hash as in
section 3.

## 5. Accounts and keys to create

| What | Where | Notes |
|---|---|---|
| AWS Organization, `tooling` and `staging` accounts, Identity Center | step 1 | production is M12 |
| Firebase projects `quad-dev` and `quad-staging` | console.firebase.google.com | add the Android and iOS apps for `com.quadedu.parent.dev` and `.staging` (`apps/parent/firebase/README.md`) |
| APNs auth key (`.p8`) | Apple Developer → Keys | upload to each Firebase project (Project settings → Cloud Messaging) with its key id and team id; Apple lets you download it once, so keep it in the password manager |
| Sentry projects `quad-api`, `quad-staff`, `quad-console`, `quad-parent` | sentry.io, one organisation | turn on server-side data scrubbing; the DSNs go into `quad-staging/env/SENTRY_DSN` (`{"api":"…","staff":"…","console":"…"}`), `SENTRY_DSN_STAFF`, `SENTRY_DSN_CONSOLE` and `apps/parent/env/staging.json` |
| Grafana Cloud stack | grafana.com | the OTLP gateway URL is `OTEL_EXPORTER_OTLP_ENDPOINT`; the `Authorization=Basic …` header goes into `quad-staging/env/OTEL_EXPORTER_OTLP_HEADERS` as `{"value":"…"}` |
| Apple Developer Program, as an organisation | developer.apple.com | needs Quad's legal entity and D-U-N-S number; two admins, each with a hardware security key |
| Google Play Console, as an organisation | play.google.com/console | the same D-U-N-S; two admins with hardware keys; create `com.quadedu.parent.staging` and upload one bundle by hand first |
| match certificates repository | a private GitHub repository | `match appstore` once from a trusted machine (not read-only) to create the staging profile |
| App Store Connect API key | App Store Connect → Users and Access → Keys | `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_B64` |
| Play upload key and service account | `keytool -genkeypair` locally; Google Cloud → service account with Play Console access | `ANDROID_*` secrets and `PLAY_SERVICE_ACCOUNT_JSON`; Play App Signing holds the app signing key |
| GitHub `staging-stores` environment secrets | step 5.6 | the fastlane credentials; AWS holds none of them |

## 6. What CI does

| Workflow | When | What | Until the variables exist |
|---|---|---|---|
| `ci.yml` | pull requests, pushes to `main`, `develop`, `claude/**`, by hand | `typecheck`, `lint` (with `pnpm format:check`), `unit` (with `pnpm audit`), `codegen`, `api-integration`, `e2e-smoke`, `build`, `images` (hadolint, then builds without pushing), `parent-build` (the staging APK and bundle, debug-signed) | runs fully; needs no account |
| `infra.yml` | `infra/**` changes, weekly, by hand | `checks` (`scripts/infra-check.mjs` with tflint and checkov required); `plan (staging)` on same-repository pull requests (`-refresh=false -lock=false`, summary only); `apply (staging)` on `main` behind `infra-staging`; `drift (staging)` weekly | `checks` runs; `plan` skips without `AWS_STAGING_PLAN_ROLE_ARN`, `apply` and `drift` without `AWS_STAGING_APPLY_ROLE_ARN` |
| `deploy-staging.yml` | after CI succeeds on a push to `main`, or by hand from `main` | `gate` (only the tip of `main` after a green CI push), `build-push`, `migrate` (db-bootstrap, then migrate), `deploy`, `seed`, `smoke`; `parent-ios` and `parent-android` on their own switches | `gate` and everything after it skip without `AWS_STAGING_DEPLOY_ROLE_ARN`, `IOS_UPLOAD_ENABLED` or `PLAY_UPLOAD_ENABLED` |

The repository is public, so no workflow prints, posts or uploads a full plan: `scripts/plan-summary.mjs`
reduces it to resource addresses, actions and counts.

## 7. Validation gaps

Run here (offline): `pnpm verify`, `pnpm infra:check` with the mirror and checkov, `terraform test`
of every module and root with mocked AWS, image builds and local smoke runs of every image,
`flutter analyze` and `flutter test`, actionlint, action-validator and hadolint on the workflows and
Dockerfiles. CI on GitHub additionally ran tflint and a real Android staging build.

**Tools that run only in CI**
- **tflint** runs only in CI: the official image is on `ghcr.io` and the AWS ruleset downloads from
  GitHub releases, both blocked in the development container.
- **checkov** runs locally only from the `.cache/checkov` virtual environment (not on `PATH` by
  default, so `infra-check` skips it unless you add it); CI installs and requires it.
- **Mobile builds** run only in CI: the container has no Android SDK or Xcode. CI's `parent-build`
  proves the Android build with debug keys. The iOS lane (match, manual signing, `flutter build
  ipa`, TestFlight) and the Play upload have never run anywhere. `sentry_flutter`'s native start was
  never exercised on a device.

**Proven only offline (confirm on the first deploy, section 3)**
- No Terraform has been planned or applied against AWS. Every resource was checked with mocked
  providers, which cannot see IAM evaluation, AWS API validation, `default_tags` merging into
  `tags_all`, or resource ordering (`depends_on` on the services and the edge output has no test).
- IAM: every policy and trust policy (state roles, DNS roles, OIDC subjects with the custom claim
  keys, `ecs:cluster`, SES ARN scoping, `kms:ViaService`, the plan role's denies, the bucket policy's
  `aws:PrincipalArn` with Identity Center paths).
- The S3 backend: the `assume_role` `-backend-config` syntax, the read role's exact calls,
  DynamoDB encryption with a customer key.
- `replace_triggered_by` planning behaviour, and the `engine_version = "16"` diff suppression.
- Edge: the shared ACM validation record, the forwarded-Host certificate check, the managed policy
  ids, the WAF `SizeRestrictions_Body` label and WAF metric dimensions.
- The CloudWatch dashboard body (validated by CloudWatch only on apply).
- SES publishing to the KMS-encrypted SNS topic, and the webhook confirming the subscription.
- RDS: `BYPASSRLS` for `quad_platform` under the RDS master user, RDS Proxy with `db.t4g.medium`,
  and the proxy reaching Secrets Manager through the one-zone endpoint.
- ECS: Fargate copying image `VOLUME` contents and ownership, ECS injecting an empty JSON-key value,
  health checks and the deployment circuit breaker.
- `deploy-staging.yml` and the `plan`, `apply` and `drift` jobs have never run against AWS (they
  skip); the 10-minute ECS waiters may be short for a long migration.
- `terraform test` cannot mock ephemeral resources, so the data and app tests use the real `random`
  provider (local, no network).
- A `secret_string` assertion failure panics Terraform 1.16.5 while rendering the message; the static
  guard in `infra-check` (`secret_string =` under `infra/modules` and `infra/envs`) runs first.

**Supply chain**
- The `SHA256SUMS` pins in `infra/toolchain.json` were recorded through a TLS-intercepting proxy
  without a GPG check (trust on first use). CI re-downloads over direct TLS against the same pins;
  cross-check them as in section 3.
- The committed lock files carry only `h1:` hashes (from the mirror). A registry install adds `zh:`
  hashes; that is expected, not drift.
- freshclam could not download signatures in the container; the clamav image was checked with its
  bundled database.
- No Sentry test event has reached a real project; `dist/sentry-test.js` now fails unless Sentry
  accepts the event.

## 8. Open questions

- **Web images per environment** (M12): staff and console bake `NEXT_PUBLIC_*` at build, so staging
  builds its own; spec 20's "promote by digest" needs runtime public configuration instead.
- **PR plans reading staging state** (M12): see R-origin-secret-state below.
- **Shared DKIM wildcard** (M12): `*._domainkey.mail.quad-edu.com` is writable by every
  environment's DNS role; production should use its own sending subdomain or narrower names.
- **Native crash scrubbing** (M6): native iOS and Android crashes bypass the Dart `beforeSend`;
  turn off native crash handling or add native hooks.
- **RDS Proxy IAM auth and 90-day rotation** (M12): staging uses Secrets Manager password auth.
- **SES TLS policy** (M12): `OPTIONAL` now; revisit `REQUIRE`.
- **Public bucket writes** (later milestone): the API has no permission on the public bucket yet;
  public objects must live under `assets/` to be served by `/assets/*`.
- **A CI plan of `envs/global`**: possible once the Identity Center ARNs become variables
  (`TF_GLOBAL_STATE_READ_ROLE_ARN`, `AWS_TOOLING_PLAN_ROLE_ARN` are reserved).
- **CI cost**: nine CI jobs each install dependencies, four with Flutter, and turbo has no remote
  cache.

## 9. Accepted risks for staging

- **R-pr-plan.** Pull request plans run with `-refresh=false -lock=false`, because the plan role may
  not read secret values, parameters or decrypt, which a refresh needs. Drift shows in the
  `infra-staging` apply (a refreshed plan) and in the weekly `plan -refresh-only`.
- **R-origin-secret-state.** The CloudFront origin secret is in Terraform state (no write-only
  form), and PR plans read state through the state-read role, so a repository writer could reach
  the ALB past WAF. Staging holds no real personal data. M12 adds WAF on the ALB or stops PR plans
  reading staging state.
- **The deploy role's path to the master secret.** It can pass `migrate-exec` to `RunTask` with a
  command override, so it can reach the RDS master secret. It is trusted only from the `staging`
  environment on `main`. `staging` has no reviewers (ruling R-env-approvals, so merges deploy
  without a manual step), so the mitigation is that the environment allows `main` only and branch
  protection (step 5.4) lets changes reach `main` only as reviewed pull requests with green checks.

## Pre-launch site (GitHub Pages)

Until the AWS deploy exists, `quad-edu.com` serves a static export of the landing page from GitHub
Pages (decision D30 in [spec 02](../docs/spec/02-architecture.md#decision-log)). Nothing here uses
AWS or Terraform. `.github/workflows/pages.yml` builds the export
(`pnpm --filter @quad/staff build:export`, with `NEXT_PUBLIC_QUAD_PRELAUNCH=true`), runs the
landing journey against it, and on every push to `main` (or a manual run) deploys it. On pull
requests it builds and tests the export without deploying.

What the owner does, once:

1. Merge the change to `main`. The first `Pages` run builds the site; its deploy job waits until
   Pages is switched on (step 2), so re-run it after that if it failed.
2. In the repository, **Settings → Pages**:
   - **Source:** GitHub Actions.
   - **Custom domain:** `quad-edu.com`, then **Save** (the export also ships a `CNAME` file with
     the same name).
   - **Enforce HTTPS:** tick it once GitHub has issued the certificate (it appears after DNS
     resolves, usually within an hour).
3. At the registrar for `quad-edu.com`, add:

   | Name | Type | Value |
   |---|---|---|
   | `@` (apex) | A | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
   | `@` (apex) | AAAA | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
   | `www` | CNAME | `prishanmaduka.github.io` |

   Remove any other apex A/AAAA records and any parking records. Leave the Google Workspace MX and
   TXT records alone. If the registrar has CAA records, one must allow `letsencrypt.org` (GitHub
   Pages certificates come from Let's Encrypt). Check with `dig +short quad-edu.com` and
   `dig +short www.quad-edu.com`.
4. Optional but recommended: verify the domain for the account or organisation (**Settings → Pages
   → Add a domain** at the account level, then the TXT record GitHub shows), so no other
   repository can claim `quad-edu.com`.
5. Open `https://quad-edu.com/` and `https://www.quad-edu.com/` (GitHub redirects `www` to the
   apex).

### How this meets the AWS plan

The first deploy checklist moves the domain to Route 53 in
[Step 4](#step-4-apply-the-global-root-and-delegate-quad-educom-tooling-account): the registrar's
name servers are replaced by the four Route 53 ones, so the records above stop being used.

- **Cutting over:** when production is ready (M12), CloudFront serves `/` (spec 19). Delegate as
  in Step 4, let the production records point the apex and `www` at CloudFront, then switch the
  Pages site off (**Settings → Pages → Unpublish**, and disable the `Pages` workflow).
- **Keeping Pages live after delegation** (for example if staging is set up first): before you
  change the name servers, add the apex A and AAAA records and the `www` CNAME above to
  `infra/envs/global`, and extend its CAA record with `0 issue "letsencrypt.org"`. The global root
  only allows `amazon.com` today, so without that GitHub cannot renew the certificate. Step 4's
  first item ("anything not in `infra/envs/global` must be added there first") covers this. These
  records go when CloudFront takes over the apex.
- Staging (`staging.quad-edu.com`) and the console are subdomains and do not touch these records.
