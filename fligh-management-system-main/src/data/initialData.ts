import { Flight, Airline, Agency, FlightTemplate } from '../types';

export const INITIAL_AIRLINES: Airline[] = [
  { airlineId: 1, airlineName: 'EgyptAir', iataCode: 'MS', country: 'Egypt' },
  { airlineId: 2, airlineName: 'Saudia', iataCode: 'SV', country: 'Saudi Arabia' },
  { airlineId: 3, airlineName: 'Emirates', iataCode: 'EK', country: 'UAE' },
  { airlineId: 4, airlineName: 'British Airways', iataCode: 'BA', country: 'United Kingdom' },
  { airlineId: 5, airlineName: 'Lufthansa', iataCode: 'LH', country: 'Germany' },
  { airlineId: 6, airlineName: 'Qatar Airways', iataCode: 'QR', country: 'Qatar' },
  { airlineId: 7, airlineName: 'Turkish Airlines', iataCode: 'TK', country: 'Turkey' },
  { airlineId: 8, airlineName: 'FlyDubai', iataCode: 'FZ', country: 'UAE' },
];

export const INITIAL_AGENCIES: Agency[] = [
  { agencyId: 1, agencyName: 'Global Aviation Services', contactEmail: 'ops@globalaviation.com', phone: '+20 2 2265 1100' },
  { agencyId: 2, agencyName: 'Swissport Executive Handling', contactEmail: 'cai.station@swissport.com', phone: '+20 2 2265 3344' },
  { agencyId: 3, agencyName: 'Menzies Aviation Cairo', contactEmail: 'dispatch@menzies.aero', phone: '+20 2 2265 4488' },
  { agencyId: 4, agencyName: 'Dnata Ground Operations', contactEmail: 'groundops@dnata.com', phone: '+971 4 606 4000' },
  { agencyId: 5, agencyName: 'National Handling Services', contactEmail: 'ops@nationalhandling.eg', phone: '+20 2 2265 7799' },
];

export const INITIAL_TEMPLATES: FlightTemplate[] = [
  {
    templateId: 1,
    templateName: 'Triangle London - Cairo - Hurghada Rotation',
    inboundFlightNumber: 'MS777',
    outboundFlightNumber: 'MS778',
    staTimeOfDay: '08:15',
    stdTimeOfDay: '09:45',
    origin: 'LHR',
    destination: 'CAI',
    via: 'HRG',
    finalDestination: 'LHR',
    airlineId: 1,
    agencyId: 1,
    aircraftType: 'B777-300ER',
    schedule: {
      templateId: 1,
      frequency: 'Daily',
      daysOfWeek: '1,2,3,4,5,6,7',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    },
  },
  {
    templateId: 2,
    templateName: 'Weekly Dubai Rotational',
    inboundFlightNumber: 'EK927',
    outboundFlightNumber: 'EK928',
    staTimeOfDay: '10:30',
    stdTimeOfDay: '12:15',
    origin: 'DXB',
    destination: 'CAI',
    finalDestination: 'DXB',
    airlineId: 3,
    agencyId: 2,
    aircraftType: 'A380-800',
    schedule: {
      templateId: 2,
      frequency: 'Weekly',
      daysOfWeek: '1,3,5,6',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    },
  },
  {
    templateId: 3,
    templateName: 'Riyadh Express Service',
    inboundFlightNumber: 'SV301',
    outboundFlightNumber: 'SV302',
    staTimeOfDay: '14:00',
    stdTimeOfDay: '15:20',
    origin: 'RUH',
    destination: 'CAI',
    finalDestination: 'MED',
    airlineId: 2,
    agencyId: 3,
    aircraftType: 'A330-300',
    schedule: {
      templateId: 3,
      frequency: 'Daily',
      daysOfWeek: '1,2,3,4,5,6,7',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    },
  },
  {
    templateId: 4,
    templateName: 'Frankfurt Morning Hub Connection',
    inboundFlightNumber: 'LH582',
    outboundFlightNumber: 'LH583',
    staTimeOfDay: '02:40',
    stdTimeOfDay: '04:10',
    origin: 'FRA',
    destination: 'CAI',
    finalDestination: 'FRA',
    airlineId: 5,
    agencyId: 2,
    aircraftType: 'A321neo',
    schedule: {
      templateId: 4,
      frequency: 'Weekly',
      daysOfWeek: '2,4,6',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    },
  },
];

const CORE_INITIAL_FLIGHTS: Flight[] = [
  {
    flightId: 101,
    inboundFlightNumber: 'MS777',
    outboundFlightNumber: 'MS778',
    staUtc: '2026-09-03T08:15:00Z',
    stdUtc: '2026-09-03T09:45:00Z',
    ataUtc: '2026-09-03T08:22:00Z',
    atdUtc: '2026-09-03T10:15:00Z',
    origin: 'LHR',
    destination: 'CAI',
    via: 'HRG',
    finalDestination: 'LHR',
    airlineId: 1,
    airlineName: 'EgyptAir',
    agencyId: 1,
    agencyName: 'Global Aviation Services',
    aircraftType: 'B777-300ER',
    registration: 'SU-GDU',
    remarks: 'Triangle flight rotation (LHR-CAI-HRG-LHR). Passenger and baggage transit handling cleared.',
    numberOfBags: 284,
    adultPax: 242,
    childPax: 28,
    infantPax: 6,
    totalPax: 276,
    delays: [
      { code: '15', minutes: 15 },
      { code: '18', minutes: 15 },
    ],
    delayMinutesTotal: 30,
    flightStatus: 'Completed',
  },
  {
    flightId: 102,
    inboundFlightNumber: 'EK927',
    outboundFlightNumber: 'EK928',
    staUtc: '2026-09-03T10:30:00Z',
    stdUtc: '2026-09-03T12:15:00Z',
    ataUtc: '2026-09-03T10:25:00Z',
    atdUtc: null,
    origin: 'DXB',
    destination: 'CAI',
    finalDestination: 'DXB',
    airlineId: 3,
    airlineName: 'Emirates',
    agencyId: 2,
    agencyName: 'Swissport Executive Handling',
    aircraftType: 'A380-800',
    registration: 'A6-EVS',
    remarks: 'Aircraft on gate F4. Cleaning and catering servicing in progress.',
    numberOfBags: 460,
    adultPax: 388,
    childPax: 35,
    infantPax: 8,
    totalPax: 431,
    delays: [],
    delayMinutesTotal: 0,
    flightStatus: 'Arrived - Not Departed',
  },
  {
    flightId: 103,
    inboundFlightNumber: 'SV301',
    outboundFlightNumber: 'SV302',
    staUtc: '2026-09-03T14:00:00Z',
    stdUtc: '2026-09-03T15:20:00Z',
    ataUtc: null,
    atdUtc: null,
    origin: 'RUH',
    destination: 'CAI',
    finalDestination: 'MED',
    airlineId: 2,
    airlineName: 'Saudia',
    agencyId: 3,
    agencyName: 'Menzies Aviation Cairo',
    aircraftType: 'A330-300',
    registration: 'HZ-AQ12',
    remarks: 'Scheduled on time. Stand 14 assigned.',
    numberOfBags: null,
    adultPax: null,
    childPax: null,
    infantPax: null,
    totalPax: null,
    delays: [],
    delayMinutesTotal: 0,
    flightStatus: 'Scheduled',
  },
  {
    flightId: 104,
    inboundFlightNumber: 'BA155',
    outboundFlightNumber: 'BA154',
    staUtc: '2026-09-03T16:45:00Z',
    stdUtc: '2026-09-03T18:10:00Z',
    ataUtc: null,
    atdUtc: null,
    origin: 'LHR',
    destination: 'CAI',
    finalDestination: 'LHR',
    airlineId: 4,
    airlineName: 'British Airways',
    agencyId: 1,
    agencyName: 'Global Aviation Services',
    aircraftType: 'B787-9',
    registration: 'G-ZBKL',
    remarks: 'ATC slot delay reported out of London.',
    numberOfBags: null,
    adultPax: null,
    childPax: null,
    infantPax: null,
    totalPax: null,
    delays: [
      { code: '89', minutes: 45 }
    ],
    delayMinutesTotal: 45,
    flightStatus: 'Scheduled',
  },
  {
    flightId: 105,
    inboundFlightNumber: 'LH582',
    outboundFlightNumber: 'LH583',
    staUtc: '2026-09-02T02:40:00Z',
    stdUtc: '2026-09-02T04:10:00Z',
    ataUtc: '2026-09-02T02:35:00Z',
    atdUtc: '2026-09-02T04:05:00Z',
    origin: 'FRA',
    destination: 'CAI',
    finalDestination: 'FRA',
    airlineId: 5,
    airlineName: 'Lufthansa',
    agencyId: 2,
    agencyName: 'Swissport Executive Handling',
    aircraftType: 'A321neo',
    registration: 'D-AIEB',
    remarks: 'Punctual departure. Zero delays reported.',
    numberOfBags: 172,
    adultPax: 160,
    childPax: 12,
    infantPax: 2,
    totalPax: 174,
    delays: [],
    delayMinutesTotal: 0,
    flightStatus: 'Completed',
  },
  {
    flightId: 106,
    inboundFlightNumber: 'QR1301',
    outboundFlightNumber: 'QR1302',
    staUtc: '2026-09-02T11:00:00Z',
    stdUtc: '2026-09-02T12:30:00Z',
    ataUtc: '2026-09-02T11:45:00Z',
    atdUtc: '2026-09-02T13:40:00Z',
    origin: 'DOH',
    destination: 'CAI',
    finalDestination: 'DOH',
    airlineId: 6,
    airlineName: 'Qatar Airways',
    agencyId: 4,
    agencyName: 'Dnata Ground Operations',
    aircraftType: 'B777-300ER',
    registration: 'A7-BAC',
    remarks: 'Late inbound arrival from Doha due to airspace holding.',
    numberOfBags: 340,
    adultPax: 290,
    childPax: 18,
    infantPax: 4,
    totalPax: 312,
    delays: [
      { code: '93', minutes: 45 },
      { code: '31', minutes: 25 },
    ],
    delayMinutesTotal: 70,
    flightStatus: 'Completed',
  },
  {
    flightId: 107,
    inboundFlightNumber: 'TK692',
    outboundFlightNumber: 'TK693',
    staUtc: '2026-09-02T17:15:00Z',
    stdUtc: '2026-09-02T18:45:00Z',
    ataUtc: null,
    atdUtc: null,
    origin: 'IST',
    destination: 'CAI',
    finalDestination: 'IST',
    airlineId: 7,
    airlineName: 'Turkish Airlines',
    agencyId: 5,
    agencyName: 'National Handling Services',
    aircraftType: 'A330-200',
    registration: 'TC-JNC',
    remarks: 'Flight canceled due to technical AOG in Istanbul prior to departure.',
    numberOfBags: null,
    adultPax: null,
    childPax: null,
    infantPax: null,
    totalPax: null,
    delays: [
      { code: '41', minutes: 120 }
    ],
    delayMinutesTotal: 120,
    flightStatus: 'Canceled',
    cancellationReason: 'Technical AOG hydraulic pump failure in Istanbul',
  },
  {
    flightId: 108,
    inboundFlightNumber: 'FZ175',
    outboundFlightNumber: 'FZ176',
    staUtc: '2026-09-01T19:30:00Z',
    stdUtc: '2026-09-01T20:45:00Z',
    ataUtc: '2026-09-01T19:25:00Z',
    atdUtc: '2026-09-01T20:40:00Z',
    origin: 'DXB',
    destination: 'CAI',
    finalDestination: 'DXB',
    airlineId: 8,
    airlineName: 'FlyDubai',
    agencyId: 3,
    agencyName: 'Menzies Aviation Cairo',
    aircraftType: 'B737-MAX8',
    registration: 'A6-FKA',
    remarks: 'Rapid turn around in 75 minutes. All pax boarded smoothly.',
    numberOfBags: 185,
    adultPax: 154,
    childPax: 16,
    infantPax: 3,
    totalPax: 173,
    delays: [],
    delayMinutesTotal: 0,
    flightStatus: 'Completed',
  }
];

// Generate comprehensive realistic 30-day historical flight data (August 5 - August 31, 2026)
function generateHistoricalAugustFlights(): Flight[] {
  const flights: Flight[] = [];
  let idCounter = 201;

  const patterns = [
    {
      inbound: 'MS777', outbound: 'MS778',
      sta: '08:15', std: '09:45',
      origin: 'LHR', dest: 'CAI', via: 'HRG', finalDest: 'LHR',
      airlineId: 1, airlineName: 'EgyptAir',
      agencyId: 1, agencyName: 'Global Aviation Services',
      aircraftType: 'B777-300ER', reg: 'SU-GDU',
      basePax: 265, baseBags: 275,
    },
    {
      inbound: 'EK927', outbound: 'EK928',
      sta: '10:30', std: '12:15',
      origin: 'DXB', dest: 'CAI', finalDest: 'DXB',
      airlineId: 3, airlineName: 'Emirates',
      agencyId: 2, agencyName: 'Swissport Executive Handling',
      aircraftType: 'A380-800', reg: 'A6-EVS',
      basePax: 415, baseBags: 450,
    },
    {
      inbound: 'SV301', outbound: 'SV302',
      sta: '14:00', std: '15:20',
      origin: 'RUH', dest: 'CAI', finalDest: 'MED',
      airlineId: 2, airlineName: 'Saudia',
      agencyId: 3, agencyName: 'Menzies Aviation Cairo',
      aircraftType: 'A330-300', reg: 'HZ-AQ12',
      basePax: 275, baseBags: 285,
    },
    {
      inbound: 'BA155', outbound: 'BA154',
      sta: '16:45', std: '18:10',
      origin: 'LHR', dest: 'CAI', finalDest: 'LHR',
      airlineId: 4, airlineName: 'British Airways',
      agencyId: 1, agencyName: 'Global Aviation Services',
      aircraftType: 'B787-9', reg: 'G-ZBKL',
      basePax: 225, baseBags: 235,
    },
    {
      inbound: 'LH582', outbound: 'LH583',
      sta: '02:40', std: '04:10',
      origin: 'FRA', dest: 'CAI', finalDest: 'FRA',
      airlineId: 5, airlineName: 'Lufthansa',
      agencyId: 2, agencyName: 'Swissport Executive Handling',
      aircraftType: 'A321neo', reg: 'D-AIEB',
      basePax: 168, baseBags: 176,
    },
    {
      inbound: 'QR1301', outbound: 'QR1302',
      sta: '11:00', std: '12:30',
      origin: 'DOH', dest: 'CAI', finalDest: 'DOH',
      airlineId: 6, airlineName: 'Qatar Airways',
      agencyId: 4, agencyName: 'Dnata Ground Operations',
      aircraftType: 'B777-300ER', reg: 'A7-BAC',
      basePax: 310, baseBags: 330,
    },
    {
      inbound: 'FZ175', outbound: 'FZ176',
      sta: '19:30', std: '20:45',
      origin: 'DXB', dest: 'CAI', finalDest: 'DXB',
      airlineId: 8, airlineName: 'FlyDubai',
      agencyId: 3, agencyName: 'Menzies Aviation Cairo',
      aircraftType: 'B737-MAX8', reg: 'A6-FKA',
      basePax: 162, baseBags: 170,
    },
  ];

  // Generate for days 5 to 31 in August 2026
  for (let day = 5; day <= 31; day++) {
    const dayStr = String(day).padStart(2, '0');
    const datePrefix = `2026-08-${dayStr}`;

    // Select 4 to 6 flights per day
    const countForDay = 4 + ((day * 3) % 3); // 4, 5, or 6 flights
    for (let fIdx = 0; fIdx < countForDay; fIdx++) {
      const p = patterns[(day + fIdx) % patterns.length];

      // Deterministic punctuality variation
      const isCanceled = (day === 12 && fIdx === 1) || (day === 24 && fIdx === 2);
      const isDelayed = !isCanceled && ((day * 7 + fIdx * 11) % 5 === 0);

      const staUtc = `${datePrefix}T${p.sta}:00Z`;
      const stdUtc = `${datePrefix}T${p.std}:00Z`;

      let ataUtc: string | null = null;
      let atdUtc: string | null = null;
      let flightStatus: Flight['flightStatus'] = 'Completed';
      let delayMinutesTotal = 0;
      const delays: Flight['delays'] = [];
      let remarks = 'Turnaround turnaround completed per ground service SLA.';

      if (isCanceled) {
        flightStatus = 'Canceled';
        remarks = 'Sector canceled due to technical rotation constraints.';
      } else if (isDelayed) {
        const delayMins = 20 + ((day * 5 + fIdx * 7) % 35); // 20 - 54 mins
        delayMinutesTotal = delayMins;
        const code = (day % 2 === 0) ? '15' : '89';
        delays.push({ code, minutes: delayMins });
        ataUtc = `${datePrefix}T${p.sta}:00Z`;
        // ATD delayed
        const [stdH, stdM] = p.std.split(':').map(Number);
        const depTotalM = stdH * 60 + stdM + delayMins;
        const depH = String(Math.floor(depTotalM / 60) % 24).padStart(2, '0');
        const depM = String(depTotalM % 60).padStart(2, '0');
        atdUtc = `${datePrefix}T${depH}:${depM}:00Z`;
        remarks = `Turnaround delayed by ${delayMins} min (IATA Code ${code}).`;
      } else {
        // On-time
        ataUtc = `${datePrefix}T${p.sta}:00Z`;
        atdUtc = `${datePrefix}T${p.std}:00Z`;
      }

      const paxVariance = ((day * 13 + fIdx * 7) % 21) - 10;
      const totalPax = isCanceled ? null : Math.max(80, p.basePax + paxVariance);
      const adultPax = totalPax ? Math.floor(totalPax * 0.88) : null;
      const childPax = totalPax ? Math.floor(totalPax * 0.09) : null;
      const infantPax = totalPax ? totalPax - (adultPax || 0) - (childPax || 0) : null;
      const numberOfBags = isCanceled ? null : Math.max(90, p.baseBags + paxVariance * 2);

      flights.push({
        flightId: idCounter++,
        inboundFlightNumber: p.inbound,
        outboundFlightNumber: p.outbound,
        staUtc,
        stdUtc,
        ataUtc,
        atdUtc,
        origin: p.origin,
        destination: p.dest,
        via: p.via,
        finalDestination: p.finalDest,
        airlineId: p.airlineId,
        airlineName: p.airlineName,
        agencyId: p.agencyId,
        agencyName: p.agencyName,
        aircraftType: p.aircraftType,
        registration: p.reg,
        remarks,
        numberOfBags,
        adultPax,
        childPax,
        infantPax,
        totalPax,
        delays,
        delayMinutesTotal,
        flightStatus,
      });
    }
  }

  return flights;
}

export const INITIAL_FLIGHTS: Flight[] = [
  ...CORE_INITIAL_FLIGHTS,
  ...generateHistoricalAugustFlights(),
];
