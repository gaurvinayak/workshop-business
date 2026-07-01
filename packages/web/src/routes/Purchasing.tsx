import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { useApi, errMsg } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { money } from '../lib/format';
import { PERMISSIONS } from '@workshopos/shared';

interface Supplier { id: string; name: string; }
interface Item { id: string; sku: string; name: string; }
interface Paged<T> { data: T[]; }
interface Location { id: string; name: string; }
interface PO { id: string; number: string; date: string; status: string; total: string; supplier: { name: string }; }

const today = () => new Date().toISOString().slice(0, 10);

export default function Purchasing() {
  const { can } = useAuth();
  const suppliers = useApi<Supplier[]>('/suppliers');
  const items = useApi<Paged<Item>>('/items?pageSize=200');
  const locations = useApi<Location[]>('/locations');
  const pos = useApi<PO[]>('/purchase-orders');
  const canManage = can(PERMISSIONS.PURCHASE_MANAGE);

  const [supName, setSupName] = useState('');
  const [po, setPo] = useState({ supplierId: '', itemId: '', quantity: '', rate: '', taxRate: '0' });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function addSupplier(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try { await api.post('/suppliers', { name: supName }); setSupName(''); suppliers.reload(); }
    catch (e2) { setErr(errMsg(e2)); }
  }

  async function createPO(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try {
      await api.post('/purchase-orders', {
        supplierId: po.supplierId, date: today(),
        lines: [{ itemId: po.itemId, quantity: po.quantity, rate: po.rate, taxRate: po.taxRate }],
      });
      setPo({ supplierId: '', itemId: '', quantity: '', rate: '', taxRate: '0' });
      pos.reload();
    } catch (e2) { setErr(errMsg(e2)); }
  }

  async function receive(poId: string) {
    setErr(null); setMsg(null);
    try {
      const full = await api.get<{ lines: { id: string; quantity: string; rate: string; receivedQty: string }[] }>(`/purchase-orders/${poId}`);
      const locationId = locations.data?.[0]?.id;
      const lines = full.lines
        .map((l) => ({ poLineId: l.id, quantity: String(Number(l.quantity) - Number(l.receivedQty)), unitCost: l.rate }))
        .filter((l) => Number(l.quantity) > 0);
      if (!lines.length) { setMsg('Nothing left to receive'); return; }
      await api.post(`/purchase-orders/${poId}/receive`, { locationId, date: today(), lines });
      setMsg('Goods received and bill raised');
      pos.reload();
    } catch (e2) { setErr(errMsg(e2)); }
  }

  return (
    <div>
      <h2>Purchasing</h2>
      {err && <div className="error">{err}</div>}
      {msg && <div className="muted">{msg}</div>}

      {canManage && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
          <form className="card" onSubmit={addSupplier}>
            <h3 style={{ marginTop: 0 }}>New supplier</h3>
            <label>Name</label><input value={supName} onChange={(e) => setSupName(e.target.value)} required />
            <button type="submit">Add</button>
          </form>

          <form className="card" onSubmit={createPO}>
            <h3 style={{ marginTop: 0 }}>New purchase order</h3>
            <div className="row">
              <div><label>Supplier</label>
                <select value={po.supplierId} onChange={(e) => setPo({ ...po, supplierId: e.target.value })} required>
                  <option value="">— select —</option>
                  {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label>Item</label>
                <select value={po.itemId} onChange={(e) => setPo({ ...po, itemId: e.target.value })} required>
                  <option value="">— select —</option>
                  {items.data?.data.map((i) => <option key={i.id} value={i.id}>{i.sku} {i.name}</option>)}
                </select>
              </div>
            </div>
            <div className="row">
              <div><label>Qty</label><input value={po.quantity} onChange={(e) => setPo({ ...po, quantity: e.target.value })} required /></div>
              <div><label>Rate</label><input value={po.rate} onChange={(e) => setPo({ ...po, rate: e.target.value })} required /></div>
              <div><label>Tax %</label><input value={po.taxRate} onChange={(e) => setPo({ ...po, taxRate: e.target.value })} /></div>
            </div>
            <button type="submit">Create PO</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Purchase orders</h3>
        <table>
          <thead><tr><th>Number</th><th>Supplier</th><th>Date</th><th>Status</th><th className="num">Total</th><th></th></tr></thead>
          <tbody>
            {pos.data?.map((p) => (
              <tr key={p.id}>
                <td>{p.number}</td><td>{p.supplier.name}</td><td>{p.date.slice(0, 10)}</td>
                <td><span className={`badge ${p.status === 'RECEIVED' ? 'success' : p.status === 'PARTIALLY_RECEIVED' ? 'info' : p.status === 'CANCELLED' ? 'danger' : 'warning'}`}>{p.status.replace('_', ' ')}</span></td><td className="num">{money(p.total)}</td>
                <td>{canManage && p.status !== 'RECEIVED' && <button className="secondary" style={{ margin: 0, padding: '4px 10px' }} onClick={() => receive(p.id)}>Receive</button>}</td>
              </tr>
            ))}
            {!pos.data?.length && <tr><td colSpan={6} className="muted">No purchase orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
