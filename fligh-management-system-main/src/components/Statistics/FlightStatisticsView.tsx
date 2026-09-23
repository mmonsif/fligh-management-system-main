import React, { useState, useMemo } from 'react';
import { Flight } from '../../types';
import {
  formatUtcDateTime,
  formatMinutesToHHMM,
  getStatusBadgeStyle,
  getPassengerTotal,
} from '../../utils/flightUtils';
import { getDelayCodeInfo } from '../../data/iataDelayCodes';
import { FlightTrendsDashboard } from './FlightTrendsDashboard';
import { HoverDetail, StatisticsDetailDrawer } from './StatisticsHoverDetail';
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
  Search,
  ArrowUpDown,
  TrendingUp,
  Gauge,
} from 'lucide-react';

interface FlightStatisticsViewProps {
  flights: Flight[];
}

export const FlightStatisticsView: React.FC<FlightStatisticsViewProps> = ({ flights }) => {
  // Default range: current calendar month
  const defaultNow = new Date();
  const defaultFrom = new Date(Date.UTC(defaultNow.getUTCFullYear(), defaultNow.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const defaultTo = defaultNow.toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [activeRangePreset, setActiveRangePreset] = useState<string>('month');
  const [detailSearch, setDetailSearch] = useState('');
  const [detailSortKey, setDetailSortKey] = useState<'staUtc' | 'airlineName' | 'delayMinutesTotal' | 'totalPax'>('staUtc');
  const [detailSortDir, setDetailSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeReportTab, setActiveReportTab] = useState<
    'summary' | 'details' | 'airlines' | 'agencies' | 'destinations' | 'aircraft' | 'otp' | 'delays'
  >('summary');

  // Exploration drawer: holds the contributing flights behind a hovered card / row.
  const [detailDrilldown, setDetailDrilldown] = useState<{
    title: string;
    subtitle?: string;
    flights: Flight[];
  } | null>(null);

  const applyRangePreset = (preset: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date();
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();
    setActiveRangePreset(preset);

    if (preset === 'today') {
      setDateFrom(toIso(now));
      setDateTo(toIso(now));
    } else if (preset === 'week') {
      // Current ISO week, Monday-based
      const jsDay = now.getUTCDay(); // 0=Sun..6=Sat
      const offsetToMonday = jsDay === 0 ? 6 : jsDay - 1;
      const monday = new Date(Date.UTC(y, m, d - offsetToMonday));
      setDateFrom(toIso(monday));
      setDateTo(toIso(now));
    } else if (preset === 'month') {
      setDateFrom(toIso(new Date(Date.UTC(y, m, 1))));
      setDateTo(toIso(now));
    } else {
      setDateFrom(toIso(new Date(Date.UTC(y, 0, 1))));
      setDateTo(toIso(now));
    }
  };

  // Filter flights within selected date range
  const periodFlights = useMemo(() => {
    const fromTime = new Date(`${dateFrom}T00:00:00.000Z`).getTime();
    const toTime = new Date(`${dateTo}T23:59:59.999Z`).getTime();

    return flights.filter((f) => {
      const t = new Date(f.staUtc).getTime();
      return t >= fromTime && t <= toTime;
    });
  }, [flights, dateFrom, dateTo]);

  const completedPeriodFlights = useMemo(
    () => periodFlights.filter((f) => f.flightStatus === 'Completed'),
    [periodFlights]
  );

  // Contributing-flight sets reused by the KPI cards below.
  const completedFlightsList = completedPeriodFlights;
  const delayedFlightsList = useMemo(
    () => completedFlightsList.filter((f) => f.delays.some((d) => d.code && d.code.trim() !== '93')),
    [completedFlightsList]
  );
  const onTimeFlightsList = useMemo(
    () => completedFlightsList.filter((f) => !f.delays.some((d) => d.code && d.code.trim() !== '93')),
    [completedFlightsList]
  );
  const canceledFlightsList = useMemo(
    () => periodFlights.filter((f) => f.flightStatus === 'Canceled'),
    [periodFlights]
  );
  const inProgressFlightsList = useMemo(
    () => periodFlights.filter((f) => f.flightStatus !== 'Completed' && f.flightStatus !== 'Canceled'),
    [periodFlights]
  );

  // Search + sort the detailed flight log
  const detailFlights = useMemo(() => {
    const query = detailSearch.trim().toLowerCase();
    const filtered = query
      ? periodFlights.filter((f) =>
          [
            f.inboundFlightNumber,
            f.outboundFlightNumber,
            f.airlineName,
            f.agencyName,
            f.origin,
            f.destination,
            f.finalDestination,
            f.aircraftType,
            f.registration,
            f.flightStatus,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        )
      : periodFlights;

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (detailSortKey === 'staUtc') {
        cmp = new Date(a.staUtc).getTime() - new Date(b.staUtc).getTime();
      } else if (detailSortKey === 'delayMinutesTotal') {
        cmp = (a.delayMinutesTotal || 0) - (b.delayMinutesTotal || 0);
      } else if (detailSortKey === 'totalPax') {
        cmp = (a.totalPax || 0) - (b.totalPax || 0);
      } else {
        cmp = a.airlineName.localeCompare(b.airlineName);
      }
      return detailSortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [periodFlights, detailSearch, detailSortKey, detailSortDir]);

  const toggleDetailSort = (key: typeof detailSortKey) => {
    if (detailSortKey === key) {
      setDetailSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setDetailSortKey(key);
      setDetailSortDir('desc');
    }
  };

  // Aggregate Key Performance Indicators
  const stats = useMemo(() => {
    const totalFlights = periodFlights.length;
    const completedFlights = periodFlights.filter((f) => f.flightStatus === 'Completed').length;
    const canceledFlights = periodFlights.filter((f) => f.flightStatus === 'Canceled').length;

    // OTP by delay code: a completed flight is delayed when it carries any delay code
    // other than 93. Code 93 shared with another code still counts as delayed; only a
    // flight with code 93 alone (or no codes) is on-time.
    const evaluatedFlights = periodFlights.filter((f) => f.flightStatus === 'Completed');
    const delayedFlights = evaluatedFlights.filter((f) =>
      f.delays.some((d) => d.code && d.code.trim() !== '93')
    ).length;
    const onTimeFlights = evaluatedFlights.length - delayedFlights;

    const totalAdultPax = completedPeriodFlights.reduce((acc, f) => acc + (f.adultPax || 0), 0);
    const totalChildPax = completedPeriodFlights.reduce((acc, f) => acc + (f.childPax || 0), 0);
    const totalInfantPax = completedPeriodFlights.reduce((acc, f) => acc + (f.infantPax || 0), 0);
    const totalPaxOut = completedPeriodFlights.reduce(
      (acc, f) => acc + (f.totalPax ?? getPassengerTotal(f.adultPax, f.childPax, f.infantPax)),
      0
    );
    const totalIncomingAdultPax = completedPeriodFlights.reduce((acc, f) => acc + (f.incomingAdultPax || 0), 0);
    const totalIncomingChildPax = completedPeriodFlights.reduce((acc, f) => acc + (f.incomingChildPax || 0), 0);
    const totalIncomingInfantPax = completedPeriodFlights.reduce((acc, f) => acc + (f.incomingInfantPax || 0), 0);
    const totalPaxIn = completedPeriodFlights.reduce(
      (acc, f) => acc + (f.incomingTotalPax ?? getPassengerTotal(f.incomingAdultPax, f.incomingChildPax, f.incomingInfantPax)),
      0
    );
    const totalBagsOut = completedPeriodFlights.reduce((acc, f) => acc + (f.numberOfBags || 0), 0);
    const totalBagsIn = completedPeriodFlights.reduce((acc, f) => acc + (f.incomingNumberOfBags || 0), 0);

    const activeFlights = totalFlights - canceledFlights;
    const completionRate = activeFlights > 0 ? (completedFlights / activeFlights) * 100 : 0;
    const onTimeRate = evaluatedFlights.length > 0 ? (onTimeFlights / evaluatedFlights.length) * 100 : 0;
    const delayRate = activeFlights > 0 ? (delayedFlights / activeFlights) * 100 : 0;
    const cancelationRate = totalFlights > 0 ? (canceledFlights / totalFlights) * 100 : 0;

    // Delay minutes are the recorded delay-minutes of delayed (non-93-only) flights
    const totalDelayMinutes = evaluatedFlights.reduce(
      (acc, f) => acc + (f.delays.some((d) => d.code && d.code.trim() !== '93') ? (f.delayMinutesTotal || 0) : 0),
      0
    );
    const avgDelayMinutes = delayedFlights > 0 ? totalDelayMinutes / delayedFlights : 0;

    const flightsWithPax = completedPeriodFlights.filter((f) => (f.totalPax || 0) > 0);
    const avgPaxPerFlight = flightsWithPax.length > 0 ? totalPaxOut / flightsWithPax.length : 0;

    const flightsWithBags = completedPeriodFlights.filter((f) => (f.numberOfBags || 0) > 0);
    const avgBagsPerFlight = flightsWithBags.length > 0 ? totalBagsOut / flightsWithBags.length : 0;

    const uniqueAirlines = new Set(completedPeriodFlights.map((f) => f.airlineId)).size;
    const uniqueAgencies = new Set(completedPeriodFlights.map((f) => f.agencyId)).size;

    // Delay-minutes spread across active (non-canceled) flights
    const activeFlightsList = periodFlights.filter((f) => f.flightStatus !== 'Canceled');
    const totalDelayMinutesAll = activeFlightsList.reduce((acc, f) => acc + (f.delayMinutesTotal || 0), 0);
    // Average delay spread across every active flight (delay per movement), a standard ops KPI
    const avgDelayPerActiveFlight = activeFlightsList.length > 0 ? totalDelayMinutesAll / activeFlightsList.length : 0;
    const worstDelayMinutes = activeFlightsList.reduce(
      (max, f) => Math.max(max, f.delayMinutesTotal || 0),
      0
    );

    const inProgressFlights = periodFlights.filter(
      (f) => f.flightStatus !== 'Completed' && f.flightStatus !== 'Canceled'
    ).length;

    return {
      totalFlights,
      completedFlights,
      canceledFlights,
      delayedFlights,
      onTimeFlights,
      inProgressFlights,
      totalDelayMinutesAll,
      avgDelayPerActiveFlight,
      worstDelayMinutes,
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
      bagPaxRatio: totalPaxOut > 0 ? totalBagsOut / totalPaxOut : 0,
    };
  }, [periodFlights, completedPeriodFlights]);

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
        evaluated: number;
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
          evaluated: 0,
          canceled: 0,
          totalPax: 0,
          totalBags: 0,
        };
        map.set(f.airlineId, item);
      }
      item.total += 1;
      if (f.flightStatus === 'Completed') item.completed += 1;
      if (f.flightStatus === 'Canceled') item.canceled += 1;
      // OTP by delay code: delayed when a delay code other than 93 is present
      if (f.flightStatus === 'Completed') {
        item.evaluated += 1;
        if (f.delays.some((d) => d.code && d.code.trim() !== '93')) {
          item.delayed += 1;
        } else {
          item.onTime += 1;
        }
      }
      item.totalPax += f.totalPax ?? getPassengerTotal(f.adultPax, f.childPax, f.infantPax);
      item.totalBags += f.numberOfBags || 0;
    });

    return Array.from(map.values())
      .map((a) => {
        const active = a.total - a.canceled;
        const cancelationRate = a.total > 0 ? (a.canceled / a.total) * 100 : 0;
        const avgPax = active > 0 ? a.totalPax / active : 0;
        const avgBags = active > 0 ? a.totalBags / active : 0;
        const otpRate = a.evaluated > 0 ? (a.onTime / a.evaluated) * 100 : 0;
        return {
          ...a,
          cancelationRate,
          avgPax,
          avgBags,
          otpRate,
        };
      })
      .sort((a, b) => b.total - a.total);
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
        delayed: number;
        onTime: number;
        evaluated: number;
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
          delayed: 0,
          onTime: 0,
          evaluated: 0,
          totalPax: 0,
          totalBags: 0,
        };
        map.set(f.agencyId, item);
      }
      item.total += 1;
      if (f.flightStatus === 'Canceled') item.canceled += 1;
      if (f.flightStatus === 'Completed') item.completed += 1;
      // OTP by delay code: delayed when a delay code other than 93 is present
      if (f.flightStatus === 'Completed') {
        item.evaluated += 1;
        if (f.delays.some((d) => d.code && d.code.trim() !== '93')) {
          item.delayed += 1;
        } else {
          item.onTime += 1;
        }
      }
      item.totalPax += f.totalPax ?? getPassengerTotal(f.adultPax, f.childPax, f.infantPax);
      item.totalBags += f.numberOfBags || 0;
    });

    return Array.from(map.values())
      .map((a) => {
        const active = a.total - a.canceled;
        const avgPax = active > 0 ? a.totalPax / active : 0;
        const avgBags = active > 0 ? a.totalBags / active : 0;
        const otpRate = a.evaluated > 0 ? (a.onTime / a.evaluated) * 100 : 0;
        return {
          ...a,
          avgPax,
          avgBags,
          otpRate,
        };
      })
      .sort((a, b) => b.total - a.total);
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

  const destinationReport = useMemo(() => {
    const map = new Map<string, { flights: number; canceled: number; pax: number; bags: number }>();
    periodFlights.forEach((f) => {
      const destination = f.finalDestination || f.destination || 'Unknown';
      const item = map.get(destination) || { flights: 0, canceled: 0, pax: 0, bags: 0 };
      item.flights += 1;
      if (f.flightStatus === 'Canceled') item.canceled += 1;
      if (f.flightStatus === 'Completed') {
        item.pax += f.totalPax ?? getPassengerTotal(f.adultPax, f.childPax, f.infantPax);
        item.bags += f.numberOfBags || 0;
      }
      map.set(destination, item);
    });
    return Array.from(map.entries())
      .map(([destination, v]) => ({
        destination,
        flights: v.flights,
        canceled: v.canceled,
        pax: v.pax,
        bags: v.bags,
        avgPax: v.flights > 0 ? v.pax / v.flights : 0,
      }))
      .sort((a, b) => b.flights - a.flights);
  }, [periodFlights]);

  const aircraftReport = useMemo(() => {
    const map = new Map<string, { flights: number; canceled: number; pax: number; bags: number }>();
    periodFlights.forEach((f) => {
      const aircraftType = f.aircraftType || 'Unknown';
      const item = map.get(aircraftType) || { flights: 0, canceled: 0, pax: 0, bags: 0 };
      item.flights += 1;
      if (f.flightStatus === 'Canceled') item.canceled += 1;
      if (f.flightStatus === 'Completed') {
        item.pax += f.totalPax ?? getPassengerTotal(f.adultPax, f.childPax, f.infantPax);
        item.bags += f.numberOfBags || 0;
      }
      map.set(aircraftType, item);
    });
    return Array.from(map.entries())
      .map(([aircraftType, v]) => ({
        aircraftType,
        flights: v.flights,
        canceled: v.canceled,
        pax: v.pax,
        bags: v.bags,
        avgPax: v.flights > 0 ? v.pax / v.flights : 0,
      }))
      .sort((a, b) => b.flights - a.flights);
  }, [periodFlights]);

  const delayOtpReport = useMemo(() => {
    const codes = Array.from({ length: 9 }, (_, index) => String(31 + index));
    return codes.map((code) => {
      const affectedFlights = completedPeriodFlights.filter((f) => f.delays.some((d) => d.code === code));
      const totalMinutes = affectedFlights.reduce(
        (total, f) => total + f.delays.filter((d) => d.code === code).reduce((minutes, d) => minutes + d.minutes, 0),
        0
      );
      return {
        code,
        description: getDelayCodeInfo(code)?.description || 'IATA delay code',
        affectedFlights: affectedFlights.length,
        totalMinutes,
        flights: affectedFlights.length,
        otpImpact: completedPeriodFlights.length > 0 ? (affectedFlights.length / completedPeriodFlights.length) * 100 : 0,
      };
    });
  }, [completedPeriodFlights]);

  const otp31To39Rate = useMemo(() => {
    if (completedPeriodFlights.length === 0) return 0;
    const delayedBy31To39 = completedPeriodFlights.filter((f) =>
      f.delays.some((d) => Number(d.code) >= 31 && Number(d.code) <= 39)
    ).length;
    return ((completedPeriodFlights.length - delayedBy31To39) / completedPeriodFlights.length) * 100;
  }, [completedPeriodFlights]);

  // Delay-code lookup: which flights carry a given code (used by the delay/OTP reports).
  const flightsByDelayCode = (code: string) => completedFlightsList.filter((f) => f.delays.some((d) => d.code === code));

  const openDrilldown = (title: string, subtitle: string, drills: Flight[]) => {
    setDetailDrilldown({ title, subtitle, flights: drills });
  };

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
    csvContent += `Cancelation Rate,${stats.cancelationRate.toFixed(1)}%\r\n`;
    csvContent += `In-Progress Flights,${stats.inProgressFlights}\r\n`;
    csvContent += `Avg Delay per Active Flight (min),${stats.avgDelayPerActiveFlight.toFixed(1)}\r\n`;
    csvContent += `Worst Single Delay (min),${stats.worstDelayMinutes}\r\n`;
    csvContent += `Baggage / Pax Ratio,${stats.bagPaxRatio.toFixed(2)}\r\n\r\n`;

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
    csvContent += `\r\n`;

    // 5. Destination Breakdown
    csvContent += `5. DESTINATION BREAKDOWN\r\nDestination,Total Flights,Canceled,Passengers,Bags,Avg Pax/Flight\r\n`;
    destinationReport.forEach((d) => {
      csvContent += `"${d.destination}",${d.flights},${d.canceled},${d.pax},${d.bags},${d.avgPax.toFixed(1)}\r\n`;
    });
    csvContent += `\r\n`;

    // 6. Aircraft Breakdown
    csvContent += `6. AIRCRAFT BREAKDOWN\r\nAircraft Type,Total Flights,Canceled,Passengers,Bags,Avg Pax/Flight\r\n`;
    aircraftReport.forEach((a) => {
      csvContent += `"${a.aircraftType}",${a.flights},${a.canceled},${a.pax},${a.bags},${a.avgPax.toFixed(1)}\r\n`;
    });
    csvContent += `\r\n`;

    // 7. OTP by IATA codes 31-39
    csvContent += `7. OTP IMPACT (IATA CODES 31-39) - Overall OTP ${otp31To39Rate.toFixed(1)}%\r\nCode,Description,Affected Flights,Total Delay (min),Impact %\r\n`;
    delayOtpReport.forEach((o) => {
      csvContent += `"${o.code}","${o.description}",${o.affectedFlights},${o.totalMinutes},${o.otpImpact.toFixed(1)}%\r\n`;
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
              onChange={(e) => { setDateFrom(e.target.value); setActiveRangePreset('custom'); }}
              className="glass-input px-3 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setActiveRangePreset('custom'); }}
              className="glass-input px-3 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Quick range presets */}
          <div className="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl border-slate-200 dark:border-white/10">
            {([
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'Week' },
              { key: 'month', label: 'Month' },
              { key: 'year', label: 'Year' },
            ] as const).map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyRangePreset(preset.key)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeRangePreset === preset.key
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
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
        <HoverDetail
          title="Total Flights"
          subtitle={`All movements in ${dateFrom} → ${dateTo}`}
          metrics={[
            { label: 'Total', value: String(stats.totalFlights) },
            { label: 'Airlines', value: String(stats.uniqueAirlines) },
            { label: 'Agencies', value: String(stats.uniqueAgencies) },
          ]}
          flights={periodFlights}
          onExplore={() => openDrilldown('Total Flights', `${dateFrom} → ${dateTo}`, periodFlights)}
          className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Total Flights</span>
            <Plane className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{stats.totalFlights}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">In operational period</div>
        </HoverDetail>

        <HoverDetail
          title="Completed Flights"
          subtitle={`${stats.completionRate.toFixed(1)}% of active movements`}
          metrics={[
            { label: 'Completed', value: String(stats.completedFlights), tone: 'emerald' },
            { label: 'Pax out', value: stats.totalPaxOut.toLocaleString(), tone: 'sky' },
            { label: 'Bags out', value: stats.totalBagsOut.toLocaleString(), tone: 'sky' },
          ]}
          flights={completedFlightsList}
          onExplore={() => openDrilldown('Completed Flights', `${dateFrom} → ${dateTo}`, completedFlightsList)}
          className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-xl"
        >
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
        </HoverDetail>

        <HoverDetail
          title="Delayed Flights"
          subtitle="Completed flights carrying a non-93 delay code"
          metrics={[
            { label: 'Delayed', value: String(stats.delayedFlights), tone: 'amber' },
            { label: 'Total delay', value: `${stats.totalDelayMinutesAll} min`, tone: 'amber' },
            { label: 'Avg / flight', value: `${stats.avgDelayMinutes.toFixed(1)} min`, tone: 'amber' },
            { label: 'Worst', value: `${stats.worstDelayMinutes} min`, tone: 'rose' },
          ]}
          flights={delayedFlightsList}
          flightNote={(f) => (f.delayMinutesTotal ? `${f.delayMinutesTotal}m` : null)}
          onExplore={() => openDrilldown('Delayed Flights', 'Completed flights with a non-93 delay code', delayedFlightsList)}
          className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Delayed Flights</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
            {stats.delayedFlights}
          </div>
          <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold mt-1">
            Avg {stats.avgDelayMinutes.toFixed(1)} min / delayed flight
          </div>
        </HoverDetail>

        <HoverDetail
          title="On-Time Flights"
          subtitle="Completed flights with no non-93 delay code"
          metrics={[
            { label: 'On-time', value: String(stats.onTimeFlights), tone: 'sky' },
            { label: 'OTP rate', value: `${stats.onTimeRate.toFixed(1)}%`, tone: 'sky' },
            { label: 'Evaluated', value: String(stats.completedFlights) },
          ]}
          flights={onTimeFlightsList}
          onExplore={() => openDrilldown('On-Time Flights', 'Completed flights with no non-93 delay code', onTimeFlightsList)}
          className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">On-Time Flights</span>
            <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono tracking-tight">{stats.onTimeFlights}</div>
          <div className="text-[10px] text-sky-700 dark:text-sky-300 font-semibold mt-1">{stats.onTimeRate.toFixed(1)}% punctuality</div>
        </HoverDetail>

        <HoverDetail
          title="Canceled Flights"
          subtitle={`${stats.cancelationRate.toFixed(1)}% of all movements`}
          metrics={[
            { label: 'Canceled', value: String(stats.canceledFlights), tone: 'rose' },
            { label: 'Cancel rate', value: `${stats.cancelationRate.toFixed(1)}%`, tone: 'rose' },
          ]}
          flights={canceledFlightsList}
          onExplore={() => openDrilldown('Canceled Flights', `${dateFrom} → ${dateTo}`, canceledFlightsList)}
          className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Canceled</span>
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">{stats.canceledFlights}</div>
          <div className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold mt-1">
            {stats.cancelationRate.toFixed(1)}% cancel rate
          </div>
        </HoverDetail>

        <HoverDetail
          title="In-Progress Movements"
          subtitle="Not yet completed or canceled"
          metrics={[{ label: 'In progress', value: String(stats.inProgressFlights), tone: 'indigo' }]}
          flights={inProgressFlightsList}
          onExplore={() => openDrilldown('In-Progress Movements', `${dateFrom} → ${dateTo}`, inProgressFlightsList)}
          className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">In Progress</span>
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight">
            {stats.inProgressFlights}
          </div>
          <div className="text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold mt-1">
            Active / not yet completed
          </div>
        </HoverDetail>
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

        <div className="p-3.5 glass-card-sub rounded-xl border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Avg Delay per Active Flight</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">{stats.avgDelayPerActiveFlight.toFixed(1)} min</span>
          </div>
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="p-3.5 glass-card-sub rounded-xl border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Worst Single Delay</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">{stats.worstDelayMinutes} min</span>
          </div>
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
        </div>

        <div className="p-3.5 glass-card-sub rounded-xl border-slate-200 dark:border-white/10 flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Baggage / Pax Ratio</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">{stats.bagPaxRatio.toFixed(2)} bags/pax</span>
          </div>
          <Gauge className="w-5 h-5 text-sky-600 dark:text-sky-400" />
        </div>
      </div>

      {/* Recharts 30-Day Daily Flight Volume & On-Time Performance Dashboard */}
      <FlightTrendsDashboard
        flights={flights}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onSelectDateFilter={(selectedDate) => {
          setDateFrom(selectedDate);
          setDateTo(selectedDate);
          setActiveRangePreset('custom');
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
            onClick={() => setActiveReportTab('destinations')}
            className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeReportTab === 'destinations'
                ? 'border-sky-500 text-sky-800 dark:text-sky-200 bg-sky-50/80 dark:bg-sky-500/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Destination Breakdown ({destinationReport.length})
          </button>
          <button
            onClick={() => setActiveReportTab('aircraft')}
            className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeReportTab === 'aircraft'
                ? 'border-sky-500 text-sky-800 dark:text-sky-200 bg-sky-50/80 dark:bg-sky-500/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Aircraft Breakdown ({aircraftReport.length})
          </button>
          <button
            onClick={() => setActiveReportTab('otp')}
            className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeReportTab === 'otp'
                ? 'border-sky-500 text-sky-800 dark:text-sky-200 bg-sky-50/80 dark:bg-sky-500/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            OTP by Codes 31-39
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
                        {stats.bagPaxRatio.toFixed(2)} bags/pax
                      </td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-white/5">
                      <td className="p-3 font-sans font-semibold text-slate-700 dark:text-slate-300">🕒 Avg Delay per Active Flight</td>
                      <td className="p-3 text-right font-bold text-amber-700 dark:text-amber-300">{stats.avgDelayPerActiveFlight.toFixed(1)} min</td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-white/5">
                      <td className="p-3 font-sans font-semibold text-slate-700 dark:text-slate-300">🚦 Worst Single Delay</td>
                      <td className="p-3 text-right font-bold text-rose-700 dark:text-rose-300">{stats.worstDelayMinutes} min</td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-white/5">
                      <td className="p-3 font-sans font-semibold text-slate-700 dark:text-slate-300">⏳ In-Progress Movements</td>
                      <td className="p-3 text-right font-bold text-indigo-700 dark:text-indigo-300">{stats.inProgressFlights}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Detailed Flight Log */}
        {activeReportTab === 'details' && (
          <div>
            {/* Search & result count */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10 glass-card-sub">
              <label className="flex items-center gap-2 glass-input px-3 py-1.5 rounded-xl text-xs w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  placeholder="Search flight no, airline, agency, route, aircraft..."
                  className="w-full bg-transparent outline-none text-slate-900 dark:text-slate-100"
                />
                {detailSearch && (
                  <button
                    type="button"
                    onClick={() => setDetailSearch('')}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold cursor-pointer"
                    aria-label="Clear search"
                  >
                    &times;
                  </button>
                )}
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Showing <strong className="text-slate-700 dark:text-slate-200">{detailFlights.length}</strong> of {periodFlights.length} movements
              </span>
            </div>

            <div className="overflow-x-auto min-h-[360px] max-h-[540px] 2xl:max-h-[640px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/90 dark:bg-white/10 backdrop-blur-md text-slate-700 dark:text-slate-300 font-bold sticky top-0 border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="p-2.5">Inbound</th>
                    <th className="p-2.5">Outbound</th>
                    <th className="p-2.5 cursor-pointer select-none hover:text-sky-700 dark:hover:text-sky-300" onClick={() => toggleDetailSort('airlineName')}>
                      <span className="inline-flex items-center gap-1">Airline <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className="p-2.5">Agency</th>
                    <th className="p-2.5 cursor-pointer select-none hover:text-sky-700 dark:hover:text-sky-300" onClick={() => toggleDetailSort('staUtc')}>
                      <span className="inline-flex items-center gap-1">STA (UTC) <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className="p-2.5">STD (UTC)</th>
                    <th className="p-2.5">ATA (UTC)</th>
                    <th className="p-2.5">ATD (UTC)</th>
                    <th className="p-2.5 text-right cursor-pointer select-none hover:text-sky-700 dark:hover:text-sky-300" onClick={() => toggleDetailSort('delayMinutesTotal')}>
                      <span className="inline-flex items-center gap-1">Delay <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className="p-2.5 text-right cursor-pointer select-none hover:text-sky-700 dark:hover:text-sky-300" onClick={() => toggleDetailSort('totalPax')}>
                      <span className="inline-flex items-center gap-1">Pax <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className="p-2.5 text-right">Bags</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {detailFlights.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-10 text-center text-slate-500 dark:text-slate-400 text-xs">
                        {periodFlights.length === 0
                          ? 'No flights found in the selected period.'
                          : 'No flights match your search.'}
                      </td>
                    </tr>
                  ) : (
                    detailFlights.map((f) => {
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Airline Performance Report */}
        {activeReportTab === 'airlines' && (
          <div className="overflow-x-auto">
            <div className="border-b border-slate-200 bg-sky-50/70 px-4 py-3 text-xs text-slate-700 dark:border-white/10 dark:bg-sky-500/10 dark:text-slate-300">
              All movements in period (including non-completed) · {airlineReport.length} airline{airlineReport.length === 1 ? '' : 's'}
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="p-3">Airline Name</th>
                  <th className="p-3 text-right">Total Flights</th>
                  <th className="p-3 text-right">Completed</th>
                  <th className="p-3 text-right">Delayed</th>
                  <th className="p-3 text-right">On-Time</th>
                  <th className="p-3 text-right">OTP %</th>
                  <th className="p-3 text-right">Canceled</th>
                  <th className="p-3 text-right">Total Pax</th>
                  <th className="p-3 text-right">Total Bags</th>
                  <th className="p-3 text-right">Avg Pax/Flt</th>
                  <th className="p-3 text-right">Cancel Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                {airlineReport.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-500 dark:text-slate-400 text-xs">
                      No airline activity in the selected period.
                    </td>
                  </tr>
                ) : (
                  airlineReport.map((a, i) => (
                    <HoverDetail
                      key={i}
                      as="tr"
                      className="hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors"
                      title={a.airlineName}
                      subtitle="Airline performance contribution"
                      metrics={[
                        { label: 'Total', value: String(a.total) },
                        { label: 'Completed', value: String(a.completed), tone: 'emerald' },
                        { label: 'Delayed', value: String(a.delayed), tone: 'amber' },
                        { label: 'On-time', value: String(a.onTime), tone: 'sky' },
                        { label: 'OTP', value: `${a.otpRate.toFixed(1)}%`, tone: 'sky' },
                        { label: 'Canceled', value: String(a.canceled), tone: 'rose' },
                        { label: 'Pax', value: a.totalPax.toLocaleString() },
                        { label: 'Bags', value: a.totalBags.toLocaleString() },
                      ]}
                      flights={periodFlights.filter((f) => f.airlineName === a.airlineName)}
                      onExplore={() =>
                        openDrilldown(
                          `${a.airlineName} — Airline Performance`,
                          `${dateFrom} → ${dateTo} · ${a.total} movements`,
                          periodFlights.filter((f) => f.airlineName === a.airlineName)
                        )
                      }
                    >
                      <td className="p-3 font-sans font-bold text-slate-900 dark:text-slate-100">{a.airlineName}</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{a.total}</td>
                      <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">{a.completed}</td>
                      <td className="p-3 text-right text-amber-600 dark:text-amber-400">{a.delayed}</td>
                      <td className="p-3 text-right text-sky-600 dark:text-sky-400">{a.onTime}</td>
                      <td className={`p-3 text-right font-bold ${a.otpRate >= 85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{a.otpRate.toFixed(1)}%</td>
                      <td className="p-3 text-right text-rose-600 dark:text-rose-400">{a.canceled}</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200">{a.totalPax.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200">{a.totalBags.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200">{a.avgPax.toFixed(1)}</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200">{a.cancelationRate.toFixed(1)}%</td>
                    </HoverDetail>
                  ))
                )}
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
                  <th className="p-3 text-right">Delayed</th>
                  <th className="p-3 text-right">Canceled</th>
                  <th className="p-3 text-right">Total Passengers</th>
                  <th className="p-3 text-right">Total Bags</th>
                  <th className="p-3 text-right">Avg Pax/Flight</th>
                  <th className="p-3 text-right">Avg Bags/Flight</th>
                  <th className="p-3 text-right">On-Time Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                {agencyReport.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-500 dark:text-slate-400 text-xs">
                      No agency activity in the selected period.
                    </td>
                  </tr>
                ) : (
                  agencyReport.map((g, i) => (
                    <HoverDetail
                      key={i}
                      as="tr"
                      className="hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors"
                      title={g.agencyName}
                      subtitle="Agency handling contribution"
                      metrics={[
                        { label: 'Total', value: String(g.total) },
                        { label: 'Completed', value: String(g.completed), tone: 'emerald' },
                        { label: 'Delayed', value: String(g.delayed), tone: 'amber' },
                        { label: 'Canceled', value: String(g.canceled), tone: 'rose' },
                        { label: 'On-time', value: `${g.otpRate.toFixed(1)}%`, tone: 'sky' },
                        { label: 'Pax', value: g.totalPax.toLocaleString() },
                        { label: 'Bags', value: g.totalBags.toLocaleString() },
                        { label: 'Avg pax/flt', value: g.avgPax.toFixed(1) },
                      ]}
                      flights={periodFlights.filter((f) => f.agencyName === g.agencyName)}
                      onExplore={() =>
                        openDrilldown(
                          `${g.agencyName} — Agency Handling`,
                          `${dateFrom} → ${dateTo} · ${g.total} movements`,
                          periodFlights.filter((f) => f.agencyName === g.agencyName)
                        )
                      }
                    >
                      <td className="p-3 font-sans font-bold text-slate-900 dark:text-slate-100">{g.agencyName}</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{g.total}</td>
                      <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">{g.completed}</td>
                      <td className="p-3 text-right text-amber-600 dark:text-amber-400">{g.delayed}</td>
                      <td className="p-3 text-right text-rose-600 dark:text-rose-400">{g.canceled}</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200">{g.totalPax.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200">{g.totalBags.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200">{g.avgPax.toFixed(1)}</td>
                      <td className="p-3 text-right text-slate-800 dark:text-slate-200">{g.avgBags.toFixed(1)}</td>
                      <td className={`p-3 text-right font-bold ${g.otpRate >= 85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{g.otpRate.toFixed(1)}%</td>
                    </HoverDetail>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeReportTab === 'destinations' && (
          <div className="overflow-x-auto">
            <div className="border-b border-slate-200 bg-sky-50/70 px-4 py-3 text-xs text-slate-700 dark:border-white/10 dark:bg-sky-500/10 dark:text-slate-300">
              All movements in period · {periodFlights.length} flights · {destinationReport.length} destinations
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="p-3">Destination</th>
                  <th className="p-3 text-right">Total Flights</th>
                  <th className="p-3 text-right">Canceled</th>
                  <th className="p-3 text-right">Passengers</th>
                  <th className="p-3 text-right">Bags</th>
                  <th className="p-3 text-right">Avg Pax/Flight</th>
                  <th className="p-3 text-right w-40">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                {destinationReport.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400 text-xs">
                      No destination activity in the selected period.
                    </td>
                  </tr>
                ) : (
                  destinationReport.map((item) => {
                    const share = periodFlights.length ? (item.flights / periodFlights.length) * 100 : 0;
                    return (
                      <tr key={item.destination} className="hover:bg-slate-100/60 dark:hover:bg-white/5">
                        <td className="p-3 font-sans font-bold text-slate-900 dark:text-slate-100">{item.destination}</td>
                        <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{item.flights}</td>
                        <td className="p-3 text-right text-rose-600 dark:text-rose-400">{item.canceled}</td>
                        <td className="p-3 text-right text-slate-800 dark:text-slate-200">{item.pax.toLocaleString()}</td>
                        <td className="p-3 text-right text-slate-800 dark:text-slate-200">{item.bags.toLocaleString()}</td>
                        <td className="p-3 text-right text-slate-800 dark:text-slate-200">{item.avgPax.toFixed(1)}</td>
                        <td className="p-3 text-right text-sky-700 dark:text-sky-300">
                          <span className="inline-flex items-center justify-end gap-2 w-full">
                            <span className="hidden sm:inline-block h-1.5 rounded-full bg-sky-200 dark:bg-sky-500/30 overflow-hidden w-16 align-middle">
                              <span className="block h-full bg-sky-500" style={{ width: `${Math.min(100, share)}%` }} />
                            </span>
                            {share.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeReportTab === 'aircraft' && (
          <div className="overflow-x-auto">
            <div className="border-b border-slate-200 bg-sky-50/70 px-4 py-3 text-xs text-slate-700 dark:border-white/10 dark:bg-sky-500/10 dark:text-slate-300">
              All movements in period · {periodFlights.length} flights · {aircraftReport.length} aircraft types
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="p-3">Aircraft Type</th>
                  <th className="p-3 text-right">Total Flights</th>
                  <th className="p-3 text-right">Canceled</th>
                  <th className="p-3 text-right">Passengers</th>
                  <th className="p-3 text-right">Bags</th>
                  <th className="p-3 text-right">Avg Pax/Flight</th>
                  <th className="p-3 text-right w-40">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                {aircraftReport.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400 text-xs">
                      No aircraft activity in the selected period.
                    </td>
                  </tr>
                ) : (
                  aircraftReport.map((item) => {
                    const share = periodFlights.length ? (item.flights / periodFlights.length) * 100 : 0;
                    return (
                      <HoverDetail
                        key={item.aircraftType}
                        as="tr"
                        className="hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors"
                        title={`${item.aircraftType} — Aircraft Breakdown`}
                        subtitle="Fleet type contribution"
                        metrics={[
                          { label: 'Flights', value: String(item.flights) },
                          { label: 'Canceled', value: String(item.canceled), tone: 'rose' },
                          { label: 'Passengers', value: item.pax.toLocaleString() },
                          { label: 'Bags', value: item.bags.toLocaleString() },
                          { label: 'Avg pax/flt', value: item.avgPax.toFixed(1) },
                          { label: 'Share', value: `${share.toFixed(1)}%`, tone: 'sky' },
                        ]}
                        flights={periodFlights.filter((f) => (f.aircraftType || 'Unknown') === item.aircraftType)}
                        onExplore={() =>
                          openDrilldown(
                            `${item.aircraftType} — Aircraft Breakdown`,
                            `${dateFrom} → ${dateTo} · ${item.flights} movements`,
                            periodFlights.filter((f) => (f.aircraftType || 'Unknown') === item.aircraftType)
                          )
                        }
                      >
                        <td className="p-3 font-sans font-bold text-slate-900 dark:text-slate-100">{item.aircraftType}</td>
                        <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{item.flights}</td>
                        <td className="p-3 text-right text-rose-600 dark:text-rose-400">{item.canceled}</td>
                        <td className="p-3 text-right text-slate-800 dark:text-slate-200">{item.pax.toLocaleString()}</td>
                        <td className="p-3 text-right text-slate-800 dark:text-slate-200">{item.bags.toLocaleString()}</td>
                        <td className="p-3 text-right text-slate-800 dark:text-slate-200">{item.avgPax.toFixed(1)}</td>
                        <td className="p-3 text-right text-sky-700 dark:text-sky-300">
                          <span className="inline-flex items-center justify-end gap-2 w-full">
                            <span className="hidden sm:inline-block h-1.5 rounded-full bg-sky-200 dark:bg-sky-500/30 overflow-hidden w-16 align-middle">
                              <span className="block h-full bg-sky-500" style={{ width: `${Math.min(100, share)}%` }} />
                            </span>
                            {share.toFixed(1)}%
                          </span>
                        </td>
                      </HoverDetail>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeReportTab === 'otp' && (
          <div className="overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-sky-50/70 px-4 py-3 text-xs dark:border-white/10 dark:bg-sky-500/10">
              <span className="text-slate-700 dark:text-slate-300">Completed flights only · codes 31-39 (ground handling / technical) excluded from this OTP view</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300">OTP (31-39 basis): {otp31To39Rate.toFixed(1)}%</span>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
                <tr><th className="p-3">Code</th><th className="p-3">Description</th><th className="p-3 text-right">Affected Flights</th><th className="p-3 text-right">Total Delay</th><th className="p-3 text-right">Impact</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {delayOtpReport.map((item) => (
                  <HoverDetail
                    key={item.code}
                    as="tr"
                    className="hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors"
                    title={`OTP Code ${item.code}`}
                    subtitle={item.description}
                    metrics={[
                      { label: 'Affected', value: String(item.affectedFlights), tone: 'amber' },
                      { label: 'Total delay', value: `${item.totalMinutes} min`, tone: 'amber' },
                      { label: 'OTP impact', value: `${item.otpImpact.toFixed(1)}%`, tone: 'rose' },
                    ]}
                    flights={flightsByDelayCode(item.code)}
                    flightNote={(f) => {
                      const mins = f.delays.filter((x) => x.code === item.code).reduce((s, x) => s + (x.minutes || 0), 0);
                      return mins ? `${mins}m` : null;
                    }}
                    onExplore={() =>
                      openDrilldown(
                        `OTP Code ${item.code} — ${item.description}`,
                        `${item.affectedFlights} affected flights · ${item.totalMinutes} min · ${item.otpImpact.toFixed(1)}% impact`,
                        flightsByDelayCode(item.code)
                      )
                    }
                  >
                    <td className="p-3 font-mono font-bold text-amber-700 dark:text-amber-400">{item.code}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{item.description}</td>
                    <td className="p-3 text-right font-mono">{item.flights}</td>
                    <td className="p-3 text-right font-mono">{item.totalMinutes} min</td>
                    <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-300">{item.otpImpact.toFixed(1)}%</td>
                  </HoverDetail>
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
                    <HoverDetail
                      key={i}
                      as="tr"
                      className="hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors"
                      title={`Delay Code ${d.code}`}
                      subtitle={d.description}
                      metrics={[
                        { label: 'Occurrences', value: String(d.occurrences), tone: 'amber' },
                        { label: 'Total', value: `${d.totalMinutes} min`, tone: 'amber' },
                        { label: 'Avg', value: `${d.avgMinutes.toFixed(1)} min` },
                        { label: 'Category', value: d.category },
                      ]}
                      flights={flightsByDelayCode(d.code)}
                      flightNote={(f) => {
                        const mins = f.delays.filter((x) => x.code === d.code).reduce((s, x) => s + (x.minutes || 0), 0);
                        return mins ? `${mins}m` : null;
                      }}
                      onExplore={() =>
                        openDrilldown(
                          `Delay Code ${d.code} — ${d.category}`,
                          `${d.description} · ${d.occurrences} occurrences · ${d.totalMinutes} min`,
                          flightsByDelayCode(d.code)
                        )
                      }
                    >
                      <td className="p-3 font-mono font-bold text-amber-700 dark:text-amber-400">{d.code}</td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{d.category}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{d.description}</td>
                      <td className="p-3 font-mono text-right text-slate-800 dark:text-slate-200">{d.occurrences}</td>
                      <td className="p-3 font-mono text-right font-bold text-amber-700 dark:text-amber-400">
                        {d.totalMinutes} min ({formatMinutesToHHMM(d.totalMinutes)})
                      </td>
                      <td className="p-3 font-mono text-right text-slate-800 dark:text-slate-200">{d.avgMinutes.toFixed(1)} min</td>
                    </HoverDetail>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contributing-flights exploration drawer (opened from any hovered card / row) */}
      <StatisticsDetailDrawer
        open={detailDrilldown !== null}
        onClose={() => setDetailDrilldown(null)}
        title={detailDrilldown?.title || ''}
        subtitle={detailDrilldown?.subtitle}
        flights={detailDrilldown?.flights || []}
      />
    </div>
  );
};
