import { FormEvent, useState } from 'react';
import { api, ApiError } from '../lib/api';

/** First-run wizard. Shown only when GET /setup/status reports isSetup=false. */
export default function Setup({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    businessName: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    fyName: 'FY 2026-27',
    fyStart: '2026-04-01',
    fyEnd: '2027-03-31',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/setup', {
        business: { name: form.businessName, currency: form.currency, timezone: form.timezone },
        fiscalYear: { name: form.fyName, startDate: form.fyStart, endDate: form.fyEnd },
        owner: { name: form.ownerName, email: form.ownerEmail, password: form.ownerPassword },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card" style={{ maxWidth: 560, width: '100%' }} onSubmit={onSubmit}>
        <h2 style={{ marginTop: 0 }}>Welcome — let's set up WorkshopOS</h2>
        <p className="muted">This runs once to create your business and owner account.</p>

        <h3>Business</h3>
        <label>Business name</label>
        <input value={form.businessName} onChange={set('businessName')} required />
        <div className="row">
          <div>
            <label>Currency (ISO)</label>
            <input value={form.currency} onChange={set('currency')} maxLength={3} required />
          </div>
          <div>
            <label>Timezone (IANA)</label>
            <input value={form.timezone} onChange={set('timezone')} required />
          </div>
        </div>

        <h3>First fiscal year</h3>
        <label>Name</label>
        <input value={form.fyName} onChange={set('fyName')} required />
        <div className="row">
          <div>
            <label>Start</label>
            <input type="date" value={form.fyStart} onChange={set('fyStart')} required />
          </div>
          <div>
            <label>End</label>
            <input type="date" value={form.fyEnd} onChange={set('fyEnd')} required />
          </div>
        </div>

        <h3>Owner account</h3>
        <label>Your name</label>
        <input value={form.ownerName} onChange={set('ownerName')} required />
        <label>Email</label>
        <input type="email" value={form.ownerEmail} onChange={set('ownerEmail')} required />
        <label>Password (min 10 chars)</label>
        <input type="password" value={form.ownerPassword} onChange={set('ownerPassword')} required minLength={10} />

        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Setting up…' : 'Create business'}
        </button>
      </form>
    </div>
  );
}
