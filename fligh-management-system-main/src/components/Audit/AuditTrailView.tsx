import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, History, RefreshCw, Search } from 'lucide-react';
import { AuditEvent } from '../../types';
import { listAuditEvents } from '../../lib/database';

interface AuditTrailViewProps {
  sessionId: string;
}

const formatWhen = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
};

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ sessionId }) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      setEvents(await listAuditEvents(sessionId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the audit trail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, [sessionId]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) =>
      [event.actorUsername, event.action, event.entityType, event.entityId || '', event.summary]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [events, searchTerm]);

  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-200 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-sky-600" />
            Audit trail
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Sign-ins, user changes, and operational edits are recorded here.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search actor, action, flight…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="glass-input w-full pl-8 pr-3 py-1.5 text-xs rounded-xl"
            />
          </div>
          <button type="button" onClick={() => void loadEvents()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3 whitespace-nowrap">When (UTC)</th>
              <th className="p-3">User</th>
              <th className="p-3">Action</th>
              <th className="p-3">Record</th>
              <th className="p-3">Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td className="p-4 text-slate-500" colSpan={5}>Loading audit events…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="p-4 text-slate-500" colSpan={5}>No matching audit events.</td>
              </tr>
            ) : (
              filtered.map((event) => (
                <tr key={event.auditId} className="text-slate-700">
                  <td className="p-3 font-mono whitespace-nowrap text-slate-500">{formatWhen(event.occurredAt)}</td>
                  <td className="p-3 font-semibold text-slate-900">{event.actorUsername}</td>
                  <td className="p-3 font-mono text-sky-700">{event.action}</td>
                  <td className="p-3">
                    {event.entityType}
                    {event.entityId ? ` #${event.entityId}` : ''}
                  </td>
                  <td className="p-3">{event.summary}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
