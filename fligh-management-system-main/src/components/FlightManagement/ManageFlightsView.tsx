import React, { useState, useMemo } from 'react';
import { Flight, Airline, Agency, FlightStatus } from '../../types';
import {
  formatUtcDateTime,
  toUtcInputString,
  parseDateTimeLocalAsUtc,
  formatMinutesToHHMM,
  parseHHMMToMinutes,
  getStatusBadgeStyle,
  exportFlightsToCsv,
  calculateFlightStatus,
  formatFlightRoute,
  isTriangleFlight,
  parseRouteString,
  getPassengerTotal,
} from '../../utils/flightUtils';
import { CancelFlightModal } from './CancelFlightModal';
import { TripFileModal } from './TripFileModal';
import { IataDelayPickerModal } from '../Common/IataDelayPickerModal';
import {
  Plus,
  Trash2,
  XCircle,
  FileText,
  FileSpreadsheet,
  Printer,
  RotateCw,
  Search,
  Filter,
  Check,
  Calendar,
  Clock,
  Plane,
  AlertTriangle,
  ArrowRight,
  Navigation,
  Repeat,
} from 'lucide-react';

interface ManageFlightsViewProps {
  flights: Flight[];
  airlines: Airline[];
  agencies: Agency[];
  canAddFlight: boolean;
  onAddFlight: (flightData: Omit<Flight, 'flightId' | 'flightStatus' | 'delayMinutesTotal'>) => void;
  onUpdateSchedule: (flightId: number, scheduleData: Partial<Flight>) => void;
  onUpdateActuals: (flightId: number, actualsData: Partial<Flight>) => void;
  onUpdateDelays: (flightId: number, delays: Flight['delays']) => void;
  onCancelFlight: (flightId: number, reason: string) => void;
  onDeleteFlight: (flightId: number) => void;
  onRefresh: () => void;
}

export const ManageFlightsView: React.FC<ManageFlightsViewProps> = ({
  flights,
  airlines,
  agencies,
  canAddFlight,
  onAddFlight,
  onUpdateSchedule,
  onUpdateActuals,
  onUpdateDelays,
  onCancelFlight,
  onDeleteFlight,
  onRefresh,
}) => {
  // Selection
  const [selectedFlightId, setSelectedFlightId] = useState<number | null>(flights[0]?.flightId ?? null);
  const [activeBottomTab, setActiveBottomTab] = useState<'schedule' | 'actuals' | 'delays'>('schedule');

  // Filter state
  const defaultFrom = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 16);
  const defaultTo = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16);
  const [filterFrom, setFilterFrom] = useState<string>(defaultFrom);
  const [filterTo, setFilterTo] = useState<string>(defaultTo);
  const [isFilterActive, setIsFilterActive] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isTripFileModalOpen, setIsTripFileModalOpen] = useState(false);
  const [isAddFlightModalOpen, setIsAddFlightModalOpen] = useState(false);
  const [isDelayPickerOpen, setIsDelayPickerOpen] = useState(false);
  const [activeDelayTarget, setActiveDelayTarget] = useState<1 | 2 | 3>(1);

  // Form states for Schedule Tab
  const [txtInbound, setTxtInbound] = useState('');
  const [txtOutbound, setTxtOutbound] = useState('');
  const [staUtc, setStaUtc] = useState(new Date().toISOString().slice(0, 16));
  const [stdUtc, setStdUtc] = useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  const [txtOrigin, setTxtOrigin] = useState('');
  const [txtDestination, setTxtDestination] = useState('');
  const [txtVia, setTxtVia] = useState('');
  const [txtFinalDestination, setTxtFinalDestination] = useState('');
  const [routeQuickInput, setRouteQuickInput] = useState('');
  const [filterTriangleOnly, setFilterTriangleOnly] = useState(false);
  const [selectedAirlineId, setSelectedAirlineId] = useState<number>(airlines[0]?.airlineId ?? 1);
  const [selectedAgencyId, setSelectedAgencyId] = useState<number>(agencies[0]?.agencyId ?? 1);
  const [txtAircraftType, setTxtAircraftType] = useState('');

  // Form states for Actuals Tab
  const [chkATA, setChkATA] = useState(false);
  const [chkATD, setChkATD] = useState(false);
  const [ataUtc, setAtaUtc] = useState(new Date().toISOString().slice(0, 16));
  const [atdUtc, setAtdUtc] = useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  const [txtBags, setTxtBags] = useState('');
  const [txtIncomingBags, setTxtIncomingBags] = useState('');
  const [txtAdultPax, setTxtAdultPax] = useState('');
  const [txtChildPax, setTxtChildPax] = useState('');
  const [txtInfantPax, setTxtInfantPax] = useState('');
  const [txtIncomingAdultPax, setTxtIncomingAdultPax] = useState('');
  const [txtIncomingChildPax, setTxtIncomingChildPax] = useState('');
  const [txtIncomingInfantPax, setTxtIncomingInfantPax] = useState('');
  const [txtRegistration, setTxtRegistration] = useState('');
  const [txtRemarks, setTxtRemarks] = useState('');

  // Form states for Delays Tab
  const [delayCode1, setDelayCode1] = useState('');
  const [delayMinutes1, setDelayMinutes1] = useState('');
  const [delayCode2, setDelayCode2] = useState('');
  const [delayMinutes2, setDelayMinutes2] = useState('');
  const [delayCode3, setDelayCode3] = useState('');
  const [delayMinutes3, setDelayMinutes3] = useState('');

  // Notification / Message box toast
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' | 'info' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; confirmText?: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' | 'info' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const selectedFlight = useMemo(
    () => flights.find((f) => f.flightId === selectedFlightId) || null,
    [flights, selectedFlightId]
  );

  const isSelectedFlightCanceled = selectedFlight?.flightStatus === 'Canceled';

  // Load selected flight details into form fields whenever selectedFlight changes
  const loadFlightIntoForm = (flight: Flight | null) => {
    if (!flight) {
      // Clear fields
      setTxtInbound('');
      setTxtOutbound('');
      setTxtOrigin('');
      setTxtDestination('');
      setTxtVia('');
      setTxtFinalDestination('');
      setRouteQuickInput('');
      setTxtAircraftType('');
      setChkATA(false);
      setChkATD(false);
      setTxtBags('');
      setTxtIncomingBags('');
      setTxtAdultPax('');
      setTxtChildPax('');
      setTxtInfantPax('');
      setTxtIncomingAdultPax('');
      setTxtIncomingChildPax('');
      setTxtIncomingInfantPax('');
      setTxtRegistration('');
      setTxtRemarks('');
      setDelayCode1('');
      setDelayMinutes1('');
      setDelayCode2('');
      setDelayMinutes2('');
      setDelayCode3('');
      setDelayMinutes3('');
      return;
    }

    setTxtInbound(flight.inboundFlightNumber || '');
    setTxtOutbound(flight.outboundFlightNumber || '');
    setTxtOrigin(flight.origin || '');
    setTxtDestination(flight.destination || '');
    setTxtVia(flight.via || '');
    setTxtFinalDestination(flight.finalDestination || '');
    setTxtAircraftType(flight.aircraftType || '');
    setSelectedAirlineId(flight.airlineId || airlines[0]?.airlineId || 1);
    setSelectedAgencyId(flight.agencyId || agencies[0]?.agencyId || 1);

    if (flight.ataUtc) {
      setChkATA(true);
      setAtaUtc(toUtcInputString(flight.ataUtc));
    } else {
      setChkATA(false);
    }

    if (flight.atdUtc) {
      setChkATD(true);
      setAtdUtc(toUtcInputString(flight.atdUtc));
    } else {
      setChkATD(false);
    }

    setTxtBags(flight.numberOfBags !== null ? String(flight.numberOfBags) : '');
    setTxtIncomingBags(flight.incomingNumberOfBags !== null && flight.incomingNumberOfBags !== undefined ? String(flight.incomingNumberOfBags) : '');
    setTxtAdultPax(flight.adultPax !== null ? String(flight.adultPax) : '');
    setTxtChildPax(flight.childPax !== null ? String(flight.childPax) : '');
    setTxtInfantPax(flight.infantPax !== null ? String(flight.infantPax) : '');
    setTxtIncomingAdultPax(flight.incomingAdultPax !== null && flight.incomingAdultPax !== undefined ? String(flight.incomingAdultPax) : '');
    setTxtIncomingChildPax(flight.incomingChildPax !== null && flight.incomingChildPax !== undefined ? String(flight.incomingChildPax) : '');
    setTxtIncomingInfantPax(flight.incomingInfantPax !== null && flight.incomingInfantPax !== undefined ? String(flight.incomingInfantPax) : '');
    setTxtRegistration(flight.registration || '');
    setTxtRemarks(flight.remarks || '');

    // Delays
    setDelayCode1(flight.delays[0]?.code || '');
    setDelayMinutes1(flight.delays[0] ? formatMinutesToHHMM(flight.delays[0].minutes) : '');
    setDelayCode2(flight.delays[1]?.code || '');
    setDelayMinutes2(flight.delays[1] ? formatMinutesToHHMM(flight.delays[1].minutes) : '');
    setDelayCode3(flight.delays[2]?.code || '');
    setDelayMinutes3(flight.delays[2] ? formatMinutesToHHMM(flight.delays[2].minutes) : '');
  };

  // When selectedFlight changes, populate
  React.useEffect(() => {
    if (selectedFlight) {
      loadFlightIntoForm(selectedFlight);
    }
  }, [selectedFlightId]);

  // Route Quick Input parser & Triangle Flight setup helper
  const handleApplyRouteQuickInput = (inputStr?: string) => {
    const target = inputStr !== undefined ? inputStr : routeQuickInput;
    if (!target || !target.trim()) {
      showToast('Please enter a route string (e.g. LHR-CAI-HRG-LHR).', 'warning');
      return;
    }
    const parsed = parseRouteString(target);
    if (parsed.origin) setTxtOrigin(parsed.origin);
    if (parsed.destination) setTxtDestination(parsed.destination);
    if (parsed.via) {
      setTxtVia(parsed.via);
    } else {
      setTxtVia('');
    }
    if (parsed.finalDestination) {
      setTxtFinalDestination(parsed.finalDestination);
    } else if (parsed.via && parsed.origin) {
      setTxtFinalDestination(parsed.origin);
    } else if (parsed.destination) {
      setTxtFinalDestination(parsed.destination);
    }
    showToast(`Route applied: ${target.toUpperCase()}`, 'success');
  };

  const handleMakeTriangleFlight = () => {
    const o = txtOrigin.trim().toUpperCase() || 'LHR';
    const d = txtDestination.trim().toUpperCase() || 'CAI';
    const v = txtVia.trim().toUpperCase() || 'HRG';
    setTxtOrigin(o);
    setTxtDestination(d);
    setTxtVia(v);
    setTxtFinalDestination(o); // Return to origin completes the triangle loop
    setRouteQuickInput(`${o}-${d}-${v}-${o}`);
    showToast(`Configured Triangle Routing: ${o}-${d}-${v}-${o}`, 'success');
  };

  // Compute total pax in actuals tab
  const computedTotalPax = useMemo(() => {
    const a = parseInt(txtAdultPax, 10) || 0;
    const c = parseInt(txtChildPax, 10) || 0;
    const i = parseInt(txtInfantPax, 10) || 0;
    return a + c + i;
  }, [txtAdultPax, txtChildPax, txtInfantPax]);

  const computedIncomingTotalPax = useMemo(() => {
    const a = parseInt(txtIncomingAdultPax, 10) || 0;
    const c = parseInt(txtIncomingChildPax, 10) || 0;
    const i = parseInt(txtIncomingInfantPax, 10) || 0;
    return a + c + i;
  }, [txtIncomingAdultPax, txtIncomingChildPax, txtIncomingInfantPax]);

  // Filtered flights list
  const filteredFlights = useMemo(() => {
    return flights.filter((f) => {
      // Date range filter
      if (isFilterActive) {
        const flightTime = new Date(f.staUtc).getTime();
        const fromTime = new Date(filterFrom).getTime();
        const toTime = new Date(filterTo).getTime();
        if (flightTime < fromTime || flightTime > toTime) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'ALL' && f.flightStatus !== statusFilter) {
        return false;
      }

      // Triangle route only filter
      if (filterTriangleOnly && !isTriangleFlight(f)) {
        return false;
      }

      // Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const fullRoute = formatFlightRoute(f).toLowerCase();
        const match =
          f.inboundFlightNumber.toLowerCase().includes(term) ||
          f.outboundFlightNumber.toLowerCase().includes(term) ||
          f.airlineName.toLowerCase().includes(term) ||
          f.agencyName.toLowerCase().includes(term) ||
          f.origin.toLowerCase().includes(term) ||
          f.destination.toLowerCase().includes(term) ||
          (f.via && f.via.toLowerCase().includes(term)) ||
          f.finalDestination.toLowerCase().includes(term) ||
          fullRoute.includes(term) ||
          (term === 'triangle' && isTriangleFlight(f)) ||
          f.registration.toLowerCase().includes(term) ||
          f.aircraftType.toLowerCase().includes(term);
        if (!match) return false;
      }

      return true;
    });
  }, [flights, isFilterActive, filterFrom, filterTo, statusFilter, filterTriangleOnly, searchTerm]);

  // Handle Add Flight
  const handleAddFlightClick = () => {
    if (!txtInbound.trim()) {
      showToast('Please enter an inbound flight number.', 'warning');
      return;
    }
    if (!txtOutbound.trim()) {
      showToast('Please enter an outbound flight number.', 'warning');
      return;
    }

    const airline = airlines.find((a) => a.airlineId === selectedAirlineId);
    const agency = agencies.find((a) => a.agencyId === selectedAgencyId);

    const orig = txtOrigin.trim().toUpperCase() || 'LHR';
    const dest = txtDestination.trim().toUpperCase() || 'CAI';
    const viaVal = txtVia.trim().toUpperCase() || undefined;
    const finalDest =
      txtFinalDestination.trim().toUpperCase() ||
      (viaVal ? orig : dest) ||
      'LHR';

    onAddFlight({
      inboundFlightNumber: txtInbound.trim().toUpperCase(),
      outboundFlightNumber: txtOutbound.trim().toUpperCase(),
      staUtc: parseDateTimeLocalAsUtc(staUtc) || new Date().toISOString(),
      stdUtc: parseDateTimeLocalAsUtc(stdUtc) || new Date().toISOString(),
      ataUtc: chkATA ? parseDateTimeLocalAsUtc(ataUtc) : null,
      atdUtc: chkATD ? parseDateTimeLocalAsUtc(atdUtc) : null,
      origin: orig,
      destination: dest,
      via: viaVal,
      finalDestination: finalDest,
      airlineId: selectedAirlineId,
      airlineName: airline?.airlineName || 'Unknown Airline',
      agencyId: selectedAgencyId,
      agencyName: agency?.agencyName || 'Standard Handling',
      aircraftType: txtAircraftType.trim().toUpperCase() || 'A320',
      registration: txtRegistration.trim().toUpperCase(),
      remarks: txtRemarks.trim(),
      numberOfBags: txtBags ? parseInt(txtBags, 10) : null,
      incomingNumberOfBags: txtIncomingBags ? parseInt(txtIncomingBags, 10) : null,
      adultPax: txtAdultPax ? parseInt(txtAdultPax, 10) : null,
      childPax: txtChildPax ? parseInt(txtChildPax, 10) : null,
      infantPax: txtInfantPax ? parseInt(txtInfantPax, 10) : null,
      totalPax: computedTotalPax > 0 ? computedTotalPax : null,
      incomingAdultPax: txtIncomingAdultPax ? parseInt(txtIncomingAdultPax, 10) : null,
      incomingChildPax: txtIncomingChildPax ? parseInt(txtIncomingChildPax, 10) : null,
      incomingInfantPax: txtIncomingInfantPax ? parseInt(txtIncomingInfantPax, 10) : null,
      incomingTotalPax: computedIncomingTotalPax > 0 ? computedIncomingTotalPax : null,
      delays: [],
    });

    showToast(`Flight ${txtInbound.toUpperCase()}/${txtOutbound.toUpperCase()} added successfully!`, 'success');
    setIsAddFlightModalOpen(false);
  };

  // Handle Update Schedule
  const handleUpdateScheduleClick = () => {
    if (!selectedFlightId) {
      showToast('Please select a flight to update.', 'info');
      return;
    }
    if (isSelectedFlightCanceled) {
      showToast('Cannot modify a canceled flight.', 'warning');
      return;
    }

    const airline = airlines.find((a) => a.airlineId === selectedAirlineId);
    const agency = agencies.find((a) => a.agencyId === selectedAgencyId);

    onUpdateSchedule(selectedFlightId, {
      inboundFlightNumber: txtInbound.trim().toUpperCase(),
      outboundFlightNumber: txtOutbound.trim().toUpperCase(),
      staUtc: parseDateTimeLocalAsUtc(staUtc) || new Date().toISOString(),
      stdUtc: parseDateTimeLocalAsUtc(stdUtc) || new Date().toISOString(),
      origin: txtOrigin.trim().toUpperCase(),
      destination: txtDestination.trim().toUpperCase(),
      via: txtVia.trim().toUpperCase() || undefined,
      finalDestination: txtFinalDestination.trim().toUpperCase(),
      airlineId: selectedAirlineId,
      airlineName: airline?.airlineName || selectedFlight?.airlineName,
      agencyId: selectedAgencyId,
      agencyName: agency?.agencyName || selectedFlight?.agencyName,
      aircraftType: txtAircraftType.trim().toUpperCase(),
    });

    showToast('Flight schedule updated successfully.', 'success');
  };

  // Handle Update Actuals
  const handleUpdateActualsClick = () => {
    if (!selectedFlightId) {
      showToast('Please select a flight to update actuals.', 'info');
      return;
    }
    if (isSelectedFlightCanceled) {
      showToast('Cannot modify actuals for a canceled flight.', 'warning');
      return;
    }

    onUpdateActuals(selectedFlightId, {
      ataUtc: chkATA ? parseDateTimeLocalAsUtc(ataUtc) : null,
      atdUtc: chkATD ? parseDateTimeLocalAsUtc(atdUtc) : null,
      numberOfBags: txtBags.trim() ? parseInt(txtBags, 10) : null,
      incomingNumberOfBags: txtIncomingBags.trim() ? parseInt(txtIncomingBags, 10) : null,
      adultPax: txtAdultPax.trim() ? parseInt(txtAdultPax, 10) : null,
      childPax: txtChildPax.trim() ? parseInt(txtChildPax, 10) : null,
      infantPax: txtInfantPax.trim() ? parseInt(txtInfantPax, 10) : null,
      totalPax: computedTotalPax > 0 ? computedTotalPax : null,
      incomingAdultPax: txtIncomingAdultPax.trim() ? parseInt(txtIncomingAdultPax, 10) : null,
      incomingChildPax: txtIncomingChildPax.trim() ? parseInt(txtIncomingChildPax, 10) : null,
      incomingInfantPax: txtIncomingInfantPax.trim() ? parseInt(txtIncomingInfantPax, 10) : null,
      incomingTotalPax: computedIncomingTotalPax > 0 ? computedIncomingTotalPax : null,
      registration: txtRegistration.trim().toUpperCase(),
      remarks: txtRemarks.trim(),
    });

    showToast('Flight actuals updated successfully.', 'success');
  };

  // Handle Update Delays
  const handleUpdateDelaysClick = () => {
    if (!selectedFlightId) {
      showToast('Please select a flight to update delays.', 'info');
      return;
    }
    if (isSelectedFlightCanceled) {
      showToast('Cannot modify delays for a canceled flight.', 'warning');
      return;
    }

    const newDelays: Flight['delays'] = [];
    if (delayCode1.trim()) {
      newDelays.push({
        code: delayCode1.trim().toUpperCase(),
        minutes: parseHHMMToMinutes(delayMinutes1),
      });
    }
    if (delayCode2.trim()) {
      newDelays.push({
        code: delayCode2.trim().toUpperCase(),
        minutes: parseHHMMToMinutes(delayMinutes2),
      });
    }
    if (delayCode3.trim()) {
      newDelays.push({
        code: delayCode3.trim().toUpperCase(),
        minutes: parseHHMMToMinutes(delayMinutes3),
      });
    }

    onUpdateDelays(selectedFlightId, newDelays);
    showToast('Flight delays updated successfully.', 'success');
  };

  // Cancel flight handler
  const handleCancelClick = () => {
    if (!selectedFlight) {
      showToast('Please select a flight to cancel.', 'info');
      return;
    }
    if (selectedFlight.flightStatus === 'Completed') {
      showToast('Cannot cancel a flight that has already completed.', 'warning');
      return;
    }
    if (selectedFlight.flightStatus === 'Canceled') {
      showToast('This flight is already canceled.', 'info');
      return;
    }
    setIsCancelModalOpen(true);
  };

  // Delete flight handler
  const handleDeleteClick = () => {
    if (!selectedFlight) {
      showToast('Please select a flight to delete.', 'info');
      return;
    }

    setConfirmDialog({
      title: 'Delete flight',
      message: `Are you sure you want to permanently delete flight ${selectedFlight.inboundFlightNumber}/${selectedFlight.outboundFlightNumber}?`,
      confirmText: 'Delete',
      onConfirm: () => {
        onDeleteFlight(selectedFlight.flightId);
        setSelectedFlightId(null);
        showToast('Flight deleted successfully.', 'info');
        setConfirmDialog(null);
      },
    });
  };

  // Open IATA Delay Picker
  const handleOpenDelayPicker = (slot: 1 | 2 | 3) => {
    setActiveDelayTarget(slot);
    setIsDelayPickerOpen(true);
  };

  const handleSelectDelayCode = (code: string) => {
    if (activeDelayTarget === 1) setDelayCode1(code);
    if (activeDelayTarget === 2) setDelayCode2(code);
    if (activeDelayTarget === 3) setDelayCode3(code);
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification with Frosted Glass */}
      {notification && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-[0_10px_30px_rgba(15,23,42,0.35)] text-xs font-semibold flex items-center gap-2 border backdrop-blur-xl transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
              : notification.type === 'warning'
              ? 'bg-amber-950/90 text-amber-100 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
              : notification.type === 'error'
              ? 'bg-rose-950/90 text-rose-100 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
              : 'bg-slate-900/90 text-slate-100 border-sky-500/30 shadow-[0_0_20px_rgba(14,165,233,0.3)]'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse"></span>
          <span>{notification.message}</span>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-[0_18px_52px_rgba(15,23,42,0.35)] overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 text-white">
              <span className="text-sm font-bold tracking-wide">{confirmDialog.title}</span>
              <span className="text-xs font-semibold uppercase text-slate-300">System</span>
            </div>
            <div className="px-4 py-4 text-sm text-slate-700">
              <p>{confirmDialog.message}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="rounded-md border border-rose-200 bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddFlightModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-[0_18px_52px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between bg-gradient-to-r from-sky-800 to-sky-700 px-5 py-4 text-white">
              <div>
                <h2 className="text-base font-bold">Add Flight</h2>
                <p className="text-xs text-sky-100">Enter the essential schedule and handling information.</p>
              </div>
              <button type="button" onClick={() => setIsAddFlightModalOpen(false)} className="rounded-md p-1.5 text-sky-100 hover:bg-white/10 hover:text-white" title="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 text-xs md:grid-cols-2">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Inbound Flight #</label>
                <input value={txtInbound} onChange={(e) => setTxtInbound(e.target.value.toUpperCase())} placeholder="e.g. MS777" className="glass-input w-full rounded-xl px-2.5 py-2 font-mono text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Outbound Flight #</label>
                <input value={txtOutbound} onChange={(e) => setTxtOutbound(e.target.value.toUpperCase())} placeholder="e.g. MS778" className="glass-input w-full rounded-xl px-2.5 py-2 font-mono text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">STA (UTC)</label>
                <input type="datetime-local" value={staUtc} onChange={(e) => setStaUtc(e.target.value)} className="glass-input w-full rounded-xl px-2.5 py-2 font-mono text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">STD (UTC)</label>
                <input type="datetime-local" value={stdUtc} onChange={(e) => setStdUtc(e.target.value)} className="glass-input w-full rounded-xl px-2.5 py-2 font-mono text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Airline</label>
                <select value={selectedAirlineId} onChange={(e) => setSelectedAirlineId(Number(e.target.value))} className="glass-input w-full rounded-xl px-2 py-2 text-slate-900">
                  {airlines.map((airline) => <option key={airline.airlineId} value={airline.airlineId}>{airline.airlineName}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Agency</label>
                <select value={selectedAgencyId} onChange={(e) => setSelectedAgencyId(Number(e.target.value))} className="glass-input w-full rounded-xl px-2 py-2 text-slate-900">
                  {agencies.map((agency) => <option key={agency.agencyId} value={agency.agencyId}>{agency.agencyName}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Origin</label>
                <input maxLength={3} value={txtOrigin} onChange={(e) => setTxtOrigin(e.target.value.toUpperCase())} placeholder="LHR" className="glass-input w-full rounded-xl px-2.5 py-2 font-mono text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Destination</label>
                <input maxLength={3} value={txtDestination} onChange={(e) => setTxtDestination(e.target.value.toUpperCase())} placeholder="CAI" className="glass-input w-full rounded-xl px-2.5 py-2 font-mono text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Via (optional)</label>
                <input maxLength={3} value={txtVia} onChange={(e) => setTxtVia(e.target.value.toUpperCase())} placeholder="HRG" className="glass-input w-full rounded-xl px-2.5 py-2 font-mono text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Final Destination</label>
                <input maxLength={3} value={txtFinalDestination} onChange={(e) => setTxtFinalDestination(e.target.value.toUpperCase())} placeholder="LHR" className="glass-input w-full rounded-xl px-2.5 py-2 font-mono text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Aircraft Type</label>
                <input value={txtAircraftType} onChange={(e) => setTxtAircraftType(e.target.value.toUpperCase())} placeholder="A320" className="glass-input w-full rounded-xl px-2.5 py-2 text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Registration / Tail</label>
                <input value={txtRegistration} onChange={(e) => setTxtRegistration(e.target.value.toUpperCase())} placeholder="SU-GDU" className="glass-input w-full rounded-xl px-2.5 py-2 font-mono text-slate-900" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block font-semibold text-slate-700">Remarks</label>
                <textarea value={txtRemarks} onChange={(e) => setTxtRemarks(e.target.value)} rows={2} placeholder="Handling notes" className="glass-input w-full rounded-xl px-2.5 py-2 text-slate-900" />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button type="button" onClick={() => setIsAddFlightModalOpen(false)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Cancel</button>
              <button type="button" onClick={handleAddFlightClick} className="glass-btn-primary rounded-md px-4 py-2 text-xs font-semibold">Submit Flight</button>
            </div>
          </div>
        </div>
      )}

      {/* Top Action Command Bar */}
      <div className="glass-card p-3 rounded-2xl shadow-xl dark:shadow-2xl flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {canAddFlight && (
            <button
              onClick={() => setIsAddFlightModalOpen(true)}
              className="glass-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Flight
            </button>
          )}

          <button
            onClick={handleCancelClick}
            disabled={!selectedFlight || isSelectedFlightCanceled}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              !selectedFlight || isSelectedFlightCanceled
                ? 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/5 cursor-not-allowed'
                : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 shadow-xs cursor-pointer'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            Cancel Flight
          </button>

          <button
            onClick={handleDeleteClick}
            disabled={!selectedFlight}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              !selectedFlight
                ? 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/5 cursor-not-allowed'
                : 'bg-slate-100 hover:bg-rose-50 dark:bg-white/5 dark:hover:bg-rose-500/20 text-slate-700 hover:text-rose-700 dark:text-slate-300 dark:hover:text-rose-300 border border-slate-300 hover:border-rose-300 dark:border-white/10 dark:hover:border-rose-500/30 cursor-pointer'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Flight
          </button>

          <div className="h-5 w-px bg-slate-200 dark:bg-white/10 mx-1 hidden sm:block" />

          <button
            onClick={() => {
              if (!selectedFlight) {
                showToast('Please select a flight first.', 'info');
                return;
              }
              setIsTripFileModalOpen(true);
            }}
            disabled={!selectedFlight}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              !selectedFlight
                ? 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/5 cursor-not-allowed'
                : 'bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 shadow-xs cursor-pointer'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Generate Trip File
          </button>

          <button
            onClick={() => exportFlightsToCsv(filteredFlights, `Flights_${new Date().toISOString().slice(0, 10)}.csv`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer backdrop-blur-md"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Export Excel
          </button>

          <button
            onClick={() => {
              if (selectedFlight) {
                setIsTripFileModalOpen(true);
              } else {
                window.print();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer backdrop-blur-md"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            Export PDF / Print
          </button>
        </div>

        <button
          onClick={() => {
            onRefresh();
            showToast('Flight list refreshed with current operational status.', 'info');
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/10 cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Date Range & Quick Status Filters */}
      <div className="glass-card p-4 rounded-2xl shadow-sm dark:shadow-2xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* UTC Date Pickers */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              UTC Filter:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">From</span>
              <input
                type="datetime-local"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="glass-input px-2.5 py-1 text-xs rounded-xl font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">To</span>
              <input
                type="datetime-local"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="glass-input px-2.5 py-1 text-xs rounded-xl font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              onClick={() => {
                setIsFilterActive(true);
                showToast(`Filter applied from ${filterFrom} to ${filterTo} UTC`, 'info');
              }}
              className="glass-btn-primary px-3.5 py-1 rounded-xl font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Filter className="w-3 h-3" />
              Apply Filter
            </button>
            {isFilterActive && (
              <button
                onClick={() => {
                  setIsFilterActive(false);
                  showToast('Filter cleared. Showing all flights.', 'info');
                }}
                className="px-2.5 py-1 rounded-xl border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search flight, airline, route, tail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input w-full pl-9 pr-3 py-1.5 text-xs rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Filter Status Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-white/10 text-[11px]">
          <div className="text-slate-500 dark:text-slate-400">
            {isFilterActive ? (
              <span className="text-sky-700 dark:text-sky-300 font-medium">
                🔍 Filtered: Showing flights from <span className="font-mono text-slate-800 dark:text-slate-200">{formatUtcDateTime(filterFrom)}</span> to{' '}
                <span className="font-mono text-slate-800 dark:text-slate-200">{formatUtcDateTime(filterTo)}</span> UTC ({filteredFlights.length} of {flights.length} flights)
              </span>
            ) : (
              <span>Showing all {filteredFlights.length} flights</span>
            )}
          </div>

          {/* Status Quick Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['ALL', 'Scheduled', 'Arrived - Not Departed', 'Completed', 'Canceled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-sky-100 dark:bg-sky-500/25 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40 shadow-xs dark:shadow-[0_0_10px_rgba(14,165,233,0.3)] font-bold'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5'
                }`}
              >
                {st}
              </button>
            ))}

            <button
              onClick={() => setFilterTriangleOnly(!filterTriangleOnly)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                filterTriangleOnly
                  ? 'bg-amber-100 dark:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-xs font-bold'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5'
              }`}
              title="Show only triangle routing flights"
            >
              <span>🔺 Triangle Routes</span>
              <span className="px-1 py-0.2 rounded-full text-[9px] bg-amber-200 dark:bg-amber-500/40 font-bold">
                {flights.filter(isTriangleFlight).length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Flights Data Table (Frosted Glass Data View) */}
      <div className="glass-card rounded-2xl shadow-sm dark:shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10">
        <div className="overflow-x-auto min-h-[360px] max-h-[540px] 2xl:max-h-[660px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100/95 dark:bg-white/[0.08] backdrop-blur-md text-slate-700 dark:text-slate-300 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="px-3.5 py-3 whitespace-nowrap">Inbound</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Outbound</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Airline</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Agency</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Route</th>
                <th className="px-3.5 py-3 whitespace-nowrap">A/C</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Tail</th>
                <th className="px-3.5 py-3 whitespace-nowrap">STA (UTC)</th>
                <th className="px-3.5 py-3 whitespace-nowrap">STD (UTC)</th>
                <th className="px-3.5 py-3 whitespace-nowrap">ATA (UTC)</th>
                <th className="px-3.5 py-3 whitespace-nowrap">ATD (UTC)</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-center">Status</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Delays</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Adults</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Children</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Infants</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Total Pax</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Bags</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-sans">
              {filteredFlights.length === 0 ? (
                <tr>
                  <td colSpan={19} className="py-12 text-center text-slate-400 text-xs">
                    No flights found matching the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredFlights.map((flight) => {
                  const isSelected = selectedFlightId === flight.flightId;
                  const isCanceled = flight.flightStatus === 'Canceled';
                  const badge = getStatusBadgeStyle(flight.flightStatus);

                  // Frosted glass colored row tints
                  let rowColorClass = 'hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-800 dark:text-slate-200';
                  if (isCanceled) {
                    rowColorClass = 'bg-slate-100/60 dark:bg-white/[0.02] text-slate-400 dark:text-slate-500 line-through';
                  } else if (flight.flightStatus === 'Not Arrived') {
                    rowColorClass = 'bg-amber-50/60 dark:bg-amber-500/10 hover:bg-amber-100/60 dark:hover:bg-amber-500/15 text-slate-800 dark:text-amber-200';
                  } else if (flight.flightStatus === 'Not Departed') {
                    rowColorClass = 'bg-rose-50/60 dark:bg-rose-500/10 hover:bg-rose-100/60 dark:hover:bg-rose-500/15 text-slate-800 dark:text-rose-200';
                  } else if (flight.flightStatus === 'Arrived - Not Departed') {
                    rowColorClass = 'bg-sky-50/60 dark:bg-sky-500/10 hover:bg-sky-100/60 dark:hover:bg-sky-500/15 text-slate-800 dark:text-sky-200';
                  } else if (flight.flightStatus === 'Departed - Not Arrived') {
                    rowColorClass = 'bg-orange-50/60 dark:bg-orange-500/10 hover:bg-orange-100/60 dark:hover:bg-orange-500/15 text-slate-800 dark:text-orange-200';
                  } else if (flight.flightStatus === 'Completed') {
                    rowColorClass = 'bg-emerald-50/60 dark:bg-emerald-500/10 hover:bg-emerald-100/60 dark:hover:bg-emerald-500/15 text-slate-800 dark:text-emerald-200';
                  }

                  const delayString =
                    flight.delays.length > 0
                      ? flight.delays.map((d) => `${d.code}:${formatMinutesToHHMM(d.minutes)}`).join('; ')
                      : 'None';

                  return (
                    <tr
                      key={flight.flightId}
                      onClick={() => setSelectedFlightId(flight.flightId)}
                      className={`cursor-pointer transition-all ${rowColorClass} ${
                        isSelected ? 'bg-sky-100/80 dark:bg-sky-500/20 ring-1 ring-sky-400 font-semibold shadow-inner' : ''
                      }`}
                    >
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {flight.inboundFlightNumber}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {flight.outboundFlightNumber}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-800 dark:text-slate-200">{flight.airlineName}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{flight.agencyName}</td>
                      <td className="px-3.5 py-2.5 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatFlightRoute(flight)}
                          </span>
                          {isTriangleFlight(flight) && (
                            <span
                              className="px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-tight bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 flex items-center gap-0.5"
                              title="Triangle Flight Rotation (3 Sectors: Origin -> Station 1 -> Station 2 -> Origin)"
                            >
                              🔺 Triangle
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300">{flight.aircraftType}</td>
                      <td className="px-3.5 py-2.5 font-mono text-sky-700 dark:text-sky-400 whitespace-nowrap font-medium">
                        {flight.registration || '-'}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatUtcDateTime(flight.staUtc)}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatUtcDateTime(flight.stdUtc)}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-sky-700 dark:text-sky-400 whitespace-nowrap font-medium">
                        {flight.ataUtc ? formatUtcDateTime(flight.ataUtc) : 'N/A'}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-sky-700 dark:text-sky-400 whitespace-nowrap font-medium">
                        {flight.atdUtc ? formatUtcDateTime(flight.atdUtc) : 'N/A'}
                      </td>
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-[11px] rounded-lg font-medium border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-amber-700 dark:text-amber-300 font-semibold whitespace-nowrap max-w-[200px] truncate">
                        {delayString}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">{flight.adultPax ?? '-'}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">{flight.childPax ?? '-'}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">{flight.infantPax ?? '-'}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-sky-700 dark:text-sky-300">
                        {flight.totalPax ?? '-'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">{flight.numberOfBags ?? '-'} / {flight.incomingNumberOfBags ?? '-'}</td>
                      <td className="px-3.5 py-2.5 text-slate-500 dark:text-slate-400 max-w-[240px] truncate text-[11px]">
                        {flight.remarks || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Flight Banner */}
      <div className="glass-card-sub px-4 py-2.5 rounded-2xl text-xs font-mono flex flex-wrap items-center justify-between gap-2 shadow-sm dark:shadow-lg border border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span className="text-slate-800 dark:text-slate-200">
            {selectedFlight
              ? `Selected Flight: ${selectedFlight.inboundFlightNumber} / ${selectedFlight.outboundFlightNumber} | STA: ${formatUtcDateTime(
                  selectedFlight.staUtc
                )} | STD: ${formatUtcDateTime(selectedFlight.stdUtc)} | Status: ${selectedFlight.flightStatus}`
              : 'Selected Flight: None (Select a flight from the table above)'}
          </span>
        </div>

        {isSelectedFlightCanceled && (
          <span className="text-rose-300 font-bold bg-rose-500/20 px-2.5 py-0.5 rounded-lg border border-rose-500/30 text-[11px]">
            ⚠️ CANCELED - EDITING DISABLED
          </span>
        )}
      </div>

      {/* Bottom Inspection & Edit Panel with 3 Tabs */}
      <div className="glass-card rounded-2xl shadow-sm dark:shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10">
        {/* Tabs Bar */}
        <div className="flex border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] backdrop-blur-md">
          <button
            onClick={() => setActiveBottomTab('schedule')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeBottomTab === 'schedule'
                ? 'border-sky-500 text-sky-700 dark:text-sky-300 bg-white dark:bg-white/5 shadow-inner'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.02]'
            }`}
          >
            1. Schedule Information
          </button>
          <button
            onClick={() => setActiveBottomTab('actuals')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeBottomTab === 'actuals'
                ? 'border-sky-500 text-sky-700 dark:text-sky-300 bg-white dark:bg-white/5 shadow-inner'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.02]'
            }`}
          >
            2. Operational Actuals &amp; Load
          </button>
          <button
            onClick={() => setActiveBottomTab('delays')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeBottomTab === 'delays'
                ? 'border-sky-500 text-sky-700 dark:text-sky-300 bg-white dark:bg-white/5 shadow-inner'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.02]'
            }`}
          >
            3. Flight Delays Accounting
          </button>
        </div>

        {/* Tab 1: Schedule Content */}
        {activeBottomTab === 'schedule' && (
          <div className="p-5 space-y-4">
            {/* Dedicated Route & Triangle Sector Management Banner */}
            <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 dark:border-white/10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    Flight Routing &amp; Triangle Loop Controls
                  </span>
                  {txtVia && txtOrigin && txtDestination && txtFinalDestination && txtOrigin === txtFinalDestination && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 flex items-center gap-1">
                      🔺 Active Triangle Flight Rotation (3 Sectors)
                    </span>
                  )}
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    disabled={isSelectedFlightCanceled}
                    onClick={handleMakeTriangleFlight}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                    title="Set up triangle flight (e.g. LHR-CAI-HRG-LHR)"
                  >
                    <span>🔺 Setup Triangle (LHR-CAI-HRG-LHR)</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSelectedFlightCanceled || !txtOrigin}
                    onClick={() => {
                      if (txtOrigin) {
                        setTxtFinalDestination(txtOrigin);
                        showToast(`Final destination set to origin (${txtOrigin}) to close route loop.`, 'info');
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 transition-all flex items-center gap-1 cursor-pointer"
                    title="Set final destination equal to origin to complete loop"
                  >
                    <Repeat className="w-3 h-3" />
                    <span>Loop to Origin ({txtOrigin || '---'})</span>
                  </button>
                </div>
              </div>

              {/* Live Sector Flow Visualizer */}
              <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-white/70 dark:bg-black/20 border border-slate-200/70 dark:border-white/5 font-mono text-xs">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 text-sky-900 dark:text-sky-200 font-bold">
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 font-sans font-normal mr-1">Sector 1:</span>
                  <span>{txtOrigin || '---'}</span>
                  <ArrowRight className="w-3 h-3 text-sky-500" />
                  <span>{txtDestination || '---'}</span>
                </div>

                {txtVia && (
                  <>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-200 font-bold">
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 font-sans font-normal mr-1">Sector 2:</span>
                      <span>{txtDestination || '---'}</span>
                      <ArrowRight className="w-3 h-3 text-amber-500" />
                      <span>{txtVia}</span>
                    </div>

                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-900 dark:text-emerald-200 font-bold">
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 font-sans font-normal mr-1">Sector 3:</span>
                      <span>{txtVia}</span>
                      <ArrowRight className="w-3 h-3 text-emerald-500" />
                      <span>{txtFinalDestination || txtOrigin || '---'}</span>
                    </div>
                  </>
                )}

                {!txtVia && txtFinalDestination && txtFinalDestination !== txtDestination && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-900 dark:text-emerald-200 font-bold">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-sans font-normal mr-1">Sector 2:</span>
                    <span>{txtDestination || '---'}</span>
                    <ArrowRight className="w-3 h-3 text-emerald-500" />
                    <span>{txtFinalDestination}</span>
                  </div>
                )}

                {/* Quick Route String Parser input */}
                <div className="ml-auto flex items-center gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
                  <input
                    type="text"
                    disabled={isSelectedFlightCanceled}
                    placeholder="Quick: LHR-CAI-HRG-LHR"
                    value={routeQuickInput}
                    onChange={(e) => setRouteQuickInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyRouteQuickInput();
                      }
                    }}
                    className="glass-input px-2 py-1 text-xs rounded-lg font-mono w-48 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    disabled={isSelectedFlightCanceled}
                    onClick={() => handleApplyRouteQuickInput()}
                    className="px-2 py-1 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-11 gap-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Inbound Flight #</label>
                <input
                  type="text"
                  value={txtInbound}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setTxtInbound(e.target.value.toUpperCase())}
                  placeholder="e.g. MS777"
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Outbound Flight #</label>
                <input
                  type="text"
                  value={txtOutbound}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setTxtOutbound(e.target.value.toUpperCase())}
                  placeholder="e.g. MS778"
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">STA (UTC)</label>
                <input
                  type="datetime-local"
                  value={staUtc}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setStaUtc(e.target.value)}
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">STD (UTC)</label>
                <input
                  type="datetime-local"
                  value={stdUtc}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setStdUtc(e.target.value)}
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Airline</label>
                <select
                  value={selectedAirlineId}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setSelectedAirlineId(Number(e.target.value))}
                  className="glass-input w-full px-2 py-1.5 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-40"
                >
                  {airlines.map((a) => (
                    <option key={a.airlineId} value={a.airlineId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      {a.airlineName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Agency</label>
                <select
                  value={selectedAgencyId}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setSelectedAgencyId(Number(e.target.value))}
                  className="glass-input w-full px-2 py-1.5 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-40"
                >
                  {agencies.map((g) => (
                    <option key={g.agencyId} value={g.agencyId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      {g.agencyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Origin (3-char)</label>
                <input
                  type="text"
                  maxLength={3}
                  value={txtOrigin}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setTxtOrigin(e.target.value.toUpperCase())}
                  placeholder="LHR"
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Destination (1st)</label>
                <input
                  type="text"
                  maxLength={3}
                  value={txtDestination}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setTxtDestination(e.target.value.toUpperCase())}
                  placeholder="CAI"
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <span>Via (2nd Stop)</span>
                  <span className="text-[9px] px-1 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">Triangle</span>
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={txtVia}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setTxtVia(e.target.value.toUpperCase())}
                  placeholder="HRG"
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Final Destination</label>
                <input
                  type="text"
                  maxLength={3}
                  value={txtFinalDestination}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setTxtFinalDestination(e.target.value.toUpperCase())}
                  placeholder="LHR"
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Aircraft Type</label>
                <input
                  type="text"
                  value={txtAircraftType}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setTxtAircraftType(e.target.value.toUpperCase())}
                  placeholder="B777-300ER"
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
              <button
                onClick={handleUpdateScheduleClick}
                disabled={!selectedFlight || isSelectedFlightCanceled}
                className="glass-btn-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                ✓ Update Schedule
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Actuals Content */}
        {activeBottomTab === 'actuals' && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {/* ATA UTC */}
              <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 dark:border-white/10 space-y-2">
                <label className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chkATA}
                    disabled={isSelectedFlightCanceled}
                    onChange={(e) => setChkATA(e.target.checked)}
                    className="rounded-sm border-slate-300 dark:border-white/20 text-sky-600 focus:ring-sky-500 bg-white dark:bg-slate-900/60"
                  />
                  <span>Actual Time of Arrival (ATA UTC)</span>
                </label>
                <input
                  type="datetime-local"
                  value={ataUtc}
                  disabled={!chkATA || isSelectedFlightCanceled}
                  onChange={(e) => setAtaUtc(e.target.value)}
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>

              {/* ATD UTC */}
              <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 dark:border-white/10 space-y-2">
                <label className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chkATD}
                    disabled={isSelectedFlightCanceled}
                    onChange={(e) => setChkATD(e.target.checked)}
                    className="rounded-sm border-slate-300 dark:border-white/20 text-sky-600 focus:ring-sky-500 bg-white dark:bg-slate-900/60"
                  />
                  <span>Actual Time of Departure (ATD UTC)</span>
                </label>
                <input
                  type="datetime-local"
                  value={atdUtc}
                  disabled={!chkATD || isSelectedFlightCanceled}
                  onChange={(e) => setAtdUtc(e.target.value)}
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Outgoing Bags</label>
                <input
                  type="number"
                  value={txtBags}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setTxtBags(e.target.value)}
                  placeholder="e.g. 284"
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Incoming Bags</label>
                <input
                  type="number"
                  value={txtIncomingBags}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setTxtIncomingBags(e.target.value)}
                  placeholder="e.g. 245"
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>

              {/* Tail Registration */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Aircraft Registration / Tail</label>
                <input
                  type="text"
                  value={txtRegistration}
                  disabled={isSelectedFlightCanceled}
                  onChange={(e) => setTxtRegistration(e.target.value.toUpperCase())}
                  placeholder="e.g. SU-GDU"
                  className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                />
              </div>
            </div>

            {/* Passenger Breakdown (Adults, Children, Infants, Auto Total) */}
            <div className="p-3.5 glass-card-sub rounded-xl border border-sky-300 dark:border-sky-500/20 bg-sky-50/50 dark:bg-sky-950/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider">
                  Passenger Breakdown
                </span>
                <span className="text-xs font-black text-sky-700 dark:text-sky-400 font-mono">
                  Outgoing Total: {computedTotalPax} | Incoming Total: {computedIncomingTotalPax}
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white/70 p-2.5 dark:border-slate-700 dark:bg-slate-900/30">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Outgoing</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Adult</label>
                      <input type="number" value={txtAdultPax} disabled={isSelectedFlightCanceled} onChange={(e) => setTxtAdultPax(e.target.value)} placeholder="0" className="glass-input w-full px-2.5 py-1 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40" />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Child</label>
                      <input type="number" value={txtChildPax} disabled={isSelectedFlightCanceled} onChange={(e) => setTxtChildPax(e.target.value)} placeholder="0" className="glass-input w-full px-2.5 py-1 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40" />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Infant</label>
                      <input type="number" value={txtInfantPax} disabled={isSelectedFlightCanceled} onChange={(e) => setTxtInfantPax(e.target.value)} placeholder="0" className="glass-input w-full px-2.5 py-1 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white/70 p-2.5 dark:border-slate-700 dark:bg-slate-900/30">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Incoming</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Adult</label>
                      <input type="number" value={txtIncomingAdultPax} disabled={isSelectedFlightCanceled} onChange={(e) => setTxtIncomingAdultPax(e.target.value)} placeholder="0" className="glass-input w-full px-2.5 py-1 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40" />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Child</label>
                      <input type="number" value={txtIncomingChildPax} disabled={isSelectedFlightCanceled} onChange={(e) => setTxtIncomingChildPax(e.target.value)} placeholder="0" className="glass-input w-full px-2.5 py-1 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40" />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Infant</label>
                      <input type="number" value={txtIncomingInfantPax} disabled={isSelectedFlightCanceled} onChange={(e) => setTxtIncomingInfantPax(e.target.value)} placeholder="0" className="glass-input w-full px-2.5 py-1 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 text-xs">
                Dispatcher Remarks / Handling Notes
              </label>
              <textarea
                value={txtRemarks}
                disabled={isSelectedFlightCanceled}
                onChange={(e) => setTxtRemarks(e.target.value)}
                placeholder="Enter turnaround observations, gate changes, servicing anomalies..."
                rows={2}
                className="glass-input w-full px-3 py-1.5 text-xs rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-40"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
              <button
                onClick={handleUpdateActualsClick}
                disabled={!selectedFlight || isSelectedFlightCanceled}
                className="glass-btn-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                ✓ Update Actuals
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Delays Content */}
        {activeBottomTab === 'delays' && (
          <div className="p-5 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Record up to 3 IATA delay codes and durations. Enter delay minutes in HHMM (e.g. 0030 for 30m, 0115 for 75m) or select an international standard code.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Delay 1 */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 glass-card-sub space-y-2">
                <span className="font-bold text-sky-700 dark:text-sky-300 block">Primary Delay 1</span>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 dark:text-slate-300 font-medium">Delay Code</label>
                    <button
                      type="button"
                      disabled={isSelectedFlightCanceled}
                      onClick={() => handleOpenDelayPicker(1)}
                      className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline text-[11px] cursor-pointer font-medium"
                    >
                      Browse IATA
                    </button>
                  </div>
                  <input
                    type="text"
                    value={delayCode1}
                    disabled={isSelectedFlightCanceled}
                    onChange={(e) => setDelayCode1(e.target.value.toUpperCase())}
                    placeholder="e.g. 89"
                    className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Minutes (HHMM)</label>
                  <input
                    type="text"
                    value={delayMinutes1}
                    disabled={isSelectedFlightCanceled}
                    onChange={(e) => setDelayMinutes1(e.target.value)}
                    placeholder="e.g. 0030"
                    className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Delay 2 */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 glass-card-sub space-y-2">
                <span className="font-bold text-sky-700 dark:text-sky-300 block">Secondary Delay 2</span>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 dark:text-slate-300 font-medium">Delay Code</label>
                    <button
                      type="button"
                      disabled={isSelectedFlightCanceled}
                      onClick={() => handleOpenDelayPicker(2)}
                      className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline text-[11px] cursor-pointer font-medium"
                    >
                      Browse IATA
                    </button>
                  </div>
                  <input
                    type="text"
                    value={delayCode2}
                    disabled={isSelectedFlightCanceled}
                    onChange={(e) => setDelayCode2(e.target.value.toUpperCase())}
                    placeholder="e.g. 15"
                    className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Minutes (HHMM)</label>
                  <input
                    type="text"
                    value={delayMinutes2}
                    disabled={isSelectedFlightCanceled}
                    onChange={(e) => setDelayMinutes2(e.target.value)}
                    placeholder="e.g. 0015"
                    className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Delay 3 */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 glass-card-sub space-y-2">
                <span className="font-bold text-sky-700 dark:text-sky-300 block">Tertiary Delay 3</span>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 dark:text-slate-300 font-medium">Delay Code</label>
                    <button
                      type="button"
                      disabled={isSelectedFlightCanceled}
                      onClick={() => handleOpenDelayPicker(3)}
                      className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline text-[11px] cursor-pointer font-medium"
                    >
                      Browse IATA
                    </button>
                  </div>
                  <input
                    type="text"
                    value={delayCode3}
                    disabled={isSelectedFlightCanceled}
                    onChange={(e) => setDelayCode3(e.target.value.toUpperCase())}
                    placeholder="e.g. 93"
                    className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Minutes (HHMM)</label>
                  <input
                    type="text"
                    value={delayMinutes3}
                    disabled={isSelectedFlightCanceled}
                    onChange={(e) => setDelayMinutes3(e.target.value)}
                    placeholder="e.g. 0025"
                    className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
              <button
                onClick={handleUpdateDelaysClick}
                disabled={!selectedFlight || isSelectedFlightCanceled}
                className="glass-btn-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                ✓ Update Delays
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancellation Modal */}
      <CancelFlightModal
        isOpen={isCancelModalOpen}
        flight={selectedFlight}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={(id, reason) => {
          onCancelFlight(id, reason);
          setIsCancelModalOpen(false);
          showToast(`Flight ${selectedFlight?.inboundFlightNumber} canceled.`, 'warning');
        }}
      />

      {/* Trip File Dossier Modal */}
      <TripFileModal
        isOpen={isTripFileModalOpen}
        flight={selectedFlight}
        onClose={() => setIsTripFileModalOpen(false)}
      />

      {/* IATA Delay Picker */}
      <IataDelayPickerModal
        isOpen={isDelayPickerOpen}
        onClose={() => setIsDelayPickerOpen(false)}
        onSelect={handleSelectDelayCode}
        selectedCode={
          activeDelayTarget === 1 ? delayCode1 : activeDelayTarget === 2 ? delayCode2 : delayCode3
        }
      />
    </div>
  );
};
