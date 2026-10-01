import React from 'react';
import { Layers, AlertTriangle, AlertOctagon, Cpu, Clock } from 'lucide-react';
import { Metrics, Anomaly } from '../types/log';

interface StatsCardsProps {
  metrics: Metrics | null;
  anomalies: Anomaly[];
  clusterCount: number;
  onFilterErrors: () => void;
  onOpenAnomalies: () => void;
  onOpenClusters: () => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  metrics,
  anomalies,
  clusterCount,
  onFilterErrors,
  onOpenAnomalies,
  onOpenClusters,
}) => {
  if (!metrics) return null;

  const totalLogs = metrics.total_logs || 0;
  const errorCount = (metrics.level_counts?.ERROR || 0) + (metrics.level_counts?.CRITICAL || 0);
  const errorRate = metrics.error_rate || 0;
  const serviceCount = metrics.services?.length || 0;
  const duration = metrics.time_range?.duration_seconds ? `${Math.round(metrics.time_range.duration_seconds)}s` : '—';

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
      {/* Total Logs */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Logs</div>
          <div className="text-xl font-bold text-slate-100 mt-1">{totalLogs.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Span: {duration}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
          <Layers className="w-5 h-5" />
        </div>
      </div>

      {/* Errors & Rate */}
      <div 
        onClick={onFilterErrors}
        className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-rose-500/40 rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-colors group"
      >
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-rose-400 transition-colors">
            Error Events
          </div>
          <div className="text-xl font-bold text-rose-400 mt-1">{errorCount.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Error rate: <span className={errorRate > 5 ? 'text-rose-400 font-semibold' : 'text-slate-300'}>{errorRate}%</span>
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertOctagon className="w-5 h-5" />
        </div>
      </div>

      {/* Anomalies Detected */}
      <div 
        onClick={onOpenAnomalies}
        className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-colors group"
      >
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-amber-400 transition-colors">
            Anomalies
          </div>
          <div className="text-xl font-bold text-amber-400 mt-1">{anomalies.length}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {anomalies.some(a => a.severity === 'critical' || a.severity === 'high') 
              ? <span className="text-rose-400 font-medium">Critical alerts present</span>
              : 'Patterns analyzed'}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5" />
        </div>
      </div>

      {/* Unique Templates (Drain Clusters) */}
      <div 
        onClick={onOpenClusters}
        className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-colors group"
      >
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-indigo-400 transition-colors">
            Drain Templates
          </div>
          <div className="text-xl font-bold text-indigo-400 mt-1">{clusterCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Template clusters mined
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Layers className="w-5 h-5" />
        </div>
      </div>

      {/* Active Services */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between col-span-2 md:col-span-1">
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Services</div>
          <div className="text-xl font-bold text-sky-400 mt-1">{serviceCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]">
            {metrics.services?.slice(0, 2).map(s => s.name).join(', ') || 'N/A'}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
          <Cpu className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
