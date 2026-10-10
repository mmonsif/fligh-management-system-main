import React, { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, Plus, Search, Shield, UserRound } from 'lucide-react';
import { AppUserAccount, UserRole } from '../../types';
import { createAppUser, listAppUsers, updateAppUser } from '../../lib/database';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'staff', label: 'Operations Staff' },
  { value: 'manager', label: 'Manager' },
  { value: 'data-insert', label: 'Data Insert Staff' },
  { value: 'load-control', label: 'Load Control' },
  { value: 'ramp', label: 'Ramp' },
  { value: 'admin', label: 'Administrator' },
];

const roleLabel = (role: UserRole) => ROLE_OPTIONS.find((option) => option.value === role)?.label || role;

interface ManageUsersViewProps {
  sessionId: string;
}

export const ManageUsersView: React.FC<ManageUsersViewProps> = ({ sessionId }) => {
  const [users, setUsers] = useState<AppUserAccount[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [isActive, setIsActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadUsers = async () => {
    const nextUsers = await listAppUsers(sessionId);
    setUsers(nextUsers);
  };

  useEffect(() => {
    let isMounted = true;
    listAppUsers(sessionId)
      .then((nextUsers) => {
        if (isMounted) setUsers(nextUsers);
      })
      .catch((loadError) => {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Could not load users.');
      });
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const handleClear = () => {
    setSelectedUserId(null);
    setUsername('');
    setPassword('');
    setRole('staff');
    setIsActive(true);
    setError('');
  };

  const handleSelectUser = (account: AppUserAccount) => {
    setSelectedUserId(account.userId);
    setUsername(account.username);
    setPassword('');
    setRole(account.role);
    setIsActive(account.isActive);
    setError('');
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      await createAppUser(sessionId, username, password, role);
      await loadUsers();
      handleClear();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not create the user.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedUserId) return;
    setError('');
    if (password && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      await updateAppUser(sessionId, selectedUserId, role, password, isActive);
      await loadUsers();
      handleClear();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update the user.');
    } finally {
      setBusy(false);
    }
  };

  const filteredUsers = users.filter((account) => {
    const query = searchTerm.toLowerCase();
    return account.username.toLowerCase().includes(query) || account.role.toLowerCase().includes(query);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-4 glass-card p-5 rounded-2xl border border-slate-200 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-sky-600" />
            {selectedUserId ? 'Edit user' : 'Create user'}
          </div>
          {selectedUserId && (
            <button type="button" onClick={handleClear} className="text-xs text-slate-500 hover:text-slate-800">
              Deselect
            </button>
          )}
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={selectedUserId ? (event) => { event.preventDefault(); void handleUpdate(); } : handleCreate} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Username *</label>
            <input
              type="text"
              required
              minLength={3}
              disabled={Boolean(selectedUserId)}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="glass-input w-full px-3 py-1.5 rounded-xl text-slate-900 disabled:bg-slate-100"
              placeholder="e.g. ops.cairo"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{selectedUserId ? 'New password' : 'Password *'}</label>
            <input
              type="password"
              required={!selectedUserId}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="glass-input w-full px-3 py-1.5 rounded-xl text-slate-900"
              placeholder={selectedUserId ? 'Leave blank to keep current password' : 'At least 8 characters'}
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Role *</label>
            <select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="glass-input w-full px-3 py-1.5 rounded-xl text-slate-900">
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          {selectedUserId && (
            <label className="flex items-center gap-2 font-semibold text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              Active account
            </label>
          )}
          <button type="submit" disabled={busy} className="glass-btn-primary w-full py-2 rounded-xl text-white font-semibold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-60">
            {selectedUserId ? 'Save changes' : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Create user
              </>
            )}
          </button>
        </form>
      </div>

      <div className="lg:col-span-8 glass-card p-5 rounded-2xl border border-slate-200 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Users ({users.length})</h3>
            <span className="text-[11px] text-slate-500">Create accounts here. Disable unused demo accounts instead of sharing them.</span>
          </div>
          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search user..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="glass-input w-full pl-8 pr-3 py-1.5 text-xs rounded-xl"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Username</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((account) => {
                const isSelected = selectedUserId === account.userId;
                return (
                  <tr
                    key={account.userId}
                    onClick={() => handleSelectUser(account)}
                    className={`cursor-pointer ${isSelected ? 'bg-sky-100/80 text-sky-900 font-semibold' : 'hover:bg-slate-100/60 text-slate-700'}`}
                  >
                    <td className="p-3 font-semibold text-slate-900 flex items-center gap-2">
                      <UserRound className="w-3.5 h-3.5 text-slate-400" />
                      {account.username}
                    </td>
                    <td className="p-3">{roleLabel(account.role)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${account.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {account.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-500">{new Date(account.createdAt).toISOString().slice(0, 10)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
