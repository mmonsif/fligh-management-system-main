import React, { useState } from 'react';
import { Agency, Flight } from '../../types';
import { Building2, Plus, Trash2, Edit2, X, Search } from 'lucide-react';

interface ManageAgenciesViewProps {
  agencies: Agency[];
  flights: Flight[];
  onAddAgency: (name: string, email?: string, phone?: string) => void;
  onUpdateAgency: (id: number, name: string, email?: string, phone?: string) => void;
  onDeleteAgency: (id: number) => void;
}

export const ManageAgenciesView: React.FC<ManageAgenciesViewProps> = ({
  agencies,
  flights,
  onAddAgency,
  onUpdateAgency,
  onDeleteAgency,
}) => {
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSelectAgency = (agency: Agency) => {
    setSelectedAgencyId(agency.agencyId);
    setAgencyName(agency.agencyName);
    setContactEmail(agency.contactEmail || '');
    setPhone(agency.phone || '');
  };

  const handleClear = () => {
    setSelectedAgencyId(null);
    setAgencyName('');
    setContactEmail('');
    setPhone('');
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyName.trim()) {
      alert('Please enter an agency name.');
      return;
    }
    onAddAgency(agencyName.trim(), contactEmail.trim() || undefined, phone.trim() || undefined);
    handleClear();
    alert('Agency added successfully.');
  };

  const handleUpdate = () => {
    if (!selectedAgencyId) {
      alert('Please select an agency from the table to update.');
      return;
    }
    if (!agencyName.trim()) {
      alert('Please enter an agency name.');
      return;
    }
    onUpdateAgency(selectedAgencyId, agencyName.trim(), contactEmail.trim() || undefined, phone.trim() || undefined);
    alert('Agency updated successfully.');
  };

  const handleDelete = () => {
    if (!selectedAgencyId) {
      alert('Please select an agency from the table to delete.');
      return;
    }
    const flightCount = flights.filter((f) => f.agencyId === selectedAgencyId).length;
    let message = 'Are you sure you want to delete this agency?';
    if (flightCount > 0) {
      message = `This agency is currently handling ${flightCount} associated flights. Are you sure you want to delete it?`;
    }

    if (window.confirm(message)) {
      onDeleteAgency(selectedAgencyId);
      handleClear();
      alert('Agency deleted successfully.');
    }
  };

  const filteredAgencies = agencies.filter((g) => {
    const q = searchTerm.toLowerCase();
    return (
      g.agencyName.toLowerCase().includes(q) ||
      (g.contactEmail && g.contactEmail.toLowerCase().includes(q)) ||
      (g.phone && g.phone.toLowerCase().includes(q))
    );
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Form Card */}
      <div className="lg:col-span-4 xl:col-span-4 glass-card p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
          <div className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            {selectedAgencyId ? 'Edit Agency Details' : 'Register New Handling Agency'}
          </div>
          {selectedAgencyId && (
            <button
              onClick={handleClear}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Deselect
            </button>
          )}
        </div>

        <form onSubmit={handleAdd} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Agency Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Global Aviation Services"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="glass-input w-full px-3 py-1.5 rounded-xl text-slate-900 dark:text-slate-100 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ops Contact Email</label>
            <input
              type="email"
              placeholder="ops@handling.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="glass-input w-full px-3 py-1.5 rounded-xl text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Station Telephone / VHF</label>
            <input
              type="text"
              placeholder="+20 2 2265 0000 / VHF 131.45"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="glass-input w-full px-3 py-1.5 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            {!selectedAgencyId ? (
              <button
                type="submit"
                className="glass-btn-primary w-full py-2 rounded-xl text-white font-semibold shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Agency
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUpdate}
                  className="glass-btn-primary flex-1 py-2 rounded-xl text-white font-semibold shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Update
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="glass-btn-danger py-2 px-4 rounded-xl text-rose-700 dark:text-rose-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Directory Table */}
      <div className="lg:col-span-8 xl:col-span-8 glass-card p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl backdrop-blur-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Handling Agencies Directory ({agencies.length})
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Click an agency to update or inspect flight allocations</span>
          </div>

          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search agency..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input w-full pl-8 pr-3 py-1.5 text-xs rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-xl glass-card-sub">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="p-3">Agency Name</th>
                <th className="p-3">Operations Contact</th>
                <th className="p-3">Telephone / VHF</th>
                <th className="p-3 text-right">Handled Flights</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredAgencies.map((g) => {
                const count = flights.filter((f) => f.agencyId === g.agencyId).length;
                const isSelected = selectedAgencyId === g.agencyId;
                return (
                  <tr
                    key={g.agencyId}
                    onClick={() => handleSelectAgency(g)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-sky-100/80 dark:bg-sky-500/20 text-sky-900 dark:text-sky-200 font-semibold'
                        : 'hover:bg-slate-100/60 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{g.agencyName}</td>
                    <td className="p-3 font-mono text-sky-700 dark:text-sky-400">{g.contactEmail || '-'}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{g.phone || '-'}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{count} flights</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
