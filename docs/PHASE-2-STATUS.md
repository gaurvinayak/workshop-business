# Phase 2 — Status (in progress)

Phase 2 rounds out the daily workflow. This is being delivered incrementally on
top of the validated Phase 1 MVP.

## Done so far

| Item | Backend | Frontend | Validated |
|------|---------|----------|-----------|
| Tax summary report (output vs input tax → net payable) | ✅ | ✅ tab | ✅ output ₹90 / input ₹360 / net −₹270 |
| Day book (all journal entries for a period) | ✅ | ✅ tab | ✅ 7 entries |
| Business settings endpoint (letterhead source) | ✅ | — | ✅ |
| Printable invoice (browser print / save-as-PDF) | uses existing API | ✅ `/print/invoice/:id` | builds |
| CSV export on reports | — | ✅ trial balance | builds |

## Still to do (Phase 2 backlog, per the roadmap)

- Leave **balances** (entitlement vs used) and the holiday-aware attendance compute
- **Quotations** → convert to invoice; **credit notes / sales & purchase returns**
- Employee self-service portal pages (my attendance, my leave) — payslips already done
- **Advances/loans** with auto-recovery in payroll
- Barcode/SKU labels + scan-to-pick
- Physical **stock count** workflow with variance posting
- **Email** (invoices to customers, payslips, low-stock alerts) via the job queue
- **PDF** server-side rendering (currently browser print) and letterhead/logo polish
- Server-side **invoice/payslip PDF** caching in object storage

## Notes

- The printable invoice uses the browser's print-to-PDF (a `@media print`
  stylesheet hides the app chrome). This needs no server-side Chromium and works
  today; a server-rendered, cached PDF is the later upgrade.
- Tax summary treats account `2200` (Output Tax) as the liability side and
  `1210` (Input Tax) as the asset side, so the net payable is collected − paid.
