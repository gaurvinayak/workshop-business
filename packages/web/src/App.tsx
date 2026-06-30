import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { PERMISSIONS, PermissionCode } from '@workshopos/shared';
import { api } from './lib/api';
import { useAuth } from './lib/auth';
import Login from './routes/Login';
import Setup from './routes/Setup';
import Dashboard from './routes/Dashboard';
import Accounts from './routes/Accounts';
import Journal from './routes/Journal';
import Employees from './routes/Employees';
import Attendance from './routes/Attendance';
import Inventory from './routes/Inventory';
import Purchasing from './routes/Purchasing';
import Sales from './routes/Sales';
import Payroll from './routes/Payroll';
import Reports from './routes/Reports';

interface NavItem { to: string; label: string; perm?: PermissionCode; element: JSX.Element; }

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', element: <Dashboard /> },
  { to: '/employees', label: 'Employees', perm: PERMISSIONS.EMPLOYEE_VIEW, element: <Employees /> },
  { to: '/attendance', label: 'Attendance', perm: PERMISSIONS.ATTENDANCE_SELF, element: <Attendance /> },
  { to: '/inventory', label: 'Inventory', perm: PERMISSIONS.ITEM_VIEW, element: <Inventory /> },
  { to: '/purchasing', label: 'Purchasing', perm: PERMISSIONS.PURCHASE_VIEW, element: <Purchasing /> },
  { to: '/sales', label: 'Sales', perm: PERMISSIONS.SALES_VIEW, element: <Sales /> },
  { to: '/payroll', label: 'Payroll', perm: PERMISSIONS.PAYROLL_VIEW, element: <Payroll /> },
  { to: '/accounts', label: 'Chart of Accounts', perm: PERMISSIONS.ACCOUNT_VIEW, element: <Accounts /> },
  { to: '/journal', label: 'Journal', perm: PERMISSIONS.JOURNAL_VIEW, element: <Journal /> },
  { to: '/reports', label: 'Reports', perm: PERMISSIONS.REPORT_VIEW, element: <Reports /> },
];

function Shell() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const visible = NAV.filter((n) => !n.perm || can(n.perm));

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>WorkshopOS</h1>
        <nav>
          {visible.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>{n.label}</NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 24 }}>
          <div className="muted" style={{ fontSize: 12, padding: '0 12px' }}>{user?.email}</div>
          <button className="secondary" style={{ margin: '8px 12px' }} onClick={() => logout().then(() => navigate('/login'))}>Sign out</button>
        </div>
      </aside>
      <main className="content">
        <Routes>
          {visible.map((n) => <Route key={n.to} path={n.to} element={n.element} />)}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const [isSetup, setIsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    api.get<{ isSetup: boolean }>('/setup/status').then((s) => setIsSetup(s.isSetup)).catch(() => setIsSetup(true));
  }, []);

  if (loading || isSetup === null) return <div className="center muted">Loading…</div>;

  if (!isSetup) {
    return (
      <Routes>
        <Route path="/setup" element={<Setup onDone={() => setIsSetup(true)} />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <Shell />;
}
