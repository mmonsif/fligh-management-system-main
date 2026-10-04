-- Reference data only (delay codes). This does not delete users, flights,
-- templates, schedules, airlines, or agencies. Run after schema.sql, or use it
-- to refresh the delay-code list on an existing setup.
--
-- Airlines and agencies are intentionally NOT seeded here. They are managed from
-- inside the application and stored in the Supabase tables, so this script leaves
-- those tables untouched. Running it will never re-add reference/demo airlines or
-- agencies that were deleted in the app.

create table if not exists public.delay_codes (
  code text primary key,
  category text not null,
  description text not null
);

alter table public.airlines add column if not exists handling_company text;

delete from public.delay_codes;

insert into public.delay_codes (code, category, description) values
('00','Internal Airline','Airline-defined internal delay code'),('01','Internal Airline','Airline-defined internal delay code'),('02','Internal Airline','Airline-defined internal delay code'),('03','Internal Airline','Three-class system moving curtain'),('04','Internal Airline','Airline-defined internal delay code'),('05','Internal Airline','Airline-defined internal delay code'),('06','Internal Airline','No gate/stand availability due to own airline activity'),('07','Internal Airline','Aircraft connection by maintenance'),('08','Internal Airline','Aircraft connection by miscellaneous airline, handling, or cabin operations'),('09','Internal Airline','Scheduled ground time less than declared minimum ground time'),
('11','Passenger and Baggage','Late check-in, acceptance after deadline'),('12','Passenger and Baggage','Late check-in, congestion in check-in area'),('13','Passenger and Baggage','Check-in error'),('14','Passenger and Baggage','Oversales, booking errors'),('15','Passenger and Baggage','Boarding, discrepancies, paging, or missing passenger at gate'),('16','Passenger and Baggage','Commercial publicity, passenger convenience, VIP, press, ground meals, or personal items'),('17','Passenger and Baggage','Catering order, late or incorrect order given to supplier'),('18','Passenger and Baggage','Baggage processing, sorting, and related handling'),('19','Passenger and Baggage','Reduced mobility boarding or deboarding'),
('21','Cargo and Mail','Cargo documentation errors'),('22','Cargo and Mail','Late cargo positioning'),('23','Cargo and Mail','Late cargo acceptance'),('24','Cargo and Mail','Inadequate cargo packing'),('25','Cargo and Mail','Cargo oversales or booking errors'),('26','Cargo and Mail','Late cargo warehouse preparation'),('27','Cargo and Mail','Mail oversales or packing'),('28','Cargo and Mail','Mail late positioning'),('29','Cargo and Mail','Mail late acceptance'),
('31','Handling','Aircraft documentation, loadsheet, declaration, or manifest'),('32','Handling','Loading, unloading, bulky or special load, or lack of staff'),('33','Handling','Loading equipment lack or breakdown'),('34','Handling','Servicing equipment lack or breakdown'),('35','Handling','Aircraft cleaning'),('36','Handling','Fuelling, defuelling, or fuel supplier'),('37','Handling','Catering late delivery or loading'),('38','Handling','ULD, containers, pallets, lack, or breakdown'),('39','Handling','Technical ground equipment lack or breakdown'),
('41','Technical','Aircraft defects'),('42','Technical','Scheduled maintenance, late release'),('43','Technical','Non-scheduled maintenance or additional work'),('44','Technical','Spares and maintenance equipment lack or breakdown'),('45','Technical','AOG spares to be carried to another station'),('46','Technical','Aircraft change for technical reasons'),('47','Technical','Standby aircraft unavailable for technical reasons'),('48','Technical','Scheduled cabin configuration adjustment'),
('51','Damage and Failure','Damage during flight operations'),('52','Damage and Failure','Damage during ground operations'),('55','Damage and Failure','Departure control, check-in, load control, or baggage system error'),('56','Damage and Failure','Cargo preparation or documentation system'),('57','Damage and Failure','Flight plans'),('58','Damage and Failure','Other computer systems'),
('61','Operation','Flight plan or flight documentation late or changed'),('62','Operation','Operational requirements, fuel, or load alteration'),('63','Operation','Late crew boarding or departure procedures'),('64','Operation','Flight deck crew shortage or rest'),('65','Operation','Flight deck crew special request or error'),('66','Operation','Late cabin crew boarding or departure procedures'),('67','Operation','Cabin crew shortage'),('68','Operation','Cabin crew error or special request'),('69','Operation','Captain request for security check'),
('71','Weather','Departure station weather'),('72','Weather','Destination station weather'),('73','Weather','En-route or alternate weather'),('75','Weather','De-icing aircraft or ice and snow removal'),('76','Weather','Snow, ice, water, or sand removal from airport or runway'),('77','Weather','Ground handling impaired by adverse weather'),
('81','Air Traffic Control','ATC restriction en-route or capacity'),('82','Air Traffic Control','ATC staff shortage or equipment failure en-route'),('83','Air Traffic Control','ATC restriction at destination'),('84','Air Traffic Control','ATC restriction due to destination weather'),('85','Air Traffic Control','Mandatory security'),('86','Air Traffic Control','Immigration, customs, or health'),('87','Air Traffic Control','Airport facilities, stands, ramp, buildings, or gate limitations'),('88','Air Traffic Control','Destination airport or runway restriction'),('89','Air Traffic Control','Departure airport or runway restriction'),
('91','Miscellaneous','Passenger or load connection'),('92','Miscellaneous','Through check-in error'),('93','Miscellaneous','Aircraft rotation or late arrival from previous sector'),('94','Miscellaneous','Cabin crew rotation'),('95','Miscellaneous','Crew rotation'),('96','Miscellaneous','Operations control, rerouting, diversion, or consolidation'),('97','Miscellaneous','Industrial action within own airline'),('98','Miscellaneous','Industrial action outside own airline, excluding ATS'),('99','Miscellaneous','Miscellaneous, not elsewhere specified');

-- Airlines are not seeded: manage them from the application.
-- Agencies are not seeded: manage them from the application.