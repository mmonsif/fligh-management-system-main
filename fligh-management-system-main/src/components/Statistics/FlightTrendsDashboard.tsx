import React, { useState, useMemo } from 'react';
import { Flight } from '../../types';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Plane,
  Award,
  BarChart2,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from 'lucide-react';

interface FlightTrendsDashboardProps {
  flights: Flight[];
  dateTo: string;
  onSelectDateFilter?: (date: string) => void;
}

export interface DailyTrendPoint {
  dateKey: string;        // "2026-08-15"
  displayDate: string;    // "Aug 15"
  dayOfWeek: string;      // "Sat"
  totalFlights: number;
  onTimeFlights: number;
  delayedFlights: number;
  canceledFlights: number;
  completedFlights: number;
  onTimeRate: number;     // 0 - 100%
  delayRate: number;      // 0 - 100%
  avgDelayMinutes: number;
  totalDelayMinutes: number;
  totalPax: number;
  totalBags: number;
}

export const FlightTrendsDashboard: React.FC<FlightTrendsDashboardProps> = ({
  flights,
  dateTo,
  onSelectDateFilter,
}) => {
  // Chart visual mode
  const [chartViewMode, setChartViewMode] = useState<'dual' | 'volume' | 'otp' | 'delays'>('dual');
  // Preset range (7, 14, 30 days)
  const [windowDays, setWindowDays] = useState<number>(30);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  // Compute the continuous 30-day time series backwards from dateTo
  const dailyData = useMemo(() => {
    const points: DailyTrendPoint[] = [];
    const baseDate = new Date(dateTo + 'T12:00:00Z');
    if (isNaN(baseDate.getTime())) {
      return points;
    }

    // Build array for windowDays (default 30)
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(baseDate.getTime() - i * 86400000);
      const dateKey = d.toISOString().slice(0, 10);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const displayDate = `${monthNames[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}`;
      const dayOfWeek = dayNames[d.getUTCDay()];

      // Find matching flights on this date
      const dayFlights = flights.filter((f) => {
        if (!f.staUtc) return false;
        return f.staUtc.startsWith(dateKey);
      });

      const totalFlights = dayFlights.length;
      const completedFlights = dayFlights.filter((f) => f.flightStatus === 'Completed').length;
      const canceledFlights = dayFlights.filter((f) => f.flightStatus === 'Canceled').length;
      const delayedFlights = dayFlights.filter((f) => f.flightStatus !== 'Canceled' && f.delayMinutesTotal > 0).length;
      const onTimeFlights = dayFlights.filter((f) => f.flightStatus === 'Completed' && f.delayMinutesTotal === 0).length;

      const activeFlights = totalFlights - canceledFlights;
      const onTimeRate = activeFlights > 0 ? Number(((onTimeFlights / activeFlights) * 100).toFixed(1)) : 100;
      const delayRate = activeFlights > 0 ? Number(((delayedFlights / activeFlights) * 100).toFixed(1)) : 0;

      const totalDelayMinutes = dayFlights.reduce((acc, f) => acc + (f.delayMinutesTotal || 0), 0);
      const avgDelayMinutes = delayedFlights > 0 ? Number((totalDelayMinutes / delayedFlights).toFixed(1)) : 0;

      const totalPax = dayFlights.reduce((acc, f) => acc + (f.totalPax || 0), 0);
      const totalBags = dayFlights.reduce((acc, f) => acc + (f.numberOfBags || 0), 0);

      points.push({
        dateKey,
        displayDate,
        dayOfWeek,
        totalFlights,
        onTimeFlights,
        delayedFlights,
        canceledFlights,
        completedFlights,
        onTimeRate,
        delayRate,
        avgDelayMinutes,
        totalDelayMinutes,
        totalPax,
        totalBags,
      });
    }

    return points;
  }, [flights, dateTo, windowDays]);

  // Aggregate metrics for this 30-day window
  const windowSummary = useMemo(() => {
    const totalFlights = dailyData.reduce((acc, d) => acc + d.totalFlights, 0);
    const totalCompleted = dailyData.reduce((acc, d) => acc + d.completedFlights, 0);
    const totalOnTime = dailyData.reduce((acc, d) => acc + d.onTimeFlights, 0);
    const totalDelayed = dailyData.reduce((acc, d) => acc + d.delayedFlights, 0);
    const totalCanceled = dailyData.reduce((acc, d) => acc + d.canceledFlights, 0);
    const totalDelayMinutes = dailyData.reduce((acc, d) => acc + d.totalDelayMinutes, 0);
    const totalPax = dailyData.reduce((acc, d) => acc + d.totalPax, 0);

    const activeFlights = totalFlights - totalCanceled;
    const avgOnTimeRate = activeFlights > 0 ? (totalOnTime / activeFlights) * 100 : 0;
    const avgDailyFlights = dailyData.length > 0 ? totalFlights / dailyData.length : 0;
    const avgDelayPerDelayedFlight = totalDelayed > 0 ? totalDelayMinutes / totalDelayed : 0;

    // Peak operations day
    let peakDay: DailyTrendPoint | null = null;
    dailyData.forEach((d) => {
      if (!peakDay || d.totalFlights > peakDay.totalFlights) {
        peakDay = d;
      }
    });

    // Best punctuality day (with at least 2 flights)
    let bestOtpDay: DailyTrendPoint | null = null;
    dailyData.forEach((d) => {
      if (d.totalFlights >= 2) {
        if (!bestOtpDay || d.onTimeRate > bestOtpDay.onTimeRate) {
          bestOtpDay = d;
        }
      }
    });

    return {
      totalFlights,
      totalCompleted,
      totalOnTime,
      totalDelayed,
      totalCanceled,
      avgOnTimeRate,
      avgDailyFlights,
      avgDelayPerDelayedFlight,
      peakDay,
      bestOtpDay,
      totalPax,
    };
  }, [dailyData]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: DailyTrendPoint = payload[0].payload;
      return (
        <div className="glass-card p-3 rounded-xl border border-slate-200 shadow-xl text-xs space-y-1.5 min-w-[200px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 font-bold text-slate-800">
            <span>
              {data.displayDate} ({data.dayOfWeek})
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{data.dateKey}</span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] pt-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Total Volume:</span>
              <span className="font-bold font-mono text-slate-900">{data.totalFlights}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-emerald-700 font-medium">On-Time:</span>
              <span className="font-bold font-mono text-emerald-700">{data.onTimeFlights}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-amber-700 font-medium">Delayed:</span>
              <span className="font-bold font-mono text-amber-700">{data.delayedFlights}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-rose-700 font-medium">Canceled:</span>
              <span className="font-bold font-mono text-rose-700">{data.canceledFlights}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sky-800">On-Time Rate (OTP):</span>
              <span className={`font-bold font-mono ${data.onTimeRate >= 85 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {data.onTimeRate.toFixed(1)}%
              </span>
            </div>

            {data.avgDelayMinutes > 0 && (
              <div className="flex items-center justify-between text-slate-500 text-[10px]">
                <span>Avg Delay / Delayed Flight:</span>
                <span className="font-mono font-semibold text-amber-700">{data.avgDelayMinutes} min</span>
              </div>
            )}

            {data.totalPax > 0 && (
              <div className="flex items-center justify-between text-slate-500 text-[10px]">
                <span>Passengers Carried:</span>
                <span className="font-mono font-semibold text-slate-800">{data.totalPax.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-200 shadow-xl space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center border border-sky-200">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                Operational Flight Volume &amp; On-Time Performance Trends
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                  Last {windowDays} Days
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Continuous daily movement density, punctuality threshold tracking (85% benchmark), and delay metrics
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Preset Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Range pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setWindowDays(7)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                windowDays === 7 ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setWindowDays(14)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                windowDays === 14 ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              14 Days
            </button>
            <button
              onClick={() => setWindowDays(30)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                windowDays === 30 ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Days
            </button>
          </div>

          {/* Chart view selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setChartViewMode('dual')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                chartViewMode === 'dual' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dual-Axis Overview
            </button>
            <button
              onClick={() => setChartViewMode('volume')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                chartViewMode === 'volume' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Volume Breakdown
            </button>
            <button
              onClick={() => setChartViewMode('otp')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                chartViewMode === 'otp' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              OTP % Curve
            </button>
            <button
              onClick={() => setChartViewMode('delays')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                chartViewMode === 'delays' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Delay Durations
            </button>
          </div>
        </div>
      </div>

      {/* 30-Day Executive Summary Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="text-slate-500 font-medium flex items-center justify-between">
            <span>Period Volume</span>
            <Plane className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">{windowSummary.totalFlights} flights</div>
          <div className="text-[11px] text-slate-500">
            Avg <span className="font-semibold text-slate-700">{windowSummary.avgDailyFlights.toFixed(1)}</span> flights/day
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="text-slate-500 font-medium flex items-center justify-between">
            <span>Overall Punctuality</span>
            <Award className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-600 font-mono">
            {windowSummary.avgOnTimeRate.toFixed(1)}%
          </div>
          <div className="text-[11px] flex items-center gap-1">
            {windowSummary.avgOnTimeRate >= 85 ? (
              <span className="text-emerald-700 font-semibold flex items-center">
                <ArrowUpRight className="w-3 h-3 inline" /> +{(windowSummary.avgOnTimeRate - 85).toFixed(1)}% vs 85% Target
              </span>
            ) : (
              <span className="text-amber-700 font-semibold flex items-center">
                <ArrowDownRight className="w-3 h-3 inline" /> -{(85 - windowSummary.avgOnTimeRate).toFixed(1)}% vs 85% Target
              </span>
            )}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="text-slate-500 font-medium flex items-center justify-between">
            <span>Peak Traffic Day</span>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {windowSummary.peakDay ? `${windowSummary.peakDay.totalFlights} flights` : '---'}
          </div>
          <div className="text-[11px] text-slate-500">
            {windowSummary.peakDay ? `${windowSummary.peakDay.displayDate} (${windowSummary.peakDay.dayOfWeek})` : 'N/A'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="text-slate-500 font-medium flex items-center justify-between">
            <span>Average Delay Duration</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-700 font-mono">
            {windowSummary.avgDelayPerDelayedFlight.toFixed(1)} min
          </div>
          <div className="text-[11px] text-slate-500">
            Across {windowSummary.totalDelayed} delayed turnarounds
          </div>
        </div>
      </div>

      {/* Main Interactive Recharts Area */}
      <div className="w-full bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        {/* Dynamic Recharts Chart */}
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height={340}>
            {chartViewMode === 'dual' ? (
              <ComposedChart
                data={dailyData}
                margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const clickedKey = e.activePayload[0].payload.dateKey;
                    setSelectedDayKey(clickedKey);
                    if (onSelectDateFilter) onSelectDateFilter(clickedKey);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  dy={8}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  allowDecimals={false}
                  label={{ value: 'Daily Flights', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11, dy: 40 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[50, 100]}
                  tick={{ fill: '#0284c7', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  unit="%"
                  label={{ value: 'OTP %', angle: 90, position: 'insideRight', fill: '#0284c7', fontSize: 11, dy: 20 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  wrapperStyle={{ fontSize: '11px', fontWeight: 600 }}
                />
                <ReferenceLine
                  yAxisId="right"
                  y={85}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: '85% Target OTP', position: 'insideTopRight', fill: '#475569', fontSize: 10 }}
                />

                {/* Stacked volume bars */}
                <Bar
                  yAxisId="left"
                  dataKey="onTimeFlights"
                  name="On-Time Flights"
                  stackId="volume"
                  fill="#10b981"
                  radius={[0, 0, 0, 0]}
                  barSize={18}
                />
                <Bar
                  yAxisId="left"
                  dataKey="delayedFlights"
                  name="Delayed Flights"
                  stackId="volume"
                  fill="#f59e0b"
                  radius={[0, 0, 0, 0]}
                  barSize={18}
                />
                <Bar
                  yAxisId="left"
                  dataKey="canceledFlights"
                  name="Canceled Flights"
                  stackId="volume"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />

                {/* On-Time Performance Line */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="onTimeRate"
                  name="On-Time % (OTP)"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: '#0369a1', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </ComposedChart>
            ) : chartViewMode === 'volume' ? (
              <BarChart
                data={dailyData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  dy={8}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  wrapperStyle={{ fontSize: '11px', fontWeight: 600 }}
                />
                <Bar dataKey="onTimeFlights" name="On-Time" stackId="v" fill="#10b981" barSize={18} />
                <Bar dataKey="delayedFlights" name="Delayed" stackId="v" fill="#f59e0b" barSize={18} />
                <Bar dataKey="canceledFlights" name="Canceled" stackId="v" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            ) : chartViewMode === 'otp' ? (
              <AreaChart
                data={dailyData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="otpGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  dy={8}
                />
                <YAxis
                  domain={[50, 100]}
                  unit="%"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={85}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{ value: '85% Industry Target', position: 'insideTopLeft', fill: '#059669', fontSize: 11, fontWeight: 700 }}
                />
                <Area
                  type="monotone"
                  dataKey="onTimeRate"
                  name="On-Time Performance %"
                  stroke="#0284c7"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#otpGradient)"
                  dot={{ r: 3, fill: '#0284c7' }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            ) : (
              <BarChart
                data={dailyData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  dy={8}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  unit=" min"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  wrapperStyle={{ fontSize: '11px', fontWeight: 600 }}
                />
                <ReferenceLine
                  y={15}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={{ value: '15m IATA Buffer', position: 'insideTopLeft', fill: '#d97706', fontSize: 10 }}
                />
                <Bar
                  dataKey="avgDelayMinutes"
                  name="Average Delay (min)"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend notes & day selection feedback */}
        <div className="mt-2 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              <span>On-Time Turnaround (0m delay)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
              <span>Delayed Flight (&gt;0m delay)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
              <span>Canceled Sector</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-sky-600 inline-block" />
              <span>Punctuality Rate %</span>
            </span>
          </div>

          {selectedDayKey && (
            <div className="flex items-center gap-2 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 text-sky-800 text-[11px]">
              <span>Selected Day: <strong>{selectedDayKey}</strong></span>
              <button
                type="button"
                onClick={() => setSelectedDayKey(null)}
                className="text-sky-600 hover:text-sky-900 font-bold ml-1 cursor-pointer"
              >
                &times;
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
