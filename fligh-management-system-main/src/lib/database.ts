import { Agency, Airline, AuthUser, Flight, FlightTemplate, TemplateSchedule } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

interface DatabaseSnapshot {
  flights: Flight[];
  airlines: Airline[];
  agencies: Agency[];
  templates: FlightTemplate[];
}

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

const failIfError = <T>(result: { data: T | null; error: { message: string } | null }) => {
  if (result.error) throw new Error(result.error.message);
  return result.data || [];
};

export const loadDatabaseSnapshot = async (): Promise<DatabaseSnapshot | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  const [flightsResult, airlinesResult, agenciesResult, templatesResult, schedulesResult] = await Promise.all([
    supabase.from('flights').select('*').order('flight_id', { ascending: false }),
    supabase.from('airlines').select('*').order('airline_id'),
    supabase.from('agencies').select('*').order('agency_id'),
    supabase.from('flight_templates').select('*').order('template_id'),
    supabase.from('template_schedules').select('*').order('template_id'),
  ]);

  const airlines = failIfError<DatabaseAirline[]>(airlinesResult).map((row) => ({
    airlineId: row.airline_id,
    airlineName: row.airline_name,
    iataCode: row.iata_code || undefined,
    country: row.country || undefined,
    handlingCompany: row.handling_company || undefined,
  }));
  const agencies = failIfError<DatabaseAgency[]>(agenciesResult).map((row) => ({
    agencyId: row.agency_id,
    agencyName: row.agency_name,
    contactEmail: row.contact_email || undefined,
    phone: row.phone || undefined,
  }));
  const schedules = failIfError<DatabaseSchedule[]>(schedulesResult).map((row) => ({
    scheduleId: row.schedule_id,
    templateId: row.template_id,
    frequency: row.frequency,
    daysOfWeek: row.days_of_week,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
  const templates = failIfError<DatabaseTemplate[]>(templatesResult).map((row) => ({
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
    schedule: schedules.find((schedule) => schedule.templateId === row.template_id),
  }));
  const flights = failIfError<DatabaseFlight[]>(flightsResult).map((row) => ({
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
  }));

  return { flights, airlines, agencies, templates };
};

export const authenticateUser = async (username: string, password: string): Promise<{ username: string; role: AuthUser['role'] } | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.rpc('authenticate_user', {
    p_username: username.trim(),
    p_password: password,
  });

  if (error) throw new Error(error.message);
  const account = Array.isArray(data) ? data[0] : data;
  if (!account) return null;

  return { username: account.username, role: account.role as AuthUser['role'] };
};

export const saveDatabaseSnapshot = async (snapshot: DatabaseSnapshot) => {
  if (!isSupabaseConfigured || !supabase) return;

  const existingFlightsResult = await supabase.from('flights').select('flight_id');
  const existingFlightIds = new Set((existingFlightsResult.data ?? []).map((row) => row.flight_id));
  const snapshotFlightIds = new Set(snapshot.flights.map((flight) => flight.flightId));
  const deletedFlightIds = [...existingFlightIds].filter((flightId) => !snapshotFlightIds.has(flightId));

  if (deletedFlightIds.length > 0) {
    const { error: deleteError } = await supabase.from('flights').delete().in('flight_id', deletedFlightIds);
    if (deleteError) throw new Error(`Supabase flight delete sync failed: ${deleteError.message}`);
  }

  const results = await Promise.all([
    supabase.from('airlines').upsert(snapshot.airlines.map((airline) => ({
      airline_id: airline.airlineId,
      airline_name: airline.airlineName,
      iata_code: airline.iataCode || null,
      country: airline.country || null,
      handling_company: airline.handlingCompany || null,
    }))),
    supabase.from('agencies').upsert(snapshot.agencies.map((agency) => ({
      agency_id: agency.agencyId,
      agency_name: agency.agencyName,
      contact_email: agency.contactEmail || null,
      phone: agency.phone || null,
    }))),
    supabase.from('flight_templates').upsert(snapshot.templates.map((template) => ({
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
    supabase.from('flights').upsert(snapshot.flights.map((flight) => ({
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

  const scheduleResult = await supabase.from('template_schedules').upsert(
    snapshot.templates
      .filter((template) => template.schedule)
      .map((template) => ({
        template_id: template.templateId,
        frequency: template.schedule!.frequency,
        days_of_week: template.schedule!.daysOfWeek,
        start_date: template.schedule!.startDate,
        end_date: template.schedule!.endDate,
      })),
    { onConflict: 'template_id' }
  );
  if (scheduleResult.error) throw new Error(`Supabase schedule sync failed: ${scheduleResult.error.message}`);
};

export const subscribeToDatabaseChanges = (onSnapshot: (snapshot: DatabaseSnapshot) => void) => {
  if (!isSupabaseConfigured || !supabase) return () => undefined;

  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const refreshSnapshot = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void loadDatabaseSnapshot()
        .then((snapshot) => snapshot && onSnapshot(snapshot))
        .catch((error) => console.error('Realtime database refresh failed:', error));
    }, 0);
  };

  const channel = supabase
    .channel('fms-database-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'flights' },
      refreshSnapshot
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'airlines' },
      refreshSnapshot
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'agencies' },
      refreshSnapshot
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'flight_templates' },
      refreshSnapshot
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'template_schedules' },
      refreshSnapshot
    );

  void channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.error(`Supabase realtime subscription ${status.toLowerCase()}.`);
    }
  });

  return () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    void supabase?.removeChannel(channel);
  };
};