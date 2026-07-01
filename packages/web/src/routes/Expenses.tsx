import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { useApi, errMsg } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { money } from '../lib/format';
import { PERMISSIONS } from '@workshopos/shared';

interface Account { code: string; name: string; type: string; isPostable: boolean; }
interface Expense { id: string; number: string; date: string; description: string; accountCode: string; amount: string; method: string; }

const today = () => new Date().toISOString().slice(0, 10);

export default function Expenses() {
  const { can } = useAuth();
  const expenses = useApi<Expense[]>('/expenses');
  const accounts = useApi<Account[]>('/accounts');
  const canManage = can(PERMISSIONS.EXPENSE_MANAGE);
  const expenseAccounts = accounts.data?.filter((a) => a.type === 'EXPENSE' && a.isPostable) ?? [];

  const [form, setForm] = useState({ date: today(), accountCode: '', description: '', amount: '', taxAmount: '0', method: 'BANK', recurring: false });
  const [err, setErr] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try {
      await api.post('/expenses', { ...form, accountCode: form.accountCode || expenseAccounts[0]?.code });
      setForm({ date: today(), accountCode: '', description: '', amount: '', taxAmount: '0', method: 'BANK', recurring: false });
      expenses.reload();
    } catch (e2) { setErr(errMsg(e2)); }
  }

  return (
    <div>
      <h2>Expenses</h2>
      {err && <div className="error">{err}</div>}
      {canManage && (
        <form className="card" onSubmit={add} style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Record expense</h3>
          <div className="row">
            <div><label>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
            <div><label>Category</label>
              <select value={form.accountCode} onChange={(e) => setForm({ ...form, accountCode: e.target.value })}>
                {expenseAccounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
              </select>
            </div>
            <div><label>Method</label><select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option>BANK</option><option>CASH</option></select></div>
          </div>
          <label>Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          <div className="row">
            <div><label>Amount</label><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
            <div><label>Tax amount</label><input value={form.taxAmount} onChange={(e) => setForm({ ...form, taxAmount: e.target.value })} /></div>
          </div>
          <button type="submit">Record</button>
        </form>
      )}
      <div className="card">
        <table>
          <thead><tr><th>Number</th><th>Date</th><th>Description</th><th>Category</th><th>Method</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {expenses.data?.map((x) => (
              <tr key={x.id}><td>{x.number}</td><td>{x.date.slice(0, 10)}</td><td>{x.description}</td><td className="muted">{x.accountCode}</td><td className="muted">{x.method}</td><td className="num">{money(x.amount)}</td></tr>
            ))}
            {!expenses.data?.length && <tr><td colSpan={6} className="muted">No expenses yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
