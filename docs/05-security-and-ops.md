# 05 — Security & Operations

Payroll and customer data are the crown jewels. This document covers keeping them safe and keeping the system running.

## 1. Authentication & access control

- **Passwords:** argon2id hashing, minimum length + breach-list check on set. No password ever logged.
- **Sessions:** httpOnly + Secure + SameSite cookies, short-lived access + rotating refresh tokens. Server-side session invalidation on logout/password change.
- **2FA:** TOTP, **required** for `owner` and `accounts` roles, optional for others.
- **RBAC:** the five roles from [`00-overview.md`](00-overview.md) map to permission sets. Enforced server-side on every endpoint — the UI only *hides* what you can't do, it never *guards* it.
- **Sensitive-field gating:** employee bank/statutory details and salary figures require dedicated permissions (`employee.view_sensitive`, `payroll.view`) and are omitted from responses otherwise.
- **Least privilege by default:** new users get the `employee` role only.

## 2. Data protection

- **In transit:** TLS everywhere (reverse proxy auto-provisions Let's Encrypt certs).
- **At rest:** full-disk encryption on the VPS volume; **application-level field encryption** for bank account numbers and statutory IDs (AES-GCM with a key from the secrets store, not in the DB).
- **Secrets:** environment variables / Docker secrets, never committed. A `.env.example` lists names only.
- **PII minimization:** collect only what payroll/invoicing needs; allow export and deletion of a person's data.
- **Backups are encrypted** before leaving the server (see §5).

## 3. Auditability & integrity

- **Audit log:** append-only record of every mutating action — who, what, when, before/after, IP. Surfaced in the admin UI, never editable.
- **Immutable financials:** posted invoices, payslips, and journal entries cannot be edited or deleted — only reversed/voided, which itself is logged. This is both a correctness and a compliance property.
- **Period locks:** closing a fiscal period or approving a payroll run blocks back-dated changes.

## 4. Application security baseline

- Validate and sanitize all input (zod at the boundary); parameterized queries only (Prisma) — no string-built SQL.
- Output encoding in React prevents XSS; set a strict Content-Security-Policy.
- CSRF protection for cookie auth (double-submit token or SameSite=strict + custom header).
- CORS restricted to the app origin.
- Rate-limit auth endpoints; lock accounts after repeated failures.
- Dependency scanning (Dependabot / `npm audit`) and container image scanning in CI.
- Security headers via the proxy (HSTS, X-Content-Type-Options, etc.).
- Run an internal **security review before each release** (see the repo's security-review process).

## 5. Backups & disaster recovery

This is non-negotiable for payroll/accounting data.

- **What:** nightly `pg_dump` of PostgreSQL + the object store (invoice/payslip PDFs, uploads).
- **How:** a `scripts/backup.sh` cron container dumps, compresses, **encrypts (age/gpg)**, and ships off-server to S3/R2/Backblaze. Keep 7 daily + 4 weekly + 12 monthly.
- **Restore drill:** `scripts/restore.sh` documented and **tested at least once before go-live and quarterly after** — an untested backup is not a backup.
- **RPO/RTO target:** lose at most 24h of data (nightly), restore within a couple of hours onto a fresh VPS.
- **Point-in-time (optional later):** enable WAL archiving for near-zero data loss if the business grows.

## 6. Deployment — self-host vs cloud

**Recommendation: self-host on a single small VPS.** For a 10-person workshop the data is sensitive (salaries, customers) and the load is tiny; a managed cloud ERP's per-user pricing isn't worth it, and you keep control of your data.

| Aspect | Self-host VPS (recommended) | Managed cloud / SaaS |
|--------|----------------------------|----------------------|
| Cost | ~$10–20/mo VPS + ~$1–2/mo backup storage | Often per-user, adds up |
| Control of data | Full | Vendor holds it |
| Maintenance | You patch & back up | Vendor does |
| Setup | `docker compose up` + domain + backups | Sign up |
| Best for | This project | Teams with no ops appetite |

**Reference deployment (one VPS, 2 vCPU / 4 GB):**

```
docker compose:
  ├─ caddy        # reverse proxy, automatic HTTPS
  ├─ web          # static SPA (or served by caddy)
  ├─ api          # NestJS
  ├─ worker       # NestJS (BullMQ consumer)
  ├─ postgres     # with a named volume
  ├─ redis
  ├─ minio        # S3-compatible file storage
  └─ backup       # cron: nightly encrypted dump -> offsite
```

- Point a domain at the VPS; Caddy gets HTTPS automatically.
- Firewall: expose only 80/443; Postgres/Redis/MinIO stay on the internal Docker network.
- Keep the OS and images patched; enable unattended-upgrades.
- A second cheap VPS as a warm spare (restore target) is a nice-to-have, not required.

> **If you genuinely have zero ops appetite,** this is the strongest argument for deploying **ERPNext on Frappe Cloud** (or any managed ERP) instead of self-hosting a custom build. Re-read the build-vs-buy section before committing.

## 7. Observability

- **Logs:** structured JSON logs from API/worker, shipped to files (or Loki/Grafana later). Never log secrets or full PII.
- **Errors:** Sentry (or self-hosted GlitchTip) for exception tracking.
- **Uptime:** an external uptime check (UptimeRobot/healthchecks.io) pinging `/healthz`.
- **Metrics (optional):** Prometheus + Grafana for DB/queue/HTTP once you care.
- **Health endpoints:** `/healthz` (liveness), `/readyz` (DB + Redis reachable).

## 8. CI/CD

GitHub Actions pipeline:

1. **On PR:** install → lint → typecheck → unit tests → integration tests (against a throwaway Postgres) → build.
2. **On merge to main:** build & push Docker images (tagged by commit), optionally auto-deploy to staging.
3. **On release tag:** publish images, deploy to prod (manual approval gate), run DB migrations as a pre-deploy step.
4. **Always:** dependency + image vulnerability scan; fail the build on high-severity findings.

Migrations run via Prisma in a pre-deploy job, never automatically at app boot in prod (so a bad migration can't take the app down silently).

## 9. Compliance notes (locale-dependent)

- **Invoicing:** many jurisdictions require gap-free sequential invoice numbers, immutability, and retention for several years — the design already enforces this.
- **Payroll/tax:** statutory deductions and rates are **configuration**, not code. Confirm local requirements (e.g. in India: PF, ESI, professional tax, TDS, GST on invoices) and set them up in settings. The app computes and reports; **e-filing stays manual/exported in v1** (a non-goal).
- **Data retention & privacy:** support export/delete of personal data; document a retention policy.
- Get a local accountant to sanity-check the chart of accounts and tax setup before go-live.
