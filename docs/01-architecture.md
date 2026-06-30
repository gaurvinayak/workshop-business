# 01 — Architecture

## 1. Stack at a glance

| Layer | Choice | Why |
|-------|--------|-----|
| **Database** | PostgreSQL 16 | Transactional integrity for money/stock, mature, great with concurrent writes, free |
| **Backend** | Node.js + TypeScript, **NestJS** | Structured, batteries-included (DI, validation, guards), one language across the stack |
| **ORM** | Prisma | Type-safe queries, painless migrations, readable schema file |
| **Frontend** | React + TypeScript (Vite), **TanStack Query** + **React Router** | Standard, fast, huge ecosystem; responsive admin + staff portal |
| **UI kit** | Tailwind CSS + shadcn/ui (Radix) | Accessible components, quick to build, easy to theme |
| **Jobs/queue** | BullMQ on Redis | Payroll runs, PDF generation, email, scheduled reports |
| **Auth** | Session cookies (httpOnly) or JWT + refresh; argon2 password hashing | Simple, secure; TOTP 2FA for admins |
| **PDF** | Headless Chromium (Playwright) rendering HTML templates | Pixel-good invoices & payslips, reuse web templates |
| **Files** | S3-compatible object store (MinIO self-hosted, or S3/R2) | Invoice PDFs, receipts, product photos |
| **Container** | Docker + Docker Compose | One-command self-host |
| **CI** | GitHub Actions | Lint, test, build, image publish |

### Why this stack over the alternatives

- **One language (TypeScript) end to end** keeps a tiny team productive and lets you share types/validation schemas between API and UI.
- **NestJS over a bare Express app**: the module/provider structure pays off the moment you have 8+ domains (HR, payroll, inventory, purchasing, sales, accounting, auth, reporting). Guards/interceptors give you clean RBAC and audit logging.
- **NestJS over Django/Rails**: those are also excellent and Django's admin is a real shortcut. If your developer is a Python person, **Django + DRF is a perfectly valid swap** — the data model and module specs in these docs are framework-agnostic. The default here is TS for stack uniformity.
- **PostgreSQL, not MySQL/SQLite**: you're storing money and stock with concurrent writers; you want strong constraints, `NUMERIC` for currency, row locking, and `SERIALIZABLE`/advisory locks for the ledger. SQLite is fine for local dev only.

> **Decision is reversible at the edges, not the core.** UI kit, queue, and PDF tooling can be swapped later cheaply. The database choice and the double-entry ledger design are load-bearing — get those right first.

## 2. System diagram

```
                    Internet
                       │  (HTTPS, TLS via Caddy/Traefik)
                       ▼
              ┌──────────────────┐
              │  Reverse proxy    │  Caddy (auto HTTPS) or Traefik
              └─────────┬────────┘
            ┌───────────┴───────────┐
            ▼                       ▼
   ┌─────────────────┐    ┌────────────────────┐
   │  Web app (SPA)  │    │   API (NestJS)      │
   │  static, served │    │  REST /api/v1/*     │
   │  by proxy/CDN   │    │  guards · services  │
   └─────────────────┘    └──────┬──────┬──────┘
                                 │      │
                  ┌──────────────┘      └──────────────┐
                  ▼                                     ▼
          ┌──────────────┐    ┌──────────────┐   ┌──────────────┐
          │ PostgreSQL    │    │   Redis      │   │  MinIO (S3)  │
          │ system of     │    │ jobs+cache   │   │  files/PDFs  │
          │ record        │    │ +sessions    │   └──────────────┘
          └──────────────┘    └──────┬───────┘
                                     ▼
                             ┌───────────────┐
                             │ Worker (Nest)  │  payroll, PDF, email,
                             │ BullMQ consumer│  scheduled reports, backups
                             └───────────────┘
```

All services run as containers in one Compose file on a single VPS. The **API** and **worker** share the same codebase (worker is the same image started with a different command), so domain logic isn't duplicated.

## 3. Repository layout (monorepo)

```
workshop-business/
├── README.md
├── docs/                      # this plan
├── docker-compose.yml         # postgres, redis, minio, api, worker, web, proxy
├── docker-compose.dev.yml
├── .github/workflows/ci.yml
├── packages/
│   ├── shared/                # TS types, zod schemas, money/date utils — used by api & web
│   │   └── src/
│   ├── api/                   # NestJS backend (also runs as worker)
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── common/        # guards, interceptors, audit, pagination, errors
│   │       ├── auth/
│   │       ├── users/         # users, roles, permissions
│   │       ├── hr/            # employees, departments, designations
│   │       ├── attendance/    # clock-in/out, shifts, leave
│   │       ├── payroll/       # salary structures, runs, payslips
│   │       ├── inventory/     # items, categories, stock, locations, movements
│   │       ├── purchasing/    # suppliers, POs, goods receipt, supplier bills
│   │       ├── sales/         # customers, quotations, invoices, payments
│   │       ├── accounting/    # chart of accounts, journal, ledger, reports
│   │       ├── reporting/     # cross-module dashboards & exports
│   │       └── jobs/          # BullMQ processors
│   └── web/                   # React app
│       └── src/
│           ├── routes/        # one folder per module, mirrors the API
│           ├── components/
│           ├── lib/           # api client, auth, formatting
│           └── features/
└── scripts/                   # backup.sh, restore.sh, seed.ts
```

**Why a monorepo:** the `shared` package lets the UI and API agree on types and validation (one zod schema validates a form *and* the request body). For a small team this kills a whole class of "frontend and backend disagree about the shape" bugs.

## 4. Cross-cutting concerns

- **Validation:** zod schemas in `shared`, used by NestJS pipes and React forms. Reject bad input at the boundary.
- **Money:** never floats. Store as integer **minor units** (paise/cents) or PostgreSQL `NUMERIC(18,4)`; pick one convention (recommend `NUMERIC` in DB, integer minor units in transit) and centralize a `Money` helper in `shared`. All arithmetic goes through it.
- **Dates & timezone:** store UTC, render in the business's configured timezone. Attendance is timezone-sensitive — get this right.
- **Audit log:** a global interceptor records who-did-what-when for every mutating request (see security doc). Financial documents additionally keep an immutable posting trail.
- **Idempotency:** mutating POSTs that create financial documents accept an idempotency key to prevent double-submits (double-paid invoices, duplicate POs).
- **Numbering:** human-friendly sequential document numbers (INV-2026-0001, PO-2026-0014) generated via a DB sequence per document-type per fiscal year, gap-free where the law requires it (invoices).
- **Soft delete vs. void:** master data (customers, items) soft-deletes; financial documents are never deleted — they're voided/reversed.

## 5. Environments

| Env | DB | Purpose |
|-----|----|---------|
| **dev** | local Postgres via Compose | day-to-day development, seeded demo data |
| **staging** (optional) | small VPS | test migrations & payroll runs before prod |
| **prod** | VPS Postgres with nightly backups | the live business |

Config via environment variables only (12-factor); secrets never committed. A `.env.example` documents every variable.

## 6. Key architectural decisions (ADR summary)

1. **Modular monolith, not microservices.** One deployable API. Domains are modules with clear boundaries, so it *could* be split later, but at 10 users that would be pure overhead.
2. **Double-entry ledger is the financial source of truth.** Stock valuation, payables, receivables, and P&L are all derived from journal entries. See [`02-data-model.md`](02-data-model.md).
3. **Posting is transactional and atomic.** Creating an invoice writes the invoice, its lines, the stock movements, and the journal entry in **one DB transaction** — all or nothing.
4. **Background worker for anything slow.** Payroll for 10 people is fast, but PDF generation, email, and scheduled reports go to the queue so the API stays responsive and retriable.
5. **Postgres does the heavy lifting for integrity.** Foreign keys, check constraints, unique constraints on document numbers, and `NUMERIC` for money. Don't push integrity rules that the DB can enforce into app code only.
