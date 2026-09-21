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

const minutesBetween = (start: string | null | undefined, end: string | null | undefined): number | null => {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e)) return null;
  return Math.round((e - s) / 60000);
};

/**
 * Scheduled ground handling (turnaround) time in minutes, i.e. STD - STA.
 * Returns null when either timestamp is missing/invalid.
 */
export function getScheduledGroundTimeMinutes(flight: Pick<Flight, 'staUtc' | 'stdUtc'>): number | null {
  return minutesBetween(flight.staUtc, flight.stdUtc);
}

/**
 * Actual ground handling (turnaround) time in minutes, i.e. ATD - ATA.
 * Returns null until both actuals are recorded.
 */
export function getActualGroundTimeMinutes(
  flight: Pick<Flight, 'ataUtc' | 'atdUtc'>
): number | null {
  return minutesBetween(flight.ataUtc, flight.atdUtc);
}

/**
 * Ground-handling variance in minutes: actual turnaround minus scheduled turnaround.
 * A positive value means the flight stayed on the ground longer than its allocated
 * schedule and is therefore considered operationally delayed. Returns null when the
 * flight is not completed (no ATA/ATD) or the schedule is invalid.
 *
 * Example: STA 10:00 & STD 10:50 (50 min scheduled). If ATA 10:05 & ATD 11:00
 * (55 min actual) the variance is +5 min -> delayed by 5 minutes.
 */
export function getGroundHandlingVarianceMinutes(
  flight: Pick<Flight, 'staUtc' | 'stdUtc' | 'ataUtc' | 'atdUtc'>
): number | null {
  const scheduled = getScheduledGroundTimeMinutes(flight);
  const actual = getActualGroundTimeMinutes(flight);
  if (scheduled === null || actual === null) return null;
  return actual - scheduled;
}

/**
 * Whether a flight exceeded its scheduled ground handling time.
 * Only completed movements (with both ATA and ATD) can be evaluated; all others
 * return false so they are not counted as delay-caused but are still excluded
 * from the on-time numerator by their status.
 */
export function isGroundHandlingDelayed(
  flight: Pick<Flight, 'staUtc' | 'stdUtc' | 'ataUtc' | 'atdUtc'>
): boolean {
  const variance = getGroundHandlingVarianceMinutes(flight);
  return variance !== null && variance > 0;
}

/**
 * Minimum scheduled ground handling time (in minutes) required before a flight is
 * even evaluated for turnaround punctuality. Guards against degenerate schedules
 * where STD == STA. Defaults to 1 minute.
 */
export const MIN_EVALUABLE_GROUND_TIME_MINUTES = 1;

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

export type FlightExportColumn = {
  /** Column header label shown in the first row. */
  label: string;
  /** Excel column width in points. */
  width: number;
  /** Value for a given flight, already stringified. */
  value: (flight: Flight) => string;
  /** Centre the cell (used for numeric / time columns). */
  align?: 'left' | 'center';
};

const dateOnlyUtc = (dateInput: string | null | undefined): string => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getUTCFullYear()}`;
};

const timeOnlyUtc = (dateInput: string | null | undefined): string => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

const cellText = (value: number | null | undefined): string =>
  value === null || value === undefined || isNaN(value) ? '' : String(value);

/**
 * The single source of truth for the exported column layout. Both the Excel and
 * the PDF exporters read from this so the two never drift apart. Removed columns
 * (Flight ID, Airline, Agency, Full Route, Routing Type, Status, Cancellation
 * Reason) and the split date/time + incoming/outgoing passenger split live here.
 */
export const FLIGHT_EXPORT_COLUMNS: FlightExportColumn[] = [
  { label: 'Inbound Flight', width: 90, value: (f) => f.inboundFlightNumber },
  { label: 'Outbound Flight', width: 90, value: (f) => f.outboundFlightNumber },
  { label: 'Origin', width: 55, value: (f) => f.origin, align: 'center' },
  { label: 'Destination', width: 70, value: (f) => f.destination, align: 'center' },
  { label: 'Via / Stop', width: 60, value: (f) => f.via || '', align: 'center' },
  { label: 'Final Destination', width: 80, value: (f) => f.finalDestination, align: 'center' },
  { label: 'Aircraft Type', width: 80, value: (f) => f.aircraftType, align: 'center' },
  { label: 'Registration', width: 80, value: (f) => f.registration, align: 'center' },
  { label: 'STA Date', width: 70, value: (f) => dateOnlyUtc(f.staUtc), align: 'center' },
  { label: 'STA Time', width: 55, value: (f) => timeOnlyUtc(f.staUtc), align: 'center' },
  { label: 'STD Date', width: 70, value: (f) => dateOnlyUtc(f.stdUtc), align: 'center' },
  { label: 'STD Time', width: 55, value: (f) => timeOnlyUtc(f.stdUtc), align: 'center' },
  { label: 'ATA Date', width: 70, value: (f) => dateOnlyUtc(f.ataUtc), align: 'center' },
  { label: 'ATA Time', width: 55, value: (f) => timeOnlyUtc(f.ataUtc), align: 'center' },
  { label: 'ATD Date', width: 70, value: (f) => dateOnlyUtc(f.atdUtc), align: 'center' },
  { label: 'ATD Time', width: 55, value: (f) => timeOnlyUtc(f.atdUtc), align: 'center' },
  { label: 'Total Delay (min)', width: 75, value: (f) => f.delayMinutesTotal ? String(f.delayMinutesTotal) : '', align: 'center' },
  {
    label: 'Delays',
    width: 130,
    value: (f) => (f.delays.length > 0
      ? f.delays.map((d) => `${d.code}:${formatMinutesToHHMM(d.minutes)}`).join('; ')
      : ''),
  },
  { label: 'Outgoing Adult', width: 70, value: (f) => cellText(f.adultPax), align: 'center' },
  { label: 'Outgoing Child', width: 70, value: (f) => cellText(f.childPax), align: 'center' },
  { label: 'Outgoing Inf', width: 65, value: (f) => cellText(f.infantPax), align: 'center' },
  { label: 'Outgoing Total Pax', width: 80, value: (f) => cellText(f.totalPax), align: 'center' },
  { label: 'Outgoing Bags', width: 75, value: (f) => cellText(f.numberOfBags), align: 'center' },
  { label: 'Incoming Adult', width: 70, value: (f) => cellText(f.incomingAdultPax ?? null), align: 'center' },
  { label: 'Incoming Child', width: 70, value: (f) => cellText(f.incomingChildPax ?? null), align: 'center' },
  { label: 'Incoming Inf', width: 65, value: (f) => cellText(f.incomingInfantPax ?? null), align: 'center' },
  { label: 'Incoming Total Pax', width: 80, value: (f) => cellText(f.incomingTotalPax ?? null), align: 'center' },
  { label: 'Incoming Bags', width: 75, value: (f) => cellText(f.incomingNumberOfBags ?? null), align: 'center' },
  { label: 'Remarks', width: 200, value: (f) => f.remarks || '' },
];

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Excel worksheet names are limited to 31 chars and forbid : \ / ? * [ ]. */
const safeSheetName = (name: string): string => {
  const cleaned = name.replace(/[:\\/?*\[\]]/g, '-').replace(/^'+|'+$/g, '').trim();
  return (cleaned || 'Flights').slice(0, 31);
};

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Builds an Excel XML Spreadsheet 2003 document. This format is opened natively
 * by Excel (and LibreOffice) and supports real styling — a coloured/bold header
 * row, frozen header, banded rows, borders, per-column widths and a named
 * worksheet — none of which a plain CSV can carry.
 *
 * @param sheetName Visible worksheet/tab name (e.g. the exported date).
 * @param title     Big title rendered above the table.
 * @param subtitle  Secondary line (e.g. the filtered date range).
 */
export function buildFlightsExcelXml(
  flights: Flight[],
  sheetName: string,
  title: string,
  subtitle: string
): string {
  const columns = FLIGHT_EXPORT_COLUMNS;
  const columnCount = columns.length;

  const headerCells = columns
    .map((c) => `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`)
    .join('');

  const rowCells = (flight: Flight, styleId: string) => columns
    .map((c) => {
      const cls = c.align === 'center' ? `${styleId}Center` : styleId;
      return `<Cell ss:StyleID="${cls}"><Data ss:Type="String">${escapeXml(c.value(flight))}</Data></Cell>`;
    })
    .join('');

  const bodyRows = flights
    .map((f, index) => {
      const styleId = index % 2 === 0 ? 'sRowA' : 'sRowB';
      return `<Row ss:Height="16">${rowCells(f, styleId)}</Row>`;
    })
    .join('\n');

  const columnDefs = columns
    .map((c) => `<Column ss:AutoFitWidth="0" ss:Width="${c.width}"/>`)
    .join('');

  const headerRowIndex = 3; // rows 1-2 are the title/subtitle, row 3 is the header
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${escapeXml(title)}</Title>
    <Author>Flight Management System</Author>
 </DocumentProperties>
 <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
    </Style>
    <Style ss:ID="sTitle">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#0F172A"/>
    </Style>
    <Style ss:ID="sSubtitle">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#475569"/>
    </Style>
    <Style ss:ID="sHeader">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0F5C8C" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B4668"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B4668"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B4668"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B4668"/>
      </Borders>
    </Style>
    <Style ss:ID="sRowA">
      <Alignment ss:Vertical="Center"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/>
      </Borders>
    </Style>
    <Style ss:ID="sRowACenter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/>
      </Borders>
    </Style>
    <Style ss:ID="sRowB">
      <Alignment ss:Vertical="Center"/>
      <Interior ss:Color="#EEF4F9" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/>
      </Borders>
    </Style>
    <Style ss:ID="sRowBCenter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Interior ss:Color="#EEF4F9" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/>
      </Borders>
    </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(safeSheetName(sheetName))}">
    <Table ss:ExpandedColumnCount="${columnCount}" ss:ExpandedRowCount="${flights.length + headerRowIndex}" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
      ${columnDefs}
      <Row ss:Height="22"><Cell ss:MergeAcross="${columnCount - 1}" ss:StyleID="sTitle"><Data ss:Type="String">${escapeXml(title)}</Data></Cell></Row>
      <Row ss:Height="16"><Cell ss:MergeAcross="${columnCount - 1}" ss:StyleID="sSubtitle"><Data ss:Type="String">${escapeXml(subtitle)}</Data></Cell></Row>
      <Row ss:Height="30">${headerCells}</Row>
      ${bodyRows}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>${headerRowIndex}</SplitHorizontal>
      <TopRowBottomPane>${headerRowIndex}</TopRowBottomPane>
      <ActivePane>2</ActivePane>
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
      <PageSetup>
        <Layout x:Orientation="Landscape"/>
        <Header x:Margin="0.3"/>
        <Footer x:Margin="0.3"/>
        <PageMargins x:Bottom="0.4" x:Left="0.3" x:Right="0.3" x:Top="0.4"/>
      </PageSetup>
      <Print>
        <ValidPrinterInfo/>
        <PaperSizeIndex>9</PaperSizeIndex>
        <HorizontalResolution>600</HorizontalResolution>
        <VerticalResolution>600</VerticalResolution>
      </Print>
      <Selected/>
      <Panes>
        <Pane>
          <Number>3</Number>
          <ActiveRow>${headerRowIndex}</ActiveRow>
          <ActiveCol>0</ActiveCol>
        </Pane>
      </Panes>
    </WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

/**
 * Exports the given flights as a professionally styled Excel workbook.
 *
 * @param flights    Rows to export (the currently filtered list).
 * @param sheetName  Worksheet/tab name — typically the exported date.
 * @param rangeLabel Human-readable date range shown under the title.
 */
export function exportFlightsToExcel(
  flights: Flight[],
  sheetName: string,
  rangeLabel: string
): void {
  const title = 'Flight Operations Report';
  const subtitle = rangeLabel ? `${sheetName}  •  ${rangeLabel}  •  All times UTC` : `${sheetName}  •  All times UTC`;
  const xml = buildFlightsExcelXml(flights, sheetName, title, subtitle);
  const blob = new Blob(['\ufeff', xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  triggerDownload(blob, `Flight_Operations_${sheetName.replace(/[^0-9A-Za-z-]/g, '-')}.xls`);
}

/**
 * Opens a print-ready, landscape PDF view of the flights and invokes the browser
 * print dialog (users choose "Save as PDF"). Styling is scoped so only the report
 * prints, not the surrounding app UI.
 */
export function exportFlightsToPdf(
  flights: Flight[],
  sheetName: string,
  rangeLabel: string
): void {
  const columns = FLIGHT_EXPORT_COLUMNS;
  const subtitle = rangeLabel ? `${sheetName}  •  ${rangeLabel}  •  All times UTC` : `${sheetName}  •  All times UTC`;

  const headerHtml = columns.map((c) => `<th>${escapeXml(c.label)}</th>`).join('');
  const bodyHtml = flights
    .map((f) => {
      const cells = columns
        .map((c) => `<td class="${c.align === 'center' ? 'c' : ''}">${escapeXml(c.value(f))}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked — allow popups to export the PDF.');
  }

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeXml(sheetName)} — Flight Operations Report</title>
<style>
  /* Force the print engine into landscape A4. Chrome honours the @page size for
     the PDF page box, and the fixed-width table below keeps every column on the
     page even if the printer/profile still defaults to portrait. */
  @page { size: A4 landscape; margin: 8mm; }
  html, body { width: 100%; }
  * { box-sizing: border-box; }
  body { font-family: Calibri, Arial, sans-serif; color: #1e293b; margin: 0; padding: 10px 12px; }
  h1 { font-size: 17px; margin: 0 0 2px; color: #0f172a; }
  .sub { font-size: 10px; color: #475569; margin-bottom: 10px; }
  /* table-layout: fixed + 100% width shares the available landscape width across
     every column, so nothing is pushed off the right edge of the page. */
  table { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 8px; }
  thead th {
    background: #0f5c8c; color: #fff; font-weight: 700; text-align: left;
    padding: 4px 3px; border: 1px solid #0b4668;
    white-space: normal; overflow-wrap: anywhere; word-break: break-word; line-height: 1.15;
  }
  tbody td {
    padding: 3px; border: 1px solid #dce3ea; vertical-align: middle;
    overflow-wrap: anywhere; word-break: break-word;
  }
  tbody td.c { text-align: center; }
  tbody tr:nth-child(even) td { background: #eef4f9; }
  thead { display: table-header-group; }
  tr, td, th { page-break-inside: avoid; }
</style>
</head>
<body>
 <h1>Flight Operations Report</h1>
 <div class="sub">${escapeXml(subtitle)}</div>
 <table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${bodyHtml}</tbody>
 </table>
</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
  // Fallback for browsers that already fired onload before assignment.
  setTimeout(() => {
    try {
      printWindow.print();
    } catch {
      // ignore
    }
  }, 300);
}
