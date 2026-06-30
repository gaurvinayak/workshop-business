import { useState } from 'react';
import { api } from '../lib/api';
import { useApi, errMsg } from '../lib/useApi';

interface SheetEmployee { id: string; code: string; name: string; days: Record<string, string>; }
interface Sheet { month: string; employees: SheetEmployee[]; }

const STATUS_SHORT: Record<string, string> = {
  PRESENT: 'P', ABSENT: 'A', HALF_DAY: '½', LEAVE: 'L', HOLIDAY: 'H', WEEKLY_OFF: 'O',
};

export default function Attendance() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data, reload } = useApi<Sheet>(`/attendance/sheet?month=${month}`);
  const [msg, setMsg] = useState<string | null>(null);

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  async function clock() {
    setMsg(null);
    try {
      await api.post('/attendance/clock', {});
      setMsg('Clocked successfully');
      reload();
    } catch (e) {
      setMsg(errMsg(e));
    }
  }

  return (
    <div>
      <h2>Attendance</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div style={{ flex: '0 0 auto' }}>
            <label>Month</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div style={{ flex: '0 0 auto', marginTop: 18 }}>
            <button onClick={clock}>Clock in / out (me)</button>
          </div>
          {msg && <div className="muted" style={{ marginTop: 24 }}>{msg}</div>}
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Monthly muster — {data?.month}</h3>
        <table style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Employee</th>
              {days.map((d) => <th key={d} className="num" style={{ padding: '6px 4px' }}>{Number(d)}</th>)}
            </tr>
          </thead>
          <tbody>
            {data?.employees.map((e) => (
              <tr key={e.id}>
                <td>{e.code} {e.name}</td>
                {days.map((d) => <td key={d} className="num" style={{ padding: '6px 4px' }}>{STATUS_SHORT[e.days[d]] ?? ''}</td>)}
              </tr>
            ))}
            {!data?.employees.length && <tr><td colSpan={32} className="muted">No active employees.</td></tr>}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 12 }}>P present · ½ half-day · A absent · L leave · H holiday · O weekly-off</p>
      </div>
    </div>
  );
}
