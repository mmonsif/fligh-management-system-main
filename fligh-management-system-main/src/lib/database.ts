import {
  Agency,
  Airline,
  AppUserAccount,
  AuditEvent,
  AuthUser,
  Flight,
  FlightTemplate,
  LIR_COMPARTMENT_NOS,
  LoadingCompartment,
  LoadingInstruction,
  LirStatus,
  TemplateSchedule,
  UserRole,
} from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

/**
 * Normalise a flight for comparison so that values Supabase returns slightly
 * differently (e.g. 'undefined' vs 'null', ISO offsets) do not look like a change.
 */
const normaliseFlightForCompare = (flight: Flight) => JSON.stringify({
  ...flight,
  via: flight.via ?? null,
  ataUtc: flight.ataUtc ?? null,
  atdUtc: flight.atdUtc ?? null,
  cancellationReason: flight.cancellationReason ?? null,
});

export interface DatabaseSnapshot {
  flights: Flight[];
  airlines: Airline[];
  agencies: Agency[];
  templates: FlightTemplate[];
}

export type DatabaseChange =
  | { table: 'flights'; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: Flight | null; id: number }
  | { table: 'airlines'; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: Airline | null; id: number }
  | { table: 'agencies'; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: Agency | null; id: number }
  | { table: 'flight_templates'; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: FlightTemplate | null; id: number }
  | { table: 'template_schedules'; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: TemplateSchedule | null; id: number };

type DatabaseAirline = {
  airline_id: number;
  airline_name: string;
  iata_code: string | null;
  country: string | null;
  handling_company: string | null;
};

type DatabaseAgency = {
  agency_id: number;
  agency_name: string;
  contact_email: string | null;
  phone: string | null;
};

type DatabaseTemplate = {
  template_id: number;
  template_name: string;
  inbound_flight_number: string;
  outbound_flight_number: string;
  sta_time_of_day: string;
  std_time_of_day: string;
  origin: string;
  destination: string;
  via: string | null;
  final_destination: string;
  airline_id: number;
  agency_id: number;
  aircraft_type: string;
};

type DatabaseSchedule = {
  schedule_id: number;
  template_id: number;
  frequency: TemplateSchedule['frequency'];
  days_of_week: string;
  start_date: string;
  end_date: string;
};

type DatabaseFlight = {
  flight_id: number;
  inbound_flight_number: string;
  outbound_flight_number: string;
  sta_utc: string;
  std_utc: string;
  ata_utc: string | null;
  atd_utc: string | null;
  origin: string;
  destination: string;
  via: string | null;
  final_destination: string;
  airline_id: number;
  airline_name: string;
  agency_id: number;
  agency_name: string;
  aircraft_type: string;
  registration: string;
  remarks: string;
  number_of_bags: number | null;
  incoming_number_of_bags: number | null;
  adult_pax: number | null;
  child_pax: number | null;
  infant_pax: number | null;
  total_pax: number | null;
  incoming_adult_pax: number | null;
  incoming_child_pax: number | null;
  incoming_infant_pax: number | null;
  incoming_total_pax: number | null;
  delays: Flight['delays'];
  flight_status: Flight['flightStatus'];
  cancellation_reason: string | null;
  delay_minutes_total: number;
};

const mapAirline = (row: DatabaseAirline): Airline => ({
  airlineId: row.airline_id,
  airlineName: row.airline_name,
  iataCode: row.iata_code || undefined,
  country: row.country || undefined,
  handlingCompany: row.handling_company || undefined,
});

const mapAgency = (row: DatabaseAgency): Agency => ({
  agencyId: row.agency_id,
  agencyName: row.agency_name,
  contactEmail: row.contact_email || undefined,
  phone: row.phone || undefined,
});

const mapSchedule = (row: DatabaseSchedule): TemplateSchedule => ({
  scheduleId: row.schedule_id,
  templateId: row.template_id,
  frequency: row.frequency,
  daysOfWeek: row.days_of_week,
  startDate: row.start_date,
  endDate: row.end_date,
});

const mapTemplate = (row: DatabaseTemplate, schedule?: TemplateSchedule): FlightTemplate => ({
  templateId: row.template_id,
  templateName: row.template_name,
  inboundFlightNumber: row.inbound_flight_number,
  outboundFlightNumber: row.outbound_flight_number,
  staTimeOfDay: row.sta_time_of_day.slice(0, 5),
  stdTimeOfDay: row.std_time_of_day.slice(0, 5),
  origin: row.origin,
  destination: row.destination,
  via: row.via || undefined,
  finalDestination: row.final_destination,
  airlineId: row.airline_id,
  agencyId: row.agency_id,
  aircraftType: row.aircraft_type,
  schedule,
});

const mapFlight = (row: DatabaseFlight): Flight => ({
  flightId: row.flight_id,
  inboundFlightNumber: row.inbound_flight_number,
  outboundFlightNumber: row.outbound_flight_number,
  staUtc: row.sta_utc,
  stdUtc: row.std_utc,
  ataUtc: row.ata_utc,
  atdUtc: row.atd_utc,
  origin: row.origin,
  destination: row.destination,
  via: row.via || undefined,
  finalDestination: row.final_destination,
  airlineId: row.airline_id,
  airlineName: row.airline_name,
  agencyId: row.agency_id,
  agencyName: row.agency_name,
  aircraftType: row.aircraft_type,
  registration: row.registration,
  remarks: row.remarks,
  numberOfBags: row.number_of_bags,
  incomingNumberOfBags: row.incoming_number_of_bags,
  adultPax: row.adult_pax,
  childPax: row.child_pax,
  infantPax: row.infant_pax,
  totalPax: row.total_pax,
  incomingAdultPax: row.incoming_adult_pax,
  incomingChildPax: row.incoming_child_pax,
  incomingInfantPax: row.incoming_infant_pax,
  incomingTotalPax: row.incoming_total_pax,
  delays: row.delays,
  flightStatus: row.flight_status,
  cancellationReason: row.cancellation_reason || undefined,
  delayMinutesTotal: row.delay_minutes_total,
});

const failIfError = <T>(result: { data: T | null; error: { message: string } | null }) => {
  if (result.error) throw new Error(result.error.message);
  return result.data || [];
};

const loadAllFlights = async (): Promise<DatabaseFlight[]> => {
  const pageSize = 1000;
  const flights: DatabaseFlight[] = [];
  let pageStart = 0;

  while (true) {
    const result = await supabase!
      .from('flights')
      .select('*')
      .order('flight_id', { ascending: false })
      .range(pageStart, pageStart + pageSize - 1);
    const page = failIfError<DatabaseFlight[]>(result);
    flights.push(...page);
    if (page.length < pageSize) return flights;
    pageStart += pageSize;
  }
};

export const loadDatabaseSnapshot = async (): Promise<DatabaseSnapshot | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  const [flightsResult, airlinesResult, agenciesResult, templatesResult, schedulesResult] = await Promise.all([
    loadAllFlights(),
    supabase.from('airlines').select('*').order('airline_id'),
    supabase.from('agencies').select('*').order('agency_id'),
    supabase.from('flight_templates').select('*').order('template_id'),
    supabase.from('template_schedules').select('*').order('template_id'),
  ]);

  const flights = flightsResult.map(mapFlight);
  const airlines = failIfError<DatabaseAirline[]>(airlinesResult).map(mapAirline);
  const agencies = failIfError<DatabaseAgency[]>(agenciesResult).map(mapAgency);
  const schedules = failIfError<DatabaseSchedule[]>(schedulesResult).map(mapSchedule);
  const templates = failIfError<DatabaseTemplate[]>(templatesResult).map((row) =>
    mapTemplate(row, schedules.find((schedule) => schedule.templateId === row.template_id))
  );
  return { flights, airlines, agencies, templates };
};

const mapAuthUser = (account: { username: string; role: string; session_id: string }): AuthUser => {
  if (!account.session_id) {
    throw new Error('Database login is not configured. Run supabase/user_audit.sql in the Supabase SQL Editor.');
  }
  return {
    username: account.username,
    role: account.role as UserRole,
    sessionId: account.session_id,
  };
};

const mapAppUser = (row: { user_id: number; username: string; role: string; is_active: boolean; created_at: string }): AppUserAccount => ({
  userId: row.user_id,
  username: row.username,
  role: row.role as UserRole,
  isActive: row.is_active,
  createdAt: row.created_at,
});

const mapAuditEvent = (row: {
  audit_id: number;
  occurred_at: string;
  actor_username: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  details: Record<string, unknown> | null;
}): AuditEvent => ({
  auditId: row.audit_id,
  occurredAt: row.occurred_at,
  actorUsername: row.actor_username,
  action: row.action,
  entityType: row.entity_type,
  entityId: row.entity_id,
  summary: row.summary,
  details: row.details,
});

export const hasAppUsers = async (): Promise<boolean> => {
  if (!isSupabaseConfigured || !supabase) return true;

  const { data, error } = await supabase.rpc('has_app_users');
  if (error) throw new Error(error.message);
  return Boolean(data);
};

export const bootstrapFirstAdmin = async (username: string, password: string): Promise<AuthUser> => {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase.rpc('bootstrap_first_admin', {
    p_username: username.trim(),
    p_password: password,
  });
  if (error) throw new Error(error.message);
  const account = Array.isArray(data) ? data[0] : data;
  if (!account) throw new Error('Could not create the first administrator.');
  return mapAuthUser(account);
};

export const authenticateUser = async (username: string, password: string): Promise<AuthUser | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.rpc('authenticate_user', {
    p_username: username.trim(),
    p_password: password,
  });

  if (error) throw new Error(error.message);
  const account = Array.isArray(data) ? data[0] : data;
  if (!account) return null;

  return mapAuthUser(account);
};

export const validateSession = async (sessionId: string): Promise<AuthUser | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.rpc('validate_session', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  const account = Array.isArray(data) ? data[0] : data;
  if (!account) return null;
  return { username: account.username, role: account.role as UserRole, sessionId };
};

export const listAppUsers = async (sessionId: string): Promise<AppUserAccount[]> => {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase.rpc('list_app_users', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  return (data || []).map(mapAppUser);
};

export const createAppUser = async (
  sessionId: string,
  username: string,
  password: string,
  role: UserRole
): Promise<AppUserAccount> => {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase.rpc('create_app_user', {
    p_session_id: sessionId,
    p_username: username.trim(),
    p_password: password,
    p_role: role,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Could not create the user.');
  return mapAppUser(row);
};

export const updateAppUser = async (
  sessionId: string,
  userId: number,
  role: UserRole,
  password: string,
  isActive: boolean
): Promise<AppUserAccount> => {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase.rpc('update_app_user', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_role: role,
    p_password: password,
    p_is_active: isActive,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Could not update the user.');
  return mapAppUser(row);
};

export const recordAuditEvent = async (
  sessionId: string,
  action: string,
  entityType: string,
  entityId: string | number | null,
  summary: string,
  details?: Record<string, unknown>
): Promise<void> => {
  if (!isSupabaseConfigured || !supabase) return;

  const { error } = await supabase.rpc('record_audit_event', {
    p_session_id: sessionId,
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId === null || entityId === undefined ? null : String(entityId),
    p_summary: summary,
    p_details: details ?? null,
  });
  if (error) console.error('Audit log failed:', error.message);
};

export const listAuditEvents = async (sessionId: string): Promise<AuditEvent[]> => {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase.rpc('list_audit_events', {
    p_session_id: sessionId,
    p_limit: 250,
    p_offset: 0,
  });
  if (error) throw new Error(error.message);
  return (data || []).map(mapAuditEvent);
};

export const saveDatabaseSnapshot = async (snapshot: DatabaseSnapshot, previousSnapshot?: DatabaseSnapshot) => {
  if (!isSupabaseConfigured || !supabase) return;

  const changedRowsFn = <T extends object>(
    currentRows: T[],
    previousRows: T[] | undefined,
    key: keyof T,
    serialise: (row: T) => string = (row) => JSON.stringify(row)
  ) => {
    const previousById = new Map((previousRows ?? []).map((row) => [row[key], serialise(row)]));
    return currentRows.filter((row) => previousById.get(row[key]) !== serialise(row));
  };

  // Skip empty upserts entirely: they are a no-op and some PostgREST versions error on them.
  const upsert = (table: string, rows: object[]) =>
    rows.length > 0
      ? supabase!.from(table).upsert(rows)
      : Promise.resolve({ data: null, error: null });

  const changedFlights = changedRowsFn(snapshot.flights, previousSnapshot?.flights, 'flightId', normaliseFlightForCompare);
  const changedAirlines = changedRowsFn(snapshot.airlines, previousSnapshot?.airlines, 'airlineId');
  const changedAgencies = changedRowsFn(snapshot.agencies, previousSnapshot?.agencies, 'agencyId');
  const changedTemplates = changedRowsFn(snapshot.templates, previousSnapshot?.templates, 'templateId');

  // Only delete rows that were present in the previous baseline but are now gone.
  // We must NOT delete every DB row absent from the snapshot: a stale/partial
  // in-memory snapshot would otherwise wipe live rows (this was the data-loss path
  // when a flight edit was followed by a realtime echo).
  const previousFlightIds = new Set((previousSnapshot?.flights ?? []).map((flight) => flight.flightId));
  const snapshotFlightIds = new Set(snapshot.flights.map((flight) => flight.flightId));
  const deletedFlightIds = previousSnapshot
    ? [...previousFlightIds].filter((flightId) => !snapshotFlightIds.has(flightId))
    : [];

  if (deletedFlightIds.length > 0) {
    const { error: deleteError } = await supabase.from('flights').delete().in('flight_id', deletedFlightIds);
    if (deleteError) throw new Error(`Supabase flight delete sync failed: ${deleteError.message}`);
  }

  // Parents (airlines, agencies, templates) must be written before the rows that
  // reference them (flights, template_schedules) or foreign keys can reject the write.
  const parentResults = await Promise.all([
    upsert('airlines', changedAirlines.map((airline) => ({
      airline_id: airline.airlineId,
      airline_name: airline.airlineName,
      iata_code: airline.iataCode || null,
      country: airline.country || null,
      handling_company: airline.handlingCompany || null,
    }))),
    upsert('agencies', changedAgencies.map((agency) => ({
      agency_id: agency.agencyId,
      agency_name: agency.agencyName,
      contact_email: agency.contactEmail || null,
      phone: agency.phone || null,
    }))),
    upsert('flight_templates', changedTemplates.map((template) => ({
      template_id: template.templateId,
      template_name: template.templateName,
      inbound_flight_number: template.inboundFlightNumber,
      outbound_flight_number: template.outboundFlightNumber,
      sta_time_of_day: template.staTimeOfDay,
      std_time_of_day: template.stdTimeOfDay,
      origin: template.origin,
      destination: template.destination,
      via: template.via || null,
      final_destination: template.finalDestination,
      airline_id: template.airlineId,
      agency_id: template.agencyId,
      aircraft_type: template.aircraftType,
    }))),
  ]);

  const failedParent = parentResults.find((result) => result.error);
  if (failedParent?.error) throw new Error(`Supabase sync failed: ${failedParent.error.message}`);

  const results = await Promise.all([
    ...parentResults,
    upsert('flights', changedFlights.map((flight) => ({
      flight_id: flight.flightId,
      inbound_flight_number: flight.inboundFlightNumber,
      outbound_flight_number: flight.outboundFlightNumber,
      sta_utc: flight.staUtc,
      std_utc: flight.stdUtc,
      ata_utc: flight.ataUtc,
      atd_utc: flight.atdUtc,
      origin: flight.origin,
      destination: flight.destination,
      via: flight.via || null,
      final_destination: flight.finalDestination,
      airline_id: flight.airlineId,
      airline_name: flight.airlineName,
      agency_id: flight.agencyId,
      agency_name: flight.agencyName,
      aircraft_type: flight.aircraftType,
      registration: flight.registration,
      remarks: flight.remarks,
      number_of_bags: flight.numberOfBags,
      incoming_number_of_bags: flight.incomingNumberOfBags ?? null,
      adult_pax: flight.adultPax,
      child_pax: flight.childPax,
      infant_pax: flight.infantPax,
      total_pax: flight.totalPax,
      incoming_adult_pax: flight.incomingAdultPax ?? null,
      incoming_child_pax: flight.incomingChildPax ?? null,
      incoming_infant_pax: flight.incomingInfantPax ?? null,
      incoming_total_pax: flight.incomingTotalPax ?? null,
      delays: flight.delays,
      flight_status: flight.flightStatus,
      cancellation_reason: flight.cancellationReason || null,
      delay_minutes_total: flight.delayMinutesTotal,
    }))),
  ]);

  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`Supabase sync failed: ${failed.error.message}`);

  const schedulesToUpsert = changedTemplates
    .filter((template) => template.schedule)
    .map((template) => ({
      template_id: template.templateId,
      frequency: template.schedule!.frequency,
      days_of_week: template.schedule!.daysOfWeek,
      start_date: template.schedule!.startDate,
      end_date: template.schedule!.endDate,
    }));
  if (schedulesToUpsert.length > 0) {
    const { error: scheduleError } = await supabase
      .from('template_schedules')
      .upsert(schedulesToUpsert, { onConflict: 'template_id' });
    if (scheduleError) throw new Error(`Supabase schedule sync failed: ${scheduleError.message}`);
  }
};

export const subscribeToDatabaseChanges = (onChange: (change: DatabaseChange) => void) => {
  if (!isSupabaseConfigured || !supabase) return () => undefined;

  const handleChange = (table: DatabaseChange['table'], payload: { eventType: string; new: unknown; old: unknown }) => {
    const eventType = payload.eventType as DatabaseChange['eventType'];
    const source = (eventType === 'DELETE' ? payload.old : payload.new) as Record<string, unknown>;

    if (table === 'flights') {
      onChange({ table, eventType, id: Number(source.flight_id), record: eventType === 'DELETE' ? null : mapFlight(source as unknown as DatabaseFlight) });
    } else if (table === 'airlines') {
      onChange({ table, eventType, id: Number(source.airline_id), record: eventType === 'DELETE' ? null : mapAirline(source as unknown as DatabaseAirline) });
    } else if (table === 'agencies') {
      onChange({ table, eventType, id: Number(source.agency_id), record: eventType === 'DELETE' ? null : mapAgency(source as unknown as DatabaseAgency) });
    } else if (table === 'flight_templates') {
      onChange({ table, eventType, id: Number(source.template_id), record: eventType === 'DELETE' ? null : mapTemplate(source as unknown as DatabaseTemplate) });
    } else {
      onChange({ table, eventType, id: Number(source.template_id), record: eventType === 'DELETE' ? null : mapSchedule(source as unknown as DatabaseSchedule) });
    }
  };

  const channel = supabase
    .channel('fms-database-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'flights' },
      (payload) => handleChange('flights', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'airlines' },
      (payload) => handleChange('airlines', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'agencies' },
      (payload) => handleChange('agencies', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'flight_templates' },
      (payload) => handleChange('flight_templates', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'template_schedules' },
      (payload) => handleChange('template_schedules', payload)
    );

  void channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.error(`Supabase realtime subscription ${status.toLowerCase()}.`);
    }
  });

  return () => {
    void supabase?.removeChannel(channel);
  };
};

const LIR_STORAGE_KEY = 'fms_lirs';

type DatabaseLir = {
  lir_id: number;
  flight_id: number;
  status: LirStatus;
  deviation_notes: string;
  load_control_notes: string;
  planned_by: string | null;
  planned_at: string | null;
  actual_by: string | null;
  actual_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  updated_at: string;
};

type DatabaseLirHold = {
  lir_id: number;
  compartment_no: number;
  planned_bags: number | null;
  actual_bags: number | null;
  planned_text?: string | null;
  actual_text?: string | null;
};

const emptyCompartments = (): LoadingCompartment[] =>
  LIR_COMPARTMENT_NOS.map((compartmentNo) => ({
    compartmentNo,
    plannedBags: null,
    actualBags: null,
    plannedText: '',
    actualText: '',
  }));

const mergeCompartments = (holds: DatabaseLirHold[]): LoadingCompartment[] =>
  emptyCompartments().map((compartment) => {
    const hold = holds.find((row) => row.compartment_no === compartment.compartmentNo);
    return {
      ...compartment,
      plannedBags: hold?.planned_bags ?? null,
      actualBags: hold?.actual_bags ?? null,
      plannedText: hold?.planned_text ?? '',
      actualText: hold?.actual_text ?? '',
    };
  });

const mapLoadingInstruction = (row: DatabaseLir, holds: DatabaseLirHold[]): LoadingInstruction => ({
  lirId: row.lir_id,
  flightId: row.flight_id,
  status: row.status,
  compartments: mergeCompartments(holds),
  deviationNotes: row.deviation_notes || '',
  loadControlNotes: row.load_control_notes || '',
  plannedBy: row.planned_by,
  plannedAt: row.planned_at,
  actualBy: row.actual_by,
  actualAt: row.actual_at,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  updatedAt: row.updated_at,
});

const readLocalLirs = (): LoadingInstruction[] => {
  try {
    const saved = localStorage.getItem(LIR_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as LoadingInstruction[]) : [];
  } catch {
    return [];
  }
};

const writeLocalLirs = (rows: LoadingInstruction[]) => {
  try {
    localStorage.setItem(LIR_STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // ignore
  }
};

export const createDraftLoadingInstruction = (flightId: number): LoadingInstruction => ({
  lirId: 0,
  flightId,
  status: 'draft',
  compartments: emptyCompartments(),
  deviationNotes: '',
  loadControlNotes: '',
  plannedBy: null,
  plannedAt: null,
  actualBy: null,
  actualAt: null,
  approvedBy: null,
  approvedAt: null,
  updatedAt: new Date().toISOString(),
});

export const loadLoadingInstruction = async (flightId: number): Promise<LoadingInstruction> => {
  if (!isSupabaseConfigured || !supabase) {
    return readLocalLirs().find((row) => row.flightId === flightId) ?? createDraftLoadingInstruction(flightId);
  }

  const headerResult = await supabase
    .from('loading_instructions')
    .select('*')
    .eq('flight_id', flightId)
    .maybeSingle();
  if (headerResult.error) throw new Error(headerResult.error.message);
  if (!headerResult.data) return createDraftLoadingInstruction(flightId);

  const holdsResult = await supabase
    .from('loading_instruction_holds')
    .select('*')
    .eq('lir_id', headerResult.data.lir_id)
    .order('compartment_no');
  if (holdsResult.error) throw new Error(holdsResult.error.message);

  return mapLoadingInstruction(headerResult.data as DatabaseLir, (holdsResult.data || []) as DatabaseLirHold[]);
};

export const saveLoadingInstruction = async (instruction: LoadingInstruction): Promise<LoadingInstruction> => {
  const now = new Date().toISOString();
  const compartments = mergeCompartments(
    instruction.compartments.map((compartment) => ({
      lir_id: instruction.lirId,
      compartment_no: compartment.compartmentNo,
      planned_bags: compartment.plannedBags,
      actual_bags: compartment.actualBags,
      planned_text: compartment.plannedText ?? '',
      actual_text: compartment.actualText ?? '',
    }))
  );

  if (!isSupabaseConfigured || !supabase) {
    const next: LoadingInstruction = {
      ...instruction,
      lirId: instruction.lirId || instruction.flightId,
      compartments,
      updatedAt: now,
    };
    const others = readLocalLirs().filter((row) => row.flightId !== instruction.flightId);
    writeLocalLirs([...others, next]);
    return next;
  }

  const headerPayload = {
    flight_id: instruction.flightId,
    status: instruction.status,
    deviation_notes: instruction.deviationNotes,
    load_control_notes: instruction.loadControlNotes,
    planned_by: instruction.plannedBy,
    planned_at: instruction.plannedAt,
    actual_by: instruction.actualBy,
    actual_at: instruction.actualAt,
    approved_by: instruction.approvedBy,
    approved_at: instruction.approvedAt,
    updated_at: now,
  };

  const headerResult = instruction.lirId
    ? await supabase
        .from('loading_instructions')
        .update(headerPayload)
        .eq('lir_id', instruction.lirId)
        .select('*')
        .single()
    : await supabase
        .from('loading_instructions')
        .upsert(headerPayload, { onConflict: 'flight_id' })
        .select('*')
        .single();

  if (headerResult.error) throw new Error(headerResult.error.message);
  const savedHeader = headerResult.data as DatabaseLir;

  const holdRows = compartments.map((compartment) => ({
    lir_id: savedHeader.lir_id,
    compartment_no: compartment.compartmentNo,
    planned_bags: compartment.plannedBags,
    actual_bags: compartment.actualBags,
    planned_text: compartment.plannedText ?? '',
    actual_text: compartment.actualText ?? '',
  }));

  let holdsResult = await supabase
    .from('loading_instruction_holds')
    .upsert(holdRows, { onConflict: 'lir_id,compartment_no' })
    .select('*');

  // If the database predates the free-text migration the upsert is rejected for the
  // unknown columns. When the user actually typed free text we must NOT drop it
  // silently (that is what made "remaining" come back as NIL), so surface a clear,
  // actionable error. If there is no text to save, fall back to the numeric-only
  // write so ordinary saves keep working on an unmigrated database.
  const hasFreeText = compartments.some(
    (compartment) =>
      Boolean(compartment.plannedText && compartment.plannedText.trim()) ||
      Boolean(compartment.actualText && compartment.actualText.trim())
  );
  if (holdsResult.error && /planned_text|actual_text|column .* does not exist/i.test(holdsResult.error.message)) {
    if (hasFreeText) {
      throw new Error(
        'This database is missing the free-text hold columns. Run supabase/loading_instructions.sql ' +
          '(adds planned_text / actual_text to loading_instruction_holds) to save text such as "remaining".'
      );
    }
    const numericRows = compartments.map((compartment) => ({
      lir_id: savedHeader.lir_id,
      compartment_no: compartment.compartmentNo,
      planned_bags: compartment.plannedBags,
      actual_bags: compartment.actualBags,
    }));
    holdsResult = await supabase
      .from('loading_instruction_holds')
      .upsert(numericRows, { onConflict: 'lir_id,compartment_no' })
      .select('*');
  }
  if (holdsResult.error) throw new Error(holdsResult.error.message);

  return mapLoadingInstruction(savedHeader, (holdsResult.data || holdRows) as DatabaseLirHold[]);
};

export const subscribeToLoadingInstruction = (
  flightId: number,
  onChange: (instruction: LoadingInstruction) => void
) => {
  if (!isSupabaseConfigured || !supabase) return () => undefined;

  const reload = () => {
    void loadLoadingInstruction(flightId)
      .then(onChange)
      .catch((error) => console.error('LIR reload failed:', error));
  };

  const channel = supabase
    .channel(`fms-lir-${flightId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'loading_instructions', filter: `flight_id=eq.${flightId}` },
      reload
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'loading_instruction_holds' },
      reload
    );

  void channel.subscribe();
  return () => {
    void supabase?.removeChannel(channel);
  };
};
