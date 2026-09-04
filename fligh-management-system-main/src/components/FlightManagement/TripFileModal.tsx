import React from 'react';
import { Flight } from '../../types';
import {
  formatUtcDateTime,
  formatMinutesToHHMM,
  getStatusBadgeStyle,
  formatFlightRoute,
  isTriangleFlight,
} from '../../utils/flightUtils';
import { getDelayCodeInfo } from '../../data/iataDelayCodes';
import { Plane, Printer, Download, X, Clock, Users, Luggage, AlertCircle, FileText } from 'lucide-react';

interface TripFileModalProps {
  isOpen: boolean;
  flight: Flight | null;
  onClose: () => void;
}

export const TripFileModal: React.FC<TripFileModalProps> = ({ isOpen, flight, onClose }) => {
  if (!isOpen || !flight) return null;

  const statusStyle = getStatusBadgeStyle(flight.flightStatus);

  // Calculate Turnaround Time if ATA and ATD are present
  let turnaroundMinutes: number | null = null;
  if (flight.ataUtc && flight.atdUtc) {
    const arr = new Date(flight.ataUtc).getTime();
    const dep = new Date(flight.atdUtc).getTime();
    if (!isNaN(arr) && !isNaN(dep) && dep > arr) {
      turnaroundMinutes = Math.round((dep - arr) / (1000 * 60));
    }
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSummary = () => {
    const summary = `========================================================================
             OPERATIONAL FLIGHT DISPATCH TRIP FILE
========================================================================
Generated: ${new Date().toUTCString()}
Flight ID: ${flight.flightId}
Inbound:   ${flight.inboundFlightNumber}
Outbound:  ${flight.outboundFlightNumber}
Airline:   ${flight.airlineName}
Agency:    ${flight.agencyName}
Route:     ${formatFlightRoute(flight)}${isTriangleFlight(flight) ? ' [Triangle Flight Rotation]' : ''}${flight.via ? ` (Via: ${flight.via})` : ''}
Aircraft:  ${flight.aircraftType} | Tail Registration: ${flight.registration || 'N/A'}
Status:    ${flight.flightStatus}

TIMINGS (UTC):
  STA: ${formatUtcDateTime(flight.staUtc)}
  STD: ${formatUtcDateTime(flight.stdUtc)}
  ATA: ${flight.ataUtc ? formatUtcDateTime(flight.ataUtc) : 'N/A'}
  ATD: ${flight.atdUtc ? formatUtcDateTime(flight.atdUtc) : 'N/A'}
  Turnaround Time: ${turnaroundMinutes ? `${turnaroundMinutes} min` : 'N/A'}

LOAD MANIFEST:
  Adults:   ${flight.adultPax ?? 0}
  Children: ${flight.childPax ?? 0}
  Infants:  ${flight.infantPax ?? 0}
  TOTAL:    ${flight.totalPax ?? 0} Passengers
  Bags:     ${flight.numberOfBags ?? 0} pieces

DELAYS REPORT:
  Total Delay: ${flight.delayMinutesTotal || 0} minutes
  ${
    flight.delays.length > 0
      ? flight.delays
          .map(
            (d) =>
              `- Code ${d.code}: ${d.minutes} min (${formatMinutesToHHMM(d.minutes)} HHMM) [${
                getDelayCodeInfo(d.code)?.category || 'General'
              }: ${getDelayCodeInfo(d.code)?.description || 'Unspecified'}]`
          )
          .join('\n  ')
      : 'No delays recorded.'
  }

REMARKS:
  ${flight.remarks || 'No dispatcher remarks recorded.'}
${flight.cancellationReason ? `\nCANCELLATION REASON:\n  ${flight.cancellationReason}` : ''}
========================================================================`;

    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TripFile_${flight.inboundFlightNumber}_${flight.outboundFlightNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-slate-950/75 backdrop-blur-md p-4 overflow-y-auto">
      <div className="glass-card rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-white/15 w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[90vh] backdrop-blur-2xl">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-100/80 dark:bg-white/5 backdrop-blur-md print:hidden">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
            <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            Flight Trip File Dossier: {flight.inboundFlightNumber}/{flight.outboundFlightNumber}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="glass-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Dossier
            </button>
            <button
              onClick={handleDownloadSummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export TXT
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-white/10 ml-2 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Trip File Document */}
        <div id="printable-trip-file" className="p-8 overflow-y-auto space-y-6 text-slate-800 dark:text-slate-200 font-sans">
          {/* Header */}
          <div className="border-b-2 border-slate-200 dark:border-white/20 pb-5">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono tracking-widest uppercase text-sky-600 dark:text-sky-400 font-bold">
                  FLIGHT OPERATIONS DISPATCH &bull; STATION GROUND HANDLING REPORT
                </span>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1 flex items-center gap-3">
                  <Plane className="w-6 h-6 text-sky-600 dark:text-sky-400 rotate-45 inline" />
                  {flight.airlineName.toUpperCase()}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Handled by: <span className="text-slate-800 dark:text-slate-200 font-semibold">{flight.agencyName}</span>
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">DOSSIER #{flight.flightId}</div>
                <div className="mt-1">
                  <span className={`px-2.5 py-1 text-xs rounded-xl border ${statusStyle.bgClass} ${statusStyle.textClass} ${statusStyle.borderClass}`}>
                    {statusStyle.label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-2">
                  STA/STD Date: {formatUtcDateTime(flight.staUtc).split(' ')[0]}
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Route & Aircraft Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl glass-card-sub border border-slate-200 dark:border-white/10 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium block">Inbound / Outbound</span>
              <span className="font-bold text-base text-slate-900 dark:text-slate-100 font-mono">
                {flight.inboundFlightNumber} / {flight.outboundFlightNumber}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium block">Route Sector</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-base text-slate-900 dark:text-slate-100 font-mono">
                  {flight.origin} &rarr; {flight.destination} {flight.via ? `\u2192 ${flight.via}` : ''} {flight.finalDestination ? `\u2192 ${flight.finalDestination}` : ''}
                </span>
                {isTriangleFlight(flight) && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                    🔺 Triangle Route
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium block">Aircraft Type</span>
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {flight.aircraftType}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium block">Registration / Tail</span>
              <span className="font-bold text-sm font-mono text-sky-600 dark:text-sky-400">
                {flight.registration || 'UNASSIGNED'}
              </span>
            </div>
          </div>

          {/* Section 2: Timings Manifest */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Operational Timings (UTC 24H)
            </h3>
            <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden glass-card-sub">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="p-2.5">Schedule In (STA)</th>
                    <th className="p-2.5">Schedule Out (STD)</th>
                    <th className="p-2.5">Actual In (ATA)</th>
                    <th className="p-2.5">Actual Out (ATD)</th>
                    <th className="p-2.5">Ground Turnaround</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  <tr>
                    <td className="p-2.5 font-mono text-slate-800 dark:text-slate-200">{formatUtcDateTime(flight.staUtc)}</td>
                    <td className="p-2.5 font-mono text-slate-800 dark:text-slate-200">{formatUtcDateTime(flight.stdUtc)}</td>
                    <td className="p-2.5 font-mono font-bold text-sky-700 dark:text-sky-400">
                      {flight.ataUtc ? formatUtcDateTime(flight.ataUtc) : 'Not Arrived'}
                    </td>
                    <td className="p-2.5 font-mono font-bold text-sky-700 dark:text-sky-400">
                      {flight.atdUtc ? formatUtcDateTime(flight.atdUtc) : 'Not Departed'}
                    </td>
                    <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">
                      {turnaroundMinutes !== null ? `${turnaroundMinutes} min` : 'Pending'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Passenger & Baggage Load */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 dark:border-white/10 p-4 rounded-xl glass-card-sub">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Passenger Manifest Breakdown
              </h3>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Adults</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{flight.adultPax ?? 0}</span>
                </div>
                <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Children</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{flight.childPax ?? 0}</span>
                </div>
                <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Infants</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{flight.infantPax ?? 0}</span>
                </div>
                <div className="p-2 bg-sky-100 dark:bg-sky-500/20 rounded-xl border border-sky-300 dark:border-sky-500/30 text-sky-800 dark:text-sky-300">
                  <span className="text-sky-800 dark:text-sky-300 block text-[10px] font-bold">TOTAL PAX</span>
                  <span className="font-black text-sm">{flight.totalPax ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-white/10 p-4 rounded-xl glass-card-sub">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Luggage className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Baggage Accounting
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Total Checked Bags</span>
                  <span className="font-bold text-lg text-slate-800 dark:text-slate-100">{flight.numberOfBags ?? 0} pcs</span>
                </div>
                <div className="p-2.5 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Avg Bags per Pax</span>
                  <span className="font-bold text-lg text-slate-800 dark:text-slate-100">
                    {flight.totalPax && flight.totalPax > 0 && flight.numberOfBags
                      ? (flight.numberOfBags / flight.totalPax).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Delay Analysis */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Delay Records &amp; Causal Analysis
              </span>
              <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                Total Delay: {flight.delayMinutesTotal || 0} min
              </span>
            </h3>

            {flight.delays.length === 0 ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                ✅ Punctual Operation: Zero delay minutes attributed to this flight.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden glass-card-sub">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="p-2.5 w-16">Code</th>
                      <th className="p-2.5 w-24">Delay Time</th>
                      <th className="p-2.5">IATA Category</th>
                      <th className="p-2.5">Standard Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {flight.delays.map((d, index) => {
                      const info = getDelayCodeInfo(d.code);
                      return (
                        <tr key={index}>
                          <td className="p-2.5 font-mono font-bold text-amber-700 dark:text-amber-400">{d.code}</td>
                          <td className="p-2.5 font-mono text-slate-800 dark:text-slate-200">
                            {d.minutes} min ({formatMinutesToHHMM(d.minutes)})
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{info?.category || 'General'}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">{info?.description || 'Custom Station Delay'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 5: Remarks & Cancellation */}
          <div className="border border-slate-200 dark:border-white/10 rounded-xl p-4 glass-card-sub text-xs space-y-2">
            <div>
              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Station Dispatcher Remarks:</span>
              <p className="text-slate-700 dark:text-slate-300 font-mono text-xs italic bg-slate-100 dark:bg-white/5 p-2.5 rounded-xl border border-slate-200 dark:border-white/10">
                {flight.remarks || 'No specific operational remarks registered for this turnaround.'}
              </p>
            </div>

            {flight.cancellationReason && (
              <div className="mt-2 pt-2 border-t border-rose-300 dark:border-rose-500/30">
                <span className="font-bold text-rose-800 dark:text-rose-300 block mb-1">Official Cancellation Reason:</span>
                <p className="text-rose-800 dark:text-rose-200 font-medium bg-rose-50 dark:bg-rose-500/15 p-2.5 rounded-xl border border-rose-300 dark:border-rose-500/30">
                  {flight.cancellationReason}
                </p>
              </div>
            )}
          </div>

          {/* Sign-off footer */}
          <div className="pt-6 border-t border-slate-200 dark:border-white/10 grid grid-cols-2 gap-8 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <div className="h-10 border-b border-dashed border-slate-400 dark:border-slate-600 mb-1"></div>
              <span>Flight Dispatcher / Ground Operations Agent</span>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-slate-400 dark:border-slate-600 mb-1"></div>
              <span>Airline Station Duty Manager Approval</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-white/5 flex justify-end print:hidden">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-slate-100 transition-colors cursor-pointer border border-slate-300 dark:border-white/10"
          >
            Close Trip File
          </button>
        </div>
      </div>
    </div>
  );
};
