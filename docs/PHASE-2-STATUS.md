# Phase 2 — Status (complete)

Phase 2 rounds out the daily workflow on top of the validated Phase 1 MVP.
Every item below is implemented **and** the accounting flows were validated
against a live Postgres, keeping the trial balance in balance.

## Delivered

| Item | Backend | Frontend | Validated |
|------|---------|----------|-----------|
| Tax summary + Day book reports | ✅ | ✅ tabs | ✅ output 90 / input 360 |
| Business settings / letterhead | ✅ | — | ✅ |
| Printable invoice (browser → PDF) | ✅ | ✅ `/print/invoice/:id` | ✅ |
| CSV export on reports | — | ✅ | ✅ |
| **Quotations** → convert to invoice | ✅ | API* | ✅ `QUO-2026-0001` → `INV-2026-0002` |
| **Credit notes** (sales returns) | ✅ | API* | ✅ `CN-2026-0001` (stock back in + ledger reversal) |
| **Debit notes** (purchase returns) | ✅ | API* | ✅ (stock out + AP reduced) |
| **Stock count** with variance posting | ✅ | API* | ✅ `SC-2026-0001` (variance → adjustment) |
| **Employee advances** + auto-recovery | ✅ | ✅ (Payroll page) | ✅ ₹6000 advance, ₹2000 recovered in payroll |
| **Expenses** (rent, utilities, recurring flag) | ✅ | ✅ Expenses page | ✅ `EXP-2026-0001` |

\* API-complete and validated; a dedicated UI form is a small follow-up (the
existing Sales/Purchasing/Inventory pages cover the primary flows). All are
reachable via the documented REST endpoints today.

## Genuinely deferred (need external systems or hardware)

These are intentionally **not** built because they depend on things outside the
app and are better configured per-deployment:

- **Email** (invoices/payslips/low-stock alerts) — needs an SMTP account and a
  Redis-backed queue. The hook points exist (background worker in the
  architecture); wire in `nodemailer` + BullMQ per deployment.
- **Barcode/scan hardware**, biometric/RFID attendance import — device-specific.
- **Server-side cached PDF** (vs. today's browser print) — needs Chromium in the
  API image; the print view already produces clean PDFs.
- Leave **balances** ledger and holiday-aware compute — schema is present
  (`LeaveBalance`); the accrual policy is business-specific.
