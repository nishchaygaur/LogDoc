export interface LogEntry {
  id: string;
  timestamp: string | null;
  timestamp_epoch: number | null;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'CRITICAL' | 'TRACE';
  service: string | null;
  message: string;
  raw: string;
  source: string | null;
  line_number: number | null;
  metadata: Record<string, any>;
  template_id: number | null;
}

export interface DatasetSummary {
  id: string;
  name: string;
  parser_type: string;
  log_count: number;
  is_active: boolean;
}

export interface HistogramBucket {
  timestamp_epoch: number;
  total: number;
  INFO: number;
  WARN: number;
  ERROR: number;
  DEBUG: number;
  OTHER: number;
}

export interface DrainCluster {
  cluster_id: number;
  template: string;
  size: number;
  error_count: number;
  first_seen: string | null;
  last_seen: string | null;
  sample_logs: LogEntry[];
  sample_params: string[][];
}

export interface Anomaly {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  timestamp: string | null;
  description: string;
  sample_errors: string[];
  metric_value: number;
  baseline_value: number;
}

export interface Metrics {
  total_logs: number;
  level_counts: Record<string, number>;
  error_rate: number;
  services: { name: string; count: number; percentage: number }[];
  top_errors: { message: string; count: number }[];
  histogram: HistogramBucket[];
  time_range: {
    start: string | null;
    end: string | null;
    duration_seconds: number;
  };
}

export interface DiagnosedIssue {
  category: string;
  title: string;
  confidence: number;
  occurrences: number;
  root_cause: string;
  remediation: string[];
  sample_snippets: string[];
}

export interface DiagnosticResult {
  source: 'heuristic_engine' | 'gemini_ai';
  model?: string;
  executive_summary: string;
  diagnosed_issues: DiagnosedIssue[];
  affected_services: string[];
  total_errors: number;
  error_rate: number;
  anomalies_detected: number;
  gemini_available: boolean;
  note?: string;
}

export interface FilterState {
  query: string;
  isRegex: boolean;
  levels: string[];
  selectedService: string | null;
  selectedTemplateId: number | null;
  startEpoch: number | null;
  endEpoch: number | null;
  sortOrder: 'desc' | 'asc';
}
