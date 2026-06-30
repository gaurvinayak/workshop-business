import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Account { id: string; }
interface Paged<T> { data: T[]; total: number; }

export default function Dashboard() {
  const [accounts, setAccounts] = useState<number | null>(null);
  const [entries, setEntries] = useState<number | null>(null);

  useEffect(() => {
    api.get<Account[]>('/accounts').then((a) => setAccounts(a.length)).catch(() => setAccounts(null));
    api.get<Paged<unknown>>('/journal-entries?pageSize=1').then((p) => setEntries(p.total)).catch(() => setEntries(null));
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      <p className="muted">Phase 0 foundation. Operational widgets (cash, sales, attendance, low stock) arrive with their modules.</p>
      <div className="grid" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="muted">Accounts in chart</div>
          <div className="stat">{accounts ?? '—'}</div>
        </div>
        <div className="card">
          <div className="muted">Journal entries posted</div>
          <div className="stat">{entries ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
