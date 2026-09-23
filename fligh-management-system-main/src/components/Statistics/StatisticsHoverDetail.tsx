import React, { useState, useRef, useLayoutEffect, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { Flight } from '../../types';
import { formatUtcDateTime, getPassengerTotal } from '../../utils/flightUtils';
import { X, ArrowUpRight, Plane } from 'lucide-react';

/** A single labelled metric row shown inside a hover popover. */
export interface HoverMetric {
  label: string;
  value: string;
  tone?: 'default' | 'sky' | 'emerald' | 'amber' | 'rose' | 'indigo';
}

const toneClass: Record<NonNullable<HoverMetric['tone']>, string> = {
  default: 'text-slate-800 dark:text-slate-200',
  sky: 'text-sky-700 dark:text-sky-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-amber-700 dark:text-amber-300',
  rose: 'text-rose-700 dark:text-rose-300',
  indigo: 'text-indigo-700 dark:text-indigo-300',
};

/** Only one statistics popover may be on screen at a time. Each HoverDetail
 * registers a closer here; when a new element is hovered it first fires the
 * previous closer, so the popover can never "jump" between two anchors or
 * linger behind a second one.
 */
let activeStatsPopoverCloser: (() => void) | null = null;

const claimStatsPopover = (close: () => void) => {
  if (activeStatsPopoverCloser && activeStatsPopoverCloser !== close) {
    activeStatsPopoverCloser();
  }
  activeStatsPopoverCloser = close;
};

const releaseStatsPopover = (close: () => void) => {
  if (activeStatsPopoverCloser === close) activeStatsPopoverCloser = null;
};

interface HoverDetailProps {
  /** Popover heading, e.g. the metric or row name. */
  title?: string;
  /** Short helper line under the title (e.g. what is contributing). */
  subtitle?: string;
  /** Aggregated numbers that build the metric / row. */
  metrics?: HoverMetric[];
  /** The flights that contribute to this metric / row. */
  flights?: Flight[];
  /** Optional per-flight note (e.g. delay code minutes) rendered as a small tag. */
  flightNote?: (flight: Flight) => string | null;
  /** How many contributing flights to preview before "open full report". */
  previewLimit?: number;
  /** Opens the full exploration drawer for the underlying flights. */
  onExplore?: () => void;
  /** The hoverable content (card body or table row cells). */
  children: React.ReactNode;
  /** Extra classes applied to the anchor wrapper (ignored for table rows). */
  className?: string;
  /** Rendered as a block wrapper (default) or as a table row. */
  as?: 'div' | 'tr';
}

/**
 * Wraps a statistics element (KPI card or report row) and reveals, on hover or
 * click, a panel with the aggregated metrics and the contributing flights.
 *
 * Robustness notes — each of these fixes a real failure mode of a naive tooltip:
 *  - The panel is rendered through a **portal into <body>** with a very high
 *    z-index, so a card's `transform` (which creates a stacking context) can no
 *    longer paint the panel behind its siblings.
 *  - A single **global controller** guarantees at most one panel is open, so
 *    moving across rows replaces the panel instead of stacking/oscillating.
 *  - An invisible **hover bridge** spans the gap between the anchor and the
 *    panel, so the pointer can travel into the panel without a dead zone.
 *  - Clicking the anchor **pins** the panel; it then stays put while the pointer
 *    moves freely anywhere, until a click outside or the close button.
 */
export const HoverDetail: React.FC<HoverDetailProps> = ({
  title,
  subtitle,
  metrics,
  flights = [],
  flightNote,
  previewLimit = 4,
  onExplore,
  children,
  className = '',
  as = 'div',
}) => {
  const reactId = useId();
  const anchorRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, below: true });

  const open = hovered || pinned;
  const hasPopover = Boolean(metrics?.length || flights.length);
  const preview = flights.slice(0, previewLimit);
  const panelWidth = 340;

  /** Vertical gap between the anchor and its panel, in pixels. */
  const BRIDGE = 6;

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closeNow = useCallback(() => {
    clearCloseTimer();
    setHovered(false);
    setPinned(false);
  }, [clearCloseTimer]);

  // Keep the global "one popover" slot in sync with this instance's visibility.
  useEffect(() => {
    if (open) {
      claimStatsPopover(closeNow);
      return () => releaseStatsPopover(closeNow);
    }
    return undefined;
  }, [open, closeNow]);

  // Close on Escape and on any scroll/resize (a fixed panel would detach from
  // its anchor otherwise), and on a click outside while pinned.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNow();
    };
    const onScrollOrResize = () => closeNow();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closeNow();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, closeNow]);

  const computePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = panelRef.current?.offsetWidth ?? panelWidth;
    const height = panelRef.current?.offsetHeight ?? 240;
    const margin = 12;

    // Prefer aligning the panel's left edge with the anchor, but never overflow.
    let left = rect.left;
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - width - margin);
    }
    if (left < margin) left = margin;

    const roomBelow = window.innerHeight - rect.bottom;
    const placeAbove = roomBelow < height + margin && rect.top > height + margin;
    // Flush against the anchor: the hover bridge below fills the small gap.
    const top = placeAbove ? rect.top - height - BRIDGE : rect.bottom + BRIDGE;

    setPos({ top, left, below: !placeAbove });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
    // Re-measure once after the panel has painted with real content.
    const raf = window.requestAnimationFrame(computePosition);
    return () => window.cancelAnimationFrame(raf);
  }, [open, computePosition]);

  const handleEnter = () => {
    clearCloseTimer();
    if (activeStatsPopoverCloser && activeStatsPopoverCloser !== closeNow) {
      activeStatsPopoverCloser();
    }
    setHovered(true);
  };

  const handleLeave = () => {
    if (pinned) return; // pinned panels stay until dismissed
    clearCloseTimer();
    // Small grace period so the pointer can bridge the gap into the panel.
    closeTimer.current = window.setTimeout(() => setHovered(false), 220);
  };

  const handlePanelEnter = () => clearCloseTimer();

  const handlePanelLeave = () => {
    if (pinned) return;
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setHovered(false), 220);
  };

  const handleAnchorClick = (e: React.MouseEvent) => {
    if (!hasPopover) return;
    e.stopPropagation();
    setPinned((p) => !p);
    setHovered(true);
  };

  const panel = open && hasPopover
    ? createPortal(
        <>
          {/* Invisible bridge across the anchor↔panel gap: the pointer can travel
              from the row/card into the panel without landing on a dead zone or
              on a neighbouring row that would steal the hover. */}
          <div
            aria-hidden="true"
            data-stats-bridge={reactId}
            style={{
              position: 'fixed',
              left: pos.left,
              width: panelWidth,
              height: BRIDGE + 2,
              top: pos.below ? pos.top - (BRIDGE + 2) : pos.top + (panelRef.current?.offsetHeight ?? 0),
              zIndex: 199,
            }}
            onMouseEnter={handlePanelEnter}
            onMouseLeave={handlePanelLeave}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={title || 'Details'}
            data-stats-popover={reactId}
            style={{ top: pos.top, left: pos.left, width: panelWidth }}
            className="fixed z-[200] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-[0_18px_52px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-slate-900"
            onMouseEnter={handlePanelEnter}
            onMouseLeave={handlePanelLeave}
          >
          {(title || onExplore) && (
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div>
                {title && <div className="text-[11px] font-black text-slate-900 dark:text-white">{title}</div>}
                {subtitle && <div className="text-[10px] text-slate-500 dark:text-slate-400">{subtitle}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {onExplore && flights.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExplore();
                      closeNow();
                    }}
                    className="glass-btn-primary inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white cursor-pointer"
                  >
                    Full report <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeNow}
                  aria-label="Close details"
                  className="rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {metrics && metrics.length > 0 && (
            <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1 border-b border-slate-100 pb-2 dark:border-white/10">
              {metrics.map((m) => (
                <div key={m.label} className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{m.label}</span>
                  <span className={`font-mono text-[11px] font-bold ${toneClass[m.tone || 'default']}`}>{m.value}</span>
                </div>
              ))}
            </div>
          )}

          {flights.length > 0 ? (
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Plane className="h-3 w-3" /> Contributing flights
                </span>
                <span className="font-mono">{flights.length}</span>
              </div>
              <ul className="space-y-0.5">
                {preview.map((f) => {
                  const note = flightNote?.(f);
                  return (
                    <li
                      key={f.flightId}
                      className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 font-mono text-[10px] odd:bg-slate-50 dark:odd:bg-white/5"
                    >
                      <span className="truncate font-bold text-slate-800 dark:text-slate-200">
                        {f.inboundFlightNumber}
                        <span className="ml-1 font-sans font-normal text-slate-500 dark:text-slate-400">
                          {f.airlineName}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {note && (
                          <span className="rounded bg-amber-100 px-1 font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                            {note}
                          </span>
                        )}
                        <span className="text-slate-500 dark:text-slate-400">
                          {formatUtcDateTime(f.staUtc).slice(0, 10)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {flights.length > preview.length && onExplore && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExplore();
                    closeNow();
                  }}
                  className="mt-1.5 w-full rounded-md bg-sky-50 px-2 py-1 text-center text-[10px] font-semibold text-sky-700 transition-colors hover:bg-sky-100 cursor-pointer dark:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/25"
                >
                  View all {flights.length} flights in the full report →
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-md bg-slate-50 px-2 py-1.5 text-[10px] text-slate-500 dark:bg-white/5 dark:text-slate-400">
              No flights contribute to this metric in the selected period.
            </div>
          )}
          </div>
        </>,
        document.body
      )
    : null;

  if (as === 'tr') {
    return (
      <>
        <tr
          ref={anchorRef as React.RefObject<HTMLTableRowElement>}
          className={`${className} ${hasPopover ? 'cursor-pointer' : ''} ${pinned ? 'bg-sky-50/70 dark:bg-sky-500/10' : ''}`}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onClick={handleAnchorClick}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          {children}
        </tr>
        {panel}
      </>
    );
  }

  return (
    <div
      ref={anchorRef as React.RefObject<HTMLDivElement>}
      className={`relative ${className} ${hasPopover ? 'cursor-pointer' : ''} ${open ? 'ring-1 ring-sky-300/70 dark:ring-sky-500/40' : ''}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={handleAnchorClick}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      {children}
      {panel}
    </div>
  );
};

interface StatisticsDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  flights: Flight[];
  emptyMessage?: string;
}

/**
 * Bottom-sheet / modal drawer listing every contributing flight for a metric or
 * report row, including the delay codes that explain why the flight is in the set.
 */
export const StatisticsDetailDrawer: React.FC<StatisticsDetailDrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  flights,
  emptyMessage = 'No flights contribute to this metric.',
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <div>
            <div className="text-sm font-black text-slate-900 dark:text-white">{title}</div>
            {subtitle && <div className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer dark:hover:bg-white/10 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100/95 text-slate-700 backdrop-blur-md dark:bg-white/10 dark:text-slate-300">
              <tr className="font-bold">
                <th className="p-2.5">Inbound</th>
                <th className="p-2.5">Outbound</th>
                <th className="p-2.5">Airline</th>
                <th className="p-2.5">Agency</th>
                <th className="p-2.5">STA (UTC)</th>
                <th className="p-2.5">Aircraft</th>
                <th className="p-2.5 text-right">Delay</th>
                <th className="p-2.5 text-right">Pax</th>
                <th className="p-2.5">Delay Codes</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono dark:divide-white/5">
              {flights.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                flights.map((f) => (
                  <tr key={f.flightId} className="hover:bg-slate-100/60 dark:hover:bg-white/5">
                    <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{f.inboundFlightNumber}</td>
                    <td className="p-2.5 text-slate-700 dark:text-slate-300">{f.outboundFlightNumber}</td>
                    <td className="p-2.5 font-sans text-slate-800 dark:text-slate-200">{f.airlineName}</td>
                    <td className="p-2.5 font-sans text-slate-500 dark:text-slate-400">{f.agencyName}</td>
                    <td className="p-2.5 text-slate-700 dark:text-slate-300">{formatUtcDateTime(f.staUtc)}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{f.aircraftType}</td>
                    <td className="p-2.5 text-right font-bold text-amber-700 dark:text-amber-400">
                      {f.delayMinutesTotal ? `${f.delayMinutesTotal}m` : '-'}
                    </td>
                    <td className="p-2.5 text-right text-slate-800 dark:text-slate-200">
                      {f.totalPax ?? getPassengerTotal(f.adultPax, f.childPax, f.infantPax)}
                    </td>
                    <td className="p-2.5">
                      <span className="flex flex-wrap gap-1">
                        {f.delays.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          f.delays.map((d, idx) => (
                            <span
                              key={`${d.code}-${idx}`}
                              className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                            >
                              {d.code}
                              {d.minutes ? ` · ${d.minutes}m` : ''}
                            </span>
                          ))
                        )}
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-sans text-[10px] text-slate-600 dark:text-slate-300">
                      {f.flightStatus}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
};
