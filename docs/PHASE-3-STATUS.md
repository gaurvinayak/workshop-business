# Phase 3 — Status

Phase 3 adds depth. The two flagship, self-contained items are built and
validated; the rest are scoped below with rationale.

## Delivered

| Item | Backend | Frontend | Validated |
|------|---------|----------|-----------|
| **Production / work orders** (job costing) | ✅ | ✅ Production page | ✅ consumed ₹400 material + ₹500 labor → ₹900 finished-goods value |
| **Fixed assets + straight-line depreciation** | ✅ | ✅ Fixed Assets page | ✅ ₹120,000 / 120mo → ₹1,000/mo posted |

Both post through the same journal engine, so the trial balance stayed balanced
(Dr 195,827 = Cr 195,827) after every operation in the end-to-end test.

### How production works

A work order consumes raw materials (stock out at moving-average cost), adds
labor + overhead, and produces finished goods valued at the full production cost
(material + labor + overhead), blended across the output quantity. The value
uplift (labor + overhead) is capitalized into inventory. This gives the workshop
real job cost and margin per batch — the core reason a rig/fabrication shop
wants software over spreadsheets.

## Scoped but not built (external dependencies / per-deployment)

These require integrations or business-specific policy and are best done against
a real deployment rather than speculatively:

- **Multi-currency** purchasing/sales and **FIFO** valuation option — the money
  and stock layers are abstracted (moving-average today), so these are additive.
- **Biometric/RFID attendance import** — device-specific; the attendance model
  already accepts a `source` and could ingest a CSV/API feed.
- **Scheduled email reports**, **customer/supplier portals**, **PWA/mobile
  wrapper** — need SMTP/hosting/app-store decisions.
- **Statutory e-filing exports** (GST returns, payroll statutory files) — must
  match the exact local filing format; the data (tax summary, payroll) is
  already captured and exportable to CSV.

## Summary across all phases

| Phase | Scope | State |
|-------|-------|-------|
| 0 | Foundation (auth, RBAC, journal engine) | ✅ validated |
| 1 | MVP: attendance, payroll, inventory, purchasing, sales, accounting | ✅ validated end-to-end (API + browser) |
| 2 | Reports, printable invoices, quotations, returns, stock count, advances, expenses | ✅ validated |
| 3 | Production/job costing, fixed assets & depreciation | ✅ validated |

The double-entry ledger is the through-line: **every** money movement in every
phase posts through one transactional gateway, so the books are always balanced
and every report is a query over the same journal.
