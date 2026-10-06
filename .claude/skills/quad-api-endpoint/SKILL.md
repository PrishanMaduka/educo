---
name: quad-api-endpoint
description: Step-by-step recipe for adding or changing a Quad API endpoint (contract, guard, controller, service, repository, audit, realtime, OpenAPI client regeneration and the four required integration tests). Use whenever you touch apps/api routes.
---

# Adding an API endpoint

Read the endpoint's line in `docs/spec/06-api-and-events.md` and the conventions at the top of that file first.

## 1. Contract (`packages/contracts/src/<area>/`)
- Request and response Zod schemas, named `<Thing>CreateInput`, `<Thing>UpdateInput`, `<Thing>`, `<Thing>List` (`{ items, nextCursor }`).
- Reuse with `.pick/.omit/.extend`. Money is `MoneySchema`, ids are `IdSchema`, timestamps `IsoDateTimeSchema`.
- New error codes and permission keys go in the contracts' enums.
- Write the contract tests (valid example passes; each invalid field fails at the right path).

## 2. Tests first (`apps/api/test/<area>/<thing>.test.ts`)
Write the integration tests before the code, using `quad-tdd`:
happy path · 400 validation · 403 permission · cross-tenant (404 by id, absent from lists) · parent-not-linked (`/family`) · `module_not_in_plan` (`@Module`) · the spec's 409/422 cases · idempotency replay (when the route takes `Idempotency-Key`) · stale `If-Match` → 409 (editable records).

## 3. Controller (thin)
Shape to follow (adjust to the helpers M0/M1 created; keep the same responsibilities):

```ts
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post(':id/remind')
  @Can('fees.remind')
  @Module('fees')
  @HttpCode(202)
  async remind(@Param('id', IdPipe) id: string, @Body(new ZodPipe(InvoiceRemindInput)) body: InvoiceRemindInput, @Ctx() ctx: RequestCtx) {
    return this.invoices.remind(ctx, id, body);
  }
}
```
- No queries, no rules, no tenant id from params/body. `ctx` carries `tenantId`, `userId`, permissions (and an active role preview).
- Lists: `?cursor=&limit=` through the shared pagination helper; `Accept: text/csv` through the shared export helper (needs `sensitive.export_data` for personal data, audited).

## 4. Service
- Loads with the repository, decides with `packages/domain`, saves with the repository, all inside one `withTenant(ctx.tenantId, tx => …)` transaction.
- Writes audit events for anything listed in spec 05 → Audit.
- Emits realtime events (names from contracts, spec 06 → Realtime) **after** commit; queues jobs for slow work (email, SMS, push, PDFs) instead of doing them inline.
- Throws typed domain errors; never returns error objects.

## 5. Repository
- Every query inside `withTenant`. Select only the needed columns. Batch related loads (no N+1).
- Lookups by id return `null` when not found (RLS makes another tenant's row look not found); the service turns it into `NotFoundError`.

## 6. Sensitive data
- Safeguarding and medical fields need the sensitive key permission; each view writes an audit event.
- Never include them in early warning, Ask Quad tools, logs or analytics.

## 7. Regenerate and check
```bash
pnpm api:client            # OpenAPI -> packages/client (TS) + quad_api (Dart)
pnpm --filter @quad/api test:api -- <area>
pnpm typecheck && pnpm lint
```
Commit the regenerated clients in the same change (`codegen:check` fails otherwise).

## Checklist
- [ ] Contract + contract tests
- [ ] `@Can` (and `@Module`) on the route; `/family` link check
- [ ] Tenant only from ctx; repository inside `withTenant`
- [ ] Rules in `packages/domain`, not the service
- [ ] Audit, realtime, jobs as the spec says
- [ ] Idempotency / etag where the conventions require them
- [ ] All required integration tests green
- [ ] Clients regenerated
