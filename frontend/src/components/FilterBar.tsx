import React from 'react';
import { Search, Regex, ArrowDownUp, X, Filter } from 'lucide-react';
import { FilterState } from '../types/log';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  availableServices: string[];
  totalMatches: number;
}

const LOG_LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'];

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  availableServices,
  totalMatches,
}) => {
  const handleQueryChange = (val: string) => {
    onFilterChange({ ...filters, query: val });
  };

  const toggleRegex = () => {
    onFilterChange({ ...filters, isRegex: !filters.isRegex });
  };

  const handleLevelToggle = (lvl: string) => {
    if (lvl === 'ALL') {
      onFilterChange({ ...filters, levels: [] });
      return;
    }

    const current = [...filters.levels];
    const index = current.indexOf(lvl);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(lvl);
    }
    onFilterChange({ ...filters, levels: current });
  };

  const toggleSort = () => {
    onFilterChange({
      ...filters,
      sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc'
    });
  };

  const clearAllFilters = () => {
    onFilterChange({
      query: '',
      isRegex: false,
      levels: [],
      selectedService: null,
      selectedTemplateId: null,
      startEpoch: null,
      endEpoch: null,
      sortOrder: 'desc',
    });
  };

  const hasActiveFilters = 
    Boolean(filters.query) || 
    filters.levels.length > 0 || 
    Boolean(filters.selectedService) || 
    filters.selectedTemplateId !== null;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 mb-4 space-y-3">
      {/* Search Input Row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={filters.isRegex ? "Search with Regular Expression (e.g. status_code.*5\\d{2})..." : "Search messages, services, raw logs, IPs, or trace IDs..."}
            value={filters.query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="w-full pl-9 pr-10 py-2 rounded-lg bg-slate-950 border border-slate-700/80 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 text-xs font-mono text-slate-100 placeholder:text-slate-500"
          />
          {filters.query && (
            <button
              onClick={() => handleQueryChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Regex toggle button */}
        <button
          onClick={toggleRegex}
          title="Toggle Regular Expression mode"
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-mono font-medium border transition-colors ${
            filters.isRegex
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
              : 'bg-slate-800 hover:bg-slate-750 text-slate-400 border-slate-700'
          }`}
        >
          <Regex className="w-4 h-4" />
          <span className="hidden sm:inline">Regex</span>
        </button>

        {/* Sort Order */}
        <button
          onClick={toggleSort}
          title={`Sorted: ${filters.sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors"
        >
          <ArrowDownUp className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">{filters.sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
        </button>
      </div>

      {/* Filter Chips & Service Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
        {/* Levels */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Level:
          </span>
          {LOG_LEVELS.map((lvl) => {
            const isAll = lvl === 'ALL';
            const isActive = isAll ? filters.levels.length === 0 : filters.levels.includes(lvl);
            
            let colorStyle = 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-slate-700/60';
            if (isActive) {
              if (lvl === 'ERROR') colorStyle = 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold';
              else if (lvl === 'WARN') colorStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold';
              else if (lvl === 'INFO') colorStyle = 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-semibold';
              else if (lvl === 'DEBUG') colorStyle = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold';
              else colorStyle = 'bg-slate-700 text-white border-slate-600 font-semibold';
            }

            return (
              <button
                key={lvl}
                onClick={() => handleLevelToggle(lvl)}
                className={`px-2.5 py-1 rounded-md text-[11px] border transition-all ${colorStyle}`}
              >
                {lvl}
              </button>
            );
          })}
        </div>

        {/* Service filter & Template indicator & Clear */}
        <div className="flex items-center gap-2">
          {availableServices.length > 0 && (
            <select
              value={filters.selectedService || ''}
              onChange={(e) => onFilterChange({ ...filters, selectedService: e.target.value || null })}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-[11px] rounded-md px-2.5 py-1 focus:outline-none focus:border-sky-500"
            >
              <option value="">All Services ({availableServices.length})</option>
              {availableServices.map((svc) => (
                <option key={svc} value={svc}>{svc}</option>
              ))}
            </select>
          )}

          {filters.selectedTemplateId !== null && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[11px]">
              <span>Template #{filters.selectedTemplateId}</span>
              <button
                onClick={() => onFilterChange({ ...filters, selectedTemplateId: null })}
                className="hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
            >
              <X className="w-3 h-3" /> Reset filters
            </button>
          )}

          <div className="text-[11px] text-slate-400 pl-2 border-l border-slate-800">
            Matches: <strong className="text-slate-200">{totalMatches.toLocaleString()}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
