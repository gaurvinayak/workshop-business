# 02 — Data Model

This is the load-bearing document. Get the ledger and stock model right and everything else is CRUD.

## 1. Conventions

- Every table has `id` (UUID v7 or bigserial), `created_at`, `updated_at`.
- Mutable master data has `deleted_at` (soft delete) and `is_active`.
- Money is `NUMERIC(18,4)`; quantities `NUMERIC(18,4)` (supports fractional units like 2.5 kg).
- All timestamps `timestamptz`, stored UTC.
- Foreign keys are enforced. Document-number uniqueness is enforced by a unique constraint.
- "Posted" financial documents are immutable; corrections are reversals.

## 2. Entity-relationship overview

```
            ┌────────────┐        ┌──────────────┐
            │   User      │───────▶│ Role / Perm  │
            └─────┬──────┘        └──────────────┘
                  │ 1:1 (staff log in)
            ┌─────▼──────┐
            │  Employee   │◀──────┐
            └─────┬──────┘        │
        ┌─────────┼─────────┐     │
        ▼         ▼         ▼     │
 ┌───────────┐ ┌────────┐ ┌──────────────┐
 │Attendance │ │ Leave  │ │SalaryStructure│
 └───────────┘ └────────┘ └──────┬───────┘
                                 ▼
                          ┌──────────────┐      ┌──────────┐
                          │ PayrollRun    │─────▶│ Payslip  │
                          └──────────────┘      └────┬─────┘
                                                     │ posts to
 ┌──────────┐   ┌──────────────┐                     ▼
 │ Supplier  │  │   Customer    │             ┌───────────────┐
 └────┬─────┘   └──────┬───────┘              │ JournalEntry   │◀──── everything
      │                │                       │  + JournalLine │      financial
      ▼                ▼                       └───────┬───────┘      posts here
 ┌──────────┐   ┌──────────────┐                       │
 │PurchaseOrd│  │   Invoice     │              ┌────────▼────────┐
 │ + lines   │  │   + lines     │              │   Account        │
 └────┬─────┘   └──────┬───────┘              │ (chart of accts) │
      │                │                       └─────────────────┘
      ▼                ▼
 ┌──────────────────────────────┐
 │       StockMovement           │  (one row per item per location per event)
 │  in/out, ref to PO/Invoice    │
 └──────────────┬───────────────┘
                ▼
        ┌───────────────┐   ┌──────────────┐
        │     Item       │──▶│  StockLevel  │ (item × location running qty)
        │ product/part/  │   └──────────────┘
        │ raw material   │
        └───────────────┘
```

## 3. Core domains & key tables

### 3.1 Identity & access

| Table | Key fields | Notes |
|-------|-----------|-------|
| `user` | email, password_hash (argon2), is_active, totp_secret | Login identity. May be linked to an `employee`. |
| `role` | name, description | owner, accounts, store, supervisor, employee |
| `permission` | code (e.g. `invoice.create`) | Fine-grained |
| `role_permission` | role_id, permission_id | Many-to-many |
| `user_role` | user_id, role_id | A user may hold multiple roles |
| `audit_log` | user_id, action, entity, entity_id, before, after, ip, at | Append-only |

### 3.2 HR & people

| Table | Key fields | Notes |
|-------|-----------|-------|
| `employee` | code, name, dob, phone, address, designation_id, department_id, date_joined, date_left, status, bank details, statutory ids (PF/ESI/PAN or local equivalents) | The person |
| `department` | name | Workshop, Stores, Office… |
| `designation` | name | Welder, Machinist, Accountant… |

### 3.3 Attendance & leave

| Table | Key fields | Notes |
|-------|-----------|-------|
| `shift` | name, start_time, end_time, break_minutes, grace_minutes | Defines expected hours |
| `employee_shift` | employee_id, shift_id, effective_from | Who works which shift |
| `attendance` | employee_id, date, check_in, check_out, status (present/absent/half/leave/holiday), worked_minutes, overtime_minutes, source (kiosk/manual/biometric), verified_by | One row per employee per day |
| `holiday` | date, name | Company calendar |
| `leave_type` | name, paid (bool), annual_quota | Casual, sick, unpaid… |
| `leave_request` | employee_id, leave_type_id, from, to, days, status, approver_id | Approval workflow |
| `leave_balance` | employee_id, leave_type_id, year, entitled, used | Running balance |

**Attendance integrity:** `unique(employee_id, date)`. `worked_minutes`/`overtime_minutes` derived from check-in/out vs. assigned shift, recomputed on edit. This feeds payroll.

### 3.4 Payroll

| Table | Key fields | Notes |
|-------|-----------|-------|
| `salary_component` | name, type (earning/deduction), calc (fixed/percent/formula), taxable | Basic, HRA, OT, PF, ESI, advance, fine… |
| `salary_structure` | employee_id, effective_from, currency | Header |
| `salary_structure_line` | structure_id, component_id, amount_or_rate | The breakdown |
| `payroll_run` | period (month), status (draft/approved/paid), created_by, approved_by | One run per month |
| `payslip` | run_id, employee_id, gross, total_deductions, net, paid_days, lop_days, ot_minutes | Per employee per run |
| `payslip_line` | payslip_id, component_id, amount | Frozen snapshot of components |

**Payroll flow:** a run reads attendance for the period → applies each employee's salary structure → prorates for paid days / loss-of-pay → adds overtime → subtracts deductions → produces payslips. Approving the run **posts one journal entry** (Dr salary expense, Cr salary payable / bank). Statutory deductions (PF/ESI/PT/TDS or local equivalents) are configurable components, not hardcoded.

### 3.5 Inventory

| Table | Key fields | Notes |
|-------|-----------|-------|
| `item` | sku, name, type (product/raw_material/spare_part/service), uom_id, category_id, hsn/sac code, tax_rate, reorder_level, is_stock_tracked, valuation_method | The thing you stock or sell |
| `item_category` | name, parent_id | Tree (e.g. Fasteners → Bolts) |
| `uom` | name, symbol | piece, kg, metre, litre |
| `location` | name, type (store/workshop/scrap) | Multiple stock locations |
| `stock_level` | item_id, location_id, quantity, avg_cost | Running on-hand & moving-average cost. `unique(item_id, location_id)` |
| `stock_movement` | item_id, location_id, qty (+in/−out), unit_cost, type (purchase/sale/adjustment/transfer/production/return), ref_type, ref_id, at, by | **The ledger of stock** — append-only |
| `stock_count` | location_id, status, lines | Physical count → adjustment movements |

**Stock truth:** `stock_level.quantity` is a cached running total; it must always equal the sum of `stock_movement.qty` for that item/location. Movements are the source of truth; levels are a performance cache, rebuildable. Valuation uses **moving average cost** by default (simplest correct method); FIFO is a later option.

### 3.6 Purchasing

| Table | Key fields | Notes |
|-------|-----------|-------|
| `supplier` | name, contact, address, tax_id, payment_terms, ledger_account_id | Vendor master |
| `purchase_order` | number, supplier_id, date, status (draft/sent/partially_received/received/closed/cancelled), currency, totals | PO header |
| `purchase_order_line` | po_id, item_id, qty, rate, tax_rate, received_qty | Lines |
| `goods_receipt` | number, po_id, date, location_id, received_by | Receiving event → creates stock-in movements |
| `goods_receipt_line` | grn_id, po_line_id, qty, unit_cost | Drives stock movements & avg cost |
| `supplier_bill` | number, supplier_id, po_id, date, due_date, totals, status (unpaid/partial/paid) | The payable; posts to ledger |
| `supplier_payment` | supplier_id, bill_id, date, amount, method | Settles payable; posts to ledger |

### 3.7 Sales & invoicing

| Table | Key fields | Notes |
|-------|-----------|-------|
| `customer` | name, contact, billing/shipping address, tax_id, credit_terms, ledger_account_id | Customer master |
| `quotation` | number, customer_id, date, valid_until, status, lines, totals | Optional pre-invoice |
| `invoice` | number, customer_id, date, due_date, status (draft/posted/partially_paid/paid/void), currency, subtotal, tax_total, total, amount_due | The receivable |
| `invoice_line` | invoice_id, item_id, description, qty, rate, discount, tax_rate, line_total | Lines; selling stock items creates stock-out movements |
| `payment_receipt` | number, customer_id, date, amount, method, allocations | Money in; allocates across invoices |
| `payment_allocation` | receipt_id, invoice_id, amount | Which invoice a payment settles |

**Invoice posting:** posting an invoice (a) generates the gap-free number, (b) creates stock-out movements for stock lines at current avg cost, (c) writes a journal entry: Dr accounts-receivable, Cr sales income, Cr tax-payable, and Dr cost-of-goods-sold / Cr inventory for the stock value. All in one transaction.

### 3.8 Accounting — the heart

| Table | Key fields | Notes |
|-------|-----------|-------|
| `account` | code, name, type (asset/liability/equity/income/expense), parent_id, is_postable | Chart of accounts (tree) |
| `fiscal_year` | name, start, end, status (open/closed) | Locks periods |
| `journal_entry` | number, date, narration, source_type, source_id, fiscal_year_id, posted_by, reversed_by | Header. `source_*` links to the invoice/PO/payslip that created it |
| `journal_line` | entry_id, account_id, debit, credit, party_type, party_id | The double entry. **Sum(debit) = Sum(credit)** enforced |

**The golden rule:** every financial event in the system writes a balanced `journal_entry`. Nothing touches account balances except journal lines. Reports (P&L, balance sheet, trial balance, receivables/payables aging) are *queries over journal lines* — never separately maintained numbers. This is why "basic accounting" comes for free: it's not a feature, it's the substrate.

A **default chart of accounts** is seeded on setup (Cash, Bank, Accounts Receivable, Accounts Payable, Inventory, Sales, COGS, Salary Expense, Tax Payable, etc.) and the owner can extend it.

## 4. The "one transaction" pattern (worked example)

Posting a customer invoice for goods:

```
BEGIN;
  -- 1. finalize the document
  UPDATE invoice SET status='posted', number=next_invoice_number(year);
  -- 2. move stock out for each stock line (at moving-avg cost)
  INSERT INTO stock_movement (...) VALUES (item, location, -qty, avg_cost, 'sale', 'invoice', invoice_id);
  UPDATE stock_level SET quantity = quantity - qty WHERE ...;
  -- 3. post the balanced journal entry
  INSERT INTO journal_entry (... source_type='invoice', source_id=invoice_id);
  INSERT INTO journal_line VALUES
     (entry, accounts_receivable, debit=total),
     (entry, sales_income,        credit=subtotal),
     (entry, tax_payable,         credit=tax_total),
     (entry, cogs,                debit=stock_value),
     (entry, inventory_asset,     credit=stock_value);
  -- assert sum(debit)=sum(credit)
COMMIT;
```

If any step fails, the whole thing rolls back — you never get stock moved without the ledger updated, or vice versa. This atomicity is the single most important correctness property of the system.

## 5. Indexing & performance notes

- Index foreign keys used in joins and the `(date)` columns on documents (reports filter by date range).
- `stock_movement(item_id, location_id, at)` composite index for valuation queries.
- `journal_line(account_id)` and `(party_type, party_id)` for ledger & aging reports.
- At 10 employees the data volume is tiny for years; correctness >> micro-optimization. Don't denormalize prematurely — the cached `stock_level` and per-account balances are the only caches worth keeping, and both are rebuildable from their movement/journal source.

## 6. Data we must protect

Salaries, bank details, and statutory IDs are sensitive. Encrypt bank/statutory fields at rest (application-level field encryption or DB-level), restrict via RBAC, and exclude from general API responses unless the requester has `payroll.view`/`employee.view_sensitive`. See [`05-security-and-ops.md`](05-security-and-ops.md).
