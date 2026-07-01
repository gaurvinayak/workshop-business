import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { useApi, errMsg } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { PERMISSIONS } from '@workshopos/shared';

interface Item { id: string; sku: string; name: string; }
interface Paged<T> { data: T[]; }
interface Location { id: string; name: string; }
interface WO { id: string; number: string; description: string; date: string; status: string; materialCost: string; outputValue: string; }

const today = () => new Date().toISOString().slice(0, 10);

export default function Production() {
  const { can } = useAuth();
  const items = useApi<Paged<Item>>('/items?pageSize=200');
  const locations = useApi<Location[]>('/locations');
  const wos = useApi<WO[]>('/work-orders');
  const canManage = can(PERMISSIONS.PRODUCTION_MANAGE);

  const [wo, setWo] = useState({ description: '', locationId: '', matItem: '', matQty: '', outItem: '', outQty: '', laborCost: '0', overheadCost: '0' });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try {
      await api.post('/work-orders', {
        description: wo.description, locationId: wo.locationId || locations.data?.[0]?.id, date: today(),
        laborCost: wo.laborCost, overheadCost: wo.overheadCost,
        materials: [{ itemId: wo.matItem, quantity: wo.matQty }],
        outputs: [{ itemId: wo.outItem, quantity: wo.outQty }],
      });
      setWo({ description: '', locationId: '', matItem: '', matQty: '', outItem: '', outQty: '', laborCost: '0', overheadCost: '0' });
      wos.reload();
    } catch (e2) { setErr(errMsg(e2)); }
  }

  async function complete(id: string) {
    setErr(null); setMsg(null);
    try { await api.post(`/work-orders/${id}/complete`); setMsg('Completed — outputs produced'); wos.reload(); }
    catch (e2) { setErr(errMsg(e2)); }
  }

  return (
    <div>
      <h2>Production</h2>
      {err && <div className="error">{err}</div>}
      {msg && <div className="muted">{msg}</div>}

      {canManage && (
        <form className="card" onSubmit={create} style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>New work order</h3>
          <label>Description</label><input value={wo.description} onChange={(e) => setWo({ ...wo, description: e.target.value })} required />
          <div className="row">
            <div><label>Material</label>
              <select value={wo.matItem} onChange={(e) => setWo({ ...wo, matItem: e.target.value })} required>
                <option value="">— raw material —</option>
                {items.data?.data.map((i) => <option key={i.id} value={i.id}>{i.sku} {i.name}</option>)}
              </select>
            </div>
            <div><label>Qty consumed</label><input value={wo.matQty} onChange={(e) => setWo({ ...wo, matQty: e.target.value })} required /></div>
          </div>
          <div className="row">
            <div><label>Output</label>
              <select value={wo.outItem} onChange={(e) => setWo({ ...wo, outItem: e.target.value })} required>
                <option value="">— finished item —</option>
                {items.data?.data.map((i) => <option key={i.id} value={i.id}>{i.sku} {i.name}</option>)}
              </select>
            </div>
            <div><label>Qty produced</label><input value={wo.outQty} onChange={(e) => setWo({ ...wo, outQty: e.target.value })} required /></div>
          </div>
          <div className="row">
            <div><label>Labor cost</label><input value={wo.laborCost} onChange={(e) => setWo({ ...wo, laborCost: e.target.value })} /></div>
            <div><label>Overhead</label><input value={wo.overheadCost} onChange={(e) => setWo({ ...wo, overheadCost: e.target.value })} /></div>
          </div>
          <button type="submit">Create work order</button>
        </form>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Work orders</h3>
        <table>
          <thead><tr><th>Number</th><th>Description</th><th>Status</th><th className="num">Material</th><th className="num">Output value</th><th></th></tr></thead>
          <tbody>
            {wos.data?.map((w) => (
              <tr key={w.id}>
                <td>{w.number}</td><td>{w.description}</td><td className="muted">{w.status}</td>
                <td className="num">{w.materialCost}</td><td className="num">{w.outputValue}</td>
                <td>{canManage && w.status !== 'COMPLETED' && <button className="secondary" style={{ margin: 0, padding: '4px 10px' }} onClick={() => complete(w.id)}>Complete</button>}</td>
              </tr>
            ))}
            {!wos.data?.length && <tr><td colSpan={6} className="muted">No work orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
