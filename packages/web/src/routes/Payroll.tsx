import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { useApi, errMsg } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { PERMISSIONS } from '@workshopos/shared';

interface Run { id: string; period: string; status: string; grossTotal: string; netTotal: string; }
interface Payslip { id: string; employee: { code: string; name: string }; paidDays: string; gross: string; totalDeductions: string; net: string; }
interface RunDetail extends Run { payslips: Payslip[]; }
interface Employee { id: string; code: string; name: string; }
interface EmpPaged { data: Employee[]; }
interface Advance { id: string; employee: { code: string; name: string }; amount: string; installment: string; recovered: string; isActive: boolean; }

export default function Payroll() {
  const { can } = useAuth();
  const runs = useApi<Run[]>('/payroll/runs');
  const employees = useApi<EmpPaged>('/employees?pageSize=200');
  const advances = useApi<Advance[]>('/advances');
  const canManage = can(PERMISSIONS.PAYROLL_MANAGE);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [adv, setAdv] = useState({ employeeId: '', amount: '', installment: '', method: 'BANK' });

  async function giveAdvance(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try {
      await api.post('/advances', { ...adv, date: new Date().toISOString().slice(0, 10) });
      setAdv({ employeeId: '', amount: '', installment: '', method: 'BANK' });
      advances.reload();
    } catch (e2) { setErr(errMsg(e2)); }
  }

  async function act(fn: () => Promise<unknown>) {
    setErr(null);
    try { await fn(); runs.reload(); if (detail) open(detail.id); } catch (e) { setErr(errMsg(e)); }
  }
  async function createRun() { await act(() => api.post('/payroll/runs', { period })); }
  async function open(id: string) { try { setDetail(await api.get<RunDetail>(`/payroll/runs/${id}`)); } catch (e) { setErr(errMsg(e)); } }

  return (
    <div>
      <h2>Payroll</h2>
      {err && <div className="error">{err}</div>}

      {canManage && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 auto' }}><label>Period</label><input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
            <div style={{ flex: '0 0 auto' }}><button onClick={createRun}>Create run</button></div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 2fr' : '1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Runs</h3>
          <table>
            <thead><tr><th>Period</th><th>Status</th><th className="num">Net</th></tr></thead>
            <tbody>
              {runs.data?.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => open(r.id)}>
                  <td>{r.period}</td><td><span className={`badge ${r.status === 'PAID' ? 'success' : r.status === 'APPROVED' ? 'primary' : 'warning'}`}>{r.status}</span></td><td className="num">{money(r.netTotal)}</td>
                </tr>
              ))}
              {!runs.data?.length && <tr><td colSpan={3} className="muted">No runs yet.</td></tr>}
            </tbody>
          </table>
        </div>

        {detail && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{detail.period} — {detail.status}</h3>
            {canManage && (
              <div style={{ marginBottom: 10 }}>
                {detail.status === 'DRAFT' && <button onClick={() => act(() => api.post(`/payroll/runs/${detail.id}/approve`))}>Approve &amp; post</button>}
                {detail.status === 'APPROVED' && <button onClick={() => act(() => api.post(`/payroll/runs/${detail.id}/mark-paid`))}>Mark paid</button>}
              </div>
            )}
            <table>
              <thead><tr><th>Employee</th><th className="num">Paid days</th><th className="num">Gross</th><th className="num">Deductions</th><th className="num">Net</th></tr></thead>
              <tbody>
                {detail.payslips.map((p) => (
                  <tr key={p.id}>
                    <td>{p.employee.code} {p.employee.name}</td>
                    <td className="num">{p.paidDays}</td><td className="num">{money(p.gross)}</td><td className="num">{money(p.totalDeductions)}</td><td className="num">{money(p.net)}</td>
                  </tr>
                ))}
                {!detail.payslips.length && <tr><td colSpan={5} className="muted">No payslips — add salary structures first.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canManage && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginTop: 16 }}>
          <form className="card" onSubmit={giveAdvance}>
            <h3 style={{ marginTop: 0 }}>Give advance / loan</h3>
            <label>Employee</label>
            <select value={adv.employeeId} onChange={(e) => setAdv({ ...adv, employeeId: e.target.value })} required>
              <option value="">— select —</option>
              {employees.data?.data.map((e) => <option key={e.id} value={e.id}>{e.code} {e.name}</option>)}
            </select>
            <div className="row">
              <div><label>Amount</label><input value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: e.target.value })} required /></div>
              <div><label>Monthly installment</label><input value={adv.installment} onChange={(e) => setAdv({ ...adv, installment: e.target.value })} required /></div>
            </div>
            <button type="submit">Give advance</button>
            <p className="muted" style={{ fontSize: 12 }}>Auto-recovered from future payroll runs.</p>
          </form>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Advances</h3>
            <table>
              <thead><tr><th>Employee</th><th className="num">Amount</th><th className="num">Installment</th><th className="num">Recovered</th><th>Status</th></tr></thead>
              <tbody>
                {advances.data?.map((a) => (
                  <tr key={a.id}>
                    <td>{a.employee.code} {a.employee.name}</td><td className="num">{money(a.amount)}</td><td className="num">{money(a.installment)}</td>
                    <td className="num">{money(a.recovered)}</td><td><span className={`badge ${a.isActive ? 'info' : 'neutral'}`}>{a.isActive ? 'active' : 'cleared'}</span></td>
                  </tr>
                ))}
                {!advances.data?.length && <tr><td colSpan={5} className="muted">No advances.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
