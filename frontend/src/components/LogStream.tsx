import React, { useState } from 'react';
import { 
  ChevronRight, ChevronDown, Copy, Check, Terminal, 
  Layers, AlertCircle, ChevronLeft 
} from 'lucide-react';
import { LogEntry } from '../types/log';
import { getLevelBadgeStyle, getServiceColor, formatTimestamp } from '../utils/colors';

interface LogStreamProps {
  logs: LogEntry[];
  totalLogs: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onFilterByTemplate?: (templateId: number) => void;
  onFilterByService?: (service: string) => void;
}

export const LogStream: React.FC<LogStreamProps> = ({
  logs,
  totalLogs,
  currentPage,
  pageSize,
  onPageChange,
  onFilterByTemplate,
  onFilterByService,
}) => {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  const copyToClipboard = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize));

  if (logs.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-12 text-center">
        <Terminal className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-300">No logs found</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          No log events matched your current search filters or date range. Try clearing your filters or changing the query.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
      {/* Table Header */}
      <div className="bg-slate-950/80 border-b border-slate-800 px-4 py-2.5 grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
        <div className="col-span-1 sm:col-span-1 flex items-center">Expand</div>
        <div className="col-span-3 sm:col-span-2">Timestamp</div>
        <div className="col-span-2 sm:col-span-1">Level</div>
        <div className="col-span-2 sm:col-span-2">Service</div>
        <div className="col-span-4 sm:col-span-6">Message</div>
      </div>

      {/* Log Rows */}
      <div className="divide-y divide-slate-800/50 font-mono-code text-xs">
        {logs.map((entry) => {
          const isExpanded = expandedRowId === entry.id;
          const levelStyle = getLevelBadgeStyle(entry.level);
          const serviceColor = getServiceColor(entry.service);

          return (
            <React.Fragment key={entry.id}>
              <div
                onClick={() => toggleRow(entry.id)}
                className={`grid grid-cols-12 gap-2 px-4 py-2 hover:bg-slate-800/60 cursor-pointer transition-colors items-center ${
                  isExpanded ? 'bg-slate-850 border-l-2 border-sky-500' : ''
                } ${entry.level === 'ERROR' ? 'hover:bg-rose-950/20' : ''}`}
              >
                {/* Expand Caret */}
                <div className="col-span-1 sm:col-span-1 text-slate-500 flex items-center">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Timestamp */}
                <div className="col-span-3 sm:col-span-2 text-slate-400 truncate text-[11px]">
                  {formatTimestamp(entry.timestamp)}
                </div>

                {/* Level Badge */}
                <div className="col-span-2 sm:col-span-1">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${levelStyle.bg}`}>
                    {entry.level}
                  </span>
                </div>

                {/* Service */}
                <div className="col-span-2 sm:col-span-2 truncate">
                  {entry.service ? (
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onFilterByService && entry.service) onFilterByService(entry.service);
                      }}
                      style={{ color: serviceColor }}
                      className="font-medium hover:underline cursor-pointer"
                    >
                      {entry.service}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </div>

                {/* Message */}
                <div className="col-span-4 sm:col-span-6 truncate text-slate-200">
                  {entry.message}
                </div>
              </div>

              {/* Expanded Details Drawer */}
              {isExpanded && (
                <div className="bg-slate-950 p-4 border-y border-slate-800 space-y-3 font-sans text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-medium">Log Details</span>
                      {entry.source && (
                        <span className="text-slate-500 text-[11px]">Source: {entry.source}</span>
                      )}
                      {entry.line_number && (
                        <span className="text-slate-500 text-[11px]">Line: {entry.line_number}</span>
                      )}
                      {entry.template_id && (
                        <button
                          onClick={() => onFilterByTemplate && onFilterByTemplate(entry.template_id!)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] hover:bg-indigo-500/20"
                        >
                          <Layers className="w-3 h-3" /> Filter Template #{entry.template_id}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={(e) => copyToClipboard(entry.raw || entry.message, entry.id, e)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                    >
                      {copiedId === entry.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Raw</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Metadata fields */}
                  {Object.keys(entry.metadata).length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Structured Attributes & Metadata
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(entry.metadata).map(([k, v]) => {
                          if (k === 'stack_trace') return null;
                          return (
                            <div key={k} className="bg-slate-950/60 p-2 rounded border border-slate-800/80">
                              <span className="text-slate-500 text-[10px] block font-mono">{k}</span>
                              <span className="text-slate-200 text-xs font-mono break-all">
                                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Stack Trace if present */}
                  {entry.metadata?.stack_trace && Array.isArray(entry.metadata.stack_trace) && (
                    <div className="bg-rose-950/20 border border-rose-900/40 rounded-lg p-3">
                      <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" /> Stack Trace
                      </div>
                      <pre className="text-rose-300 font-mono-code text-[11px] overflow-x-auto p-2 bg-slate-950 rounded">
                        {entry.metadata.stack_trace.join('\n')}
                      </pre>
                    </div>
                  )}

                  {/* Raw Log Line */}
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Raw Log Content
                    </div>
                    <pre className="text-slate-300 font-mono-code text-[11px] whitespace-pre-wrap break-all select-all">
                      {entry.raw || entry.message}
                    </pre>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Pagination Footer */}
      <div className="bg-slate-950/90 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
        <div>
          Showing <strong className="text-slate-200">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
          <strong className="text-slate-200">{Math.min(currentPage * pageSize, totalLogs)}</strong> of{' '}
          <strong className="text-slate-200">{totalLogs.toLocaleString()}</strong> events
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-300 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
