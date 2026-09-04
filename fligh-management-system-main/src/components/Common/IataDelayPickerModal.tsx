import React, { useState } from 'react';
import { IATA_DELAY_CODES } from '../../data/iataDelayCodes';
import { IataDelayCode } from '../../types';
import { Search, X, Check } from 'lucide-react';

interface IataDelayPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (code: string) => void;
  selectedCode?: string;
}

export const IataDelayPickerModal: React.FC<IataDelayPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedCode,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  if (!isOpen) return null;

  const categories = ['All', ...Array.from(new Set(IATA_DELAY_CODES.map(d => d.category)))];

  const filteredCodes = IATA_DELAY_CODES.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-slate-950/75 backdrop-blur-md p-4">
      <div className="glass-card rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-white/15 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] backdrop-blur-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-white/5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-sm"></span>
              Standard IATA Delay Code Directory
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select an international standard delay code for operational reporting
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-3 bg-slate-50/50 dark:bg-white/5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search delay code or description (e.g., 89, 93, Baggage, ATC, Weather)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input w-full pl-10 pr-4 py-2 text-sm rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-sky-100 dark:bg-sky-500/30 text-sky-800 dark:text-sky-200 font-bold border border-sky-300 dark:border-sky-400/40 shadow-xs'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Code List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 dark:divide-white/5">
          {filteredCodes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No IATA delay codes found matching "{searchTerm}"
            </div>
          ) : (
            filteredCodes.map((item: IataDelayCode) => {
              const isSelected = selectedCode === item.code;
              return (
                <div
                  key={item.code}
                  onClick={() => {
                    onSelect(item.code);
                    onClose();
                  }}
                  className={`py-2.5 px-3 rounded-xl flex items-start justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-sky-100/80 dark:bg-sky-500/20 border border-sky-300 dark:border-sky-500/40 text-sky-900 dark:text-sky-200 font-semibold'
                      : 'hover:bg-slate-100/70 dark:hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex items-center justify-center font-mono font-bold text-sm px-2.5 py-1 bg-slate-100 dark:bg-white/5 text-sky-700 dark:text-sky-400 border border-slate-200 dark:border-white/10 rounded-lg">
                      {item.code}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {item.category}
                      </div>
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                        {item.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-sky-600 dark:text-sky-400 p-1">
                      <Check className="w-5 h-5" />
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
          <span>Showing {filteredCodes.length} codes</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
