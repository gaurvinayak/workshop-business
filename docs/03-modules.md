# 03 — Modules (feature spec)

Each module below lists: what it does, the key screens, the rules that matter, and how it touches the ledger. Build them in roughly the order of [`06-roadmap.md`](06-roadmap.md).

---

## A. Authentication & user management

**Purpose:** log people in, control what they can see/do.

- Email + password login (argon2 hashing), session via httpOnly cookie or JWT + refresh token.
- Optional **TOTP 2FA**, required for owner/accounts roles.
- Password reset by email; admin can reset/disable any user.
- **RBAC:** roles (owner, accounts, store, supervisor, employee) → permissions. UI hides actions the user lacks; API enforces on every endpoint (UI hiding is not security).
- First-run setup wizard: create owner account, business profile, currency, timezone, fiscal year, seed chart of accounts.

**Screens:** login, forgot/reset password, 2FA setup, users list, user detail (assign roles), my profile.

---

## B. HR — employees

**Purpose:** the people directory that attendance and payroll build on.

- Employee CRUD: personal details, contact, department, designation, join/leave dates, status.
- Bank & statutory details (sensitive — gated by permission, encrypted at rest).
- Link an employee to a login `user` (so they can clock in and see payslips) — or not (for staff who don't use the app).
- Documents: upload ID/contract scans to object storage.

**Screens:** employee list (filter by dept/status), employee detail (tabs: profile, attendance, salary, documents), departments & designations settings.

---

## C. Attendance & leave

**Purpose:** capture hours worked; feed payroll accurately.

- **Clock in/out:** employees clock from the web (and a shared **kiosk mode** tablet at the entrance — one screen, enter code/PIN, in/out). Optional later: biometric/RFID device import via CSV or API.
- **Shifts:** define expected hours, grace period, break. Assign shifts to employees.
- Daily attendance auto-computes `status`, `worked_minutes`, `overtime_minutes` from punches vs. shift.
- **Manual entry & correction** by supervisor/admin (audit-logged); reason required.
- **Leave:** request → approve workflow, leave types with quotas, running balances, company holiday calendar.
- **Monthly attendance sheet:** grid of employees × days, the artifact that replaces the Excel muster roll; exportable.

**Rules that matter:**
- One attendance row per employee per day (`unique`).
- Overtime rules configurable (e.g. >8h/day or work on holidays at 1.5×).
- Editing attendance for a period that's already been paid is blocked (period lock) — corrections go to the next run as adjustments.

**Ledger touch:** none directly; attendance is an input to payroll.

---

## D. Payroll

**Purpose:** turn attendance + salary structures into correct, on-time pay and payslips.

- **Salary structures** per employee: earnings (basic, HRA, allowances, overtime) and deductions (PF, ESI, professional tax, TDS, advances, fines) as configurable components. Components support fixed amounts, percentages of basic, or formulas.
- **Payroll run** for a period:
  1. Pull attendance → paid days, loss-of-pay days, overtime minutes.
  2. Apply each employee's structure, prorate by paid days.
  3. Compute gross, deductions, net.
  4. Produce payslips (draft) for review.
  5. **Approve** → locks the run, posts the journal entry, locks the attendance period.
  6. **Mark paid** → records payment, posts cash/bank movement.
- **Payslip PDF** per employee (downloadable by the employee in their portal).
- **Loans/advances:** track an advance given to an employee and auto-recover it across future payslips.
- Statutory components are **configurable**, not hardcoded — so this works regardless of country. Ship a sensible India preset (PF/ESI/PT) and a "none/custom" preset.

**Screens:** salary structure editor, payroll run wizard, run detail (payslip table, totals), payslip view/PDF, my payslips (employee portal).

**Ledger touch:**
- Approve run → `Dr Salary Expense, Cr Salary Payable` (+ separate lines for each statutory payable).
- Pay run → `Dr Salary Payable, Cr Bank`.

---

## E. Inventory — products, raw material, spare parts

**Purpose:** one accurate source of truth for what's in stock and what it's worth.

- **Item master:** SKU, name, type (product / raw material / spare part / service), unit of measure, category tree, tax rate/HSN, reorder level, valuation method, stock-tracked flag.
- **Multiple locations** (main store, workshop floor, scrap) with per-location on-hand.
- **Stock movements** for every event (purchase in, sale out, adjustment, transfer between locations, production consume/produce, returns) — append-only, each carries a unit cost.
- **Moving-average valuation** maintained on every inbound movement.
- **Stock adjustments** & **physical stock counts:** count sheet → variances → adjustment movements (audit-logged, reason required).
- **Low-stock alerts:** items at/below reorder level surfaced on dashboard and (optionally) emailed; one-click "create PO".
- **Barcode/SKU support:** print item labels; scan to pick items into POs/invoices/counts.

**Screens:** item list (filter by type/category/low-stock), item detail (stock by location, movement history, valuation), stock adjustment, stock transfer, stock count, locations & categories & UoM settings.

**Ledger touch:** inbound movements increase the Inventory asset (posted via the purchase/GRN flow); outbound via sale/COGS. Adjustments post to an inventory-adjustment expense/income account.

---

## F. Purchasing & supplier management

**Purpose:** know what we ordered, received, and owe — linked to stock.

- **Supplier master:** contact, address, tax id, payment terms, opening balance.
- **Purchase order:** draft → send → receive. Lines with item, qty, rate, tax. Tracks received vs. ordered (partial receipts supported).
- **Goods receipt (GRN):** receive against a PO into a location → creates stock-in movements at the receipt unit cost (this is what updates moving-average cost).
- **Supplier bill (payable):** record the vendor's bill (against PO/GRN or standalone) → posts the payable to the ledger.
- **Supplier payment:** pay a bill fully/partially → settles the payable, posts cash/bank out.
- **Purchase reports:** purchases by supplier/item/period; outstanding payables; PO status.

**Screens:** supplier list/detail (with ledger), PO list, PO editor, goods receipt, supplier bills, supplier payments, purchase reports.

**Ledger touch:**
- Supplier bill → `Dr Inventory/Expense + Dr Tax-input, Cr Accounts Payable`.
- Payment → `Dr Accounts Payable, Cr Bank`.

---

## G. Sales & customer invoicing

**Purpose:** bill customers, get paid, track who owes what.

- **Customer master:** contact, billing/shipping address, tax id, credit terms, opening balance.
- **Quotation (optional):** create, send, convert to invoice.
- **Invoice:** draft → post. Lines for stock items and/or services, with qty, rate, discount, tax. Auto tax calculation, gap-free numbering on posting.
- **Invoice PDF** with the business's logo/letterhead; email to customer.
- **Payment receipt:** record money in, allocate across one or more invoices (partial payments supported).
- **Receivables:** outstanding invoices, **aging report** (0–30 / 31–60 / 61–90 / 90+).
- **Credit notes / returns:** reverse an invoice (sales return → stock back in, ledger reversal).

**Screens:** customer list/detail (with ledger & aging), quotation editor, invoice list, invoice editor, invoice PDF/print, payment receipt, sales reports.

**Ledger touch:** (see worked example in [`02-data-model.md`](02-data-model.md))
- Post invoice → `Dr A/R, Cr Sales, Cr Tax-payable` (+ `Dr COGS, Cr Inventory` for stock value).
- Receive payment → `Dr Bank, Cr A/R`.

---

## H. Accounting & finance

**Purpose:** make the financial picture trustworthy and accessible without an accountant rebuilding it monthly.

- **Chart of accounts:** tree, seeded with sensible defaults, editable.
- **Manual journal entries:** for things outside the automated flows (owner's capital, rent, utilities, depreciation, opening balances) — must balance to post.
- **Ledgers:** per-account, per-customer, per-supplier transaction listings with running balance.
- **Reports:**
  - Trial balance
  - Profit & Loss (date range)
  - Balance sheet
  - Cash/bank book
  - Receivables & payables aging
  - Tax summary (output tax vs. input tax for the period)
  - Day book (all transactions for a day)
- **Fiscal year close:** lock a period so no one can post into it; roll balances forward.

**Screens:** chart of accounts, journal entry editor, account ledger, the report set (with date filters and CSV/PDF export).

---

## I. Reporting & dashboard (cross-module)

**Purpose:** the owner's at-a-glance answer to "how are we doing?"

- **Home dashboard:** cash & bank balance, this-month sales vs. purchases, receivables/payables totals, today's attendance count, low-stock items, upcoming payments due.
- **Exports:** every list and report exports to CSV; key documents to PDF.
- **Scheduled reports (later):** email the owner a weekly summary.

---

## J. Settings & administration

- Business profile (name, address, logo, tax registration, currency, timezone, fiscal year).
- Tax rates and the components that drive payroll/invoicing.
- Document numbering formats per document type.
- Users, roles, permissions.
- Backup status & manual backup trigger; data export.
- Audit log viewer.

---

## Module dependency order

```
Auth/Users ─▶ HR ─▶ Attendance ─▶ Payroll
                                      │
Accounting (chart + ledger) ─────────┤  (all financial modules post here)
   │                                  │
   ├─▶ Inventory ─▶ Purchasing        │
   │                  │               │
   └─▶ Sales/Invoicing ◀──────────────┘
            │
        Reporting/Dashboard (reads everything)
```

Accounting's ledger must exist before Purchasing/Sales/Payroll can post — so build a minimal chart-of-accounts + journal engine early, even before its reports are pretty.
