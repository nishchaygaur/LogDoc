import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { HistogramBucket } from '../types/log';

interface TimelineHistogramProps {
  histogram: HistogramBucket[];
  onSelectTimeBucket?: (startEpoch: number, endEpoch: number) => void;
}

export const TimelineHistogram: React.FC<TimelineHistogramProps> = ({
  histogram,
}) => {
  if (!histogram || histogram.length === 0) return null;

  // Format data for chart
  const data = histogram.map((bucket) => {
    const d = new Date(bucket.timestamp_epoch * 1000);
    const timeLabel = d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return {
      time: timeLabel,
      epoch: bucket.timestamp_epoch,
      INFO: bucket.INFO,
      WARN: bucket.WARN,
      ERROR: bucket.ERROR,
      DEBUG: bucket.DEBUG,
      total: bucket.total,
    };
  });

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Log Distribution Over Time</span>
          <span className="text-[11px] text-slate-500">({histogram.length} buckets)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-sky-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> INFO
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> WARN
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> ERROR
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> DEBUG
          </span>
        </div>
      </div>

      <div className="h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-lg text-xs">
                      <div className="font-semibold text-slate-200 mb-1">{label}</div>
                      <div className="text-sky-400">INFO: {item.INFO}</div>
                      <div className="text-amber-400">WARN: {item.WARN}</div>
                      <div className="text-rose-400 font-semibold">ERROR: {item.ERROR}</div>
                      <div className="text-emerald-400">DEBUG: {item.DEBUG}</div>
                      <div className="border-t border-slate-800 mt-1 pt-1 text-slate-300 font-medium">
                        Total: {item.total}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="INFO" stackId="a" fill="#0284c7" />
            <Bar dataKey="WARN" stackId="a" fill="#f59e0b" />
            <Bar dataKey="ERROR" stackId="a" fill="#f43f5e" />
            <Bar dataKey="DEBUG" stackId="a" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
