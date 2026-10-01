import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronRight, Filter, AlertOctagon, Terminal } from 'lucide-react';
import { DrainCluster } from '../types/log';

interface ClusteringViewProps {
  clusters: DrainCluster[];
  onSelectCluster: (clusterId: number) => void;
  selectedClusterId: number | null;
}

export const ClusteringView: React.FC<ClusteringViewProps> = ({
  clusters,
  onSelectCluster,
  selectedClusterId,
}) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (clusters.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center">
        <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-slate-300">No clusters extracted yet</h4>
        <p className="text-xs text-slate-500 mt-1">Load or upload a log file to extract log templates automatically.</p>
      </div>
    );
  }

  const highlightTemplateTokens = (template: string) => {
    const parts = template.split(/(<[^>]+>)/g);
    return parts.map((part, i) => {
      if (part.startsWith('<') && part.endsWith('>')) {
        return (
          <span key={i} className="inline-block px-1.5 py-0.2 mx-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40 text-[11px]">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-200">Mined Log Templates (Drain Clustering)</h3>
          <span className="text-xs text-slate-500 font-mono">({clusters.length} unique templates)</span>
        </div>
        <p className="text-xs text-slate-400 hidden sm:block">
          Aggregates repetitive log messages by parameterizing variables with <code className="text-sky-400 font-mono">&lt;*&gt;</code>
        </p>
      </div>

      <div className="divide-y divide-slate-800/60">
        {clusters.map((cluster) => {
          const isSelected = selectedClusterId === cluster.cluster_id;
          const isExpanded = expandedId === cluster.cluster_id;
          const hasErrors = cluster.error_count > 0;

          return (
            <div key={cluster.cluster_id} className={`transition-colors ${isSelected ? 'bg-indigo-950/30' : 'hover:bg-slate-850/60'}`}>
              <div 
                onClick={() => setExpandedId(isExpanded ? null : cluster.cluster_id)}
                className="px-4 py-3 flex items-start justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <button className="mt-1 text-slate-500 hover:text-slate-300">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-sky-400" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        Template #{cluster.cluster_id}
                      </span>
                      {hasErrors && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <AlertOctagon className="w-2.5 h-2.5" /> {cluster.error_count} errors
                        </span>
                      )}
                    </div>
                    <div className="font-mono-code text-xs text-slate-200 break-words leading-relaxed">
                      {highlightTemplateTokens(cluster.template)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-200">{cluster.size.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">occurrences</div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCluster(cluster.cluster_id);
                    }}
                    title="Filter main log stream to this template"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    <span>{isSelected ? 'Filtered' : 'Filter'}</span>
                  </button>
                </div>
              </div>

              {/* Expanded sample logs */}
              {isExpanded && (
                <div className="bg-slate-950/80 px-10 py-3 border-t border-slate-800/80 space-y-2 text-xs">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-sky-400" /> Sample concrete log instances:
                  </div>
                  {cluster.sample_logs && cluster.sample_logs.length > 0 ? (
                    cluster.sample_logs.map((s, idx) => (
                      <div key={idx} className="bg-slate-900 border border-slate-800/80 p-2 rounded font-mono-code text-[11px] text-slate-300">
                        {s.raw || s.message}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-xs">No sample preview available</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
