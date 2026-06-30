# 00 — Overview & Scope

## 1. The problem

A newly-formed rig/workshop business with ~10 employees is outgrowing Excel. The pain points that come with that growth:

- **Attendance** is on paper or a spreadsheet; overtime and leave are calculated by hand.
- **Payroll** is error-prone — formulas get copied wrong, deductions are inconsistent, payslips are ad-hoc.
- **Inventory** of raw material, finished products, and spare parts has no single source of truth; stock-outs and over-ordering both happen.
- **Purchasing** isn't linked to stock, so what was ordered vs. received vs. paid is fuzzy.
- **Customer invoices** are Word/Excel templates with manual numbering — easy to duplicate or lose.
- **Accounting** is reconstructed at month/year end from receipts, which is stressful and inaccurate.

The goal is **one application** that ties these together so a single transaction (e.g. "received 100 bolts on PO #14") updates stock, supplier balance, and the ledger at once.

## 2. Goals

1. Replace the spreadsheet stack with a single web app accessible to staff and admins.
2. Make day-to-day data entry fast (the people entering data are not accountants).
3. Keep an accurate, auditable financial picture as a *byproduct* of normal operations.
4. Be cheap and simple to self-host and back up.
5. Be safe with sensitive data (salaries, customer details) — proper roles and audit logs.

## 3. Non-goals (for v1)

Explicitly out of scope so the project stays finishable:

- Full manufacturing / BOM / production routing (a later module; v1 treats production as simple stock adjustments).
- Multi-company / multi-branch consolidation (single legal entity, optional multiple stock locations).
- Statutory e-filing integrations (GST returns, tax e-invoicing portals). We compute and *store* tax; filing stays manual or exported.
- Mobile native apps (the web app is mobile-responsive; native can come later).
- Marketplace/e-commerce storefront.
- HR beyond attendance & payroll (no recruitment, appraisals, training).

## 4. Users & roles (personas)

| Persona | Who | Needs |
|---------|-----|-------|
| **Owner / Admin** | Business owner | Everything: full visibility, financial reports, user management, settings |
| **Accounts / Office staff** | 1–2 office people | Invoices, purchases, payments, payroll runs, ledger |
| **Store / Inventory keeper** | Stores in-charge | Stock-in/out, spare parts, stock counts, low-stock alerts |
| **Supervisor / Floor lead** | Workshop lead | Mark/verify attendance, view team, raise material requests |
| **Employee** | Workshop staff | Clock in/out, view own attendance, leave requests, download payslips |

These map directly to the RBAC roles in [`05-security-and-ops.md`](05-security-and-ops.md). Permissions are role-based with sensible defaults; the owner can adjust.

## 5. Build vs. Buy — the honest analysis

| Option | Setup effort | Fit for a workshop | Ongoing ownership | Verdict |
|--------|-------------|--------------------|--------------------|---------|
| **ERPNext (Frappe)** | Low–medium (Docker) | Excellent — HR, payroll, stock, accounting, manufacturing all built-in | You configure, they maintain core | **Best if you just need it to work** |
| **Odoo Community** | Medium | Very good; some HR/payroll features are Enterprise-only | Module sprawl, upgrade friction | Good, watch the paywall line |
| **Tryton** | Medium | Good accounting/inventory core | Smaller community | Niche but solid |
| **Build WorkshopOS** | High | Exactly your workflow | You own all of it forever | **Only if you have a developer who will stay** |

**Recommendation if asked plainly:** for a 10-person shop that just wants to stop using Excel, **deploy ERPNext** and spend the saved months running the business. Build WorkshopOS only if control/learning/unusual workflow makes a custom build worth the multi-month effort and permanent maintenance burden. This repository proceeds on the assumption that you've consciously chosen to build — but revisit this table before you write the first line of code.

## 6. Success criteria

The MVP is "done enough to switch off Excel" when:

- [ ] Every employee can clock in/out and an admin can see a monthly attendance sheet.
- [ ] A payroll run produces correct payslips for all employees from attendance + salary structure.
- [ ] Stock levels for products and spare parts are accurate after a purchase and a sale.
- [ ] A customer invoice can be created, numbered, printed/PDF'd, and marked paid.
- [ ] The owner can pull a profit/loss and a list of who owes what (receivables) and what we owe (payables).
- [ ] Nightly backups run and have been test-restored once.

## 7. Guiding principles

1. **Double-entry at the core.** Accounting isn't a module bolted on at the end; stock moves, payroll, and sales all post journal entries. This makes reports trustworthy.
2. **Immutable financial records.** Posted invoices/journal entries are never edited in place — you reverse and re-issue. Drafts are editable; posted documents are not.
3. **Boring, proven tech.** PostgreSQL, a single API service, a single web app. No premature microservices.
4. **Fast data entry over feature breadth.** The shop floor won't use a clunky tool.
5. **Self-host friendly.** One `docker compose up`, a backup script, done.
