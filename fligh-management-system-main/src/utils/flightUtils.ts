import { Flight, FlightStatus } from '../types';

export function calculateFlightStatus(
  staUtcStr: string,
  stdUtcStr: string,
  ataUtcStr: string | null,
  atdUtcStr: string | null,
  isCanceled: boolean = false
): FlightStatus {
  if (isCanceled) {
    return 'Canceled';
  }

  const hasAta = Boolean(ataUtcStr && ataUtcStr.trim() !== '');
  const hasAtd = Boolean(atdUtcStr && atdUtcStr.trim() !== '');

  if (hasAta && hasAtd) {
    return 'Completed';
  }

  if (hasAtd && !hasAta) {
    return 'Departed - Not Arrived';
  }

  if (hasAta && !hasAtd) {
    const now = new Date();
    const std = new Date(stdUtcStr);
    if (!isNaN(std.getTime()) && now.getTime() > std.getTime()) {
      return 'Not Departed';
    }
    return 'Arrived - Not Departed';
  }

  // Neither arrived nor departed
  const now = new Date();
  const sta = new Date(staUtcStr);
  if (!isNaN(sta.getTime()) && now.getTime() > sta.getTime()) {
    return 'Not Arrived';
  }

  return 'Scheduled';
}

export function formatUtcDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'N/A';

  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function parseDateTimeLocalAsUtc(dateInput: string | null | undefined): string | null {
  if (!dateInput || !dateInput.trim()) return null;

  const cleaned = dateInput.trim();

  const datetimeLocalPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
  if (!datetimeLocalPattern.test(cleaned)) {
    const parsed = new Date(cleaned);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const [datePart, timePart] = cleaned.split('T');
  const [year, month, day] = datePart.split('-');
  const timeSegments = timePart.split(':');
  const hours = String(parseInt(timeSegments[0] ?? '0', 10)).padStart(2, '0');
  const minutes = String(parseInt(timeSegments[1] ?? '0', 10)).padStart(2, '0');
  const seconds = timeSegments[2] ? String(parseInt(timeSegments[2], 10)).padStart(2, '0') : '00';

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
}

export function getPassengerTotal(
  adult: number | null | undefined,
  child: number | null | undefined,
  infant: number | null | undefined
): number {
  return (adult ?? 0) + (child ?? 0) + (infant ?? 0);
}

export function formatUtcTimeOnly(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '--:--';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '--:--';

  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function toUtcInputString(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatMinutesToHHMM(totalMinutes: number): string {
  if (!totalMinutes || isNaN(totalMinutes) || totalMinutes < 0) return '0000';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
}

export function parseHHMMToMinutes(inputStr: string): number {
  if (!inputStr) return 0;
  const clean = inputStr.replace(/[^0-9]/g, '');
  if (clean.length === 0) return 0;

  if (clean.length <= 2) {
    return parseInt(clean, 10);
  }

  if (clean.length >= 3) {
    const hours = parseInt(clean.slice(0, -2), 10);
    const minutes = parseInt(clean.slice(-2), 10);
    return hours * 60 + minutes;
  }

  return parseInt(clean, 10);
}

export function getStatusBadgeStyle(status: FlightStatus): {
  bgClass: string;
  textClass: string;
  borderClass: string;
  label: string;
} {
  switch (status) {
    case 'Canceled':
      return {
        bgClass: 'bg-slate-100 dark:bg-white/5 backdrop-blur-xs',
        textClass: 'text-slate-500 dark:text-slate-400 line-through',
        borderClass: 'border-slate-200 dark:border-white/10',
        label: '❌ Canceled',
      };
    case 'Not Arrived':
      return {
        bgClass: 'bg-amber-100/90 dark:bg-amber-500/15 backdrop-blur-xs',
        textClass: 'text-amber-800 dark:text-amber-300 font-semibold',
        borderClass: 'border-amber-300 dark:border-amber-500/30',
        label: '⚠️ Not Arrived',
      };
    case 'Not Departed':
      return {
        bgClass: 'bg-rose-100/90 dark:bg-rose-500/15 backdrop-blur-xs',
        textClass: 'text-rose-800 dark:text-rose-300 font-semibold',
        borderClass: 'border-rose-300 dark:border-rose-500/30',
        label: '⚠️ Not Departed',
      };
    case 'Arrived - Not Departed':
      return {
        bgClass: 'bg-sky-100/90 dark:bg-sky-500/15 backdrop-blur-xs',
        textClass: 'text-sky-800 dark:text-sky-300 font-semibold',
        borderClass: 'border-sky-300 dark:border-sky-500/30',
        label: '🛬 Arrived - Not Departed',
      };
    case 'Departed - Not Arrived':
      return {
        bgClass: 'bg-orange-100/90 dark:bg-orange-500/15 backdrop-blur-xs',
        textClass: 'text-orange-800 dark:text-orange-300 font-semibold',
        borderClass: 'border-orange-300 dark:border-orange-500/30',
        label: '🛫 Departed - Not Arrived',
      };
    case 'Completed':
      return {
        bgClass: 'bg-emerald-100/90 dark:bg-emerald-500/15 backdrop-blur-xs',
        textClass: 'text-emerald-800 dark:text-emerald-300 font-semibold',
        borderClass: 'border-emerald-300 dark:border-emerald-500/30',
        label: '✅ Completed',
      };
    case 'Scheduled':
    default:
      return {
        bgClass: 'bg-slate-100 dark:bg-white/5 backdrop-blur-xs',
        textClass: 'text-slate-700 dark:text-slate-300 font-medium',
        borderClass: 'border-slate-200 dark:border-white/10',
        label: '⏱️ Scheduled',
      };
  }
}

export function formatFlightRoute(flight: {
  origin: string;
  destination: string;
  via?: string | null;
  finalDestination?: string | null;
}): string {
  const o = flight.origin?.trim().toUpperCase() || '---';
  const d = flight.destination?.trim().toUpperCase() || '---';
  const v = flight.via?.trim().toUpperCase() || '';
  const fd = flight.finalDestination?.trim().toUpperCase() || '';

  if (v) {
    // Triangle or 4-point routing: ORIGIN-DEST-VIA-FINALDEST (e.g. LHR-CAI-HRG-LHR)
    const finalPt = fd || o;
    return `${o}-${d}-${v}-${finalPt}`;
  }

  if (fd && fd !== d) {
    return `${o}-${d}-${fd}`;
  }

  return `${o}-${d}`;
}

export function isTriangleFlight(flight: {
  origin: string;
  destination: string;
  via?: string | null;
  finalDestination?: string | null;
}): boolean {
  const v = flight.via?.trim().toUpperCase();
  return Boolean(v && v.length > 0);
}

export function parseRouteString(input: string): {
  origin?: string;
  destination?: string;
  via?: string;
  finalDestination?: string;
} {
  if (!input) return {};
  // Split by hyphen, slash, arrow, space, or comma
  const parts = input
    .replace(/[\u2192\->/,\s]+/g, '-')
    .split('-')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (parts.length >= 4) {
    return {
      origin: parts[0],
      destination: parts[1],
      via: parts[2],
      finalDestination: parts[3],
    };
  }
  if (parts.length === 3) {
    return {
      origin: parts[0],
      destination: parts[1],
      finalDestination: parts[2],
    };
  }
  if (parts.length === 2) {
    return {
      origin: parts[0],
      destination: parts[1],
      finalDestination: parts[1],
    };
  }
  if (parts.length === 1) {
    return { origin: parts[0] };
  }
  return {};
}

export function exportFlightsToCsv(flights: Flight[], filename = 'Flight_List.csv'): void {
  const headers = [
    'Flight ID',
    'Inbound Flight',
    'Outbound Flight',
    'Airline',
    'Agency',
    'Full Route',
    'Routing Type',
    'Origin',
    'Destination',
    'Via / Stop',
    'Final Destination',
    'Aircraft Type',
    'Registration',
    'STA (UTC)',
    'STD (UTC)',
    'ATA (UTC)',
    'ATD (UTC)',
    'Status',
    'Total Delay (min)',
    'Delays',
    'Adult Pax',
    'Child Pax',
    'Infant Pax',
    'Total Pax',
    'Bags',
    'Remarks',
    'Cancellation Reason'
  ];

  const rows = flights.map(f => {
    const delayString = f.delays.length > 0 
      ? f.delays.map(d => `${d.code}:${formatMinutesToHHMM(d.minutes)}`).join('; ') 
      : 'None';
    
    const fullRoute = formatFlightRoute(f);
    const routingType = isTriangleFlight(f) ? 'Triangle Route' : (f.destination !== f.finalDestination ? 'Multi-Sector' : 'Direct Turnaround');
    
    return [
      f.flightId,
      `"${f.inboundFlightNumber}"`,
      `"${f.outboundFlightNumber}"`,
      `"${f.airlineName}"`,
      `"${f.agencyName}"`,
      `"${fullRoute}"`,
      `"${routingType}"`,
      `"${f.origin}"`,
      `"${f.destination}"`,
      `"${f.via || ''}"`,
      `"${f.finalDestination}"`,
      `"${f.aircraftType}"`,
      `"${f.registration || ''}"`,
      `"${formatUtcDateTime(f.staUtc)}"`,
      `"${formatUtcDateTime(f.stdUtc)}"`,
      `"${f.ataUtc ? formatUtcDateTime(f.ataUtc) : 'N/A'}"`,
      `"${f.atdUtc ? formatUtcDateTime(f.atdUtc) : 'N/A'}"`,
      `"${f.flightStatus}"`,
      f.delayMinutesTotal || 0,
      `"${delayString}"`,
      f.adultPax ?? 0,
      f.childPax ?? 0,
      f.infantPax ?? 0,
      f.totalPax ?? 0,
      f.numberOfBags ?? 0,
      `"${(f.remarks || '').replace(/"/g, '""')}"`,
      `"${(f.cancellationReason || '').replace(/"/g, '""')}"`
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
