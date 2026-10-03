import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { TimelineHistogram } from './components/TimelineHistogram';
import { FilterBar } from './components/FilterBar';
import { LogStream } from './components/LogStream';
import { ClusteringView } from './components/ClusteringView';
import { AnomalyAlerts } from './components/AnomalyAlerts';
import { AIDiagnosticsModal } from './components/AIDiagnosticsModal';
import { UploadModal } from './components/UploadModal';
import { ExportModal, UploadedDatasetData } from './components/ExportModal';

import {
  fetchDatasets,
  selectDataset,
  uploadLogFile,
  loadSampleDataset,
  fetchOverview,
  runDiagnostics,
  toggleSimulator,
  createLogWebSocket,
} from './api/client';

import {
  LogEntry,
  DatasetSummary,
  DrainCluster,
  Anomaly,
  Metrics,
  DiagnosticResult,
  FilterState,
} from './types/log';

import { ListFilter, Layers, AlertTriangle } from 'lucide-react';

export const App: React.FC = () => {
  // Datasets state
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);

  // Client-stored uploaded datasets (preserves user uploads across serverless lambdas)
  const [uploadedDatasets, setUploadedDatasets] = useState<Record<string, UploadedDatasetData>>(() => {
    try {
      const saved = sessionStorage.getItem('logdoc_uploaded_datasets');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const saveUploadedDataset = (data: UploadedDatasetData) => {
    setUploadedDatasets((prev) => {
      const next = { ...prev, [data.dataset_name]: data };
      try {
        sessionStorage.setItem('logdoc_uploaded_datasets', JSON.stringify(next));
      } catch (err) {
        console.warn('Could not persist to sessionStorage:', err);
      }
      return next;
    });
  };

  // Main telemetry state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [clusters, setClusters] = useState<DrainCluster[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  // Navigation & UI state
  const [activeTab, setActiveTab] = useState<'stream' | 'clusters' | 'anomalies'>('stream');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(50);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<DiagnosticResult | null>(null);
  const [isDiagLoading, setIsDiagLoading] = useState<boolean>(false);

  // Settings
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('logdoc_gemini_key') || '';
  });

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    isRegex: false,
    levels: [],
    selectedService: null,
    selectedTemplateId: null,
    startEpoch: null,
    endEpoch: null,
    sortOrder: 'desc',
  });

  // Initial load of datasets
  const loadDatasetsList = useCallback(async () => {
    try {
      const data = await fetchDatasets();
      const uploadedSummaries: DatasetSummary[] = Object.values(uploadedDatasets).map((d) => ({
        id: d.dataset_name,
        name: d.dataset_name,
        parser_type: d.parser_used,
        log_count: d.logs.length,
        is_active: d.dataset_name === activeDataset,
      }));

      const serverDatasets = (data?.datasets || []).filter(
        (sd) => !uploadedDatasets[sd.name]
      );

      const merged = [...uploadedSummaries, ...serverDatasets];
      setDatasets(merged);

      if (!activeDataset) {
        if (uploadedSummaries.length > 0) {
          setActiveDataset(uploadedSummaries[0].name);
        } else if (data?.active_dataset) {
          setActiveDataset(data.active_dataset);
        }
      }
    } catch (err) {
      console.error('Failed to load datasets:', err);
    }
  }, [activeDataset, uploadedDatasets]);

  useEffect(() => {
    loadDatasetsList();
  }, [loadDatasetsList]);

  // Load telemetry data whenever active dataset or filters change
  const refreshData = useCallback(async () => {
    if (!activeDataset) return;

    // Fast path: In-memory filtering for user-uploaded datasets
    if (uploadedDatasets[activeDataset]) {
      const up = uploadedDatasets[activeDataset];
      setIsLoading(true);
      try {
        let filtered = up.logs;

        // Level filter
        if (filters.levels.length > 0) {
          const levelSet = new Set(filters.levels.map((l) => l.toUpperCase()));
          filtered = filtered.filter((l) => levelSet.has(l.level));
        }

        // Service filter
        if (filters.selectedService) {
          filtered = filtered.filter((l) => l.service === filters.selectedService);
        }

        // Template filter
        if (filters.selectedTemplateId !== null && filters.selectedTemplateId !== undefined) {
          filtered = filtered.filter((l) => l.template_id === filters.selectedTemplateId);
        }

        // Time epoch filter
        if (filters.startEpoch !== null && filters.startEpoch !== undefined) {
          filtered = filtered.filter((l) => l.timestamp_epoch !== null && l.timestamp_epoch >= filters.startEpoch!);
        }
        if (filters.endEpoch !== null && filters.endEpoch !== undefined) {
          filtered = filtered.filter((l) => l.timestamp_epoch !== null && l.timestamp_epoch <= filters.endEpoch!);
        }

        // Search Query filter
        if (filters.query && filters.query.trim()) {
          const q = filters.query.trim();
          if (filters.isRegex) {
            try {
              const rx = new RegExp(q, 'i');
              filtered = filtered.filter((l) => rx.test(l.message) || rx.test(l.raw));
            } catch {
              const qLower = q.toLowerCase();
              filtered = filtered.filter(
                (l) => l.message.toLowerCase().includes(qLower) || l.raw.toLowerCase().includes(qLower)
              );
            }
          } else {
            const qLower = q.toLowerCase();
            filtered = filtered.filter(
              (l) => l.message.toLowerCase().includes(qLower) || l.raw.toLowerCase().includes(qLower)
            );
          }
        }

        // Sort order
        if (filters.sortOrder === 'asc') {
          filtered = [...filtered].sort((a, b) => (a.timestamp_epoch || 0) - (b.timestamp_epoch || 0));
        } else {
          filtered = [...filtered].sort((a, b) => (b.timestamp_epoch || 0) - (a.timestamp_epoch || 0));
        }

        const total = filtered.length;
        const offset = (currentPage - 1) * pageSize;
        const pageLogs = filtered.slice(offset, offset + pageSize);

        setLogs(pageLogs);
        setTotalLogs(total);
        setMetrics(up.metrics);
        setClusters(up.clusters);
        setAnomalies(up.anomalies);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Server-side path: Sample datasets & serverless datasets
    setIsLoading(true);
    try {
      const data = await fetchOverview({
        dataset: activeDataset,
        q: filters.query || undefined,
        is_regex: filters.isRegex,
        levels: filters.levels.length > 0 ? filters.levels : undefined,
        services: filters.selectedService ? [filters.selectedService] : undefined,
        template_id: filters.selectedTemplateId,
        start_epoch: filters.startEpoch,
        end_epoch: filters.endEpoch,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        sort_order: filters.sortOrder,
      });

      setLogs(data.logs);
      setTotalLogs(data.total);
      setMetrics(data.metrics);
      setClusters(data.clusters);
      setAnomalies(data.anomalies);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeDataset, uploadedDatasets, filters, currentPage, pageSize]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // WebSocket Live Streaming connection
  useEffect(() => {
    const cleanupWs = createLogWebSocket((message) => {
      if (message.type === 'log_entry') {
        const newEntry: LogEntry = message.entry;
        if (message.dataset === activeDataset || activeDataset === 'live_stream') {
          setLogs((prev) => [newEntry, ...prev.slice(0, pageSize - 1)]);
          setTotalLogs((prev) => prev + 1);
        }
      }
    });

    return () => {
      cleanupWs();
    };
  }, [activeDataset, pageSize]);

  // Handle switching datasets
  const handleSelectDataset = async (name: string) => {
    try {
      if (!uploadedDatasets[name]) {
        await selectDataset(name);
      }
      setActiveDataset(name);
      setCurrentPage(1);
      setFilters((prev) => ({ ...prev, selectedTemplateId: null, selectedService: null }));
    } catch (err) {
      alert('Error switching dataset: ' + err);
    }
  };

  // Handle file upload
  const handleUploadFile = async (file: File) => {
    const res = await uploadLogFile(file);
    const newRecord: UploadedDatasetData = {
      dataset_name: res.dataset_name,
      parser_used: res.parser_used,
      logs: res.logs || [],
      clusters: res.clusters || [],
      anomalies: res.anomalies || [],
      metrics: res.metrics || {
        total_logs: res.total_parsed,
        level_counts: {},
        error_rate: 0,
        services: [],
        top_errors: [],
        histogram: [],
        time_range: { start: null, end: null, duration_seconds: 0 },
      },
    };

    saveUploadedDataset(newRecord);
    setActiveDataset(res.dataset_name);
    setCurrentPage(1);
    setFilters({
      query: '',
      isRegex: false,
      levels: [],
      selectedService: null,
      selectedTemplateId: null,
      startEpoch: null,
      endEpoch: null,
      sortOrder: 'desc',
    });
  };

  // Handle sample dataset load
  const handleLoadSample = async (sampleType: string) => {
    const res = await loadSampleDataset(sampleType);
    await loadDatasetsList();
    await handleSelectDataset(res.dataset_name);
  };

  // Live Tail toggle
  const handleToggleLive = async () => {
    try {
      const nextState = !isLiveActive;
      const res = await toggleSimulator(nextState ? 'start' : 'stop', 0.8);
      setIsLiveActive(res.is_running);
      if (res.is_running && activeDataset !== 'live_stream') {
        await handleSelectDataset('live_stream');
      }
    } catch (err) {
      alert('Live tail error: ' + err);
    }
  };

  // Trigger AI Diagnostics
  const handleRunDiagnostics = async (keyOverride?: string) => {
    const keyToUse = keyOverride !== undefined ? keyOverride : geminiApiKey;
    if (keyOverride !== undefined) {
      setGeminiApiKey(keyOverride);
      localStorage.setItem('logdoc_gemini_key', keyOverride);
    }

    setIsDiagLoading(true);
    try {
      let context: { error_samples?: any[]; anomalies?: any[]; metrics?: any } | undefined = undefined;
      if (activeDataset && uploadedDatasets[activeDataset]) {
        const up = uploadedDatasets[activeDataset];
        const errorLogs = up.logs.filter((l) => l.level === 'ERROR' || l.level === 'CRITICAL');
        const warnLogs = up.logs.filter((l) => l.level === 'WARN');
        const sampleContext = [...errorLogs.slice(0, 100), ...warnLogs.slice(0, 50), ...up.logs.slice(0, 50)];
        context = {
          error_samples: sampleContext,
          anomalies: up.anomalies,
          metrics: up.metrics,
        };
      }

      const res = await runDiagnostics(activeDataset || undefined, keyToUse || undefined, context);
      setDiagnosticsResult(res);
      setIsDiagnosticsOpen(true);
    } catch (err) {
      alert('Diagnostics failed: ' + err);
    } finally {
      setIsDiagLoading(false);
    }
  };

  // Quick filter helpers
  const handleFilterErrors = () => {
    setFilters((prev) => ({ ...prev, levels: ['ERROR'] }));
    setCurrentPage(1);
    setActiveTab('stream');
  };

  const handleSelectTemplate = (templateId: number) => {
    if (filters.selectedTemplateId === templateId) {
      setFilters((prev) => ({ ...prev, selectedTemplateId: null }));
    } else {
      setFilters((prev) => ({ ...prev, selectedTemplateId: templateId }));
      setActiveTab('stream');
    }
    setCurrentPage(1);
  };

  const availableServices = metrics?.services?.map((s) => s.name) || [];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Top Navbar */}
      <Navbar
        datasets={datasets}
        activeDataset={activeDataset}
        onSelectDataset={handleSelectDataset}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenDiagnostics={() => handleRunDiagnostics()}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenApiKeyModal={() => {
          setIsDiagnosticsOpen(true);
        }}
        isLiveActive={isLiveActive}
        onToggleLive={handleToggleLive}
        onRefresh={refreshData}
        isLoading={isLoading}
        geminiKeySet={Boolean(geminiApiKey)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6">
        {/* KPI Summary Cards */}
        <StatsCards
          metrics={metrics}
          anomalies={anomalies}
          clusterCount={clusters.length}
          onFilterErrors={handleFilterErrors}
          onOpenAnomalies={() => setActiveTab('anomalies')}
          onOpenClusters={() => setActiveTab('clusters')}
        />

        {/* Anomaly Alerts Banner (if any) */}
        {anomalies.length > 0 && (
          <AnomalyAlerts
            anomalies={anomalies}
            onInvestigate={() => handleRunDiagnostics()}
          />
        )}

        {/* Time-series Histogram */}
        {metrics?.histogram && metrics.histogram.length > 0 && (
          <TimelineHistogram histogram={metrics.histogram} />
        )}

        {/* Tab Navigation & Controls */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('stream')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'stream'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Log Stream</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/30 font-mono">
                {totalLogs.toLocaleString()}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('clusters')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'clusters'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Drain Templates</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/30 font-mono">
                {clusters.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('anomalies')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'anomalies'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Anomalies</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/30 font-mono">
                {anomalies.length}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            {activeDataset ? `Active: ${activeDataset}` : 'No dataset'}
          </div>
        </div>

        {/* Tab 1: Filter Bar + Log Stream */}
        {activeTab === 'stream' && (
          <>
            <FilterBar
              filters={filters}
              onFilterChange={(newFilters) => {
                setFilters(newFilters);
                setCurrentPage(1);
              }}
              availableServices={availableServices}
              totalMatches={totalLogs}
            />

            <LogStream
              logs={logs}
              totalLogs={totalLogs}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
              onFilterByTemplate={handleSelectTemplate}
              onFilterByService={(svc) => {
                setFilters((prev) => ({ ...prev, selectedService: svc }));
                setCurrentPage(1);
              }}
            />
          </>
        )}

        {/* Tab 2: Drain Clustering View */}
        {activeTab === 'clusters' && (
          <ClusteringView
            clusters={clusters}
            onSelectCluster={handleSelectTemplate}
            selectedClusterId={filters.selectedTemplateId}
          />
        )}

        {/* Tab 3: Detailed Anomalies View */}
        {activeTab === 'anomalies' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-base font-bold text-slate-100 mb-2">Detected Telemetry Anomalies</h3>
              <p className="text-xs text-slate-400 mb-6 max-w-xl">
                LogDoc uses moving-window z-score calculations, error-burst thresholding, status code distributions, and security pattern matching to identify active degradation.
              </p>
              <AnomalyAlerts
                anomalies={anomalies}
                onInvestigate={() => handleRunDiagnostics()}
              />
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadFile={handleUploadFile}
        onLoadSample={handleLoadSample}
      />

      <AIDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        result={diagnosticsResult}
        isLoading={isDiagLoading}
        onRunDiagnostics={handleRunDiagnostics}
        savedApiKey={geminiApiKey}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        activeDataset={activeDataset}
        uploadedDataset={activeDataset ? uploadedDatasets[activeDataset] : null}
      />
    </div>
  );
};

export default App;
