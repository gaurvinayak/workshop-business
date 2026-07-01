import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { useApi, errMsg } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { PERMISSIONS } from '@workshopos/shared';

interface Asset { id: string; code: string; name: string; cost: string; usefulLifeMonths: number; accumulatedDepreciation: string; }

const today = () => new Date().toISOString().slice(0, 10);

export default function Assets() {
  const { can } = useAuth();
  const assets = useApi<Asset[]>('/fixed-assets');
  const canManage = can(PERMISSIONS.ASSET_MANAGE);
  const [form, setForm] = useState({ code: '', name: '', purchaseDate: today(), cost: '', salvageValue: '0', usefulLifeMonths: '60' });
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try {
      await api.post('/fixed-assets', { ...form, usefulLifeMonths: Number(form.usefulLifeMonths) });
      setForm({ code: '', name: '', purchaseDate: today(), cost: '', salvageValue: '0', usefulLifeMonths: '60' });
      assets.reload();
    } catch (e2) { setErr(errMsg(e2)); }
  }

  async function depreciate() {
    setErr(null); setMsg(null);
    try {
      const r = await api.post<{ posted: { code: string; amount: string }[] }>('/fixed-assets/depreciation', { period });
      setMsg(`Depreciation posted for ${r.posted.length} asset(s)`);
      assets.reload();
    } catch (e2) { setErr(errMsg(e2)); }
  }

  return (
    <div>
      <h2>Fixed Assets</h2>
      {err && <div className="error">{err}</div>}
      {msg && <div className="muted">{msg}</div>}

      {canManage && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
          <form className="card" onSubmit={add}>
            <h3 style={{ marginTop: 0 }}>New asset</h3>
            <div className="row">
              <div><label>Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
              <div><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            </div>
            <div className="row">
              <div><label>Purchase date</label><input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} required /></div>
              <div><label>Cost</label><input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} required /></div>
            </div>
            <div className="row">
              <div><label>Salvage value</label><input value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: e.target.value })} /></div>
              <div><label>Life (months)</label><input value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: e.target.value })} required /></div>
            </div>
            <button type="submit">Add asset</button>
          </form>

          <form className="card" onSubmit={(e) => { e.preventDefault(); depreciate(); }}>
            <h3 style={{ marginTop: 0 }}>Run depreciation</h3>
            <label>Period</label><input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            <button type="submit">Post depreciation</button>
            <p className="muted" style={{ fontSize: 12 }}>Straight-line, one entry per active asset.</p>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th className="num">Cost</th><th className="num">Life (mo)</th><th className="num">Accum. dep.</th><th className="num">Net book</th></tr></thead>
          <tbody>
            {assets.data?.map((a) => (
              <tr key={a.id}>
                <td>{a.code}</td><td>{a.name}</td><td className="num">{a.cost}</td><td className="num">{a.usefulLifeMonths}</td>
                <td className="num">{a.accumulatedDepreciation}</td>
                <td className="num">{(Number(a.cost) - Number(a.accumulatedDepreciation)).toFixed(2)}</td>
              </tr>
            ))}
            {!assets.data?.length && <tr><td colSpan={6} className="muted">No assets yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
