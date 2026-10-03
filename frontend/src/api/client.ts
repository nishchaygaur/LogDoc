import { LogEntry, DatasetSummary, DrainCluster, Anomaly, Metrics, DiagnosticResult } from '../types/log';

const customApi = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
const API_BASE = customApi ? (customApi.endsWith('/api') ? customApi : `${customApi}/api`) : '/api';

export async function fetchDatasets(): Promise<{ datasets: DatasetSummary[]; active_dataset: string | null }> {
  const res = await fetch(`${API_BASE}/datasets`);
  if (!res.ok) throw new Error('Failed to fetch datasets');
  return res.json();
}

export async function selectDataset(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/datasets/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to select dataset');
}

export interface UploadResponse {
  status: string;
  dataset_name: string;
  parser_used: string;
  total_parsed: number;
  error_count: number;
  logs: LogEntry[];
  clusters: DrainCluster[];
  anomalies: Anomaly[];
  metrics: Metrics;
}

export async function uploadLogFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
  } catch (netErr: any) {
    throw new Error(`Network failure connecting to ${API_BASE}/upload: ${netErr?.message || netErr}`);
  }

  if (!res.ok) {
    let msg = `Upload failed (HTTP ${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.detail) {
        msg = errJson.detail;
      }
    } catch {
      if (res.status === 413) {
        msg = 'File exceeds maximum upload size (4.5 MB). Try uploading a smaller log sample or slice.';
      } else if (res.status === 401 || res.status === 403) {
        msg = 'Vercel Authentication blocked the request. Please use https://logdoc-phi.vercel.app.';
      } else {
        msg = `Server returned HTTP ${res.status}: ${res.statusText}`;
      }
    }
    throw new Error(msg);
  }

  return res.json();
}

export async function loadSampleDataset(sampleType: string): Promise<{ dataset_name: string; total_parsed: number }> {
  const res = await fetch(`${API_BASE}/load-sample`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sample_type: sampleType }),
  });
  if (!res.ok) {
    let msg = 'Failed to load sample dataset';
    try {
      const errJson = await res.json();
      if (errJson?.detail) msg = errJson.detail;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export interface FetchLogsParams {
  dataset?: string;
  q?: string;
  is_regex?: boolean;
  levels?: string[];
  services?: string[];
  template_id?: number | null;
  start_epoch?: number | null;
  end_epoch?: number | null;
  limit?: number;
  offset?: number;
  sort_order?: 'desc' | 'asc';
}

export async function fetchLogs(params: FetchLogsParams): Promise<{ total: number; limit: number; offset: number; logs: LogEntry[] }> {
  const searchParams = new URLSearchParams();
  if (params.dataset) searchParams.append('dataset', params.dataset);
  if (params.q) searchParams.append('q', params.q);
  if (params.is_regex) searchParams.append('is_regex', 'true');
  if (params.levels && params.levels.length > 0) {
    params.levels.forEach(lvl => searchParams.append('levels', lvl));
  }
  if (params.services && params.services.length > 0) {
    params.services.forEach(svc => searchParams.append('services', svc));
  }
  if (params.template_id !== null && params.template_id !== undefined) {
    searchParams.append('template_id', params.template_id.toString());
  }
  if (params.start_epoch) searchParams.append('start_epoch', params.start_epoch.toString());
  if (params.end_epoch) searchParams.append('end_epoch', params.end_epoch.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.offset !== undefined) searchParams.append('offset', params.offset.toString());
  if (params.sort_order) searchParams.append('sort_order', params.sort_order);

  const res = await fetch(`${API_BASE}/logs?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export interface OverviewResponse {
  logs: LogEntry[];
  total: number;
  limit: number;
  offset: number;
  metrics: Metrics;
  clusters: DrainCluster[];
  anomalies: Anomaly[];
}

export async function fetchOverview(params: FetchLogsParams): Promise<OverviewResponse> {
  const searchParams = new URLSearchParams();
  if (params.dataset) searchParams.append('dataset', params.dataset);
  if (params.q) searchParams.append('q', params.q);
  if (params.is_regex) searchParams.append('is_regex', 'true');
  if (params.levels && params.levels.length > 0) {
    params.levels.forEach(lvl => searchParams.append('levels', lvl));
  }
  if (params.services && params.services.length > 0) {
    params.services.forEach(svc => searchParams.append('services', svc));
  }
  if (params.template_id !== null && params.template_id !== undefined) {
    searchParams.append('template_id', params.template_id.toString());
  }
  if (params.start_epoch) searchParams.append('start_epoch', params.start_epoch.toString());
  if (params.end_epoch) searchParams.append('end_epoch', params.end_epoch.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.offset !== undefined) searchParams.append('offset', params.offset.toString());
  if (params.sort_order) searchParams.append('sort_order', params.sort_order);

  const res = await fetch(`${API_BASE}/overview?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch dataset overview');
  return res.json();
}

export async function fetchClusters(dataset?: string): Promise<{ clusters: DrainCluster[] }> {
  const url = dataset ? `${API_BASE}/clusters?dataset=${encodeURIComponent(dataset)}` : `${API_BASE}/clusters`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch clusters');
  return res.json();
}

export async function fetchAnomalies(dataset?: string): Promise<{ anomalies: Anomaly[] }> {
  const url = dataset ? `${API_BASE}/anomalies?dataset=${encodeURIComponent(dataset)}` : `${API_BASE}/anomalies`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch anomalies');
  return res.json();
}

export async function fetchMetrics(dataset?: string): Promise<Metrics> {
  const url = dataset ? `${API_BASE}/metrics?dataset=${encodeURIComponent(dataset)}` : `${API_BASE}/metrics`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

export interface DiagnosticContext {
  error_samples?: any[];
  anomalies?: any[];
  metrics?: any;
}

export async function runDiagnostics(
  dataset?: string,
  geminiApiKey?: string,
  context?: DiagnosticContext
): Promise<DiagnosticResult> {
  const body: any = {
    dataset,
    gemini_api_key: geminiApiKey || undefined,
  };
  if (context?.error_samples && context?.metrics) {
    body.error_samples = context.error_samples;
    body.anomalies = context.anomalies;
    body.metrics = context.metrics;
  }

  const res = await fetch(`${API_BASE}/diagnostics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Diagnostics failed (HTTP ${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) msg = data.detail;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function toggleSimulator(action: 'start' | 'stop', delaySeconds: number = 1.0): Promise<{ is_running: boolean }> {
  const res = await fetch(`${API_BASE}/simulator/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, delay_seconds: delaySeconds }),
  });
  if (!res.ok) throw new Error('Failed to control live simulator');
  return res.json();
}

export function createLogWebSocket(onMessage: (data: any) => void): () => void {
  let wsUrl = '';
  const customWs = import.meta.env.VITE_WS_URL as string | undefined;
  if (customWs) {
    wsUrl = customWs;
  } else if (customApi) {
    try {
      const parsed = new URL(customApi);
      const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProto}//${parsed.host}/ws`;
    } catch {
      // invalid customApi URL
    }
  } else {
    // Only connect directly via relative /ws if running locally on localhost
    const isLocal = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isLocal) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws`;
    }
  }

  let ws: WebSocket | null = null;
  let isClosed = false;
  let fallbackInterval: any = null;

  function startFallbackSimulation() {
    if (fallbackInterval || isClosed) return;
    const services = ['api-gateway', 'auth-service', 'cart-service', 'payment-service', 'order-service'];
    const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'DEBUG'];

    fallbackInterval = setInterval(() => {
      if (isClosed) {
        clearInterval(fallbackInterval);
        return;
      }
      const isError = Math.random() < 0.12;
      const lvl = isError ? 'ERROR' : levels[Math.floor(Math.random() * levels.length)];
      const svc = services[Math.floor(Math.random() * services.length)];
      const errorMsgs = [
        'Database connection pool exhausted: HikariPool-1 timeout after 30000ms',
        'Upstream call to payment-service failed: HTTP 504 Gateway Timeout',
        'JWT validation failed: signature has expired',
        'Kafka producer buffer full: failed to deliver payload',
      ];
      const normalMsgs = [
        `Handled HTTP request from client IP 192.168.1.${Math.floor(Math.random() * 190) + 10}`,
        `Dispatched notification to queue events-worker-${Math.floor(Math.random() * 4) + 1}`,
        `Database query cache hit: key=usr_session_${Math.floor(Math.random() * 900) + 100}`,
        'Session authenticated successfully for token bearer-xyz',
        `Checked inventory for SKU_${Math.floor(Math.random() * 9000) + 1000}: stock=42`,
      ];
      const msg = isError ? errorMsgs[Math.floor(Math.random() * errorMsgs.length)] : normalMsgs[Math.floor(Math.random() * normalMsgs.length)];
      const now = new Date();

      const entry = {
        id: 'sim_' + Math.random().toString(36).substring(2, 9),
        timestamp: now.toISOString(),
        timestamp_epoch: now.getTime() / 1000,
        level: lvl,
        service: svc,
        message: msg,
        raw: `[${now.toISOString()}] [${lvl}] [${svc}] ${msg}`,
        source: 'live_stream',
        line_number: null,
        metadata: {},
        template_id: Math.floor(Math.random() * 8) + 1,
      };

      onMessage({
        type: 'log_entry',
        dataset: 'live_stream',
        entry,
      });
    }, 1000);
  }

  if (wsUrl) {
    let retryCount = 0;
    function connect() {
      if (isClosed) return;
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            onMessage(data);
          } catch {}
        };
        ws.onerror = () => {
          retryCount++;
          if (retryCount >= 2) {
            if (ws) {
              try { ws.close(); } catch {}
              ws = null;
            }
            startFallbackSimulation();
          }
        };
        ws.onclose = () => {
          if (!isClosed && retryCount < 2) {
            retryCount++;
            setTimeout(connect, 3000);
          } else if (!isClosed) {
            startFallbackSimulation();
          }
        };
      } catch {
        startFallbackSimulation();
      }
    }
    connect();
  } else {
    // On serverless hosts without dedicated WebSocket server, start client-side stream simulation
    startFallbackSimulation();
  }

  return () => {
    isClosed = true;
    if (fallbackInterval) {
      clearInterval(fallbackInterval);
      fallbackInterval = null;
    }
    if (ws) {
      try {
        ws.close();
      } catch {}
    }
  };
}
