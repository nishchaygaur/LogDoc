export function getLevelBadgeStyle(level: string) {
  const lvl = (level || '').toUpperCase();
  switch (lvl) {
    case 'ERROR':
    case 'CRITICAL':
    case 'FATAL':
      return {
        bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        dot: 'bg-rose-500',
        text: 'text-rose-400'
      };
    case 'WARN':
    case 'WARNING':
      return {
        bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        dot: 'bg-amber-500',
        text: 'text-amber-400'
      };
    case 'INFO':
    case 'NOTICE':
      return {
        bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
        dot: 'bg-sky-500',
        text: 'text-sky-400'
      };
    case 'DEBUG':
      return {
        bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-500',
        text: 'text-emerald-400'
      };
    case 'TRACE':
      return {
        bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        dot: 'bg-purple-500',
        text: 'text-purple-400'
      };
    default:
      return {
        bg: 'bg-slate-700/30 text-slate-300 border-slate-700/50',
        dot: 'bg-slate-400',
        text: 'text-slate-300'
      };
  }
}

export function getSeverityStyle(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-950/60 text-red-400 border-red-800/80';
    case 'high':
      return 'bg-rose-950/50 text-rose-300 border-rose-700/60';
    case 'medium':
      return 'bg-amber-950/50 text-amber-300 border-amber-700/60';
    case 'low':
      return 'bg-blue-950/50 text-blue-300 border-blue-700/60';
    default:
      return 'bg-slate-800/50 text-slate-300 border-slate-700';
  }
}

const SERVICE_PALETTE = [
  '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb923c',
  '#34d399', '#a3e635', '#2dd4bf', '#60a5fa', '#f87171'
];

export function getServiceColor(serviceName?: string | null): string {
  if (!serviceName) return '#94a3b8';
  let hash = 0;
  for (let i = 0; i < serviceName.length; i++) {
    hash = serviceName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SERVICE_PALETTE.length;
  return SERVICE_PALETTE[index];
}

export function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const timePart = d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${timePart}.${ms}`;
  } catch {
    return ts;
  }
}
