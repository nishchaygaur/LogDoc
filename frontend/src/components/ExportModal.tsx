import React from 'react';
import { Download, FileText, Table, ExternalLink, X } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDataset: string | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  activeDataset,
}) => {
  if (!isOpen) return null;

  const datasetParam = activeDataset ? `?dataset=${encodeURIComponent(activeDataset)}` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-slate-100">Export Logs & Reports</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {/* JSON Export */}
          <a
            href={`/api/export${datasetParam}&format=json`}
            download
            className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-sky-500/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200 group-hover:text-sky-300">
                  Export as JSON
                </div>
                <div className="text-[11px] text-slate-400">
                  Full structured log objects with all parsed metadata
                </div>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400 group-hover:text-sky-300" />
          </a>

          {/* CSV Export */}
          <a
            href={`/api/export${datasetParam}&format=csv`}
            download
            className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-emerald-500/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
                <Table className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-300">
                  Export as CSV
                </div>
                <div className="text-[11px] text-slate-400">
                  Compatible with Excel, Sheets, and Pandas analysis
                </div>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-300" />
          </a>

          {/* Standalone HTML Executive Report */}
          <a
            href={`/api/export/report${datasetParam}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-indigo-500/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20">
                <ExternalLink className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200 group-hover:text-indigo-300">
                  HTML Incident Report
                </div>
                <div className="text-[11px] text-slate-400">
                  Print-ready executive summary & anomaly post-mortem
                </div>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-300" />
          </a>
        </div>
      </div>
    </div>
  );
};
