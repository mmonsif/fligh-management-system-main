import React, { useState, useEffect, useRef } from 'react';
import { ActiveTab, AuthUser, Flight, Airline, Agency, FlightTemplate, UserRole } from './types';
import {
  INITIAL_FLIGHTS,
  INITIAL_AIRLINES,
  INITIAL_AGENCIES,
  INITIAL_TEMPLATES,
} from './data/initialData';
import { calculateFlightStatus } from './utils/flightUtils';
import { Navbar } from './components/Navbar';
import { ManageFlightsView } from './components/FlightManagement/ManageFlightsView';
import { BulkFlightsView } from './components/BulkFlights/BulkFlightsView';
import { FlightStatisticsView } from './components/Statistics/FlightStatisticsView';
import { ManageAirlinesView } from './components/Airlines/ManageAirlinesView';
import { ManageAgenciesView } from './components/Agencies/ManageAgenciesView';
import { LoginPage } from './components/LoginPage';
import { isSupabaseConfigured } from './lib/supabase';
import { loadDatabaseSnapshot, saveDatabaseSnapshot, subscribeToDatabaseChanges } from './lib/database';

const roleTabs: Record<UserRole, ActiveTab[]> = {
  staff: ['manage-flights'],
  manager: ['manage-flights', 'statistics'],
  'data-insert': ['bulk-flights', 'airlines', 'agencies'],
  admin: ['manage-flights', 'bulk-flights', 'statistics', 'airlines', 'agencies'],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('manage-flights');
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('fms_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [databaseLoaded, setDatabaseLoaded] = useState(!isSupabaseConfigured);
  const skipNextDatabaseSave = useRef(false);

  const allowedTabs = user ? roleTabs[user.role] : [];

  useEffect(() => {
    if (user) {
      localStorage.setItem('fms_user', JSON.stringify(user));
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) return undefined;

    loadDatabaseSnapshot()
      .then((snapshot) => {
        if (!isMounted || !snapshot) return;
        setFlights(snapshot.flights);
        setAirlines(snapshot.airlines);
        setAgencies(snapshot.agencies);
        setTemplates(snapshot.templates);
        setDatabaseLoaded(true);
      })
      .catch((error) => {
        console.error('Supabase load failed; using local data:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    return subscribeToDatabaseChanges((snapshot) => {
      skipNextDatabaseSave.current = true;
      setFlights(snapshot.flights);
      setAirlines(snapshot.airlines);
      setAgencies(snapshot.agencies);
      setTemplates(snapshot.templates);
    });
  }, []);

  useEffect(() => {
    if (user && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [activeTab, allowedTabs, user]);

  const handleLogin = (nextUser: AuthUser) => {
    setUser(nextUser);
    setActiveTab(roleTabs[nextUser.role][0]);
  };

  const handleLogout = () => {
    localStorage.removeItem('fms_user');
    setUser(null);
  };

  // Ensure dark mode is permanently disabled
  useEffect(() => {
    try {
      localStorage.removeItem('fms_theme');
    } catch {
      // ignore
    }
    document.documentElement.classList.remove('dark');
  }, []);

  // Load persisted states or fall back to defaults
  const [flights, setFlights] = useState<Flight[]>(() => {
    if (isSupabaseConfigured) return [];

    try {
      const saved = localStorage.getItem('fms_flights');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 25) {
          return parsed;
        }
      }
      return INITIAL_FLIGHTS;
    } catch {
      return INITIAL_FLIGHTS;
    }
  });

  const [airlines, setAirlines] = useState<Airline[]>(() => {
    if (isSupabaseConfigured) return [];

    try {
      const saved = localStorage.getItem('fms_airlines');
      return saved ? JSON.parse(saved) : INITIAL_AIRLINES;
    } catch {
      return INITIAL_AIRLINES;
    }
  });

  const [agencies, setAgencies] = useState<Agency[]>(() => {
    if (isSupabaseConfigured) return [];

    try {
      const saved = localStorage.getItem('fms_agencies');
      return saved ? JSON.parse(saved) : INITIAL_AGENCIES;
    } catch {
      return INITIAL_AGENCIES;
    }
  });

  const [templates, setTemplates] = useState<FlightTemplate[]>(() => {
    if (isSupabaseConfigured) return [];

    try {
      const saved = localStorage.getItem('fms_templates');
      return saved ? JSON.parse(saved) : INITIAL_TEMPLATES;
    } catch {
      return INITIAL_TEMPLATES;
    }
  });

  // Sync with LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('fms_flights', JSON.stringify(flights));
    } catch (e) {
      console.error('Failed to save flights to localStorage', e);
    }
  }, [flights]);

  useEffect(() => {
    try {
      localStorage.setItem('fms_airlines', JSON.stringify(airlines));
    } catch (e) {
      console.error('Failed to save airlines to localStorage', e);
    }
  }, [airlines]);

  useEffect(() => {
    try {
      localStorage.setItem('fms_agencies', JSON.stringify(agencies));
    } catch (e) {
      console.error('Failed to save agencies to localStorage', e);
    }
  }, [agencies]);

  useEffect(() => {
    try {
      localStorage.setItem('fms_templates', JSON.stringify(templates));
    } catch (e) {
      console.error('Failed to save templates to localStorage', e);
    }
  }, [templates]);

  useEffect(() => {
    if (!databaseLoaded) return;
    if (skipNextDatabaseSave.current) {
      skipNextDatabaseSave.current = false;
      return;
    }

    void saveDatabaseSnapshot({ flights, airlines, agencies, templates }).catch((error) => {
      console.error('Supabase sync failed:', error);
    });
  }, [databaseLoaded, flights, airlines, agencies, templates]);

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Reset data handler
  const handleResetData = () => {
    setFlights(INITIAL_FLIGHTS);
    setAirlines(INITIAL_AIRLINES);
    setAgencies(INITIAL_AGENCIES);
    setTemplates(INITIAL_TEMPLATES);
    localStorage.removeItem('fms_flights');
    localStorage.removeItem('fms_airlines');
    localStorage.removeItem('fms_agencies');
    localStorage.removeItem('fms_templates');
  };

  // Add flight
  const handleAddFlight = (
    flightData: Omit<Flight, 'flightId' | 'flightStatus' | 'delayMinutesTotal'>
  ) => {
    const nextId = flights.length > 0 ? Math.max(...flights.map((f) => f.flightId)) + 1 : 101;
    const delayTotal = (flightData.delays || []).reduce((acc, d) => acc + (d.minutes || 0), 0);
    const status = calculateFlightStatus(
      flightData.staUtc,
      flightData.stdUtc,
      flightData.ataUtc,
      flightData.atdUtc,
      false
    );

    const newFlight: Flight = {
      ...flightData,
      flightId: nextId,
      flightStatus: status,
      delayMinutesTotal: delayTotal,
    };

    setFlights((prev) => [newFlight, ...prev]);
  };

  // Update schedule
  const handleUpdateSchedule = (flightId: number, scheduleData: Partial<Flight>) => {
    setFlights((prev) =>
      prev.map((f) => {
        if (f.flightId !== flightId) return f;
        const updatedSta = scheduleData.staUtc || f.staUtc;
        const updatedStd = scheduleData.stdUtc || f.stdUtc;
        const status =
          f.flightStatus === 'Canceled'
            ? 'Canceled'
            : calculateFlightStatus(updatedSta, updatedStd, f.ataUtc, f.atdUtc, false);

        return {
          ...f,
          ...scheduleData,
          flightStatus: status,
        };
      })
    );
  };

  // Update actuals
  const handleUpdateActuals = (flightId: number, actualsData: Partial<Flight>) => {
    setFlights((prev) =>
      prev.map((f) => {
        if (f.flightId !== flightId) return f;
        const newAta = actualsData.ataUtc !== undefined ? actualsData.ataUtc : f.ataUtc;
        const newAtd = actualsData.atdUtc !== undefined ? actualsData.atdUtc : f.atdUtc;
        const status =
          f.flightStatus === 'Canceled'
            ? 'Canceled'
            : calculateFlightStatus(f.staUtc, f.stdUtc, newAta, newAtd, false);

        return {
          ...f,
          ...actualsData,
          flightStatus: status,
        };
      })
    );
  };

  // Update delays
  const handleUpdateDelays = (flightId: number, newDelays: Flight['delays']) => {
    const totalMinutes = newDelays.reduce((acc, d) => acc + (d.minutes || 0), 0);
    setFlights((prev) =>
      prev.map((f) => {
        if (f.flightId !== flightId) return f;
        return {
          ...f,
          delays: newDelays,
          delayMinutesTotal: totalMinutes,
        };
      })
    );
  };

  // Cancel flight
  const handleCancelFlight = (flightId: number, reason: string) => {
    setFlights((prev) =>
      prev.map((f) => {
        if (f.flightId !== flightId) return f;
        return {
          ...f,
          flightStatus: 'Canceled',
          cancellationReason: reason,
        };
      })
    );
  };

  // Delete flight
  const handleDeleteFlight = (flightId: number) => {
    setFlights((prev) => prev.filter((f) => f.flightId !== flightId));
  };

  // Refresh operational status
  const handleRefresh = () => {
    setFlights((prev) =>
      prev.map((f) => {
        if (f.flightStatus === 'Canceled') return f;
        const recalculated = calculateFlightStatus(f.staUtc, f.stdUtc, f.ataUtc, f.atdUtc, false);
        return {
          ...f,
          flightStatus: recalculated,
        };
      })
    );
  };

  // Bulk Generator Handlers
  const handleCreateTemplate = (newTemplate: Omit<FlightTemplate, 'templateId'>) => {
    const nextId = templates.length > 0 ? Math.max(...templates.map((t) => t.templateId)) + 1 : 1;
    setTemplates((prev) => [...prev, { ...newTemplate, templateId: nextId }]);
  };

  const handleAddSchedule = (
    templateId: number,
    schedule: { frequency: 'Daily' | 'Weekly'; daysOfWeek: string; startDate: string; endDate: string }
  ) => {
    setTemplates((prev) =>
      prev.map((t) => {
        if (t.templateId !== templateId) return t;
        return {
          ...t,
          schedule: {
            templateId,
            ...schedule,
          },
        };
      })
    );
  };

  const handleGenerateFlights = (templateId: number, startDateStr: string, endDateStr: string): number => {
    const template = templates.find((t) => t.templateId === templateId);
    if (!template) return 0;

    const airline = airlines.find((a) => a.airlineId === template.airlineId);
    const agency = agencies.find((a) => a.agencyId === template.agencyId);

    const freq = template.schedule?.frequency || 'Daily';
    const allowedDays = (template.schedule?.daysOfWeek || '1,2,3,4,5,6,7').split(',');

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    let current = new Date(start);

    const generated: Flight[] = [];
    let curId = flights.length > 0 ? Math.max(...flights.map((f) => f.flightId)) + 1 : 200;

    while (current <= end) {
      // Check day of week: 1=Monday, 7=Sunday
      const jsDay = current.getDay();
      const dayCode = jsDay === 0 ? '7' : String(jsDay);

      if (freq === 'Daily' || allowedDays.includes(dayCode)) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        const datePrefix = `${year}-${month}-${day}`;

        const staIso = `${datePrefix}T${template.staTimeOfDay}:00Z`;
        const stdIso = `${datePrefix}T${template.stdTimeOfDay}:00Z`;

        const newFlt: Flight = {
          flightId: curId++,
          inboundFlightNumber: template.inboundFlightNumber,
          outboundFlightNumber: template.outboundFlightNumber,
          staUtc: staIso,
          stdUtc: stdIso,
          ataUtc: null,
          atdUtc: null,
          origin: template.origin,
          destination: template.destination,
          via: template.via || undefined,
          finalDestination: template.finalDestination,
          airlineId: template.airlineId,
          airlineName: airline?.airlineName || 'Scheduled Airline',
          agencyId: template.agencyId,
          agencyName: agency?.agencyName || 'Scheduled Agency',
          aircraftType: template.aircraftType,
          registration: '',
          remarks: `Generated from template: ${template.templateName}`,
          numberOfBags: null,
          adultPax: null,
          childPax: null,
          infantPax: null,
          totalPax: null,
          delays: [],
          delayMinutesTotal: 0,
          flightStatus: 'Scheduled',
        };

        generated.push(newFlt);
      }

      // Next day
      current.setDate(current.getDate() + 1);
    }

    if (generated.length > 0) {
      setFlights((prev) => [...generated, ...prev]);
    }

    return generated.length;
  };

  // Airline CRUD
  const handleAddAirline = (name: string, iataCode?: string, country?: string) => {
    const nextId = airlines.length > 0 ? Math.max(...airlines.map((a) => a.airlineId)) + 1 : 1;
    setAirlines((prev) => [...prev, { airlineId: nextId, airlineName: name, iataCode, country }]);
  };

  const handleUpdateAirline = (id: number, name: string, iataCode?: string, country?: string) => {
    setAirlines((prev) =>
      prev.map((a) => (a.airlineId === id ? { ...a, airlineName: name, iataCode, country } : a))
    );
    // Also update airline names on existing flights
    setFlights((prev) =>
      prev.map((f) => (f.airlineId === id ? { ...f, airlineName: name } : f))
    );
  };

  const handleDeleteAirline = (id: number) => {
    setAirlines((prev) => prev.filter((a) => a.airlineId !== id));
  };

  // Agency CRUD
  const handleAddAgency = (name: string, contactEmail?: string, phone?: string) => {
    const nextId = agencies.length > 0 ? Math.max(...agencies.map((g) => g.agencyId)) + 1 : 1;
    setAgencies((prev) => [...prev, { agencyId: nextId, agencyName: name, contactEmail, phone }]);
  };

  const handleUpdateAgency = (id: number, name: string, contactEmail?: string, phone?: string) => {
    setAgencies((prev) =>
      prev.map((g) => (g.agencyId === id ? { ...g, agencyName: name, contactEmail, phone } : g))
    );
    setFlights((prev) =>
      prev.map((f) => (f.agencyId === id ? { ...f, agencyName: name } : f))
    );
  };

  const handleDeleteAgency = (id: number) => {
    setAgencies((prev) => prev.filter((g) => g.agencyId !== id));
  };

  return (
    <div className="min-h-screen text-slate-900 bg-slate-50 flex flex-col font-sans relative selection:bg-sky-500/20 selection:text-sky-900">
      {/* Subtle ambient glow elements */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        flightCount={flights.length}
        user={user}
        allowedTabs={allowedTabs}
        onLogout={handleLogout}
      />

      {/* Main Content View - Full viewport width */}
      <main className="flex-1 w-full px-3 sm:px-5 lg:px-6 py-4">
        {activeTab === 'manage-flights' && (
          <ManageFlightsView
            flights={flights}
            airlines={airlines}
            agencies={agencies}
            onAddFlight={handleAddFlight}
            onUpdateSchedule={handleUpdateSchedule}
            onUpdateActuals={handleUpdateActuals}
            onUpdateDelays={handleUpdateDelays}
            onCancelFlight={handleCancelFlight}
            onDeleteFlight={handleDeleteFlight}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'bulk-flights' && (
          <BulkFlightsView
            templates={templates}
            airlines={airlines}
            agencies={agencies}
            onCreateTemplate={handleCreateTemplate}
            onAddSchedule={handleAddSchedule}
            onGenerateFlights={handleGenerateFlights}
          />
        )}

        {activeTab === 'statistics' && <FlightStatisticsView flights={flights} />}

        {activeTab === 'airlines' && (
          <ManageAirlinesView
            airlines={airlines}
            flights={flights}
            onAddAirline={handleAddAirline}
            onUpdateAirline={handleUpdateAirline}
            onDeleteAirline={handleDeleteAirline}
          />
        )}

        {activeTab === 'agencies' && (
          <ManageAgenciesView
            agencies={agencies}
            flights={flights}
            onAddAgency={handleAddAgency}
            onUpdateAgency={handleUpdateAgency}
            onDeleteAgency={handleDeleteAgency}
          />
        )}
      </main>

      {/* Footer - Full viewport width */}
      <footer className="py-3 px-3 sm:px-5 lg:px-6 border-t border-slate-200 bg-white/90 backdrop-blur-xl text-center text-xs text-slate-500">
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-xs"></span>
            Flight Management System (FMS) &bull; Ground Handling &amp; Operational Dispatch
          </span>
          <span className="font-mono text-[11px] text-slate-400">All times in UTC standard &bull; ISO 8601</span>
        </div>
      </footer>
    </div>
  );
}
