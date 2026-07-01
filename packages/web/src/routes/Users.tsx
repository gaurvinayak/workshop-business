import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { useApi, errMsg } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { PERMISSIONS } from '@workshopos/shared';

interface User { id: string; email: string; name: string; isActive: boolean; roles: string[]; }
interface Paged<T> { data: T[]; total: number; }
interface Role { code: string; name: string; description: string | null; permissions: string[]; }

const ROLE_CODES = ['owner', 'accounts', 'store', 'supervisor', 'employee'] as const;

function emptyRoleMap(initial: string[] = []): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const code of ROLE_CODES) map[code] = initial.includes(code);
  return map;
}

export default function Users() {
  const { user: me, can } = useAuth();
  const { data, reload } = useApi<Paged<User>>('/users?pageSize=200');
  const roles = useApi<Role[]>('/roles');
  const canManage = can(PERMISSIONS.USER_MANAGE);

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [formRoles, setFormRoles] = useState<Record<string, boolean>>(emptyRoleMap());
  const [error, setError] = useState<string | null>(null);

  const [editingRolesFor, setEditingRolesFor] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const selected = ROLE_CODES.filter((c) => formRoles[c]);
      await api.post('/users', { ...form, roles: selected });
      setForm({ name: '', email: '', password: '' });
      setFormRoles(emptyRoleMap());
      reload();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function toggleActive(u: User) {
    setRowError(null);
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      reload();
    } catch (err) {
      setRowError(errMsg(err));
    }
  }

  async function resetPassword(u: User) {
    const password = window.prompt(`New password for ${u.email} (min 8 characters):`);
    if (!password) return;
    setRowError(null);
    try {
      await api.post(`/users/${u.id}/reset-password`, { password });
    } catch (err) {
      setRowError(errMsg(err));
    }
  }

  function startEditRoles(u: User) {
    setRowError(null);
    setEditingRolesFor(u.id);
    setEditRoles(emptyRoleMap(u.roles));
  }

  async function saveRoles(u: User) {
    setRowError(null);
    try {
      const selected = ROLE_CODES.filter((c) => editRoles[c]);
      await api.patch(`/users/${u.id}/roles`, { roles: selected });
      setEditingRolesFor(null);
      reload();
    } catch (err) {
      setRowError(errMsg(err));
    }
  }

  return (
    <div>
      <h2>Users &amp; Roles</h2>

      {canManage && (
        <form className="card" onSubmit={add} style={{ marginBottom: 20 }}>
          <div className="row">
            <div><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><label>Password</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Roles</label>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {ROLE_CODES.map((code) => (
                <label key={code} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={!!formRoles[code]}
                    onChange={(e) => setFormRoles({ ...formRoles, [code]: e.target.checked })}
                  />
                  {code}
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <button type="submit">Add user</button>
          </div>
          {error && <div className="error">{error}</div>}
        </form>
      )}

      {rowError && <div className="error" style={{ marginBottom: 12 }}>{rowError}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Status</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data?.data.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  {editingRolesFor === u.id ? (
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      {ROLE_CODES.map((code) => (
                        <label key={code} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={!!editRoles[code]}
                            onChange={(e) => setEditRoles({ ...editRoles, [code]: e.target.checked })}
                          />
                          {code}
                        </label>
                      ))}
                    </div>
                  ) : (
                    u.roles.map((r) => <span key={r} className="badge primary" style={{ marginRight: 4 }}>{r}</span>)
                  )}
                </td>
                <td><span className={`badge ${u.isActive ? 'success' : 'neutral'}`}>{u.isActive ? 'active' : 'inactive'}</span></td>
                {canManage && (
                  <td>
                    {editingRolesFor === u.id ? (
                      <>
                        <button type="button" onClick={() => saveRoles(u)} style={{ marginRight: 6 }}>Save roles</button>
                        <button type="button" className="secondary" onClick={() => setEditingRolesFor(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEditRoles(u)} style={{ marginRight: 6 }}>Edit roles</button>
                        <button type="button" onClick={() => resetPassword(u)} style={{ marginRight: 6 }}>Reset password</button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={u.id === me?.id && u.isActive}
                          onClick={() => toggleActive(u)}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!data?.data.length && (
              <tr><td colSpan={canManage ? 5 : 4} className="muted">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>What each role can do</h3>
        {roles.data?.map((r) => (
          <div key={r.code} style={{ marginBottom: 12 }}>
            <div>
              <span className="badge primary" style={{ marginRight: 8 }}>{r.code}</span>
              <strong>{r.name}</strong>
              <span className="muted"> — {r.permissions.length} permission{r.permissions.length === 1 ? '' : 's'}</span>
            </div>
            {r.description && <div className="muted" style={{ fontSize: 12 }}>{r.description}</div>}
            <div className="muted" style={{ fontSize: 12 }}>{r.permissions.join(', ')}</div>
          </div>
        ))}
        {!roles.data?.length && <div className="muted">No roles found.</div>}
      </div>
    </div>
  );
}
