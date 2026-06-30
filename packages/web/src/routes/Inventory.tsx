import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { useApi, errMsg } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { PERMISSIONS } from '@workshopos/shared';

interface Uom { id: string; name: string; }
interface Location { id: string; name: string; }
interface Item { id: string; sku: string; name: string; type: string; salePrice: string; }
interface Paged<T> { data: T[]; total: number; }
interface StockRow { itemId: string; sku: string; name: string; location: string; quantity: string; avgCost: string; low: boolean; }

export default function Inventory() {
  const { can } = useAuth();
  const items = useApi<Paged<Item>>('/items?pageSize=200');
  const stock = useApi<StockRow[]>('/stock');
  const uoms = useApi<Uom[]>('/uoms');
  const locations = useApi<Location[]>('/locations');
  const canManage = can(PERMISSIONS.ITEM_MANAGE);
  const canStock = can(PERMISSIONS.STOCK_MANAGE);

  const [item, setItem] = useState({ sku: '', name: '', type: 'PRODUCT', uomId: '', taxRate: '0', salePrice: '0', reorderLevel: '0' });
  const [adj, setAdj] = useState({ itemId: '', locationId: '', quantity: '', unitCost: '0', reason: '' });
  const [err, setErr] = useState<string | null>(null);

  async function addItem(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post('/items', { ...item, uomId: item.uomId || uoms.data?.[0]?.id });
      setItem({ sku: '', name: '', type: 'PRODUCT', uomId: '', taxRate: '0', salePrice: '0', reorderLevel: '0' });
      items.reload();
    } catch (e2) { setErr(errMsg(e2)); }
  }

  async function adjustStock(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post('/stock/adjustments', { ...adj, locationId: adj.locationId || locations.data?.[0]?.id });
      setAdj({ itemId: '', locationId: '', quantity: '', unitCost: '0', reason: '' });
      stock.reload();
    } catch (e2) { setErr(errMsg(e2)); }
  }

  return (
    <div>
      <h2>Inventory</h2>
      {err && <div className="error">{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {canManage && (
          <form className="card" onSubmit={addItem}>
            <h3 style={{ marginTop: 0 }}>New item</h3>
            <label>SKU</label><input value={item.sku} onChange={(e) => setItem({ ...item, sku: e.target.value })} required />
            <label>Name</label><input value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} required />
            <div className="row">
              <div><label>Type</label>
                <select value={item.type} onChange={(e) => setItem({ ...item, type: e.target.value })}>
                  <option>PRODUCT</option><option>RAW_MATERIAL</option><option>SPARE_PART</option><option>SERVICE</option>
                </select>
              </div>
              <div><label>UoM</label>
                <select value={item.uomId} onChange={(e) => setItem({ ...item, uomId: e.target.value })}>
                  {uoms.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="row">
              <div><label>Tax %</label><input value={item.taxRate} onChange={(e) => setItem({ ...item, taxRate: e.target.value })} /></div>
              <div><label>Sale price</label><input value={item.salePrice} onChange={(e) => setItem({ ...item, salePrice: e.target.value })} /></div>
              <div><label>Reorder</label><input value={item.reorderLevel} onChange={(e) => setItem({ ...item, reorderLevel: e.target.value })} /></div>
            </div>
            <button type="submit">Add item</button>
          </form>
        )}

        {canStock && (
          <form className="card" onSubmit={adjustStock}>
            <h3 style={{ marginTop: 0 }}>Stock adjustment</h3>
            <label>Item</label>
            <select value={adj.itemId} onChange={(e) => setAdj({ ...adj, itemId: e.target.value })} required>
              <option value="">— select —</option>
              {items.data?.data.map((i) => <option key={i.id} value={i.id}>{i.sku} {i.name}</option>)}
            </select>
            <label>Location</label>
            <select value={adj.locationId} onChange={(e) => setAdj({ ...adj, locationId: e.target.value })}>
              {locations.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <div className="row">
              <div><label>Quantity (±)</label><input value={adj.quantity} onChange={(e) => setAdj({ ...adj, quantity: e.target.value })} placeholder="100 or -5" required /></div>
              <div><label>Unit cost</label><input value={adj.unitCost} onChange={(e) => setAdj({ ...adj, unitCost: e.target.value })} /></div>
            </div>
            <label>Reason</label><input value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} required />
            <button type="submit">Post adjustment</button>
          </form>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Stock on hand</h3>
        <table>
          <thead><tr><th>SKU</th><th>Item</th><th>Location</th><th className="num">Qty</th><th className="num">Avg cost</th><th></th></tr></thead>
          <tbody>
            {stock.data?.map((s, i) => (
              <tr key={i}>
                <td>{s.sku}</td><td>{s.name}</td><td>{s.location}</td>
                <td className="num">{s.quantity}</td><td className="num">{s.avgCost}</td>
                <td>{s.low && <span style={{ color: 'var(--danger)' }}>● low</span>}</td>
              </tr>
            ))}
            {!stock.data?.length && <tr><td colSpan={6} className="muted">No stock yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
