import React, { useState, useEffect } from 'react';
import { ActiveTab, AuthUser } from '../types';
import { Plane, BarChart3, Building2, Layers, Clock, LogOut } from 'lucide-react';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  flightCount: number;
  user: AuthUser;
  allowedTabs: ActiveTab[];
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  flightCount,
  user,
  allowedTabs,
  onLogout,
}) => {
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hours}:${minutes}:${seconds} UTC`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    {
      id: 'manage-flights',
      label: 'Flight Operations',
      icon: <Plane className="w-4 h-4" />,
      badge: flightCount,
    },
    {
      id: 'bulk-flights',
      label: 'Bulk Schedule Generator',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 'statistics',
      label: 'Statistics & Reports',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'airlines',
      label: 'Airlines',
      icon: <Plane className="w-4 h-4 rotate-45" />,
    },
    {
      id: 'agencies',
      label: 'Agencies',
      icon: <Building2 className="w-4 h-4" />,
    },
  ];

  return (
    <header className="bg-white/95 backdrop-blur-xl text-slate-900 border-b border-slate-200 shadow-xs sticky top-0 z-30 transition-colors">
      {/* Top utility row - Full width */}
      <div className="w-full px-3 sm:px-5 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 text-xs">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-md border border-sky-500/40">
            <Plane className="w-4 h-4 -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-tight text-slate-900 uppercase">Flight Management System</span>
              <span className="px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-800 font-mono text-[10px] font-bold border border-sky-300">
                STATION OPS
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              Turnaround Operations &bull; Ground Handling &bull; Schedule &amp; Delays
            </p>
          </div>
        </div>

        {/* Operational live clock */}
          <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 font-mono text-xs text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            <span className="text-slate-500 font-sans font-semibold">CLOCK:</span>
            <span className="font-bold text-sky-700">{utcTime || '12:00:00 UTC'}</span>
          </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs font-semibold text-slate-600">{user.username} · {user.role === 'data-insert' ? 'Data Insert Staff' : user.role}</span>
              <button type="button" onClick={onLogout} title="Sign out" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
        </div>
      </div>

      {/* Navigation tabs - Full width */}
      <div className="w-full px-3 sm:px-5 lg:px-6">
        <nav className="flex space-x-1.5 overflow-x-auto no-scrollbar py-1.5">
          {navItems.filter((item) => allowedTabs.includes(item.id)).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 border border-sky-300 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono border ${
                      isActive
                        ? 'bg-sky-200/80 text-sky-800 border-sky-300'
                        : 'bg-slate-200/80 text-slate-700 border-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
