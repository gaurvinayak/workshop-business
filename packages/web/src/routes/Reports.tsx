import { useState } from 'react';
import { useApi } from '../lib/useApi';

interface TBRow { code: string; name: string; debit: string; credit: string; }
interface TrialBalance { rows: TBRow[]; totalDebit: string; totalCredit: string; balanced: boolean; }
interface PLLine { code: string; name: string; amount: string; }
interface PL { income: PLLine[]; expense: PLLine[]; totalIncome: string; totalExpense: string; netProfit: string; }
interface AgingTotals { current: string; d30: string; d60: string; d90plus: string; total: string; }
interface Aging { totals: AgingTotals; rows: { party: string; ref: string; ageDays: number; outstanding: string }[]; }

type Tab = 'tb' | 'pl' | 'recv' | 'pay';

export default function Reports() {
  const [tab, setTab] = useState<Tab>('tb');
  const tb = useApi<TrialBalance>(tab === 'tb' ? '/reports/trial-balance' : null);
  const pl = useApi<PL>(tab === 'pl' ? '/reports/profit-loss' : null);
  const recv = useApi<Aging>(tab === 'recv' ? '/reports/receivables-aging' : null);
  const pay = useApi<Aging>(tab === 'pay' ? '/reports/payables-aging' : null);

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button className={tab === id ? '' : 'secondary'} style={{ marginRight: 8 }} onClick={() => setTab(id)}>{label}</button>
  );

  return (
    <div>
      <h2>Reports</h2>
      <div style={{ marginBottom: 16 }}>
        <TabBtn id="tb" label="Trial balance" />
        <TabBtn id="pl" label="Profit &amp; Loss" />
        <TabBtn id="recv" label="Receivables aging" />
        <TabBtn id="pay" label="Payables aging" />
      </div>

      {tab === 'tb' && tb.data && (
        <div className="card">
          <table>
            <thead><tr><th>Code</th><th>Account</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
            <tbody>
              {tb.data.rows.map((r) => <tr key={r.code}><td>{r.code}</td><td>{r.name}</td><td className="num">{r.debit}</td><td className="num">{r.credit}</td></tr>)}
              <tr style={{ fontWeight: 700 }}><td></td><td>Total</td><td className="num">{tb.data.totalDebit}</td><td className="num">{tb.data.totalCredit}</td></tr>
            </tbody>
          </table>
          <p className={tb.data.balanced ? 'muted' : 'error'}>{tb.data.balanced ? '✓ Balanced' : '✗ NOT balanced'}</p>
        </div>
      )}

      {tab === 'pl' && pl.data && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Income</h3>
          <table><tbody>{pl.data.income.map((r) => <tr key={r.code}><td>{r.name}</td><td className="num">{r.amount}</td></tr>)}<tr style={{ fontWeight: 700 }}><td>Total income</td><td className="num">{pl.data.totalIncome}</td></tr></tbody></table>
          <h3>Expenses</h3>
          <table><tbody>{pl.data.expense.map((r) => <tr key={r.code}><td>{r.name}</td><td className="num">{r.amount}</td></tr>)}<tr style={{ fontWeight: 700 }}><td>Total expense</td><td className="num">{pl.data.totalExpense}</td></tr></tbody></table>
          <p className="stat">Net profit: {pl.data.netProfit}</p>
        </div>
      )}

      {(tab === 'recv' || tab === 'pay') && (() => {
        const d = (tab === 'recv' ? recv : pay).data;
        if (!d) return null;
        return (
          <div className="card">
            <div className="grid" style={{ marginBottom: 16 }}>
              <div><div className="muted">Current</div><div className="stat">{d.totals.current}</div></div>
              <div><div className="muted">31–60</div><div className="stat">{d.totals.d30}</div></div>
              <div><div className="muted">61–90</div><div className="stat">{d.totals.d60}</div></div>
              <div><div className="muted">90+</div><div className="stat">{d.totals.d90plus}</div></div>
            </div>
            <table>
              <thead><tr><th>Party</th><th>Ref</th><th className="num">Age (days)</th><th className="num">Outstanding</th></tr></thead>
              <tbody>
                {d.rows.map((r, i) => <tr key={i}><td>{r.party}</td><td>{r.ref}</td><td className="num">{r.ageDays}</td><td className="num">{r.outstanding}</td></tr>)}
                {!d.rows.length && <tr><td colSpan={4} className="muted">Nothing outstanding.</td></tr>}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}
