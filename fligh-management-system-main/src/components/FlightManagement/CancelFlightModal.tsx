import React, { useState } from 'react';
import { Flight } from '../../types';
import { AlertTriangle, X } from 'lucide-react';

interface CancelFlightModalProps {
  isOpen: boolean;
  flight: Flight | null;
  onClose: () => void;
  onConfirm: (flightId: number, reason: string) => void;
}

export const CancelFlightModal: React.FC<CancelFlightModalProps> = ({
  isOpen,
  flight,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');

  if (!isOpen || !flight) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(flight.flightId, reason.trim());
    setReason('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md p-4">
      <div className="glass-card rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-white/15 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 backdrop-blur-2xl">
        <div className="px-6 py-4 border-b border-rose-500/20 flex items-center justify-between bg-rose-50 dark:bg-rose-500/10">
          <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-300 font-bold text-base">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            Cancel Flight
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="glass-card-sub p-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              Flight: {flight.inboundFlightNumber} / {flight.outboundFlightNumber}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Route: {flight.origin} → {flight.destination} ({flight.airlineName})
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Cancellation Reason (Optional):
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Technical defect AOG, severe weather restriction, ATC operational shutdown..."
              rows={3}
              className="glass-input w-full text-sm p-3 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              autoFocus
            />
          </div>

          <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 p-3 rounded-xl border border-amber-300 dark:border-amber-500/30">
            ⚠️ Warning: Once canceled, direct editing of schedule and actual times for this flight will be disabled.
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Confirm Cancellation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
