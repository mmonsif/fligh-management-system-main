import React, { FormEvent, useState } from 'react';
import { AlertCircle, LockKeyhole, Plane, UserRound } from 'lucide-react';
import { AuthUser, UserRole } from '../types';
import { authenticateUser } from '../lib/database';
import { isSupabaseConfigured } from '../lib/supabase';

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}

const demoAccounts: { role: UserRole; label: string; username: string; password: string }[] = [
  { role: 'staff', label: 'Operations Staff', username: 'staff', password: 'staff123' },
  { role: 'manager', label: 'Manager', username: 'manager', password: 'manager123' },
  { role: 'data-insert', label: 'Data Insert Staff', username: 'data', password: 'data123' },
  { role: 'admin', label: 'Administrator', username: 'admin', password: 'admin123' },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured for this deployment. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy.');
      return;
    }

    try {
      const account = await authenticateUser(username, password);
      if (!account) {
        setError('Invalid username or password.');
        return;
      }
      onLogin(account);
    } catch (loginError) {
      console.error('Database login failed:', loginError);
      setError('Database login is not configured. Run supabase/schema.sql in the Supabase SQL Editor.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.2),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,0.12),transparent_32%)]" />
      <section className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-sky-700 px-8 py-8 text-white">
          <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mb-5">
            <Plane className="w-6 h-6 -rotate-45" />
          </div>
          <p className="text-sky-100 text-xs font-bold uppercase tracking-[0.2em]">Station Ops</p>
          <h1 className="text-2xl font-black mt-2">Flight Management System</h1>
          <p className="text-sky-100 text-sm mt-2">Sign in to access your operational workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Username</span>
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
              <UserRound className="w-4 h-4 text-slate-400" />
              <input value={username} onChange={(event) => setUsername(event.target.value)} className="w-full bg-transparent py-3 text-sm text-slate-900 outline-none" autoComplete="username" required />
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Password</span>
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
              <LockKeyhole className="w-4 h-4 text-slate-400" />
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-transparent py-3 text-sm text-slate-900 outline-none" autoComplete="current-password" required />
            </span>
          </label>

          <button type="submit" className="w-full rounded-xl bg-sky-600 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700">
            Sign in
          </button>

          <div className="border-t border-slate-100 pt-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">Demo access</p>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((account) => (
                <button key={account.role} type="button" onClick={() => { setUsername(account.username); setPassword(account.password); setError(''); }} className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-sky-300 hover:bg-sky-50">
                  <span className="block font-bold text-slate-800">{account.label}</span>
                  <span>{account.username} / {account.password}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </main>
  );
};