import React, { useState } from 'react';
import { 
  Sparkles, X, AlertOctagon, Wrench, 
  ExternalLink, Key, RefreshCw, ShieldCheck 
} from 'lucide-react';
import { DiagnosticResult } from '../types/log';

interface AIDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: DiagnosticResult | null;
  isLoading: boolean;
  onRunDiagnostics: (apiKey?: string) => void;
  savedApiKey: string;
}

export const AIDiagnosticsModal: React.FC<AIDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  result,
  isLoading,
  onRunDiagnostics,
  savedApiKey,
}) => {
  const [tempApiKey, setTempApiKey] = useState(savedApiKey);
  const [showKeyInput, setShowKeyInput] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Automated Incident Diagnostics & Root Cause Analysis
              </h2>
              <p className="text-xs text-slate-400">
                AI + Heuristic telemetry correlation engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Engine Banner & Model Toggle */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                result?.source === 'gemini_ai'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
              }`}>
                {result?.source === 'gemini_ai' ? 'Gemini 2.5 Flash Model' : 'Expert Heuristic Engine'}
              </span>
              <span className="text-slate-400 text-xs">
                {result?.total_errors || 0} errors correlated across {result?.affected_services?.length || 0} services
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 hover:underline"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                {savedApiKey || tempApiKey ? 'Edit Gemini Key' : 'Configure Gemini Key'}
              </button>
              <button
                onClick={() => onRunDiagnostics(tempApiKey)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium text-xs shadow-md transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Re-Analyze</span>
              </button>
            </div>
          </div>

          {/* Gemini Key Input */}
          {showKeyInput && (
            <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-2">
              <div className="font-semibold text-slate-300">Google Gemini API Key</div>
              <p className="text-slate-400 text-[11px]">
                Add your Gemini API key to enable Deep LLM root-cause synthesis with <code className="text-sky-400">gemini-2.5-flash</code>. If left empty, LogDoc uses its built-in rule-based expert diagnostic system.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  onClick={() => {
                    onRunDiagnostics(tempApiKey);
                    setShowKeyInput(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs"
                >
                  Save & Analyze
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-slate-300 font-medium text-sm">Synthesizing Incident Telemetry...</div>
              <p className="text-slate-500 text-xs">Correlating error stack traces, anomaly bursts, and service graphs.</p>
            </div>
          ) : result ? (
            <div className="space-y-6">
              {/* Executive Summary */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Executive Incident Summary
                </h3>
                <div className="text-slate-200 text-xs leading-relaxed whitespace-pre-line font-sans">
                  {result.executive_summary}
                </div>
              </div>

              {/* Diagnosed Incidents & Root Causes */}
              {result.diagnosed_issues && result.diagnosed_issues.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4" /> Primary Root Cause Findings ({result.diagnosed_issues.length})
                  </h3>

                  <div className="space-y-3">
                    {result.diagnosed_issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-rose-950/70 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-rose-300">
                            {issue.title}
                          </h4>
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
                            Confidence: {Math.round(issue.confidence * 100)}%
                          </span>
                        </div>

                        <p className="text-slate-300 leading-relaxed text-xs">
                          {issue.root_cause}
                        </p>

                        {/* Remediation steps */}
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5 text-amber-400" /> Actionable Remediation Checklist:
                          </div>
                          <ul className="space-y-1 pl-4 list-disc text-slate-300 text-[11px]">
                            {issue.remediation.map((step, sIdx) => (
                              <li key={sIdx}>{step}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Sample snippets */}
                        {issue.sample_snippets && issue.sample_snippets.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] text-slate-500 uppercase font-semibold">Correlated Log Sample:</div>
                            <pre className="bg-slate-900 p-2 rounded text-[11px] font-mono-code text-rose-300 overflow-x-auto whitespace-pre-wrap">
                              {issue.sample_snippets[0]}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              Click Re-Analyze to generate diagnostic breakdown.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <a
            href="/api/export/report"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Standalone Printable HTML Report
          </a>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
