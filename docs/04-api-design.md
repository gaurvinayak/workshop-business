# 04 — API Design

A pragmatic REST API under `/api/v1`. JSON in/out. The web app is the primary client; the API is also usable for kiosk devices and future integrations.

## 1. Conventions

- **Base path:** `/api/v1`. Version in the path; bump only on breaking changes.
- **Auth:** httpOnly session cookie (web) or `Authorization: Bearer <jwt>` (devices). Refresh-token rotation.
- **Content type:** `application/json`. Files via `multipart/form-data` to dedicated upload endpoints, stored in object storage, referenced by id.
- **IDs:** UUIDs in URLs.
- **Validation:** zod schemas (shared with the web app); 422 with a field-error map on failure.
- **Errors:** consistent envelope:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "qty": "must be > 0" } } }
  ```
  Codes: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`.
- **Pagination:** `?page=1&pageSize=25` (or cursor for large lists); responses include `{ data, page, pageSize, total }`.
- **Filtering/sorting:** `?status=posted&from=2026-01-01&to=2026-01-31&sort=-date`.
- **Idempotency:** financial POSTs accept `Idempotency-Key` header; same key returns the original result, never double-posts.
- **Timestamps:** ISO-8601 UTC in responses.
- **Money:** strings to avoid float issues (`"1250.0000"`), or integer minor units — pick one and document it in `shared`.

## 2. Resource map (representative, not exhaustive)

```
POST   /auth/login                       JWT/cookie
POST   /auth/logout
POST   /auth/refresh
POST   /auth/2fa/setup  /auth/2fa/verify

GET    /users            POST /users       PATCH /users/:id
GET    /roles            PATCH /roles/:id/permissions

GET    /employees        POST /employees   PATCH /employees/:id
GET    /employees/:id/attendance
GET    /employees/:id/payslips
GET    /departments      /designations

POST   /attendance/clock-in   /attendance/clock-out     # for the logged-in employee/kiosk
GET    /attendance?from&to&employeeId
PATCH  /attendance/:id                                   # supervisor correction (reason required)
GET    /attendance/sheet?month=2026-06                   # monthly muster grid
GET/POST /shifts   /holidays   /leave-types
POST   /leave-requests   PATCH /leave-requests/:id/approve

GET    /salary-structures   PUT /employees/:id/salary-structure
POST   /payroll/runs                       # create draft run for a period
POST   /payroll/runs/:id/compute           # (re)calc payslips
POST   /payroll/runs/:id/approve           # posts journal entry, locks period
POST   /payroll/runs/:id/mark-paid
GET    /payroll/runs/:id  /payslips/:id  /payslips/:id/pdf

GET    /items   POST /items   PATCH /items/:id
GET    /items/:id/movements
GET    /stock?locationId&lowStock=true
POST   /stock/adjustments     /stock/transfers
POST   /stock/counts          POST /stock/counts/:id/post
GET/POST /locations  /item-categories  /uoms

GET    /suppliers   POST /suppliers
POST   /purchase-orders     PATCH /purchase-orders/:id
POST   /purchase-orders/:id/receive        # goods receipt -> stock-in
POST   /supplier-bills      POST /supplier-payments
GET    /reports/payables-aging

GET    /customers   POST /customers
POST   /quotations  POST /quotations/:id/convert
POST   /invoices                            # creates draft
POST   /invoices/:id/post                   # number, stock-out, journal entry (idempotent)
POST   /invoices/:id/void
GET    /invoices/:id/pdf
POST   /payment-receipts                     # money in, allocate to invoices
GET    /reports/receivables-aging

GET    /accounts   POST /accounts            # chart of accounts
POST   /journal-entries                      # manual entry (must balance)
GET    /accounts/:id/ledger
GET    /reports/trial-balance
GET    /reports/profit-loss?from&to
GET    /reports/balance-sheet?asOf
GET    /reports/tax-summary?from&to

GET    /dashboard                            # aggregated home widgets
GET    /audit-logs?entity&entityId
GET    /settings   PATCH /settings
POST   /backups/run   GET /backups
```

## 3. State-transition endpoints over PATCH-the-status

Financial documents move through states via **explicit action endpoints** (`/invoices/:id/post`, `/payroll/runs/:id/approve`) rather than `PATCH {status}`. This keeps the side effects (numbering, stock movement, journal posting) server-controlled and lets the API reject illegal transitions cleanly. Drafts are edited with normal `PATCH`; once posted they're immutable.

## 4. Authorization

Every endpoint declares the permission it needs (e.g. `@RequirePermission('invoice.post')`). A guard checks the user's roles → permissions. Sensitive employee/payroll fields require an extra permission and are stripped from responses otherwise. The audit interceptor logs every mutating call.

## 5. Background work

Long actions return quickly and continue on the worker via BullMQ:
- `POST /payroll/runs/:id/compute` may enqueue if employee count grows; for 10 it's synchronous.
- `GET /invoices/:id/pdf` renders on demand and caches the PDF in object storage.
- Email (invoice to customer, payslip, low-stock alert) is always queued.

## 6. OpenAPI & types

NestJS emits an **OpenAPI spec** from decorators. Generate the web app's API client and TypeScript types from it (or share zod schemas via the `shared` package). One source of truth for request/response shapes; no drift.

## 7. Rate limiting & abuse

- Login and password-reset endpoints rate-limited (per IP + per account).
- Kiosk endpoints use a device token, not a user session.
- All mutating endpoints behind auth; CORS locked to the app origin.
