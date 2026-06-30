import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PERMISSIONS } from '@workshopos/shared';

interface Account { id: string; code: string; name: string; isPostable: boolean; }
interface EntryLine { account: Account; debit: string; credit: string; }
interface Entry { id: string; number: string; date: string; narration: string; lines: EntryLine[]; }
interface Paged<T> { data: T[]; total: number; }

const today = new Date().toISOString().slice(0, 10);

export default function Journal() {
  const { can } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(today);
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState([
    { accountId: '', debit: '', credit: '' },
    { accountId: '', debit: '', credit: '' },
  ]);

  const canPost = can(PERMISSIONS.JOURNAL_POST);

  function reload() {
    api.get<Paged<Entry>>('/journal-entries').then((p) => setEntries(p.data)).catch(() => setEntries([]));
  }

  useEffect(() => {
    api.get<Account[]>('/accounts').then((a) => setAccounts(a.filter((x) => x.isPostable))).catch(() => setAccounts([]));
    reload();
  }, []);

  function updateLine(i: number, key: 'accountId' | 'debit' | 'credit', value: string) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/journal-entries', {
        date,
        narration,
        lines: lines
          .filter((l) => l.accountId)
          .map((l) => ({ accountId: l.accountId, debit: l.debit || '0', credit: l.credit || '0' })),
      });
      setNarration('');
      setLines([{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }]);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not post entry');
    }
  }

  return (
    <div>
      <h2>Journal</h2>

      {canPost && (
        <form className="card" onSubmit={onSubmit} style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>New journal entry</h3>
          <div className="row">
            <div style={{ maxWidth: 180 }}>
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label>Narration</label>
              <input value={narration} onChange={(e) => setNarration(e.target.value)} required />
            </div>
          </div>

          <table style={{ marginTop: 14 }}>
            <thead>
              <tr><th>Account</th><th className="num">Debit</th><th className="num">Credit</th></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <select value={l.accountId} onChange={(e) => updateLine(i, 'accountId', e.target.value)}>
                      <option value="">— select —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="num"><input value={l.debit} onChange={(e) => updateLine(i, 'debit', e.target.value)} placeholder="0" /></td>
                  <td className="num"><input value={l.credit} onChange={(e) => updateLine(i, 'credit', e.target.value)} placeholder="0" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="secondary" onClick={() => setLines([...lines, { accountId: '', debit: '', credit: '' }])}>
            + Add line
          </button>{' '}
          <button type="submit">Post entry</button>
          {error && <div className="error">{error}</div>}
        </form>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent entries</h3>
        <table>
          <thead>
            <tr><th>Number</th><th>Date</th><th>Narration</th><th>Lines</th></tr>
          </thead>
          <tbody>
            {entries.map((en) => (
              <tr key={en.id}>
                <td>{en.number}</td>
                <td>{en.date.slice(0, 10)}</td>
                <td>{en.narration}</td>
                <td className="muted">{en.lines.length}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={4} className="muted">No entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
