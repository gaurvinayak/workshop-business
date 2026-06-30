# 06 — Roadmap & Delivery Plan

Phased so that something *usable* ships early and Excel gets switched off one workflow at a time. Estimates assume **one experienced full-stack developer** (or a small part-time team); they're planning ranges, not promises.

## Guiding sequencing rule

Build the **financial spine first** (auth + chart of accounts + journal engine), then hang each operational module off it. Every module that touches money posts to the ledger from day one — never "we'll add accounting later."

---

## Phase 0 — Foundations (≈1–2 weeks)

Goal: a skeleton you can build on; nothing business-facing yet.

- Monorepo, Docker Compose dev env, Postgres + Prisma + NestJS + React wired together.
- CI pipeline (lint, typecheck, test, build).
- Auth: login, sessions, password hashing, RBAC scaffolding, the five roles.
- First-run setup wizard: business profile, currency, timezone, fiscal year.
- Seed **chart of accounts** + a minimal **journal-entry engine** (post balanced entries, account ledger query).
- Audit-log interceptor, money/date helpers in `shared`, error envelope, pagination.

**Exit:** an admin can log in, the app knows the business, and you can post a manual balanced journal entry and see it in a ledger.

---

## Phase 1 — MVP: "switch off the worst spreadsheets" (≈6–9 weeks)

Goal: the [success criteria](00-overview.md#6-success-criteria). Ship the modules that hurt most in Excel.

| Order | Module | Slice for MVP |
|-------|--------|---------------|
| 1 | **HR / Employees** | Employee CRUD, departments, designations |
| 2 | **Attendance** | Web clock-in/out + kiosk, shifts, daily compute, monthly sheet, manual correction |
| 3 | **Inventory** | Items (product/part/raw), single→multi location, stock movements, moving-avg cost, adjustments, low-stock list |
| 4 | **Purchasing** | Suppliers, PO, goods receipt → stock-in, supplier bill + payment (posts to ledger) |
| 5 | **Sales/Invoicing** | Customers, invoice draft→post (numbering, stock-out, ledger), invoice PDF, payment receipt |
| 6 | **Payroll** | Salary structures, monthly run → payslips, approve→post, payslip PDF |
| 7 | **Accounting reports** | Trial balance, P&L, receivables & payables aging, account ledger |
| 8 | **Dashboard** | Cash/bank, month sales vs purchases, receivables/payables, today's attendance, low stock |

**Exit (go-live candidate):** all six MVP success criteria met; nightly encrypted backup running and **test-restored once**; an internal security review passed.

> Suggested go-live tactic: run the new system **in parallel with Excel for one month**, reconcile the month-end numbers, then cut over.

---

## Phase 2 — v1: round out the daily workflow (≈4–6 weeks)

Goal: fewer rough edges, the things people will ask for in week two.

- **Leave management:** types, quotas, request→approve, balances, holiday calendar.
- **Quotations** → convert to invoice; **credit notes / sales returns**; **purchase returns**.
- **Employee self-service portal:** my attendance, my leave, my payslips.
- **Advances/loans** with auto-recovery in payroll.
- **Barcode/SKU labels** + scan-to-pick in POs/invoices/counts.
- **Physical stock count** workflow with variance posting.
- **Balance sheet, cash/bank book, tax summary, day book** reports.
- **Email**: send invoices to customers, payslips to employees, low-stock alerts.
- **CSV exports** on every list; **PDF** branding/letterhead polish.

**Exit:** the business runs entirely in WorkshopOS; Excel is reference-only.

---

## Phase 3 — v2: depth & nice-to-haves (as needed)

Pull from this backlog based on real demand — don't build speculatively.

- **Production/jobs module:** simple work orders consuming raw material and producing finished goods (BOM-lite), so a "rig build" job tracks material + labour cost and margin.
- **Multi-location/branch** consolidation; **multi-currency** purchasing/sales.
- **FIFO valuation** option alongside moving average.
- **Biometric/RFID attendance** device integration.
- **Scheduled email reports** (weekly owner summary).
- **Customer/supplier portals.**
- **Mobile-friendly PWA / native wrapper** for clock-in and approvals on the go.
- **Statutory e-filing exports** (GST returns, payroll statutory files) in the local format.
- **Fixed assets & depreciation**, recurring expenses.

---

## Effort summary

| Phase | Scope | Rough effort (1 dev) |
|-------|-------|----------------------|
| 0 | Foundations | 1–2 weeks |
| 1 | MVP (go-live) | 6–9 weeks |
| 2 | v1 (full daily workflow) | 4–6 weeks |
| 3 | v2 (depth) | ongoing, demand-driven |

**To first go-live: ~2–3 months of focused full-stack work.** A two-person team or strong reuse of UI components compresses this; part-time work stretches it. This is exactly the effort that the build-vs-buy analysis weighs against an afternoon of ERPNext setup — go in with eyes open.

## Testing strategy (applies across phases)

- **Unit tests** for money math, payroll proration, moving-average costing, and journal-entry balancing — the logic where bugs cost real money.
- **Integration tests** for the "one transaction" posting flows (invoice-post, GRN, payroll-approve) against a real Postgres, asserting stock *and* ledger end states.
- **A reconciliation test:** seed a month of operations, then assert trial balance balances, stock levels equal summed movements, and A/R equals open invoices. This single test guards the core invariant of the whole system.
- **E2E smoke** (Playwright) for the critical paths: login, clock-in, create+post invoice, run payroll.

## Definition of done (per module)

- [ ] API endpoints with validation, RBAC, and audit logging.
- [ ] UI screens, responsive, with empty/loading/error states.
- [ ] Posts to the ledger correctly (where financial) — covered by an integration test.
- [ ] Unit tests on the money/quantity logic.
- [ ] Docs updated; permissions added to the role matrix.
- [ ] Seed/demo data so the screen isn't empty in a demo.

## Immediate next steps (when you start building)

1. Re-confirm the build-vs-buy decision in [`00-overview.md`](00-overview.md) — seriously.
2. Lock the stack (default: TS/NestJS/Prisma/Postgres/React) or swap to Django if that's your team's language.
3. Scaffold Phase 0: repo, Compose, CI, auth, chart of accounts, journal engine.
4. Build the MVP modules in the order in the Phase 1 table.
5. Run parallel with Excel for a month, reconcile, cut over.
