import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
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

export default function Dashboard() {
  const { can, user } = useAuth();
  const canReport = can(PERMISSIONS.REPORT_VIEW);
  const { data } = useApi<Summary>(canReport ? '/dashboard' : null);

  if (!canReport) {
    return (
      <div>
        <h2>Welcome</h2>
        <p className="muted">Signed in as {user?.email}. Use the menu to clock in/out and view your payslips.</p>
      </div>
    );
  }

  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <div className="card"><div className="muted">{label}</div><div className="stat">{value}</div></div>
  );

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="grid" style={{ marginTop: 20 }}>
        <Stat label="Cash & bank" value={data?.cashAndBank ?? '—'} />
        <Stat label="Sales this month" value={data?.monthSales ?? '—'} />
        <Stat label="Purchases this month" value={data?.monthPurchases ?? '—'} />
        <Stat label="Receivables" value={data?.receivables ?? '—'} />
        <Stat label="Payables" value={data?.payables ?? '—'} />
        <Stat label="Present today" value={data?.presentToday ?? '—'} />
        <Stat label="Low-stock items" value={data?.lowStockItems ?? '—'} />
      </div>
    </div>
  );
}
