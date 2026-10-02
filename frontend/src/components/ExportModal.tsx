import React from 'react';
import { Download, FileText, Table, ExternalLink, X } from 'lucide-react';
import { LogEntry, DrainCluster, Anomaly, Metrics } from '../types/log';

export interface UploadedDatasetData {
  dataset_name: string;
  parser_used: string;
  logs: LogEntry[];
  clusters: DrainCluster[];
  anomalies: Anomaly[];
  metrics: Metrics;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDataset: string | null;
  uploadedDataset?: UploadedDatasetData | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  activeDataset,
  uploadedDataset,
}) => {
  if (!isOpen) return null;

  const datasetParam = activeDataset ? `?dataset=${encodeURIComponent(activeDataset)}` : '';

  const handleExportJSON = (e: React.MouseEvent) => {
    if (uploadedDataset) {
      e.preventDefault();
      const blob = new Blob([JSON.stringify(uploadedDataset.logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${uploadedDataset.dataset_name}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportCSV = (e: React.MouseEvent) => {
    if (uploadedDataset) {
      e.preventDefault();
      const headers = ['Timestamp', 'Level', 'Service', 'Message', 'Source', 'Line'];
      const rows = uploadedDataset.logs.map((l) => [
        `"${(l.timestamp || '').replace(/"/g, '""')}"`,
        `"${(l.level || '').replace(/"/g, '""')}"`,
        `"${(l.service || '').replace(/"/g, '""')}"`,
        `"${(l.message || '').replace(/"/g, '""')}"`,
        `"${(l.source || '').replace(/"/g, '""')}"`,
        `"${l.line_number ?? ''}"`,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${uploadedDataset.dataset_name}_export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportHTML = (e: React.MouseEvent) => {
    if (uploadedDataset) {
      e.preventDefault();
      const ds = uploadedDataset;
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Incident Report - ${ds.dataset_name}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 40px; margin: 0; }
        .container { max-width: 900px; margin: 0 auto; }
        .header { border-bottom: 2px solid #334155; padding-bottom: 20px; margin-bottom: 30px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        .kpi-card { background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155; }
        .card-val { font-size: 28px; font-weight: bold; color: #38bdf8; }
        .anomaly-card { background: #1e293b; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 16px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color:#38bdf8; margin:0;">LogDoc Incident Post-Mortem & Telemetry Report</h1>
            <p style="color:#94a3b8; margin: 5px 0 0 0;">Dataset: <strong>${ds.dataset_name}</strong> | Generated: ${new Date().toISOString()}</p>
        </div>
        <div class="kpi-grid">
            <div class="kpi-card"><div>Total Logs</div><div class="card-val">${ds.metrics?.total_logs || ds.logs.length}</div></div>
            <div class="kpi-card"><div>Error Count</div><div class="card-val" style="color: #ef4444;">${ds.metrics?.level_counts?.ERROR || 0}</div></div>
            <div class="kpi-card"><div>Error Rate</div><div class="card-val" style="color: #f59e0b;">${((ds.metrics?.error_rate || 0) * 100).toFixed(1)}%</div></div>
        </div>
        <h2>Detected Telemetry Anomalies (${ds.anomalies.length})</h2>
        ${ds.anomalies.map((a) => `
            <div class="anomaly-card">
                <h3 style="margin-top:0; color:#f87171;">${a.title}</h3>
                <p style="color:#cbd5e1;">${a.description}</p>
                <div style="font-size:12px; color:#94a3b8;">Severity: <strong style="color:#f87171;">${a.severity.toUpperCase()}</strong> | Baseline: ${a.baseline_value} &rarr; Observed: ${a.metric_value}</div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

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
            href={uploadedDataset ? '#' : `/api/export${datasetParam}&format=json`}
            onClick={handleExportJSON}
            download={uploadedDataset ? undefined : true}
            className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-sky-500/40 transition-all group cursor-pointer"
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
            href={uploadedDataset ? '#' : `/api/export${datasetParam}&format=csv`}
            onClick={handleExportCSV}
            download={uploadedDataset ? undefined : true}
            className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-emerald-500/40 transition-all group cursor-pointer"
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
            href={uploadedDataset ? '#' : `/api/export/report${datasetParam}`}
            onClick={handleExportHTML}
            target={uploadedDataset ? undefined : '_blank'}
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-indigo-500/40 transition-all group cursor-pointer"
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
