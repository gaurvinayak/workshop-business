# Phase 0 — Status

Phase 0 from [`06-roadmap.md`](06-roadmap.md) is **scaffolded and runnable**.
This is the foundation every later module hangs off.

## What's built

| Roadmap item | Status | Where |
|--------------|--------|-------|
| Monorepo + Docker Compose dev env | ✅ | `package.json` (workspaces), `docker-compose*.yml` |
| Postgres + Prisma + NestJS + React wired together | ✅ | `packages/*` |
| CI pipeline (lint/typecheck/test/build) | ✅ | `.github/workflows/ci.yml` |
| Auth: login, sessions, password hashing, RBAC | ✅ | `packages/api/src/auth`, `src/common/*guard*` |
| The five roles + permissions | ✅ | `packages/shared/src/rbac.ts`, seeded |
| First-run setup wizard | ✅ | `packages/api/src/setup`, `packages/web/src/routes/Setup.tsx` |
| Seed chart of accounts | ✅ | `packages/shared/src/coa.ts`, `prisma/seed.ts` |
| Journal-entry engine (post balanced entries, ledger) | ✅ | `packages/api/src/accounting` |
| Audit-log interceptor | ✅ | `packages/api/src/common/audit.interceptor.ts` |
| Money/date helpers, error envelope, pagination | ✅ | `packages/shared/src` |

## Exit criteria (from the roadmap)

> An admin can log in, the app knows the business, and you can post a manual
> balanced journal entry and see it in a ledger.

All wired:
- Setup wizard → business + fiscal year + owner.
- Login (cookie session, argon2, rotating refresh tokens).
- Chart of accounts seeded; **post a journal entry** (validated, balanced,
  gap-free numbered, atomic) → view it on the **account ledger** with a running
  balance.

## Validated in this environment

- `packages/shared`: typecheck ✅, build ✅, **6 unit tests pass** (Money math).
- `packages/api`: **7 unit tests pass** for `assertBalanced` — the core
  double-entry invariant (debits = credits, one-sided lines, no zero entries).
- `packages/web`: typecheck ✅.

> The full API typecheck/build needs the generated Prisma client. Generating it
> downloads a query-engine binary that this sandbox's egress proxy resets
> mid-stream; it generates fine on a normal network and in CI. See the note in
> [`DEVELOPMENT.md`](../DEVELOPMENT.md).

## Design choices worth knowing

- **One posting gateway.** `JournalService.postWithinTransaction()` is the only
  way money hits the ledger. Phase 1's invoice/payroll/GRN flows call it from
  inside their own transaction, so stock + ledger move atomically or not at all.
- **Reference data is idempotent.** Both `prisma/seed.ts` and the setup wizard
  ensure roles/permissions/COA exist, so a fresh install bootstraps even if the
  seed wasn't run.
- **Security is server-side.** `JwtAuthGuard` + `PermissionsGuard` run globally;
  `@Public()` opts a route out, `@RequirePermissions()` gates the rest. The web
  app only *hides* UI it can't use.

## Next: Phase 1, in order

Per the roadmap — HR/Employees → Attendance → Inventory → Purchasing →
Sales/Invoicing → Payroll → accounting reports → dashboard. Each new financial
flow posts through the existing journal engine.
