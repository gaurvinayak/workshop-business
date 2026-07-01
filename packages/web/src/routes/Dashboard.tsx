import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { money } from '../lib/format';
import { PERMISSIONS } from '@workshopos/shared';

interface Summary {
  cashAndBank: string;
  monthSales: string;
  monthPurchases: string;
  receivables: string;
  payables: string;
  presentToday: number;
  lowStockItems: number;
}
interface Settings { business: { currency: string } | null; }

export default function Dashboard() {
  const { can, user } = useAuth();
  const canReport = can(PERMISSIONS.REPORT_VIEW);
  const { data } = useApi<Summary>(canReport ? '/dashboard' : null);
  const settings = useApi<Settings>(canReport ? '/settings' : null);
  const cur = settings.data?.business?.currency;

  if (!canReport) {
    return (
      <div>
        <h2>Welcome</h2>
        <p className="muted">Signed in as {user?.email}. Use the menu to clock in/out and view your payslips.</p>
      </div>
    );
  }

  const Money = ({ label, value, tone }: { label: string; value?: string; tone?: 'pos' | 'neg' }) => {
    const negative = value !== undefined && Number(value) < 0;
    return (
      <div className="card">
        <div className="muted">{label}</div>
        <div className={`stat ${tone === 'neg' || negative ? 'neg' : tone === 'pos' ? 'pos' : ''}`}>
          {value === undefined ? '—' : money(value, cur)}
        </div>
      </div>
    );
  };
  const Count = ({ label, value }: { label: string; value?: number }) => (
    <div className="card"><div className="muted">{label}</div><div className="stat">{value ?? '—'}</div></div>
  );

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="grid" style={{ marginTop: 20 }}>
        <Money label="Cash & bank" value={data?.cashAndBank} />
        <Money label="Sales this month" value={data?.monthSales} />
        <Money label="Purchases this month" value={data?.monthPurchases} />
        <Money label="Receivables" value={data?.receivables} tone="pos" />
        <Money label="Payables" value={data?.payables} tone="neg" />
        <Count label="Present today" value={data?.presentToday} />
        <Count label="Low-stock items" value={data?.lowStockItems} />
      </div>
    </div>
  );
}
