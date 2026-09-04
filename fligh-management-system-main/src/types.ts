export type FlightStatus =
  | 'Scheduled'
  | 'Not Arrived'
  | 'Arrived - Not Departed'
  | 'Departed - Not Arrived'
  | 'Not Departed'
  | 'Completed'
  | 'Canceled';

export interface FlightDelay {
  code: string;
  minutes: number;
}

export interface Flight {
  flightId: number;
  inboundFlightNumber: string;
  outboundFlightNumber: string;
  staUtc: string; // ISO string YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm
  stdUtc: string;
  ataUtc: string | null;
  atdUtc: string | null;
  origin: string;
  destination: string;
  via?: string; // Optional intermediate / 2nd stop for triangle flights (e.g. LHR-CAI-HRG-LHR)
  finalDestination: string;
  airlineId: number;
  airlineName: string;
  agencyId: number;
  agencyName: string;
  aircraftType: string;
  registration: string;
  remarks: string;
  numberOfBags: number | null;
  incomingNumberOfBags?: number | null;
  adultPax: number | null;
  childPax: number | null;
  infantPax: number | null;
  totalPax: number | null;
  incomingAdultPax?: number | null;
  incomingChildPax?: number | null;
  incomingInfantPax?: number | null;
  incomingTotalPax?: number | null;
  delays: FlightDelay[];
  flightStatus: FlightStatus;
  cancellationReason?: string;
  delayMinutesTotal: number;
}

export interface Airline {
  airlineId: number;
  airlineName: string;
  iataCode?: string;
  country?: string;
  handlingCompany?: string;
}

export interface Agency {
  agencyId: number;
  agencyName: string;
  contactEmail?: string;
  phone?: string;
}

export interface TemplateSchedule {
  scheduleId?: number;
  templateId: number;
  frequency: 'Daily' | 'Weekly';
  daysOfWeek: string; // comma-separated day numbers 1-7 (1=Monday, 7=Sunday)
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface FlightTemplate {
  templateId: number;
  templateName: string;
  inboundFlightNumber: string;
  outboundFlightNumber: string;
  staTimeOfDay: string; // HH:mm
  stdTimeOfDay: string; // HH:mm
  origin: string;
  destination: string;
  via?: string; // Optional intermediate / 2nd stop for triangle flights (e.g. LHR-CAI-HRG-LHR)
  finalDestination: string;
  airlineId: number;
  agencyId: number;
  aircraftType: string;
  schedule?: TemplateSchedule;
}

export interface IataDelayCode {
  code: string;
  category: string;
  description: string;
}

export type ActiveTab = 
  | 'manage-flights' 
  | 'bulk-flights' 
  | 'statistics' 
  | 'airlines' 
  | 'agencies';

export type UserRole = 'staff' | 'manager' | 'data-insert' | 'admin';

export interface AuthUser {
  username: string;
  role: UserRole;
}
