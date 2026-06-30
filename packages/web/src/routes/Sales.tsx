import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { useApi, errMsg } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { PERMISSIONS } from '@workshopos/shared';

interface Customer { id: string; name: string; }
interface Item { id: string; sku: string; name: string; salePrice: string; taxRate: string; }
interface Paged<T> { data: T[]; }
interface Invoice { id: string; number?: string; date: string; status: string; total: string; amountPaid: string; customer: { name: string }; }

const today = () => new Date().toISOString().slice(0, 10);

export default function Sales() {
  const { can } = useAuth();
  const customers = useApi<Customer[]>('/customers');
  const items = useApi<Paged<Item>>('/items?pageSize=200');
  const invoices = useApi<Invoice[]>('/invoices');
  const canManage = can(PERMISSIONS.SALES_MANAGE);

  const [custName, setCustName] = useState('');
  const [inv, setInv] = useState({ customerId: '', itemId: '', quantity: '1', rate: '', taxRate: '0' });
  const [pay, setPay] = useState({ customerId: '', amount: '', method: 'BANK' });
  const [err, setErr] = useState<string | null>(null);

  async function addCustomer(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try { await api.post('/customers', { name: custName }); setCustName(''); customers.reload(); }
    catch (e2) { setErr(errMsg(e2)); }
  }

  async function createAndPost(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try {
      const created = await api.post<{ id: string }>('/invoices', {
        customerId: inv.customerId,
        date: today(),
        lines: [{ itemId: inv.itemId, quantity: inv.quantity, rate: inv.rate, taxRate: inv.taxRate }],
      });
      await api.post(`/invoices/${created.id}/post`);
      setInv({ customerId: '', itemId: '', quantity: '1', rate: '', taxRate: '0' });
      invoices.reload();
    } catch (e2) { setErr(errMsg(e2)); }
  }

  async function receivePayment(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try { await api.post('/payment-receipts', { ...pay, date: today() }); setPay({ customerId: '', amount: '', method: 'BANK' }); invoices.reload(); }
    catch (e2) { setErr(errMsg(e2)); }
  }

  return (
    <div>
      <h2>Sales</h2>
      {err && <div className="error">{err}</div>}

      {canManage && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <form className="card" onSubmit={addCustomer}>
            <h3 style={{ marginTop: 0 }}>New customer</h3>
            <label>Name</label><input value={custName} onChange={(e) => setCustName(e.target.value)} required />
            <button type="submit">Add</button>
          </form>

          <form className="card" onSubmit={createAndPost}>
            <h3 style={{ marginTop: 0 }}>New invoice</h3>
            <label>Customer</label>
            <select value={inv.customerId} onChange={(e) => setInv({ ...inv, customerId: e.target.value })} required>
              <option value="">— select —</option>
              {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label>Item</label>
            <select value={inv.itemId} onChange={(e) => {
              const it = items.data?.data.find((x) => x.id === e.target.value);
              setInv({ ...inv, itemId: e.target.value, rate: it?.salePrice ?? inv.rate, taxRate: it?.taxRate ?? inv.taxRate });
            }} required>
              <option value="">— select —</option>
              {items.data?.data.map((i) => <option key={i.id} value={i.id}>{i.sku} {i.name}</option>)}
            </select>
            <div className="row">
              <div><label>Qty</label><input value={inv.quantity} onChange={(e) => setInv({ ...inv, quantity: e.target.value })} /></div>
              <div><label>Rate</label><input value={inv.rate} onChange={(e) => setInv({ ...inv, rate: e.target.value })} required /></div>
              <div><label>Tax %</label><input value={inv.taxRate} onChange={(e) => setInv({ ...inv, taxRate: e.target.value })} /></div>
            </div>
            <button type="submit">Create &amp; post</button>
          </form>

          <form className="card" onSubmit={receivePayment}>
            <h3 style={{ marginTop: 0 }}>Receive payment</h3>
            <label>Customer</label>
            <select value={pay.customerId} onChange={(e) => setPay({ ...pay, customerId: e.target.value })} required>
              <option value="">— select —</option>
              {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label>Amount</label><input value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required />
            <label>Method</label>
            <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option>BANK</option><option>CASH</option></select>
            <button type="submit">Record receipt</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Invoices</h3>
        <table>
          <thead><tr><th>Number</th><th>Customer</th><th>Date</th><th>Status</th><th className="num">Total</th><th className="num">Paid</th></tr></thead>
          <tbody>
            {invoices.data?.map((i) => (
              <tr key={i.id}>
                <td>{i.number ?? '(draft)'}</td><td>{i.customer.name}</td><td>{i.date.slice(0, 10)}</td>
                <td className="muted">{i.status}</td><td className="num">{i.total}</td><td className="num">{i.amountPaid}</td>
              </tr>
            ))}
            {!invoices.data?.length && <tr><td colSpan={6} className="muted">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
