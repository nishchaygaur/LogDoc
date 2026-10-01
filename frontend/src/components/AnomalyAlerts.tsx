import React from 'react';
import { AlertTriangle, ShieldAlert, TrendingUp, Zap, Clock, ChevronRight } from 'lucide-react';
import { Anomaly } from '../types/log';
import { getSeverityStyle } from '../utils/colors';

interface AnomalyAlertsProps {
  anomalies: Anomaly[];
  onInvestigate?: (anomaly: Anomaly) => void;
}

export const AnomalyAlerts: React.FC<AnomalyAlertsProps> = ({
  anomalies,
  onInvestigate,
}) => {
  if (anomalies.length === 0) return null;

  const getIconForType = (type: string) => {
    switch (type) {
      case 'ERROR_BURST':
        return <TrendingUp className="w-4 h-4 text-rose-400" />;
      case 'SECURITY_AUTHENTICATION_SPIKE':
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case 'HTTP_STATUS_OUTLIER':
        return <Zap className="w-4 h-4 text-amber-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">
            Detected Telemetry Anomalies ({anomalies.length})
          </h3>
        </div>
        <span className="text-[11px] text-slate-400">
          Automated baseline deviation & spike detection
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {anomalies.map((a) => {
          const sevStyle = getSeverityStyle(a.severity);

          return (
            <div
              key={a.id}
              className={`p-3.5 rounded-lg border flex flex-col justify-between transition-colors ${sevStyle}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {getIconForType(a.type)}
                    <span className="font-semibold text-xs truncate max-w-[200px] text-slate-100">{a.title}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/40 border border-white/10 tracking-wider">
                    {a.severity}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-2">
                  {a.description}
                </p>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                {a.timestamp ? (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                ) : (
                  <span>Aggregated</span>
                )}
                {onInvestigate && (
                  <button
                    onClick={() => onInvestigate(a)}
                    className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-0.5"
                  >
                    Details <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
