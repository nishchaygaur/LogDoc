import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Server, ShieldAlert, Coffee, Layers } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadFile: (file: File) => Promise<void>;
  onLoadSample: (sampleType: string) => Promise<void>;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadFile,
  onLoadSample,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setIsSubmitting(true);
      await onUploadFile(file);
      onClose();
    } catch (err) {
      alert('Failed to upload and parse log file: ' + err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSampleClick = async (sampleType: string) => {
    try {
      setIsSubmitting(true);
      await onLoadSample(sampleType);
      onClose();
    } catch (err) {
      alert('Failed to load sample: ' + err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Load or Upload Logs</h2>
              <p className="text-xs text-slate-400">Import your raw logs or test with pre-built synthetic scenarios</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-sky-400 bg-sky-500/10'
                : 'border-slate-700 hover:border-slate-500 bg-slate-950/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
              accept=".log,.txt,.json,.ndjson,.csv"
            />
            <FileText className="w-10 h-10 text-sky-400 mx-auto mb-3 animate-pulse" />
            <div className="text-sm font-semibold text-slate-200">
              {isSubmitting ? 'Uploading & parsing logs...' : 'Drop log file here, or browse files'}
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Auto-detects JSON, NDJSON, NGINX/Apache, Syslog (RFC 3164/5424), Spring Boot stack traces, and Logfmt.
            </p>
          </div>

          {/* Quick Preloaded Scenarios */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Or Try A Pre-Built Incident Scenario
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Scenario 1 */}
              <button
                disabled={isSubmitting}
                onClick={() => handleSampleClick('microservices_outage')}
                className="p-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-sky-500/40 text-left transition-all group flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20 shrink-0">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-sky-300">
                    Microservices Outage (JSON)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Cascading DB connection pool failure & circuit breaker trips.
                  </div>
                </div>
              </button>

              {/* Scenario 2 */}
              <button
                disabled={isSubmitting}
                onClick={() => handleSampleClick('nginx_access')}
                className="p-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-amber-500/40 text-left transition-all group flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-amber-300">
                    NGINX Access Logs
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Combined web server traffic with HTTP 502 spikes and IP analysis.
                  </div>
                </div>
              </button>

              {/* Scenario 3 */}
              <button
                disabled={isSubmitting}
                onClick={() => handleSampleClick('auth_failures')}
                className="p-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-rose-500/40 text-left transition-all group flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20 shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-rose-300">
                    SSH Brute Force Attack
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Syslog RFC 3164 security audit with repeated auth failure bursts.
                  </div>
                </div>
              </button>

              {/* Scenario 4 */}
              <button
                disabled={isSubmitting}
                onClick={() => handleSampleClick('springboot_stacktrace')}
                className="p-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-indigo-500/40 text-left transition-all group flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 shrink-0">
                  <Coffee className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-indigo-300">
                    Spring Boot Stack Traces
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Multi-line Java exceptions with unhandled NullPointerExceptions.
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
