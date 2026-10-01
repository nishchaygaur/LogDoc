import { LogEntry, DatasetSummary, DrainCluster, Anomaly, Metrics, DiagnosticResult } from '../types/log';

const API_BASE = '/api';

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

export async function uploadLogFile(file: File): Promise<{ dataset_name: string; total_parsed: number; parser_used: string }> {
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

export async function runDiagnostics(dataset?: string, geminiApiKey?: string): Promise<DiagnosticResult> {
  const res = await fetch(`${API_BASE}/diagnostics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset, gemini_api_key: geminiApiKey || undefined }),
  });
  if (!res.ok) throw new Error('Failed to run diagnostics');
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
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  let ws: WebSocket | null = null;
  let isClosed = false;
  let retryCount = 0;

  function connect() {
    if (isClosed || retryCount >= 3) return;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch {
          // ignore malformed message
        }
      };
      ws.onerror = () => {
        retryCount++;
      };
      ws.onclose = () => {
        if (!isClosed && retryCount < 3) {
          retryCount++;
          setTimeout(connect, 4000);
        }
      };
    } catch {
      retryCount++;
    }
  }

  connect();

  return () => {
    isClosed = true;
    if (ws) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
  };
}
