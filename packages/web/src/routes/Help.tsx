import { useState } from 'react';

interface Section {
  id: string;
  title: string;
  body: JSX.Element;
}

const CONCEPTS: Section[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    body: (
      <>
        <p>WorkshopOS runs your workshop in one place — attendance, payroll, stock, buying, selling, and accounts. The menu on the left groups everything by area. You only see the sections your role is allowed to use.</p>
        <p>A good first-week order: add your <b>employees</b>, set up your <b>items</b> and opening stock, add your <b>customers</b> and <b>suppliers</b>, then start raising invoices and purchase orders. The books update themselves as you work.</p>
      </>
    ),
  },
  {
    id: 'draft-post',
    title: 'Draft vs. Posted (important)',
    body: (
      <>
        <p>Money documents (invoices, receipts, bills) have two stages:</p>
        <ul>
          <li><b>Draft</b> — a work-in-progress you can freely edit.</li>
          <li><b>Posted</b> — final. It gets an official number, updates stock and the accounts, and <b>cannot be edited or deleted</b>.</li>
        </ul>
        <p>To fix a posted document you don't delete it — you reverse it (a <b>credit note</b> for a sale, a <b>debit note</b> for a purchase). This keeps your records honest and audit-safe.</p>
      </>
    ),
  },
  {
    id: 'accounting',
    title: 'How the accounting works (in plain words)',
    body: (
      <>
        <p>You don't need to be an accountant. Every action — selling, buying, paying salary — automatically records itself in the background using standard double-entry bookkeeping. That's why the <b>Reports</b> (Profit &amp; Loss, who owes you, what you owe) are always accurate without extra work.</p>
        <p>The one rule the system guarantees: the books always balance. If something can't be recorded correctly, the whole action is refused rather than leaving your accounts wrong.</p>
      </>
    ),
  },
];

const MODULES: Section[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    body: <p>Your morning overview: cash &amp; bank balance, this month's sales and purchases, who owes you (receivables) and what you owe (payables), how many staff are present today, and how many items are running low on stock.</p>,
  },
  {
    id: 'employees',
    title: 'Employees',
    body: <p>Your staff directory. Add each person with a code, name, and joining date. Employees can be grouped by department and designation. Bank and tax details are sensitive and only visible to authorised roles. Employees added here appear in attendance and payroll.</p>,
  },
  {
    id: 'attendance',
    title: 'Attendance',
    body: (
      <>
        <p>Track who worked and when. Staff clock in and out (from their login or a shared tablet at the entrance). The <b>monthly muster sheet</b> shows the whole team across the month at a glance (P = present, ½ = half day, A = absent, L = leave, H = holiday, O = weekly off).</p>
        <p>Supervisors can correct a day (a reason is required and recorded). Attendance feeds directly into payroll, so paid days are calculated for you.</p>
      </>
    ),
  },
  {
    id: 'inventory',
    title: 'Inventory',
    body: (
      <>
        <p>Everything you stock — products, raw materials, and spare parts. Each item has a code (SKU), a unit (piece, kg…), a tax rate, and a reorder level. <b>Stock on hand</b> shows quantities per location and flags anything below its reorder level.</p>
        <p>Use a <b>stock adjustment</b> to enter opening stock or record damage/found stock. The cost of your stock is tracked automatically using moving-average costing, so profit on sales is accurate.</p>
      </>
    ),
  },
  {
    id: 'purchasing',
    title: 'Purchasing',
    body: (
      <>
        <p>Buying from suppliers. Create a <b>purchase order</b> for what you're ordering, then click <b>Receive</b> when the goods arrive — that adds them to stock, raises the supplier's bill, and records what you owe. Record payments against bills to settle them.</p>
        <p>Returning goods to a supplier? Raise a <b>debit note</b>, which takes them back out of stock and reduces what you owe.</p>
      </>
    ),
  },
  {
    id: 'sales',
    title: 'Sales',
    body: (
      <>
        <p>Selling to customers. Optionally start with a <b>quotation</b> and convert it to an invoice when accepted. Create an <b>invoice</b>, and posting it reduces stock, records the sale, and adds to what the customer owes. Use <b>Print</b> to produce a clean PDF to send.</p>
        <p>Record <b>payments received</b> against invoices. For returns, raise a <b>credit note</b>.</p>
      </>
    ),
  },
  {
    id: 'production',
    title: 'Production',
    body: <p>For workshops that build or assemble things. A <b>work order</b> lists the raw materials it consumes plus labour and overhead cost. When you complete it, the materials leave stock and the finished goods enter stock valued at the full production cost — so you can see the real cost and margin of each batch.</p>,
  },
  {
    id: 'expenses',
    title: 'Expenses',
    body: <p>Day-to-day running costs — rent, electricity, fuel, and so on. Record each expense against a category; it's paid from cash or bank and flows straight into your Profit &amp; Loss.</p>,
  },
  {
    id: 'assets',
    title: 'Fixed Assets',
    body: <p>Your big equipment — machines, vehicles, tools. Register each with its cost and useful life. Run <b>depreciation</b> each month and the system spreads the cost over the asset's life automatically, keeping your accounts correct.</p>,
  },
  {
    id: 'payroll',
    title: 'Payroll',
    body: (
      <>
        <p>Paying your staff. Set each employee's <b>salary structure</b> (basic, allowances, deductions like PF). Each month, create a <b>payroll run</b> — it calculates everyone's pay from their structure and attendance. Review it, <b>Approve</b> to record it in the accounts, then <b>Mark paid</b>.</p>
        <p>You can also give an employee an <b>advance/loan</b>; it's automatically recovered in instalments from future payroll.</p>
      </>
    ),
  },
  {
    id: 'reports',
    title: 'Reports',
    body: (
      <>
        <p>The financial picture, always up to date:</p>
        <ul>
          <li><b>Trial balance</b> — the accounts, proving the books balance.</li>
          <li><b>Profit &amp; Loss</b> — income minus expenses for a period.</li>
          <li><b>Receivables / Payables aging</b> — who owes you and whom you owe, by how overdue.</li>
          <li><b>Tax summary</b> — tax collected vs. tax paid.</li>
          <li><b>Day book</b> — every transaction, for a date range.</li>
        </ul>
        <p>Most reports export to CSV for your accountant.</p>
      </>
    ),
  },
];

export default function Help() {
  const [q, setQ] = useState('');
  const match = (s: Section) => !q || s.title.toLowerCase().includes(q.toLowerCase());
  const concepts = CONCEPTS.filter(match);
  const modules = MODULES.filter(match);

  return (
    <div>
      <h2>Help &amp; User Guide</h2>
      <p className="muted" style={{ maxWidth: 640 }}>A plain-language guide to WorkshopOS. New here? Read “Getting started” and “Draft vs. Posted” first, then dip into any module below.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, marginTop: 16, alignItems: 'start' }}>
        <div className="card" style={{ position: 'sticky', top: 16 }}>
          <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
            {[...concepts, ...modules].map((s) => (
              <a key={s.id} href={`#${s.id}`} className="muted">{s.title}</a>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {concepts.length > 0 && <h3 style={{ margin: 0 }}>Key concepts</h3>}
          {concepts.map((s) => (
            <div className="card" id={s.id} key={s.id}>
              <h3 style={{ marginTop: 0 }}>{s.title}</h3>
              <div className="help-body">{s.body}</div>
            </div>
          ))}

          {modules.length > 0 && <h3 style={{ margin: '8px 0 0' }}>The modules</h3>}
          {modules.map((s) => (
            <div className="card" id={s.id} key={s.id}>
              <h3 style={{ marginTop: 0 }}>{s.title}</h3>
              <div className="help-body">{s.body}</div>
            </div>
          ))}

          {concepts.length === 0 && modules.length === 0 && <p className="muted">No help topics match “{q}”.</p>}
        </div>
      </div>
    </div>
  );
}
