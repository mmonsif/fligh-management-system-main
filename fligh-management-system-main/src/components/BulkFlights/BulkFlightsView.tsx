import React, { useState } from 'react';
import { FlightTemplate, Airline, Agency, Flight } from '../../types';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Plus,
  RefreshCw,
  Sparkles,
  Layers,
  ListFilter,
  ArrowRight,
  Navigation,
} from 'lucide-react';
import { formatFlightRoute, isTriangleFlight } from '../../utils/flightUtils';

interface BulkFlightsViewProps {
  templates: FlightTemplate[];
  airlines: Airline[];
  agencies: Agency[];
  onCreateTemplate: (template: Omit<FlightTemplate, 'templateId'>) => void;
  onAddSchedule: (
    templateId: number,
    schedule: { frequency: 'Daily' | 'Weekly'; daysOfWeek: string; startDate: string; endDate: string }
  ) => void;
  onGenerateFlights: (templateId: number, startDate: string, endDate: string) => number;
  onDeleteTemplate?: (templateId: number) => void;
}

export const BulkFlightsView: React.FC<BulkFlightsViewProps> = ({
  templates,
  airlines,
  agencies,
  onCreateTemplate,
  onAddSchedule,
  onGenerateFlights,
  onDeleteTemplate,
}) => {
  const [activeTab, setActiveTab] = useState<'manage' | 'generate'>('manage');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(templates[0]?.templateId ?? null);

  // Form states for creating a template
  const [templateName, setTemplateName] = useState('');
  const [inboundFlight, setInboundFlight] = useState('');
  const [outboundFlight, setOutboundFlight] = useState('');
  const [staTime, setStaTime] = useState('08:00');
  const [stdTime, setStdTime] = useState('09:00');
  const [origin, setOrigin] = useState('LHR');
  const [destination, setDestination] = useState('CAI');
  const [via, setVia] = useState('HRG');
  const [finalDestination, setFinalDestination] = useState('LHR');
  const [airlineId, setAirlineId] = useState<number>(airlines[0]?.airlineId ?? 1);
  const [agencyId, setAgencyId] = useState<number>(agencies[0]?.agencyId ?? 1);
  const [aircraftType, setAircraftType] = useState('A320');

  // Schedule form states
  const [frequency, setFrequency] = useState<'Daily' | 'Weekly'>('Daily');
  const [selectedDays, setSelectedDays] = useState<{ [day: string]: boolean }>({
    '1': true, // Mon
    '2': true, // Tue
    '3': true, // Wed
    '4': true, // Thu
    '5': true, // Fri
    '6': false, // Sat
    '7': false, // Sun
  });
  const todayStr = new Date().toISOString().slice(0, 10);
  const nextMonthStr = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [scheduleStart, setScheduleStart] = useState(todayStr);
  const [scheduleEnd, setScheduleEnd] = useState(nextMonthStr);

  // Generate tab states
  const [genTemplateId, setGenTemplateId] = useState<number | null>(templates[0]?.templateId ?? null);
  const [genStart, setGenStart] = useState(todayStr);
  const [genEnd, setGenEnd] = useState(nextMonthStr);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [genStatusMessage, setGenStatusMessage] = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.templateId === selectedTemplateId) || null;

  // Handle Day toggle
  const toggleDay = (dayKey: string) => {
    setSelectedDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
  };

  // Preset Triangle Route (LHR-CAI-HRG-LHR)
  const handlePresetTriangle = () => {
    setTemplateName('London - Cairo - Hurghada Triangle Rotation');
    setInboundFlight('MS777');
    setOutboundFlight('MS778');
    setOrigin('LHR');
    setDestination('CAI');
    setVia('HRG');
    setFinalDestination('LHR');
  };

  // Create Template Click
  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      alert('Please enter a template name.');
      return;
    }
    if (!inboundFlight.trim()) {
      alert('Please enter inbound flight number.');
      return;
    }

    const o = origin.trim().toUpperCase() || 'LHR';
    const d = destination.trim().toUpperCase() || 'CAI';
    const v = via.trim().toUpperCase() || undefined;
    const fd = finalDestination.trim().toUpperCase() || (v ? o : d);

    onCreateTemplate({
      templateName: templateName.trim(),
      inboundFlightNumber: inboundFlight.trim().toUpperCase(),
      outboundFlightNumber: outboundFlight.trim().toUpperCase() || inboundFlight.trim().toUpperCase(),
      staTimeOfDay: staTime,
      stdTimeOfDay: stdTime,
      origin: o,
      destination: d,
      via: v,
      finalDestination: fd,
      airlineId: Number(airlineId),
      agencyId: Number(agencyId),
      aircraftType: aircraftType.trim().toUpperCase(),
    });

    // Reset fields
    setTemplateName('');
    setInboundFlight('');
    setOutboundFlight('');
    setVia('');
    alert(`✅ Flight template created successfully!`);
  };

  // Add Schedule Click
  const handleAddSchedule = () => {
    if (!selectedTemplateId) {
      alert('Please select a template first from the table.');
      return;
    }

    let daysStr = '1,2,3,4,5,6,7';
    if (frequency === 'Weekly') {
      const activeKeys = Object.entries(selectedDays)
        .filter(([_, isChecked]) => isChecked)
        .map(([k]) => k);
      if (activeKeys.length === 0) {
        alert('Please select at least one day for weekly frequency.');
        return;
      }
      daysStr = activeKeys.join(',');
    }

    onAddSchedule(selectedTemplateId, {
      frequency,
      daysOfWeek: daysStr,
      startDate: scheduleStart,
      endDate: scheduleEnd,
    });

    alert(
      `✅ Schedule rule added to template '${selectedTemplate?.templateName}'!\nFrequency: ${frequency}\nPeriod: ${scheduleStart} to ${scheduleEnd}`
    );
  };

  // Generate Flights Click
  const handleGenerateFlights = () => {
    const targetId = genTemplateId || selectedTemplateId;
    if (!targetId) {
      alert('Please select a flight template first.');
      return;
    }

    const template = templates.find((t) => t.templateId === targetId);
    if (!template) {
      alert('Template not found.');
      return;
    }

    setIsGenerating(true);
    setProgressPercent(15);
    setGenStatusMessage(`Preparing schedule parameters for ${template.templateName}...`);

    setTimeout(() => {
      setProgressPercent(55);
      setGenStatusMessage(`Calculating recurring operational sectors...`);

      setTimeout(() => {
        const count = onGenerateFlights(targetId, genStart, genEnd);
        setProgressPercent(100);
        setGenStatusMessage(
          `✅ Successfully generated ${count} operational flights from template '${template.templateName}'!`
        );
        setIsGenerating(false);

        alert(
          `✅ Successfully generated ${count} flights!\nTemplate: ${template.templateName}\nPeriod: ${genStart} to ${genEnd}\n\nAll generated sectors are now live in the Flight Operations list.`
        );
      }, 500);
    }, 400);
  };

  const getDayNames = (daysStr?: string) => {
    if (!daysStr) return 'All Days';
    const map: { [k: string]: string } = {
      '1': 'Mon',
      '2': 'Tue',
      '3': 'Wed',
      '4': 'Thu',
      '5': 'Fri',
      '6': 'Sat',
      '7': 'Sun',
    };
    return daysStr
      .split(',')
      .map((d) => map[d] || d)
      .join(', ');
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-2xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            Bulk Flight Generator &amp; Template Scheduler
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Define recurring seasonal flight patterns and generate high-volume operational schedules in batch
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex glass-card-sub p-1 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'manage'
                ? 'bg-sky-500 text-white dark:bg-sky-500/30 dark:text-sky-200 border border-sky-600 dark:border-sky-400/40 shadow-sm font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            1. Manage Flight Templates
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'generate'
                ? 'bg-sky-500 text-white dark:bg-sky-500/30 dark:text-sky-200 border border-sky-600 dark:border-sky-400/40 shadow-sm font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            2. Generate Flights in Batch
          </button>
        </div>
      </div>

      {/* TAB 1: MANAGE TEMPLATES */}
      {activeTab === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column: Create New Template Form */}
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2.5">
              <Plus className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Create Flight Template
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily London Heathrow Turnaround"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="glass-input w-full px-3 py-1.5 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Inbound Flight #</label>
                  <input
                    type="text"
                    required
                    placeholder="MS777"
                    value={inboundFlight}
                    onChange={(e) => setInboundFlight(e.target.value.toUpperCase())}
                    className="glass-input w-full px-3 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Outbound Flight #</label>
                  <input
                    type="text"
                    required
                    placeholder="MS778"
                    value={outboundFlight}
                    onChange={(e) => setOutboundFlight(e.target.value.toUpperCase())}
                    className="glass-input w-full px-3 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">STA (UTC Time)</label>
                  <input
                    type="time"
                    required
                    value={staTime}
                    onChange={(e) => setStaTime(e.target.value)}
                    className="glass-input w-full px-3 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">STD (UTC Time)</label>
                  <input
                    type="time"
                    required
                    value={stdTime}
                    onChange={(e) => setStdTime(e.target.value)}
                    className="glass-input w-full px-3 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Route Sectors</span>
                  <button
                    type="button"
                    onClick={handlePresetTriangle}
                    className="text-[10px] text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <span>🔺 Preset Triangle (LHR-CAI-HRG-LHR)</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Origin</label>
                    <input
                      type="text"
                      maxLength={3}
                      required
                      placeholder="LHR"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                      className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 uppercase text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Destination (1st)</label>
                    <input
                      type="text"
                      maxLength={3}
                      required
                      placeholder="CAI"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value.toUpperCase())}
                      className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 uppercase text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                      <span>Via</span>
                      <span className="text-[9px] px-1 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">Triangle</span>
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      placeholder="HRG"
                      value={via}
                      onChange={(e) => setVia(e.target.value.toUpperCase())}
                      className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 uppercase text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Final Return</label>
                    <input
                      type="text"
                      maxLength={3}
                      placeholder="LHR"
                      value={finalDestination}
                      onChange={(e) => setFinalDestination(e.target.value.toUpperCase())}
                      className="glass-input w-full px-2.5 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100 uppercase text-xs"
                    />
                  </div>
                </div>

                {/* Route visual preview tag */}
                <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>
                    {origin || '---'} &rarr; {destination || '---'} {via ? `\u2192 ${via}` : ''} {finalDestination ? `\u2192 ${finalDestination}` : ''}
                  </span>
                  {via && origin && finalDestination && origin === finalDestination && (
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      🔺 Triangle Flight
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Airline</label>
                  <select
                    value={airlineId}
                    onChange={(e) => setAirlineId(Number(e.target.value))}
                    className="glass-input w-full px-2.5 py-1.5 rounded-xl text-slate-900 dark:text-slate-100"
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
                    value={agencyId}
                    onChange={(e) => setAgencyId(Number(e.target.value))}
                    className="glass-input w-full px-2.5 py-1.5 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    {agencies.map((g) => (
                      <option key={g.agencyId} value={g.agencyId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {g.agencyName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Aircraft Type</label>
                <input
                  type="text"
                  placeholder="e.g. B777-300ER, A320neo"
                  value={aircraftType}
                  onChange={(e) => setAircraftType(e.target.value.toUpperCase())}
                  className="glass-input w-full px-3 py-1.5 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <button
                type="submit"
                className="glass-btn-primary w-full mt-2 py-2 rounded-xl text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
              >
                Create Flight Template
              </button>
            </form>
          </div>

          {/* Right 2 Columns: Templates List & Add Schedule Rules */}
          <div className="lg:col-span-2 space-y-4">
            {/* Templates DataGridView */}
            <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Configured Flight Templates ({templates.length})
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Click a row to select template</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-xl glass-card-sub">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="p-2.5">Template Name</th>
                      <th className="p-2.5">Inbound</th>
                      <th className="p-2.5">Outbound</th>
                      <th className="p-2.5">STA / STD</th>
                      <th className="p-2.5">Route</th>
                      <th className="p-2.5">Aircraft</th>
                      <th className="p-2.5">Recurrence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {templates.map((t) => {
                      const isSelected = selectedTemplateId === t.templateId;
                      return (
                        <tr
                          key={t.templateId}
                          onClick={() => setSelectedTemplateId(t.templateId)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-900 dark:text-sky-200 font-medium'
                              : 'hover:bg-slate-100/60 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">{t.templateName}</td>
                          <td className="p-2.5 font-mono text-slate-800 dark:text-slate-200">{t.inboundFlightNumber}</td>
                          <td className="p-2.5 font-mono text-slate-800 dark:text-slate-200">{t.outboundFlightNumber}</td>
                          <td className="p-2.5 font-mono text-slate-800 dark:text-slate-200">
                            {t.staTimeOfDay} / {t.stdTimeOfDay}
                          </td>
                          <td className="p-2.5 font-mono text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-1">
                              <span>{formatFlightRoute(t)}</span>
                              {isTriangleFlight(t) && (
                                <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                                  🔺 Triangle
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 text-slate-800 dark:text-slate-200">{t.aircraftType}</td>
                          <td className="p-2.5">
                            {t.schedule ? (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-[11px]">
                                {t.schedule.frequency} ({getDayNames(t.schedule.daysOfWeek)})
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 italic">No schedule set</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-slate-700 dark:text-slate-300 font-mono glass-card-sub p-2.5 rounded-xl border border-slate-200 dark:border-white/10">
                {selectedTemplate
                  ? `Selected: ${selectedTemplate.templateName} (${selectedTemplate.inboundFlightNumber}/${selectedTemplate.outboundFlightNumber})`
                  : 'Select a template and add schedule rules below'}
              </div>
            </div>

            {/* Add Schedule to Selected Template */}
            <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Add Schedule Rules to Selected Template
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as 'Daily' | 'Weekly')}
                    className="glass-input w-full px-3 py-1.5 rounded-xl text-slate-900 dark:text-slate-100 font-medium"
                  >
                    <option value="Daily" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Daily</option>
                    <option value="Weekly" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Weekly (Select Days)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Schedule Period Start</label>
                  <input
                    type="date"
                    value={scheduleStart}
                    onChange={(e) => setScheduleStart(e.target.value)}
                    className="glass-input w-full px-3 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Schedule Period End</label>
                  <input
                    type="date"
                    value={scheduleEnd}
                    onChange={(e) => setScheduleEnd(e.target.value)}
                    className="glass-input w-full px-3 py-1.5 rounded-xl font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Weekly Days Checkboxes (Visible when Weekly is selected) */}
              {frequency === 'Weekly' && (
                <div className="p-3.5 glass-card-sub rounded-xl border border-slate-200 dark:border-white/10 text-xs space-y-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block">Select Days of Week:</span>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { key: '1', label: 'Monday' },
                      { key: '2', label: 'Tuesday' },
                      { key: '3', label: 'Wednesday' },
                      { key: '4', label: 'Thursday' },
                      { key: '5', label: 'Friday' },
                      { key: '6', label: 'Saturday' },
                      { key: '7', label: 'Sunday' },
                    ].map((d) => (
                      <label key={d.key} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedDays[d.key])}
                          onChange={() => toggleDay(d.key)}
                          className="rounded-md border-slate-300 dark:border-white/20 text-sky-600 focus:ring-sky-400 bg-white/5"
                        />
                        <span className="text-slate-700 dark:text-slate-300">{d.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddSchedule}
                  disabled={!selectedTemplateId}
                  className="glass-btn-primary px-4 py-2 rounded-xl text-white font-semibold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  ✓ Save Schedule Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GENERATE FLIGHTS IN BATCH - Full Viewport Width */}
      {activeTab === 'generate' && (
        <div className="glass-card p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-2xl backdrop-blur-xl space-y-6 w-full">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Batch Flight Generation Engine
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select an operational template and define the generation window to instantiate real flights across those dates
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left/Main Configuration: 7 cols */}
            <div className="lg:col-span-7 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Target Template</label>
                  <select
                    value={genTemplateId || ''}
                    onChange={(e) => setGenTemplateId(Number(e.target.value))}
                    className="glass-input w-full px-3 py-2 rounded-xl text-slate-900 dark:text-slate-100 font-medium"
                  >
                    {templates.map((t) => (
                      <option key={t.templateId} value={t.templateId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {t.templateName} ({t.inboundFlightNumber}/{t.outboundFlightNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Generation Start Date</label>
                  <input
                    type="date"
                    value={genStart}
                    onChange={(e) => setGenStart(e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-xl font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Generation End Date</label>
                  <input
                    type="date"
                    value={genEnd}
                    onChange={(e) => setGenEnd(e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-xl font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Progress bar */}
              {isGenerating && (
                <div className="space-y-2">
                  <div className="w-full bg-slate-200 dark:bg-white/5 h-2.5 rounded-full overflow-hidden border border-slate-300 dark:border-white/10">
                    <div
                      className="bg-gradient-to-r from-sky-400 to-blue-600 h-full transition-all duration-300 rounded-full shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="text-xs text-center text-sky-600 dark:text-sky-400 font-mono animate-pulse">
                    {genStatusMessage}
                  </div>
                </div>
              )}

              {genStatusMessage && !isGenerating && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{genStatusMessage}</span>
                </div>
              )}

              <div className="flex justify-start gap-3 pt-2">
                <button
                  onClick={handleGenerateFlights}
                  disabled={isGenerating}
                  className="glass-btn-primary px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGenerating ? 'Generating Flights...' : 'Generate Operational Flights'}
                </button>
              </div>
            </div>

            {/* Right: Selected Template Profile Summary: 5 cols */}
            <div className="lg:col-span-5">
              {templates.find((t) => t.templateId === genTemplateId) ? (
                (() => {
                  const tmpl = templates.find((t) => t.templateId === genTemplateId)!;
                  return (
                    <div className="glass-card-sub p-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200">Template Profile</span>
                        <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold">{tmpl.templateName}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">Inbound / Outbound</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{tmpl.inboundFlightNumber} / {tmpl.outboundFlightNumber}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">Sector Route</span>
                          <span className="font-mono text-slate-700 dark:text-slate-200 flex items-center gap-1">
                            {formatFlightRoute(tmpl)}
                            {isTriangleFlight(tmpl) && (
                              <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                                🔺 Triangle
                              </span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">Scheduled Times (UTC)</span>
                          <span className="font-mono text-slate-700 dark:text-slate-200">STA: {tmpl.staTimeOfDay} | STD: {tmpl.stdTimeOfDay}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">Aircraft Type</span>
                          <span className="text-slate-700 dark:text-slate-200">{tmpl.aircraftType}</span>
                        </div>
                      </div>
                      <div className="border-t border-slate-200 dark:border-white/10 pt-2 text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400 block mb-1">Configured Recurrence Rules:</span>
                        {tmpl.schedule ? (
                          <div className="space-y-1">
                            <div className="text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-400"></span>
                              {tmpl.schedule.frequency}: {getDayNames(tmpl.schedule.daysOfWeek)}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                              Period: {tmpl.schedule.startDate} → {tmpl.schedule.endDate}
                            </div>
                          </div>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400/80 italic">No schedule rule set (generates for every day in selected range)</span>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
