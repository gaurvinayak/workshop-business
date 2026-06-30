import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  isPostable: boolean;
}

interface LedgerRow {
  number: string;
  date: string;
  narration: string;
  debit: string;
  credit: string;
  balance: string;
}

interface Ledger {
  account: { code: string; name: string };
  balance: string;
  lines: LedgerRow[];
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ledger, setLedger] = useState<Ledger | null>(null);

  useEffect(() => {
    api.get<Account[]>('/accounts').then(setAccounts).catch(() => setAccounts([]));
  }, []);

  function openLedger(id: string) {
    api.get<Ledger>(`/accounts/${id}/ledger`).then(setLedger).catch(() => setLedger(null));
  }

  return (
    <div>
      <h2>Chart of Accounts</h2>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: 1 }}>
          <table>
            <thead>
              <tr><th>Code</th><th>Name</th><th>Type</th><th></th></tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.code}</td>
                  <td>{a.name}</td>
                  <td className="muted">{a.type}</td>
                  <td>{a.isPostable && <a onClick={() => openLedger(a.id)} style={{ cursor: 'pointer' }}>Ledger</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ledger && (
          <div className="card" style={{ flex: 1 }}>
            <h3 style={{ marginTop: 0 }}>
              {ledger.account.code} — {ledger.account.name}
            </h3>
            <div className="muted">Balance: <strong>{ledger.balance}</strong></div>
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr><th>Entry</th><th>Date</th><th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th></tr>
              </thead>
              <tbody>
                {ledger.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.number}</td>
                    <td>{l.date.slice(0, 10)}</td>
                    <td className="num">{l.debit}</td>
                    <td className="num">{l.credit}</td>
                    <td className="num">{l.balance}</td>
                  </tr>
                ))}
                {ledger.lines.length === 0 && (
                  <tr><td colSpan={5} className="muted">No transactions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
