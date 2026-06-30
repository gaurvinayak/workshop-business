import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { useApi, errMsg } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { PERMISSIONS } from '@workshopos/shared';

interface Employee { id: string; code: string; name: string; phone?: string; status: string; department?: { name: string }; designation?: { name: string }; }
interface Paged<T> { data: T[]; total: number; }

export default function Employees() {
  const { can } = useAuth();
  const { data, reload } = useApi<Paged<Employee>>('/employees?pageSize=200');
  const [form, setForm] = useState({ code: '', name: '', phone: '', dateJoined: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState<string | null>(null);
  const canManage = can(PERMISSIONS.EMPLOYEE_MANAGE);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/employees', form);
      setForm({ code: '', name: '', phone: '', dateJoined: new Date().toISOString().slice(0, 10) });
      reload();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div>
      <h2>Employees</h2>
      {canManage && (
        <form className="card" onSubmit={add} style={{ marginBottom: 20 }}>
          <div className="row">
            <div><label>Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
            <div><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label>Joined</label><input type="date" value={form.dateJoined} onChange={(e) => setForm({ ...form, dateJoined: e.target.value })} required /></div>
            <div style={{ flex: '0 0 auto' }}><button type="submit">Add</button></div>
          </div>
          {error && <div className="error">{error}</div>}
        </form>
      )}
      <div className="card">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Phone</th><th>Department</th><th>Status</th></tr></thead>
          <tbody>
            {data?.data.map((e) => (
              <tr key={e.id}><td>{e.code}</td><td>{e.name}</td><td>{e.phone ?? '—'}</td><td>{e.department?.name ?? '—'}</td><td className="muted">{e.status}</td></tr>
            ))}
            {!data?.data.length && <tr><td colSpan={5} className="muted">No employees yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
