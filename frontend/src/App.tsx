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
import { ExportModal } from './components/ExportModal';

import {
  fetchDatasets,
  selectDataset,
  uploadLogFile,
  loadSampleDataset,
  fetchLogs,
  fetchClusters,
  fetchAnomalies,
  fetchMetrics,
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
      setDatasets(data.datasets);
      if (data.active_dataset && !activeDataset) {
        setActiveDataset(data.active_dataset);
      }
    } catch (err) {
      console.error('Failed to load datasets:', err);
    }
  }, [activeDataset]);

  useEffect(() => {
    loadDatasetsList();
  }, [loadDatasetsList]);

  // Load telemetry data whenever active dataset or filters change
  const refreshData = useCallback(async () => {
    if (!activeDataset) return;
    setIsLoading(true);
    try {
      const [logsData, metricsData, clustersData, anomaliesData] = await Promise.all([
        fetchLogs({
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
        }),
        fetchMetrics(activeDataset),
        fetchClusters(activeDataset),
        fetchAnomalies(activeDataset),
      ]);

      setLogs(logsData.logs);
      setTotalLogs(logsData.total);
      setMetrics(metricsData);
      setClusters(clustersData.clusters);
      setAnomalies(anomaliesData.anomalies);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeDataset, filters, currentPage, pageSize]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // WebSocket Live Streaming connection
  useEffect(() => {
    const cleanupWs = createLogWebSocket((message) => {
      if (message.type === 'log_entry') {
        const newEntry: LogEntry = message.entry;
        // If current dataset matches live stream or user is watching live stream
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
      await selectDataset(name);
      setActiveDataset(name);
      setCurrentPage(1);
      // Reset template filter on dataset change
      setFilters((prev) => ({ ...prev, selectedTemplateId: null, selectedService: null }));
    } catch (err) {
      alert('Error switching dataset: ' + err);
    }
  };

  // Handle file upload
  const handleUploadFile = async (file: File) => {
    const res = await uploadLogFile(file);
    await loadDatasetsList();
    await handleSelectDataset(res.dataset_name);
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
      const res = await runDiagnostics(activeDataset || undefined, keyToUse || undefined);
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
      />
    </div>
  );
};

export default App;
