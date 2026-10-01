import React, { useState } from 'react';
import { 
  FileText, Upload, Sparkles, Radio, Download, 
  Database, RefreshCw, Key, ChevronDown, Check 
} from 'lucide-react';
import { DatasetSummary } from '../types/log';

interface NavbarProps {
  datasets: DatasetSummary[];
  activeDataset: string | null;
  onSelectDataset: (name: string) => void;
  onOpenUpload: () => void;
  onOpenDiagnostics: () => void;
  onOpenExport: () => void;
  onOpenApiKeyModal: () => void;
  isLiveActive: boolean;
  onToggleLive: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  geminiKeySet: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  datasets,
  activeDataset,
  onSelectDataset,
  onOpenUpload,
  onOpenDiagnostics,
  onOpenExport,
  onOpenApiKeyModal,
  isLiveActive,
  onToggleLive,
  onRefresh,
  isLoading,
  geminiKeySet,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentDataset = datasets.find(d => d.name === activeDataset);

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-40 px-4 py-2.5">
      <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-lg text-white">LogDoc</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Intelligent Log Analyzer & Diagnostic Suite</p>
            </div>
          </div>

          {/* Dataset Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <div className="flex flex-col text-left">
                <span className="font-semibold text-slate-100 max-w-[150px] sm:max-w-[200px] truncate">
                  {currentDataset ? currentDataset.name : 'Select Dataset'}
                </span>
                {currentDataset && (
                  <span className="text-[10px] text-slate-400">
                    {currentDataset.log_count.toLocaleString()} logs • {currentDataset.parser_type}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-72 rounded-lg bg-slate-900 border border-slate-700 shadow-xl z-20 py-1.5 max-h-80 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Available Datasets
                  </div>
                  {datasets.map((d) => (
                    <button
                      key={d.name}
                      onClick={() => {
                        onSelectDataset(d.name);
                        setDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-800/80 transition-colors text-xs"
                    >
                      <div className="truncate pr-2">
                        <div className="font-medium text-slate-200 truncate">{d.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {d.log_count.toLocaleString()} logs • {d.parser_type}
                        </div>
                      </div>
                      {d.name === activeDataset && (
                        <Check className="w-4 h-4 text-sky-400 shrink-0" />
                      )}
                    </button>
                  ))}
                  <div className="border-t border-slate-800 mt-1 pt-1 px-2">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenUpload();
                      }}
                      className="w-full py-1.5 px-2 rounded flex items-center gap-2 text-xs text-sky-400 hover:bg-sky-500/10 font-medium"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Load new log file or sample...
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={onRefresh}
            title="Refresh current dataset"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Live Tail Toggle */}
          <button
            onClick={onToggleLive}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isLiveActive
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm shadow-rose-500/20 animate-pulse'
                : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700/60 text-slate-300'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isLiveActive ? 'text-rose-400' : 'text-slate-400'}`} />
            <span>{isLiveActive ? 'Live Tailing ON' : 'Live Tail'}</span>
          </button>

          {/* Upload Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-xs font-medium text-slate-200 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Upload / Samples</span>
          </button>

          {/* AI Diagnostics Button */}
          <button
            onClick={onOpenDiagnostics}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-md shadow-sky-600/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-bounce" />
            <span>AI Diagnostics</span>
          </button>

          {/* Export Report */}
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-xs font-medium text-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Export</span>
          </button>

          {/* API Key Config */}
          <button
            onClick={onOpenApiKeyModal}
            title={geminiKeySet ? 'Gemini API Key active' : 'Configure Gemini API Key'}
            className={`p-1.5 rounded-lg border transition-colors ${
              geminiKeySet 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25' 
                : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Key className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
