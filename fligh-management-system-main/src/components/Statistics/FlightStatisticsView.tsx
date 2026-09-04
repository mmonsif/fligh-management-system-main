import React, { useState, useMemo } from 'react';
import { Flight } from '../../types';
import { formatUtcDateTime, formatMinutesToHHMM, getStatusBadgeStyle, getPassengerTotal } from '../../utils/flightUtils';
import { getDelayCodeInfo } from '../../data/iataDelayCodes';
import { FlightTrendsDashboard } from './FlightTrendsDashboard';
import {
  BarChart3,
  Calendar,
  Download,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  Luggage,
  Building2,
  Plane,
  XCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface FlightStatisticsViewProps {
  flights: Flight[];
}

export const FlightStatisticsView: React.FC<FlightStatisticsViewProps> = ({ flights }) => {
  // 30 days default range
  const defaultFrom = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const defaultTo = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [activeReportTab, setActiveReportTab] = useState<
    'summary' | 'details' | 'airlines' | 'agencies' | 'delays'
  >('summary');

  // Filter flights within selected date range
  const periodFlights = useMemo(() => {
    const fromTime = new Date(`${dateFrom}T00:00:00.000Z`).getTime();
    const toTime = new Date(`${dateTo}T23:59:59.999Z`).getTime();

    return flights.filter((f) => {
      const t = new Date(f.staUtc).getTime();
      return t >= fromTime && t <= toTime;
    });
  }, [flights, dateFrom, dateTo]);

  // Aggregate Key Performance Indicators
  const stats = useMemo(() => {
    const totalFlights = periodFlights.length;
    const completedFlights = periodFlights.filter((f) => f.flightStatus === 'Completed').length;
    const canceledFlights = periodFlights.filter((f) => f.flightStatus === 'Canceled').length;
    const delayedFlights = periodFlights.filter((f) => f.delayMinutesTotal > 0 && f.flightStatus !== 'Canceled').length;
    const onTimeFlights = periodFlights.filter((f) => f.delayMinutesTotal === 0 && f.flightStatus === 'Completed').length;

    const totalAdultPax = periodFlights.reduce((acc, f) => acc + (f.adultPax || 0), 0);
    const totalChildPax = periodFlights.reduce((acc, f) => acc + (f.childPax || 0), 0);
    const totalInfantPax = periodFlights.reduce((acc, f) => acc + (f.infantPax || 0), 0);
    const totalPaxOut = periodFlights.reduce(
      (acc, f) => acc + (f.totalPax ?? getPassengerTotal(f.adultPax, f.childPax, f.infantPax)),
      0
    );
    const totalIncomingAdultPax = periodFlights.reduce((acc, f) => acc + (f.incomingAdultPax || 0), 0);
    const totalIncomingChildPax = periodFlights.reduce((acc, f) => acc + (f.incomingChildPax || 0), 0);
    const totalIncomingInfantPax = periodFlights.reduce((acc, f) => acc + (f.incomingInfantPax || 0), 0);
    const totalPaxIn = periodFlights.reduce(
      (acc, f) => acc + (f.incomingTotalPax ?? getPassengerTotal(f.incomingAdultPax, f.incomingChildPax, f.incomingInfantPax)),
      0
    );
    const totalBagsOut = periodFlights.reduce((acc, f) => acc + (f.numberOfBags || 0), 0);
    const totalBagsIn = periodFlights.reduce((acc, f) => acc + (f.incomingNumberOfBags || 0), 0);

    const activeFlights = totalFlights - canceledFlights;
    const completionRate = activeFlights > 0 ? (completedFlights / activeFlights) * 100 : 0;
    const onTimeRate = activeFlights > 0 ? (onTimeFlights / activeFlights) * 100 : 0;
    const delayRate = activeFlights > 0 ? (delayedFlights / activeFlights) * 100 : 0;
    const cancelationRate = totalFlights > 0 ? (canceledFlights / totalFlights) * 100 : 0;

    const totalDelayMinutes = periodFlights.reduce((acc, f) => acc + (f.delayMinutesTotal || 0), 0);
    const flightsWithDelays = periodFlights.filter((f) => f.delayMinutesTotal > 0);
    const avgDelayMinutes = flightsWithDelays.length > 0 ? totalDelayMinutes / flightsWithDelays.length : 0;

    const flightsWithPax = periodFlights.filter((f) => (f.totalPax || 0) > 0);
    const avgPaxPerFlight = flightsWithPax.length > 0 ? totalPaxOut / flightsWithPax.length : 0;

    const flightsWithBags = periodFlights.filter((f) => (f.numberOfBags || 0) > 0);
    const avgBagsPerFlight = flightsWithBags.length > 0 ? totalBagsOut / flightsWithBags.length : 0;

    const uniqueAirlines = new Set(periodFlights.map((f) => f.airlineId)).size;
    const uniqueAgencies = new Set(periodFlights.map((f) => f.agencyId)).size;

    return {
      totalFlights,
      completedFlights,
      canceledFlights,
      delayedFlights,
      onTimeFlights,
      totalAdultPax,
      totalChildPax,
      totalInfantPax,
      totalPaxOut,
      totalIncomingAdultPax,
      totalIncomingChildPax,
      totalIncomingInfantPax,
      totalPaxIn,
      totalBagsOut,
      totalBagsIn,
      completionRate,
      onTimeRate,
      delayRate,
      cancelationRate,
      avgDelayMinutes,
      avgPaxPerFlight,
      avgBagsPerFlight,
      uniqueAirlines,
      uniqueAgencies,
    };
  }, [periodFlights]);

  // Aggregate Airline Performance
  const airlineReport = useMemo(() => {
    const map = new Map<
      number,
      {
        airlineName: string;
        total: number;
        completed: number;
        delayed: number;
        onTime: number;
        canceled: number;
        totalPax: number;
        totalBags: number;
      }
    >();

    periodFlights.forEach((f) => {
      let item = map.get(f.airlineId);
      if (!item) {
        item = {
          airlineName: f.airlineName,
          total: 0,
          completed: 0,
          delayed: 0,
          onTime: 0,
          canceled: 0,
          totalPax: 0,
          totalBags: 0,
        };
        map.set(f.airlineId, item);
      }
      item.total += 1;
      if (f.flightStatus === 'Completed') item.completed += 1;
      if (f.flightStatus === 'Canceled') item.canceled += 1;
      if (f.delayMinutesTotal > 0 && f.flightStatus !== 'Canceled') item.delayed += 1;
      if (f.delayMinutesTotal === 0 && f.flightStatus === 'Completed') item.onTime += 1;
      item.totalPax += f.totalPax ?? getPassengerTotal(f.adultPax, f.childPax, f.infantPax);
      item.totalBags += f.numberOfBags || 0;
    });

    return Array.from(map.values()).map((a) => {
      const active = a.total - a.canceled;
      const cancelationRate = a.total > 0 ? (a.canceled / a.total) * 100 : 0;
      const avgPax = active > 0 ? a.totalPax / active : 0;
      const avgBags = active > 0 ? a.totalBags / active : 0;
      return {
        ...a,
        cancelationRate,
        avgPax,
        avgBags,
      };
    });
  }, [periodFlights]);

  // Aggregate Agency Performance
  const agencyReport = useMemo(() => {
    const map = new Map<
      number,
      {
        agencyName: string;
        total: number;
        canceled: number;
        completed: number;
        totalPax: number;
        totalBags: number;
      }
    >();

    periodFlights.forEach((f) => {
      let item = map.get(f.agencyId);
      if (!item) {
        item = {
          agencyName: f.agencyName,
          total: 0,
          canceled: 0,
          completed: 0,
          totalPax: 0,
          totalBags: 0,
        };
        map.set(f.agencyId, item);
      }
      item.total += 1;
      if (f.flightStatus === 'Canceled') item.canceled += 1;
      if (f.flightStatus === 'Completed') item.completed += 1;
      item.totalPax += f.totalPax ?? getPassengerTotal(f.adultPax, f.childPax, f.infantPax);
      item.totalBags += f.numberOfBags || 0;
    });

    return Array.from(map.values()).map((a) => {
      const active = a.total - a.canceled;
      const avgPax = active > 0 ? a.totalPax / active : 0;
      const avgBags = active > 0 ? a.totalBags / active : 0;
      return {
        ...a,
        avgPax,
        avgBags,
      };
    });
  }, [periodFlights]);

  // Aggregate Delay Code Analysis
  const delayReport = useMemo(() => {
    const map = new Map<string, { occurrences: number; totalMinutes: number }>();

    periodFlights.forEach((f) => {
      f.delays.forEach((d) => {
        if (!d.code) return;
        const item = map.get(d.code) || { occurrences: 0, totalMinutes: 0 };
        item.occurrences += 1;
        item.totalMinutes += d.minutes || 0;
        map.set(d.code, item);
      });
    });

    return Array.from(map.entries())
      .map(([code, val]) => {
        const info = getDelayCodeInfo(code);
        return {
          code,
          category: info?.category || 'Station Delay',
          description: info?.description || 'Custom Station Delay',
          occurrences: val.occurrences,
          totalMinutes: val.totalMinutes,
          avgMinutes: val.occurrences > 0 ? val.totalMinutes / val.occurrences : 0,
        };
      })
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [periodFlights]);

  // Handle Export All Reports to Excel CSV
  const handleExportAllToExcel = () => {
    let csvContent = `FLIGHT OPERATIONS ANALYTICAL REPORT\r\nPeriod: ${dateFrom} to ${dateTo}\r\n\r\n`;

    // 1. Summary
    csvContent += `1. OPERATIONAL SUMMARY METRICS\r\nMetric,Value\r\n`;
    csvContent += `Total Flights,${stats.totalFlights}\r\n`;
    csvContent += `Completed Flights,${stats.completedFlights}\r\n`;
    csvContent += `Canceled Flights,${stats.canceledFlights}\r\n`;
    csvContent += `Delayed Flights,${stats.delayedFlights}\r\n`;
    csvContent += `On-Time Flights,${stats.onTimeFlights}\r\n`;
    csvContent += `Average Delay (min),${stats.avgDelayMinutes.toFixed(1)}\r\n`;
    csvContent += `Total Adult Pax,${stats.totalAdultPax}\r\n`;
    csvContent += `Total Child Pax,${stats.totalChildPax}\r\n`;
    csvContent += `Total Infant Pax,${stats.totalInfantPax}\r\n`;
    csvContent += `Total Passengers Out,${stats.totalPaxOut}\r\n`;
    csvContent += `Total Passengers In,${stats.totalPaxIn}\r\n`;
    csvContent += `Total Bags Out,${stats.totalBagsOut}\r\n`;
    csvContent += `Total Bags In,${stats.totalBagsIn}\r\n`;
    csvContent += `Completion Rate,${stats.completionRate.toFixed(1)}%\r\n`;
    csvContent += `On-Time Rate,${stats.onTimeRate.toFixed(1)}%\r\n`;
    csvContent += `Delay Rate,${stats.delayRate.toFixed(1)}%\r\n`;
    csvContent += `Cancelation Rate,${stats.cancelationRate.toFixed(1)}%\r\n\r\n`;

    // 2. Airline Performance
    csvContent += `2. AIRLINE PERFORMANCE\r\nAirline,Total Flights,Completed,Delayed,On-Time,Canceled,Total Pax,Total Bags,Avg Pax/Flight,Avg Bags/Flight,Cancelation Rate\r\n`;
    airlineReport.forEach((a) => {
      csvContent += `"${a.airlineName}",${a.total},${a.completed},${a.delayed},${a.onTime},${a.canceled},${a.totalPax},${a.totalBags},${a.avgPax.toFixed(1)},${a.avgBags.toFixed(1)},${a.cancelationRate.toFixed(1)}%\r\n`;
    });
    csvContent += `\r\n`;

    // 3. Agency Performance
    csvContent += `3. AGENCY PERFORMANCE\r\nAgency,Total Flights,Canceled,Completed,Total Pax,Total Bags,Avg Pax/Flight,Avg Bags/Flight\r\n`;
    agencyReport.forEach((g) => {
      csvContent += `"${g.agencyName}",${g.total},${g.canceled},${g.completed},${g.totalPax},${g.totalBags},${g.avgPax.toFixed(1)},${g.avgBags.toFixed(1)}\r\n`;
    });
    csvContent += `\r\n`;

    // 4. Delays
    csvContent += `4. DELAY ANALYSIS\r\nCode,Category,Description,Occurrences,Total Minutes,Avg Minutes\r\n`;
    delayReport.forEach((d) => {
      csvContent += `"${d.code}","${d.category}","${d.description}",${d.occurrences},${d.totalMinutes},${d.avgMinutes.toFixed(1)}\r\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Flight_Statistics_${dateFrom}_to_${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Date Range Selection & Actions Bar */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-2xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            Analysis Period:
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="glass-input px-3 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="glass-input px-3 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAllToExcel}
            className="glass-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export All to Excel (CSV)
          </button>
        </div>
      </div>

      {/* KPI Metric Cards (Matching frmFlightStatistics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
        <div className="p-4 glass-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Total Flights</span>
            <Plane className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{stats.totalFlights}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">In operational period</div>
        </div>

        <div className="p-4 glass-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Completed</span>
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
            {stats.completedFlights}
          </div>
          <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold mt-1">
            {stats.completionRate.toFixed(1)}% completion
          </div>
        </div>

        <div className="p-4 glass-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Delayed Flights</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
            {stats.delayedFlights}
          </div>
          <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold mt-1">
            Avg {stats.avgDelayMinutes.toFixed(1)} min delay
          </div>
        </div>

        <div className="p-4 glass-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">On-Time Flights</span>
            <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono tracking-tight">{stats.onTimeFlights}</div>
          <div className="text-[10px] text-sky-700 dark:text-sky-300 font-semibold mt-1">{stats.onTimeRate.toFixed(1)}% punctuality</div>
        </div>

        <div className="p-4 glass-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Canceled</span>
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">{stats.canceledFlights}</div>
          <div className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold mt-1">
            {stats.cancelationRate.toFixed(1)}% cancel rate
          </div>
        </div>
      </div>

      {/* Secondary Passenger & Baggage Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Adult Pax</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">{stats.totalAdultPax.toLocaleString()}</span>
          </div>
          <Users className="w-5 h-5 text-sky-600 dark:text-sky-400" />
        </div>

        <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Child Pax</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">{stats.totalChildPax.toLocaleString()}</span>
          </div>
          <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>

        <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Infant Pax</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">{stats.totalInfantPax.toLocaleString()}</span>
          </div>
          <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>

        <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Bags Out</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">{stats.totalBagsOut.toLocaleString()} pcs</span>
          </div>
          <Luggage className="w-5 h-5 text-sky-600 dark:text-sky-400" />
        </div>

        <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Pax Out</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">{stats.totalPaxOut.toLocaleString()}</span>
          </div>
          <Users className="w-5 h-5 text-sky-600 dark:text-sky-400" />
        </div>

        <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Pax In</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">{stats.totalPaxIn.toLocaleString()}</span>
          </div>
          <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>

        <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Bags In</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">{stats.totalBagsIn.toLocaleString()} pcs</span>
          </div>
          <Luggage className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>

        <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Avg Pax per Flight</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">{stats.avgPaxPerFlight.toFixed(1)}</span>
          </div>
          <Users className="w-5 h-5 text-sky-600 dark:text-sky-400" />
        </div>

        <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-slate-500 block text-[11px]">Avg Bags per Flight</span>
            <span className="text-base font-bold text-slate-900 font-mono">{stats.avgBagsPerFlight.toFixed(1)}</span>
          </div>
          <Luggage className="w-5 h-5 text-sky-600" />
        </div>
      </div>

      {/* Recharts 30-Day Daily Flight Volume & On-Time Performance Dashboard */}
      <FlightTrendsDashboard
        flights={flights}
        dateTo={dateTo}
        onSelectDateFilter={(selectedDate) => {
          setDateFrom(selectedDate);
          setDateTo(selectedDate);
        }}
      />

      {/* Multi-Tab Detailed Reports (frmFlightStatistics report tabs) */}
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-200 dark:border-white/10 glass-card-sub">
          <button
            onClick={() => setActiveReportTab('summary')}
            className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeReportTab === 'summary'
                ? 'border-sky-500 text-sky-800 dark:text-sky-200 bg-sky-50/80 dark:bg-sky-500/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            📊 Comprehensive Summary
          </button>
          <button
            onClick={() => setActiveReportTab('details')}
            className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeReportTab === 'details'
                ? 'border-sky-500 text-sky-800 dark:text-sky-200 bg-sky-50/80 dark:bg-sky-500/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            📋 Detailed Flight Log ({periodFlights.length})
          </button>
          <button
            onClick={() => setActiveReportTab('airlines')}
            className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeReportTab === 'airlines'
                ? 'border-sky-500 text-sky-800 dark:text-sky-200 bg-sky-50/80 dark:bg-sky-500/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            ✈️ Airline Performance ({airlineReport.length})
          </button>
          <button
            onClick={() => setActiveReportTab('agencies')}
            className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeReportTab === 'agencies'
                ? 'border-sky-500 text-sky-800 dark:text-sky-200 bg-sky-50/80 dark:bg-sky-500/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            🏢 Agency Handling Report ({agencyReport.length})
          </button>
          <button
            onClick={() => setActiveReportTab('delays')}
            className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeReportTab === 'delays'
                ? 'border-sky-500 text-sky-800 dark:text-sky-200 bg-sky-50/80 dark:bg-sky-500/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            🕒 Delay Analysis ({delayReport.length})
          </button>
        </div>

        {/* Tab 1: Comprehensive Summary - Full Width Balanced Presentation */}
        {activeReportTab === 'summary' && (
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Panel: Flight Movements & Punctuality */}
              <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden glass-card-sub">
                <div className="p-3 bg-slate-100/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 font-bold text-xs text-sky-700 dark:text-sky-300 flex items-center gap-2">
                  <Plane className="w-3.5 h-3.5" />
                  Movement &amp; Punctuality Statistics
                </div>
                <table className="w-full text-xs text-left">
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">📊 Total Flights in Period</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{stats.totalFlights.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">✅ Completed Flights</td>
                      <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{stats.completedFlights.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">⚠️ Delayed Flights</td>
                      <td className="p-3 text-right font-bold text-amber-600 dark:text-amber-400">{stats.delayedFlights.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">⏱️ On-Time Flights</td>
                      <td className="p-3 text-right font-bold text-sky-600 dark:text-sky-400">{stats.onTimeFlights.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">❌ Canceled Flights</td>
                      <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-400">{stats.canceledFlights.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-sky-50 dark:bg-sky-500/10">
                      <td className="p-3 font-sans font-bold text-sky-800 dark:text-sky-300">📈 Completion Rate</td>
                      <td className="p-3 text-right font-black text-sky-800 dark:text-sky-300">{stats.completionRate.toFixed(1)}%</td>
                    </tr>
                    <tr className="bg-sky-50 dark:bg-sky-500/10">
                      <td className="p-3 font-sans font-bold text-sky-800 dark:text-sky-300">🎯 On-Time Punctuality Rate</td>
                      <td className="p-3 text-right font-black text-sky-800 dark:text-sky-300">{stats.onTimeRate.toFixed(1)}%</td>
                    </tr>
                    <tr className="bg-amber-50 dark:bg-amber-500/10">
                      <td className="p-3 font-sans font-bold text-amber-800 dark:text-amber-300">⚠️ Delay Incidence Rate</td>
                      <td className="p-3 text-right font-black text-amber-800 dark:text-amber-300">{stats.delayRate.toFixed(1)}%</td>
                    </tr>
                    <tr className="bg-rose-50 dark:bg-rose-500/10">
                      <td className="p-3 font-sans font-bold text-rose-800 dark:text-rose-300">❌ Cancelation Rate</td>
                      <td className="p-3 text-right font-black text-rose-800 dark:text-rose-300">{stats.cancelationRate.toFixed(1)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right Panel: Passengers, Baggage & Fleet */}
              <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden glass-card-sub">
                <div className="p-3 bg-slate-100/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 font-bold text-xs text-sky-700 dark:text-sky-300 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  Traffic, Load &amp; Network Coverage
                </div>
                <table className="w-full text-xs text-left">
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">👥 Total Adult Pax</td>
                      <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">{stats.totalAdultPax.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">🧒 Total Child Pax</td>
                      <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">{stats.totalChildPax.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">👶 Total Infant Pax</td>
                      <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">{stats.totalInfantPax.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">👥 Total Passengers Out</td>
                      <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">{stats.totalPaxOut.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">👥 Total Passengers In</td>
                      <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">{stats.totalPaxIn.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">🎒 Total Bags Out</td>
                      <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">{stats.totalBagsOut.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">🎒 Total Bags In</td>
                      <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">{stats.totalBagsIn.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">👥 Average Pax per Flight</td>
                      <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">{stats.avgPaxPerFlight.toFixed(1)}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">🎒 Average Bags per Flight</td>
                      <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">{stats.avgBagsPerFlight.toFixed(1)}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">🕒 Average Delay Duration</td>
                      <td className="p-3 text-right font-bold text-amber-700 dark:text-amber-300">{stats.avgDelayMinutes.toFixed(1)} min</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">✈️ Unique Airlines Handled</td>
                      <td className="p-3 text-right font-bold text-sky-700 dark:text-sky-300">{stats.uniqueAirlines}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-200">🏢 Unique Agencies Involved</td>
                      <td className="p-3 text-right font-bold text-sky-700 dark:text-sky-300">{stats.uniqueAgencies}</td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-white/5">
                      <td className="p-3 font-sans font-semibold text-slate-700 dark:text-slate-300">🛄 Baggage / Pax Ratio</td>
                      <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">
                        {stats.totalPaxOut > 0 ? (stats.totalBagsOut / stats.totalPaxOut).toFixed(2) : '0.00'} bags/pax
                      </td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-white/5">
                      <td className="p-3 font-sans font-semibold text-slate-700 dark:text-slate-300">⚡ Dispatch Efficiency</td>
                      <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-300">
                        {stats.totalFlights > 0 ? (((stats.completedFlights + stats.onTimeFlights) / (stats.totalFlights * 2)) * 100).toFixed(1) : '100.0'}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Detailed Flight Log */}
        {activeReportTab === 'details' && (
          <div className="overflow-x-auto min-h-[360px] max-h-[540px] 2xl:max-h-[640px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/90 dark:bg-white/10 backdrop-blur-md text-slate-700 dark:text-slate-300 font-bold sticky top-0 border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="p-2.5">Inbound</th>
                  <th className="p-2.5">Outbound</th>
                  <th className="p-2.5">Airline</th>
                  <th className="p-2.5">Agency</th>
                  <th className="p-2.5">STA (UTC)</th>
                  <th className="p-2.5">STD (UTC)</th>
                  <th className="p-2.5">ATA (UTC)</th>
                  <th className="p-2.5">ATD (UTC)</th>
                  <th className="p-2.5 text-right">Delay</th>
                  <th className="p-2.5 text-right">Pax</th>
                  <th className="p-2.5 text-right">Bags</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {periodFlights.map((f) => {
                  const badge = getStatusBadgeStyle(f.flightStatus);
                  return (
                    <tr key={f.flightId} className="hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-slate-100">{f.inboundFlightNumber}</td>
                      <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-slate-100">{f.outboundFlightNumber}</td>
                      <td className="p-2.5 text-slate-800 dark:text-slate-200">{f.airlineName}</td>
                      <td className="p-2.5 text-slate-500 dark:text-slate-400">{f.agencyName}</td>
                      <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">{formatUtcDateTime(f.staUtc)}</td>
                      <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">{formatUtcDateTime(f.stdUtc)}</td>
                      <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">{f.ataUtc ? formatUtcDateTime(f.ataUtc) : '-'}</td>
                      <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">{f.atdUtc ? formatUtcDateTime(f.atdUtc) : '-'}</td>
                      <td className="p-2.5 font-mono text-right font-bold text-amber-700 dark:text-amber-400">
                        {f.delayMinutesTotal ? `${f.delayMinutesTotal}m` : '-'}
                      </td>
                      <td className="p-2.5 font-mono text-right text-slate-800 dark:text-slate-200">{f.totalPax ?? '-'}</td>
                      <td className="p-2.5 font-mono text-right text-slate-800 dark:text-slate-200">{f.numberOfBags ?? '-'}</td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 text-[10px] rounded-lg border backdrop-blur-md ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Airline Performance Report */}
        {activeReportTab === 'airlines' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="p-3">Airline Name</th>
                  <th className="p-3 text-right">Total Flights</th>
                  <th className="p-3 text-right">Completed</th>
                  <th className="p-3 text-right">Delayed</th>
                  <th className="p-3 text-right">On-Time</th>
                  <th className="p-3 text-right">Canceled</th>
                  <th className="p-3 text-right">Total Pax</th>
                  <th className="p-3 text-right">Total Bags</th>
                  <th className="p-3 text-right">Avg Pax/Flt</th>
                  <th className="p-3 text-right">Cancel Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                {airlineReport.map((a, i) => (
                  <tr key={i} className="hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors">
                    <td className="p-3 font-sans font-bold text-slate-900 dark:text-slate-100">{a.airlineName}</td>
                    <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{a.total}</td>
                    <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">{a.completed}</td>
                    <td className="p-3 text-right text-amber-600 dark:text-amber-400">{a.delayed}</td>
                    <td className="p-3 text-right text-sky-600 dark:text-sky-400">{a.onTime}</td>
                    <td className="p-3 text-right text-rose-600 dark:text-rose-400">{a.canceled}</td>
                    <td className="p-3 text-right text-slate-800 dark:text-slate-200">{a.totalPax.toLocaleString()}</td>
                    <td className="p-3 text-right text-slate-800 dark:text-slate-200">{a.totalBags.toLocaleString()}</td>
                    <td className="p-3 text-right text-slate-800 dark:text-slate-200">{a.avgPax.toFixed(1)}</td>
                    <td className="p-3 text-right text-slate-800 dark:text-slate-200">{a.cancelationRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Agency Flight Report */}
        {activeReportTab === 'agencies' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="p-3">Agency Name</th>
                  <th className="p-3 text-right">Total Flights</th>
                  <th className="p-3 text-right">Completed</th>
                  <th className="p-3 text-right">Canceled</th>
                  <th className="p-3 text-right">Total Passengers</th>
                  <th className="p-3 text-right">Total Bags</th>
                  <th className="p-3 text-right">Avg Pax/Flight</th>
                  <th className="p-3 text-right">Avg Bags/Flight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                {agencyReport.map((g, i) => (
                  <tr key={i} className="hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors">
                    <td className="p-3 font-sans font-bold text-slate-900 dark:text-slate-100">{g.agencyName}</td>
                    <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{g.total}</td>
                    <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">{g.completed}</td>
                    <td className="p-3 text-right text-rose-600 dark:text-rose-400">{g.canceled}</td>
                    <td className="p-3 text-right text-slate-800 dark:text-slate-200">{g.totalPax.toLocaleString()}</td>
                    <td className="p-3 text-right text-slate-800 dark:text-slate-200">{g.totalBags.toLocaleString()}</td>
                    <td className="p-3 text-right text-slate-800 dark:text-slate-200">{g.avgPax.toFixed(1)}</td>
                    <td className="p-3 text-right text-slate-800 dark:text-slate-200">{g.avgBags.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 5: Delay Analysis Report */}
        {activeReportTab === 'delays' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="p-3 w-20">Delay Code</th>
                  <th className="p-3 w-48">IATA Category</th>
                  <th className="p-3">Standard Description</th>
                  <th className="p-3 text-right w-24">Occurrences</th>
                  <th className="p-3 text-right w-32">Total Delay (min)</th>
                  <th className="p-3 text-right w-32">Avg Delay (min)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {delayReport.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                      No delay incidents registered during this operational period.
                    </td>
                  </tr>
                ) : (
                  delayReport.map((d, i) => (
                    <tr key={i} className="hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors">
                      <td className="p-3 font-mono font-bold text-amber-700 dark:text-amber-400">{d.code}</td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{d.category}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{d.description}</td>
                      <td className="p-3 font-mono text-right text-slate-800 dark:text-slate-200">{d.occurrences}</td>
                      <td className="p-3 font-mono text-right font-bold text-amber-700 dark:text-amber-400">
                        {d.totalMinutes} min ({formatMinutesToHHMM(d.totalMinutes)})
                      </td>
                      <td className="p-3 font-mono text-right text-slate-800 dark:text-slate-200">{d.avgMinutes.toFixed(1)} min</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
