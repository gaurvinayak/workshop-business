import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { api } from './lib/api';
import { useAuth } from './lib/auth';
import Login from './routes/Login';
import Setup from './routes/Setup';
import Dashboard from './routes/Dashboard';
import Accounts from './routes/Accounts';
import Journal from './routes/Journal';

function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>WorkshopOS</h1>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/accounts">Chart of Accounts</NavLink>
          <NavLink to="/journal">Journal</NavLink>
        </nav>
        <div style={{ marginTop: 24 }}>
          <div className="muted" style={{ fontSize: 12, padding: '0 12px' }}>{user?.email}</div>
          <button className="secondary" style={{ margin: '8px 12px' }} onClick={() => logout().then(() => navigate('/login'))}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/journal" element={<Journal />} />
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
