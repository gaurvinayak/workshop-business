# Phase 1 — Status

Phase 1 (the MVP — "switch off the worst spreadsheets") from
[`06-roadmap.md`](06-roadmap.md) is **implemented and validated end-to-end**.

## What's built

| Module | Backend | Frontend | Posts to ledger |
|--------|---------|----------|-----------------|
| HR / Employees | ✅ employees, departments, designations (sensitive-field gating) | ✅ list + create | — |
| Attendance | ✅ shifts, clock in/out + kiosk, daily compute, monthly sheet, corrections, holidays, leave | ✅ clock + monthly muster | — |
| Inventory | ✅ items/categories/uoms/locations, moving-average stock engine, adjustments, transfers | ✅ items, stock-on-hand, adjustments | adjustments ✅ |
| Purchasing | ✅ suppliers, POs, goods receipt → stock-in + bill, payments | ✅ suppliers, POs, receive | GRN + payment ✅ |
| Sales | ✅ customers, invoice post (number + stock-out + COGS), receipts | ✅ customer, create+post invoice, payment | invoice + receipt ✅ |
| Payroll | ✅ components, structures, runs from attendance, approve, mark-paid, self-service | ✅ runs, payslips, approve, pay | approve + pay ✅ |
| Reports | ✅ trial balance, P&L, balance sheet, receivables/payables aging | ✅ tabbed report viewer | reads ledger |
| Dashboard | ✅ cross-module summary | ✅ stat tiles | reads ledger |

## How it was validated

Run against a real Postgres (Docker) with the full stack live:

**API end-to-end (HTTP):** setup → login → create item → opening stock (+100 @ 30)
→ create & post invoice (10 @ 50 +18% = 590, `INV-2026-0001`) → stock fell to 90
→ receive payment → **trial balance balanced (Dr 3590 = Cr 3590)**. Then
supplier → PO (`PO-2026-0001`) → goods receipt (bill 2360) → pay; employee →
salary structure → payroll run (gross 30000, net 26400 after 12% PF) → approve →
mark-paid → **trial balance still balanced (Dr 35360 = Cr 35360)**.

**UI (real browser, Playwright):** login → dashboard → Sales (sees the posted
invoice) → Reports (trial balance shows "Balanced") → Inventory (sees stock).

**Unit tests:** money math, document totals, moving-average cost, salary
proration, and the journal-balancing invariant.

## The invariant that matters

Across every transaction type — stock adjustments, invoices with COGS, payments,
purchases, and payroll — the **double-entry ledger stays balanced**, because all
of them post through the one `JournalService.postWithinTransaction()` gateway
inside a single DB transaction. Stock and ledger move together or not at all.

## Known refinements (not bugs)

- **Opening stock via a stock adjustment** credits the *Inventory Adjustment*
  (P&L) account, which shows as a gain in P&L. For true opening balances, post a
  manual journal crediting *Owner's Capital* instead. A dedicated opening-stock
  flow is a Phase 2 refinement.
- **Negative stock is allowed on sale** (so invoicing isn't blocked when stock
  hasn't been entered yet); moving-average cost on negative balances is
  approximate. A per-item "block negative" setting is a Phase 2 option.
- Invoice/PDF rendering, email, quotations, and credit notes are Phase 2.

## Try it

See [`DEVELOPMENT.md`](../DEVELOPMENT.md). After `db:migrate` + `db:seed`, run
`dev:api` and `dev:web`, complete the setup wizard, and you have a working
workshop management system.
