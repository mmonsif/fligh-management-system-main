import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, FileText, Loader2, Plane, Send, ShieldCheck } from 'lucide-react';
import { AuthUser, Flight, LIR_COMPARTMENT_NOS, LoadingCompartment, LoadingInstruction, LirCompartmentNo, LirStatus, UserRole } from '../../types';
import {
  createDraftLoadingInstruction,
  loadLoadingInstruction,
  saveLoadingInstruction,
  subscribeToLoadingInstruction,
} from '../../lib/database';
import { exportLoadingInstructionToPdf } from '../../utils/flightUtils';

const STATUS_LABEL: Record<LirStatus, string> = {
  draft: 'Draft',
  planned: 'Planned',
  actual: 'Actual',
  approved: 'Approved · Completed',
};

const STATUS_CLASS: Record<LirStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-300',
  planned: 'bg-sky-100 text-sky-800 border-sky-300',
  actual: 'bg-amber-100 text-amber-800 border-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

export const lirPermissions = (role: UserRole) => ({
  canSeeAllTabs: role !== 'ramp',
  canEditPlan: role === 'load-control' || role === 'admin',
  canSubmitActual: role === 'ramp' || role === 'admin',
  canApprove: role === 'load-control' || role === 'admin',
  // The load planner may reopen an issued plan to revise it, as long as it has
  // not yet been approved & completed.
  canRevisePlan: role === 'load-control' || role === 'admin',
});

const formatHold = (bags: number | null, text?: string | null) => {
  if (text && text.trim()) return text.trim();
  return bags === null ? 'NIL' : String(bags);
};

/** Human-readable hold location labels, used by the mobile card view and the print sheet. */
const HOLD_INFO: Record<LirCompartmentNo, { zone: string; position: string }> = {
  1: { zone: 'FWD', position: 'Forward hold · door 1' },
  2: { zone: 'FWD', position: 'Forward hold · door 2' },
  3: { zone: 'AFT', position: 'Aft hold · door 1' },
  4: { zone: 'AFT', position: 'Aft hold · door 2' },
  5: { zone: 'BULK', position: 'Aft bulk hold' },
};

const toNilIfEmpty = (value: number | null) => (value === null || value <= 0 ? null : value);

/**
 * Parse the numeric part of a hold entry. Free text such as "remaining" is not a
 * number, so the numeric field stays null while the raw text is kept separately —
 * this lets a planner jot notes in a hold without breaking the bag totals.
 */
const parseBags = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toUpperCase() === 'NIL') return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed === 0 ? null : parsed;
};

const totalBags = (compartments: LoadingCompartment[], field: 'plannedBags' | 'actualBags') =>
  compartments.reduce((sum, compartment) => sum + (compartment[field] ?? 0), 0);

const hasDeviation = (compartments: LoadingCompartment[]) =>
  compartments.some((compartment) => compartment.plannedBags !== compartment.actualBags);

/**
 * The number of bags declared in the Operational Actual tab ("Outgoing Bags").
 * This is the pool that the holds must be loaded from, so it "seeds" the actual
 * loading and is drawn down as the load controller / ramp fills each hold.
 */
const bagsOutTotal = (flight: Flight) => Math.max(0, flight.numberOfBags ?? 0);

interface LoadingInstructionTabProps {
  flight: Flight;
  user: AuthUser;
  disabled?: boolean;
  onToast: (message: string, type?: 'success' | 'warning' | 'info' | 'error') => void;
}

export const LoadingInstructionTab: React.FC<LoadingInstructionTabProps> = ({
  flight,
  user,
  disabled = false,
  onToast,
}) => {
  const permissions = lirPermissions(user.role);
  const [instruction, setInstruction] = useState<LoadingInstruction>(() => createDraftLoadingInstruction(flight.flightId));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  // When the load planner reopens an already-issued plan, the planned holds become
  // editable again without disturbing the ramp-facing status until it is re-issued.
  const [revisingPlan, setRevisingPlan] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadLoadingInstruction(flight.flightId)
      .then((row) => {
        if (mounted) setInstruction(row);
      })
      .catch((error) => {
        onToast(error instanceof Error ? error.message : 'Could not load the loading instruction.', 'error');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const unsubscribe = subscribeToLoadingInstruction(flight.flightId, (row) => {
      if (mounted) setInstruction(row);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [flight.flightId]);

  // The plan can be edited while it is a draft, or after the load planner reopens
  // an issued plan for revision (status is 'planned' at that point).
  const canEditPlan =
    permissions.canEditPlan && (instruction.status === 'draft' || revisingPlan) && !disabled;
  // A plan can be revised once issued but before it is approved & completed.
  const canRevisePlan =
    permissions.canRevisePlan && instruction.status === 'planned' && !disabled && !revisingPlan;
  // Actual loading may be entered by the ramp OR by load control while the plan is
  // issued (planned). This lets the load controller draw bags out of the holds and
  // watch the remaining balance, and still lets ramp report the real loading.
  const canEditActual =
    (permissions.canSubmitActual || permissions.canEditPlan) && instruction.status === 'planned' && !disabled && !revisingPlan;
  const deviation = useMemo(() => hasDeviation(instruction.compartments), [instruction.compartments]);

  const updateCompartment = (compartmentNo: LirCompartmentNo, field: 'plannedBags' | 'actualBags', raw: string) => {
    const bags = parseBags(raw);
    const trimmed = raw.trim();
    const upper = trimmed.toUpperCase();
    const textField = field === 'plannedBags' ? 'plannedText' : 'actualText';
    // Keep free text (e.g. "remaining") so it survives, but treat a plain number,
    // an explicit NIL, or 0 as text-free — the parsed number (or null) drives totals.
    const isPlaceholderWord = bags === null && upper !== '' && upper !== 'NIL' && upper !== '0';
    const textValue = isPlaceholderWord ? upper : '';
    setInstruction((current) => ({
      ...current,
      compartments: current.compartments.map((compartment) =>
        compartment.compartmentNo === compartmentNo
          ? { ...compartment, [field]: bags, [textField]: textValue }
          : compartment
      ),
    }));
  };

  const persist = async (next: LoadingInstruction, successMessage: string) => {
    setBusy(true);
    try {
      const saved = await saveLoadingInstruction(next);
      setInstruction(saved);
      onToast(successMessage, 'success');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Could not save the loading instruction.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleIssuePlan = () => {
    if (!canEditPlan) return;
    // A hold is "set" if it carries a bag count OR a text note (e.g. "remaining").
    const hasAnyHold = instruction.compartments.some(
      (compartment) =>
        (compartment.plannedBags !== null && compartment.plannedBags > 0) ||
        Boolean(compartment.plannedText?.trim())
    );
    if (!hasAnyHold) {
      onToast('Enter bags in at least one compartment before issuing the plan.', 'warning');
      return;
    }
    const now = new Date().toISOString();
    void persist(
      {
        ...instruction,
        status: 'planned',
        plannedBy: user.username,
        plannedAt: now,
      },
      'Loading instruction issued as Planned. Ramp can now load the aircraft.'
    );
  };

  const handleSubmitActual = () => {
    if (!canEditActual) return;
    const actual = instruction.compartments.map((compartment) => ({
      ...compartment,
      actualBags: toNilIfEmpty(compartment.actualBags ?? compartment.plannedBags),
    }));
    if (hasDeviation(actual) && !instruction.deviationNotes.trim()) {
      onToast('Actual loading differs from the plan. Enter a deviation note before submitting.', 'warning');
      return;
    }
    const now = new Date().toISOString();
    void persist(
      {
        ...instruction,
        compartments: actual,
        status: 'actual',
        actualBy: user.username,
        actualAt: now,
      },
      'Actual loading submitted. Load control can now review and issue the load sheet.'
    );
  };

  const handleApprove = () => {
    if (!permissions.canApprove || instruction.status !== 'actual' || disabled) return;
    const now = new Date().toISOString();
    void persist(
      {
        ...instruction,
        status: 'approved',
        approvedBy: user.username,
        approvedAt: now,
      },
      'Final loading approved and completed. Load sheet may be issued.'
    );
  };

  const handleReturnToRamp = () => {
    if (!permissions.canApprove || instruction.status !== 'actual' || disabled) return;
    void persist(
      {
        ...instruction,
        status: 'planned',
        actualBy: null,
        actualAt: null,
      },
      'Returned to ramp as Planned for a corrected actual loading report.'
    );
  };

  // Reopen an issued plan so the load planner can adjust the planned holds, then
  // re-issue it. The status stays 'planned' (ramp-facing) until the revision is
  // saved, so the ramp view is not disrupted mid-edit.
  const handleStartRevision = () => {
    if (!canRevisePlan) return;
    setRevisingPlan(true);
    onToast('Plan reopened for revision. Adjust the planned holds, then save the revision.', 'info');
  };

  const handleCancelRevision = () => {
    setRevisingPlan(false);
    void loadLoadingInstruction(flight.flightId)
      .then((row) => setInstruction(row))
      .catch((error) =>
        onToast(error instanceof Error ? error.message : 'Could not reload the issued plan.', 'error')
      );
  };

  const handleSaveRevision = () => {
    if (!canEditPlan || !revisingPlan) return;
    // A hold is "set" if it carries a bag count OR a text note (e.g. "remaining").
    const hasAnyHold = instruction.compartments.some(
      (compartment) =>
        (compartment.plannedBags !== null && compartment.plannedBags > 0) ||
        Boolean(compartment.plannedText && compartment.plannedText.trim())
    );
    if (!hasAnyHold) {
      onToast('Enter bags in at least one compartment before saving the revision.', 'warning');
      return;
    }
    const now = new Date().toISOString();
    setRevisingPlan(false);
    void persist(
      {
        ...instruction,
        status: 'planned',
        plannedBy: user.username,
        plannedAt: now,
      },
      'Plan revision saved and re-issued to ramp.'
    );
  };

  const handlePrint = () => {
    try {
      exportLoadingInstructionToPdf(flight, instruction, user.username);
      onToast('Loading instruction opened for printing. Use your browser print dialog to save as PDF.', 'info');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Could not generate the loading instruction.', 'error');
    }
  };

  const plannedTotal = totalBags(instruction.compartments, 'plannedBags');
  const actualTotal = totalBags(instruction.compartments, 'actualBags');
  const showActual = instruction.status === 'actual' || instruction.status === 'approved';
  const fieldToEdit: 'plannedBags' | 'actualBags' | null = canEditPlan ? 'plannedBags' : canEditActual ? 'actualBags' : null;

  // Bags Out declared in the Operational Actual tab seeds the actual loading.
  const bagsOut = bagsOutTotal(flight);
  // While the holds are being filled the entered bags are drawn down from the
  // seeded Bags Out pool and the running remainder is shown. During a plan revision
  // the planner is editing planned bags, so the planned total is the pool drawn on.
  const enteredAgainstBagsOut =
    canEditActual ? actualTotal : canEditPlan ? plannedTotal : instruction.status === 'draft' ? plannedTotal : actualTotal;
  const remainingToLoad = bagsOut - enteredAgainstBagsOut;
  const remainingIsOver = remainingToLoad < 0;

  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900">Loading Instruction Report (LIR)</h3>
            <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_CLASS[instruction.status]}`}>
              {STATUS_LABEL[instruction.status]}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {flight.aircraftType} · {flight.registration || 'No registration'} · outbound bags {flight.numberOfBags ?? '—'}
            {revisingPlan && ' · Revising the issued plan — adjust the planned holds, then save the revision.'}
            {!revisingPlan && instruction.status === 'draft' && ' · Load control sets the plan, then issues it to ramp.'}
            {!revisingPlan && instruction.status === 'planned' && ' · Labeled Planned. Ramp confirms loading or reports a deviation, then submits.'}
            {!revisingPlan && instruction.status === 'actual' && ' · Labeled Actual. Load control reviews and issues the load sheet.'}
            {!revisingPlan && instruction.status === 'approved' && ' · Labeled Approved and Completed.'}
          </p>
        </div>
        <div className="text-right text-[10px] text-slate-500 font-mono space-y-0.5">
          {instruction.plannedBy && <div>Planned by {instruction.plannedBy}</div>}
          {instruction.actualBy && <div>Actual by {instruction.actualBy}</div>}
          {instruction.approvedBy && <div>Approved by {instruction.approvedBy}</div>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading instruction...
        </div>
      ) : (
        <>
          {revisingPlan && (
            <div className="flex items-start gap-2 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Revising the issued plan. The ramp still sees the previously issued plan until you save this
                revision. Adjust the planned holds below, then choose <span className="font-bold">Save revision</span> or{' '}
                <span className="font-bold">Cancel</span>.
              </span>
            </div>
          )}

          <AircraftHoldDiagram
            compartments={instruction.compartments}
            showActual={showActual}
            field={fieldToEdit}
            onUpdate={updateCompartment}
          />

          {fieldToEdit && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-600">
              {fieldToEdit === 'actualBags' ? (
                <>
                  <span>
                    <span className="font-bold text-slate-700">Actual bags</span> — enter the loaded bags directly in the hold boxes above.
                  </span>
                  <span
                    className={`rounded-lg border px-2 py-0.5 font-mono text-[11px] font-bold ${
                      remainingIsOver
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : remainingToLoad === 0
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-amber-300 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {remainingIsOver ? `Over by ${Math.abs(remainingToLoad)}` : `${remainingToLoad} of ${bagsOut} remaining`}
                  </span>
                </>
              ) : (
                <span>
                  <span className="font-bold text-slate-700">Planned bags</span> — enter the planned bags directly in the hold boxes above. Empty compartments are stored as NIL when the plan is issued.
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
              <div className="text-[10px] font-bold uppercase text-slate-400">Bags out (operational actual)</div>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-700">{bagsOut} bags</div>
              <div className="mt-0.5 text-[10px] text-slate-500">Seeded from the outgoing bags entered in the Actuals tab.</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
              <div className="text-[10px] font-bold uppercase text-slate-400">Planned total</div>
              <div className="mt-1 font-mono text-lg font-bold text-sky-700">{plannedTotal} bags</div>
            </div>
            <div className={`rounded-xl border p-3 text-xs ${remainingIsOver ? 'border-rose-300 bg-rose-50' : remainingToLoad === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
              <div className="text-[10px] font-bold uppercase text-slate-400">Remaining to load</div>
              <div className={`mt-1 font-mono text-lg font-bold ${remainingIsOver ? 'text-rose-700' : remainingToLoad === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {remainingIsOver ? `+${Math.abs(remainingToLoad)} over` : `${remainingToLoad} bags`}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">
                {bagsOut === 0
                  ? 'No bags out declared in Operational Actual.'
                  : remainingIsOver
                    ? 'Holds exceed the declared bags out.'
                    : remainingToLoad === 0
                      ? 'All declared bags accounted for.'
                      : `Deducted from the ${bagsOut} bags out as holds are filled.`}
              </div>
            </div>
            <div className={`rounded-xl border p-3 text-xs ${deviation && showActual ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
              <div className="text-[10px] font-bold uppercase text-slate-400">Deviation</div>
              <div className="mt-1 font-bold text-slate-800">
                {instruction.status === 'draft' || instruction.status === 'planned'
                  ? instruction.status === 'planned'
                    ? 'Awaiting ramp report'
                    : 'Not issued'
                  : deviation
                    ? 'Reported — review required'
                    : 'None — matches plan'}
              </div>
            </div>
          </div>

          {(canEditActual || instruction.deviationNotes || instruction.status === 'actual') && (
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">Ramp deviation notes</label>
              <textarea
                value={instruction.deviationNotes}
                disabled={!canEditActual}
                onChange={(event) => setInstruction((current) => ({ ...current, deviationNotes: event.target.value }))}
                rows={2}
                className="glass-input w-full rounded-xl px-3 py-2 text-xs text-slate-900 disabled:bg-slate-100"
                placeholder="Describe any hold that could not be loaded as planned."
              />
            </div>
          )}

          {(permissions.canApprove || instruction.loadControlNotes) && instruction.status !== 'draft' && (
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">Load control notes</label>
              <textarea
                value={instruction.loadControlNotes}
                disabled={!permissions.canApprove || instruction.status === 'approved' || disabled}
                onChange={(event) => setInstruction((current) => ({ ...current, loadControlNotes: event.target.value }))}
                rows={2}
                className="glass-input w-full rounded-xl px-3 py-2 text-xs text-slate-900 disabled:bg-slate-100"
                placeholder="Review remarks before issuing the load sheet."
              />
            </div>
          )}

          {deviation && instruction.status === 'actual' && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Actual loading differs from the planned instruction. Review the holds before approving the final load.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
            {revisingPlan && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCancelRevision}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel revision
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveRevision}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  Save revision
                </button>
              </>
            )}
            {!revisingPlan && canEditPlan && (
              <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const planned = instruction.compartments.map((compartment) => ({
                    ...compartment,
                    plannedBags: toNilIfEmpty(compartment.plannedBags),
                  }));
                  void persist({ ...instruction, compartments: planned, status: 'draft' }, 'Draft loading instruction saved.');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleIssuePlan}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                Issue plan to ramp
              </button>
              </>
            )}
            {canRevisePlan && (
              <button
                type="button"
                disabled={busy}
                onClick={handleStartRevision}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Revise plan
              </button>
            )}
            {!revisingPlan && permissions.canEditPlan && instruction.status !== 'draft' && (
              <button
                type="button"
                disabled={busy}
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <FileText className="h-3.5 w-3.5" />
                Generate loading instruction
              </button>
            )}
            {!revisingPlan && canEditActual && (
              <button
                type="button"
                disabled={busy}
                onClick={handleSubmitActual}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Submit actual loading
              </button>
            )}
            {!revisingPlan && permissions.canApprove && instruction.status === 'actual' && !disabled && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleReturnToRamp}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Return to ramp
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleApprove}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Approve &amp; complete load sheet
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const AircraftHoldDiagram: React.FC<{
  compartments: LoadingCompartment[];
  showActual: boolean;
  field: 'plannedBags' | 'actualBags' | null;
  onUpdate: (compartmentNo: LirCompartmentNo, field: 'plannedBags' | 'actualBags', raw: string) => void;
}> = ({ compartments, showActual, field, onUpdate }) => {
  const compartmentAt = (compartmentNo: LirCompartmentNo) =>
    compartments.find((compartment) => compartment.compartmentNo === compartmentNo);

  // Box geometry inside the 920x220 SVG viewBox. The overlay uses the same
  // 920/220 aspect ratio so the inputs land exactly on top of each drawn hold.
  const VIEW_W = 920;
  const VIEW_H = 220;
  const boxX = (index: number) => 130 + index * 120;
  const BOX_Y = 90;
  const BOX_W = 100;
  const BOX_H = 52;

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-sky-200">
        <span className="flex items-center gap-2">
          <Plane className="h-3.5 w-3.5" />
          Aircraft hold layout · compartments 1–5
        </span>
        {field && (
          <span className="rounded-md border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-sky-200">
            Entering {field === 'actualBags' ? 'Actual' : 'Planned'} bags
          </span>
        )}
      </div>

      <div className="relative mx-auto hidden w-full md:block" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full">
          <ellipse cx="70" cy="110" rx="58" ry="38" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
          <rect x="90" y="72" width="700" height="76" rx="28" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
          <polygon points="790,72 890,110 790,148" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
          <polygon points="430,12 490,72 370,72" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          <polygon points="430,208 490,148 370,148" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          {LIR_COMPARTMENT_NOS.map((compartmentNo, index) => (
            <rect
              key={compartmentNo}
              x={boxX(index)}
              y={BOX_Y}
              width={BOX_W}
              height={BOX_H}
              rx="8"
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="2"
            />
          ))}
          {LIR_COMPARTMENT_NOS.map((compartmentNo, index) => (
            <text
              key={`label-${compartmentNo}`}
              x={boxX(index) + BOX_W / 2}
              y={BOX_Y - 6}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize="12"
              fontFamily="ui-sans-serif"
              fontWeight="700"
            >
              CPT {compartmentNo}
            </text>
          ))}
          <text x="70" y="116" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="ui-sans-serif">NOSE</text>
          <text x="870" y="116" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="ui-sans-serif">TAIL</text>
        </svg>

        {LIR_COMPARTMENT_NOS.map((compartmentNo, index) => {
          const compartment = compartmentAt(compartmentNo);
          const editingField = field && compartment ? field : null;
          const editingTextField = editingField === 'actualBags' ? 'actualText' : 'plannedText';
          const enteredText = editingField ? compartment?.[editingTextField] ?? '' : '';
          const enteredNumber = editingField ? compartment?.[editingField] : null;
          // Show the raw text if the user typed words, otherwise the parsed number.
          const enteredValue = enteredText ? enteredText : enteredNumber === null || enteredNumber === undefined ? '' : String(enteredNumber);
          const displayValue = compartment
            ? formatHold(
                showActual ? compartment.actualBags ?? compartment.plannedBags : compartment.plannedBags,
                showActual ? compartment.actualText : compartment.plannedText
              )
            : 'NIL';
          const mismatch = showActual && compartment && compartment.plannedBags !== compartment.actualBags;

          return (
            <div
              key={compartmentNo}
              className="absolute flex flex-col items-center justify-center"
              style={{
                left: `${(boxX(index) / VIEW_W) * 100}%`,
                top: `${(BOX_Y / VIEW_H) * 100}%`,
                width: `${(BOX_W / VIEW_W) * 100}%`,
                height: `${(BOX_H / VIEW_H) * 100}%`,
              }}
            >
              {editingField === 'actualBags' && (
                <span className="mb-0.5 text-[10px] font-bold leading-none text-sky-300">
                  plan {formatHold(compartment?.plannedBags ?? null, compartment?.plannedText)}
                </span>
              )}
              {editingField ? (
                <input
                  type="text"
                  value={enteredValue}
                  placeholder="NIL or text"
                  title="Enter a bag count, NIL, or free text such as 'remaining'"
                  onChange={(event) => onUpdate(compartmentNo, editingField, event.target.value)}
                  className="mt-0.5 w-[86%] rounded-md border border-sky-400/60 bg-slate-900/80 px-1 py-0.5 text-center text-[11px] font-bold text-sky-200 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-300/60"
                />
              ) : (
                <span className={`mt-0.5 text-[11px] font-bold ${mismatch ? 'text-amber-300' : 'text-sky-300'}`}>
                  {displayValue}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 hidden text-center text-[10px] text-slate-400 md:block">
        {field
          ? `Enter ${field === 'actualBags' ? 'actual' : 'planned'} bags directly in the compartment boxes above. Empty holds display as NIL.`
          : `Values shown are ${showActual ? 'actual (or planned until ramp reports)' : 'planned'}. Empty holds display as NIL.`}
      </p>

      {/* Mobile view: the aircraft diagram is too small to read on a phone, so
          each hold is rendered as a clear, tappable card instead. */}
      <div className="space-y-2 md:hidden">
        {LIR_COMPARTMENT_NOS.map((compartmentNo) => {
          const compartment = compartmentAt(compartmentNo);
          const editingField = field && compartment ? field : null;
          const editingTextField = editingField === 'actualBags' ? 'actualText' : 'plannedText';
          const enteredText = editingField ? compartment?.[editingTextField] ?? '' : '';
          const enteredNumber = editingField ? compartment?.[editingField] : null;
          const enteredValue = enteredText ? enteredText : enteredNumber === null || enteredNumber === undefined ? '' : String(enteredNumber);
          const info = HOLD_INFO[compartmentNo];
          const planned = compartment?.plannedBags ?? null;
          const actual = compartment?.actualBags ?? null;
          const plannedText = compartment?.plannedText;
          const actualText = compartment?.actualText;
          const mismatch = showActual && planned !== actual;

          return (
            <div
              key={compartmentNo}
              className="rounded-xl border border-sky-400/30 bg-slate-900/60 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-xs font-black text-sky-200">
                    {compartmentNo}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-100">CPT {compartmentNo}</div>
                    <div className="text-[10px] text-slate-400">{info.position}</div>
                  </div>
                </div>
                <span className="rounded-md border border-slate-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-300">
                  {info.zone}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-600/40 bg-slate-800/60 p-2">
                  <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Planned</div>
                  {editingField === 'plannedBags' ? (
                    <input
                      type="text"
                      value={enteredValue}
                      placeholder="NIL or text"
                      title="Enter a bag count, NIL, or free text such as 'remaining'"
                      onChange={(event) => onUpdate(compartmentNo, 'plannedBags', event.target.value)}
                      className="mt-0.5 w-full rounded-md border border-sky-400/60 bg-slate-900/80 px-2 py-1 text-center font-mono text-base font-bold text-sky-200 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-300/60"
                    />
                  ) : (
                    <div className={`mt-0.5 break-words font-mono text-base font-bold ${mismatch ? 'text-amber-300' : 'text-sky-300'}`}>
                      {formatHold(planned, plannedText)}
                    </div>
                  )}
                </div>
                <div className={`rounded-lg border p-2 ${mismatch ? 'border-amber-400/50 bg-amber-900/20' : 'border-slate-600/40 bg-slate-800/60'}`}>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    {editingField === 'actualBags' ? 'Actual (enter)' : 'Actual'}
                  </div>
                  {editingField === 'actualBags' ? (
                    <input
                      type="text"
                      value={enteredValue}
                      placeholder="NIL or text"
                      title="Enter a bag count, NIL, or free text such as 'remaining'"
                      onChange={(event) => onUpdate(compartmentNo, 'actualBags', event.target.value)}
                      className={`mt-0.5 w-full rounded-md border bg-slate-900/80 px-2 py-1 text-center font-mono text-base font-bold outline-none ${mismatch ? 'border-amber-400/60 text-amber-200' : 'border-sky-400/60 text-sky-200'} focus:border-sky-300 focus:ring-1 focus:ring-sky-300/60`}
                    />
                  ) : (
                    <div className={`mt-0.5 break-words font-mono text-base font-bold ${mismatch ? 'text-amber-300' : 'text-slate-200'}`}>
                      {showActual ? formatHold(actual, actualText) : '—'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <p className="pt-1 text-center text-[10px] text-slate-400">
          {field
            ? `Tap a hold to enter ${field === 'actualBags' ? 'actual' : 'planned'} bags — a number, NIL, or free text such as "remaining".`
            : `Values shown are ${showActual ? 'actual (or planned until ramp reports)' : 'planned'}.`}
        </p>
      </div>
    </div>
  );
};
