import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Activity, 
  AlertTriangle, 
  ShieldAlert, 
  Cpu, 
  Zap, 
  Sliders, 
  RefreshCw, 
  BarChart3, 
  Database, 
  Filter, 
  Eye, 
  ArrowUpRight, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Terminal, 
  Download, 
  Play, 
  Network, 
  Lock, 
  Crosshair, 
  FileText, 
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from "lucide-react";
import { 
  GraphNode, 
  GraphEdge, 
  AuditLogEntry, 
  VulnerabilityAsset, 
  ThreatFeedItem, 
  MasterKeyItem,
  DetectedAnomaly, 
  AnomalySuiteConfig, 
  AnomalyAlgorithmType, 
  AnomalySeverity, 
  TelemetryRecord, 
  AnomalyBenchmarkResult,
  UserRole
} from "../../types";
import { apiClient } from "../../utils/apiClient";
import { 
  runComprehensiveAnomalySuite, 
  generateLargeTelemetryDataset, 
  defaultAnomalySuiteConfig 
} from "../../utils/anomalyEngine";

interface AnomalyDetectionDashboardProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  vulnerabilities: VulnerabilityAsset[];
  threats: ThreatFeedItem[];
  masterKeys: MasterKeyItem[];
  auditLogs: AuditLogEntry[];
  userRole: UserRole;
  onAuditLog: (action: string, target: string, justification: string, status?: "Success" | "Blocked" | "Warning" | "Requires Quorum") => void;
  onOpenAICopilotWithPrompt?: (prompt: string) => void;
  onNavigateToGraph?: (highlightNodeId?: string) => void;
  onUpdateNodes?: (nodes: GraphNode[]) => void;
}

export const AnomalyDetectionDashboard: React.FC<AnomalyDetectionDashboardProps> = ({
  nodes,
  edges,
  vulnerabilities,
  threats,
  masterKeys,
  auditLogs,
  userRole,
  onAuditLog,
  onOpenAICopilotWithPrompt,
  onNavigateToGraph,
  onUpdateNodes,
}) => {
  // Configuration State
  const [config, setConfig] = useState<AnomalySuiteConfig>(defaultAnomalySuiteConfig);
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);

  // Active Telemetry & Detection State
  const [telemetryRecords, setTelemetryRecords] = useState<TelemetryRecord[]>([]);
  const [detectedAnomalies, setDetectedAnomalies] = useState<DetectedAnomaly[]>([]);
  const [benchmarkResult, setBenchmarkResult] = useState<AnomalyBenchmarkResult | null>(null);
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);

  // Large Dataset Generator Options
  const [selectedDatasetSize, setSelectedDatasetSize] = useState<number>(2500);
  const [isGeneratingData, setIsGeneratingData] = useState(false);

  // UI Filters
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [activeViewMode, setActiveViewMode] = useState<"incidents" | "telemetry" | "benchmarks">("incidents");

  // Selected Anomaly for Modal / Deep Dive
  const [selectedAnomaly, setSelectedAnomaly] = useState<DetectedAnomaly | null>(null);
  const [escalatedIncidentData, setEscalatedIncidentData] = useState<any | null>(null);
  const [isEscalating, setIsEscalating] = useState(false);
  const [triageActionMessage, setTriageActionMessage] = useState<string | null>(null);

  // Initialize telemetry and run initial analysis
  useEffect(() => {
    const initialTelemetry = generateLargeTelemetryDataset(selectedDatasetSize);
    setTelemetryRecords(initialTelemetry);

    // Initial run
    const result = runComprehensiveAnomalySuite({
      nodes,
      edges,
      vulnerabilities,
      threats,
      masterKeys,
      auditLogs,
      telemetryRecords: initialTelemetry,
      config,
    });

    setDetectedAnomalies(result.anomalies);
    setBenchmarkResult(result.benchmark);
  }, []);

  // Handler to run full detection suite
  const handleExecuteSuite = useCallback(() => {
    setIsRunningAnalysis(true);
    setTriageActionMessage(null);

    // Use micro-task/timeout to allow UI render state transition
    setTimeout(() => {
      const result = runComprehensiveAnomalySuite({
        nodes,
        edges,
        vulnerabilities,
        threats,
        masterKeys,
        auditLogs,
        telemetryRecords,
        config,
      });

      setDetectedAnomalies(result.anomalies);
      setBenchmarkResult(result.benchmark);
      setIsRunningAnalysis(false);

      onAuditLog(
        "ANOMALY_SUITE_EXECUTION",
        "OSINT Anomaly Engine",
        `Executed comprehensive anomaly detection suite across ${result.benchmark.totalRecordsProcessed} entities & telemetry records. Flagged ${result.anomalies.length} deviations (${result.benchmark.criticalIncidentsCount} critical).`,
        "Success"
      );
    }, 50);
  }, [nodes, edges, vulnerabilities, threats, masterKeys, auditLogs, telemetryRecords, config, onAuditLog]);

  // Handler to generate large dataset
  const handleGenerateLargeDataset = async (size: number) => {
    setIsGeneratingData(true);
    setSelectedDatasetSize(size);
    setTriageActionMessage(null);

    try {
      // Fetch or generate client-side
      const response = await apiClient.post("/api/anomaly/generate-large-dataset", {
        count: size,
      });

      if (response.data) {
        const data = response.data;
        setTelemetryRecords(data.records || []);

        const result = runComprehensiveAnomalySuite({
          nodes,
          edges,
          vulnerabilities,
          threats,
          masterKeys,
          auditLogs,
          telemetryRecords: data.records || [],
          config,
        });
        setDetectedAnomalies(result.anomalies);
        setBenchmarkResult(result.benchmark);
      } else {
        // Client-side fallback generator
        const localTelemetry = generateLargeTelemetryDataset(size);
        setTelemetryRecords(localTelemetry);

        const result = runComprehensiveAnomalySuite({
          nodes,
          edges,
          vulnerabilities,
          threats,
          masterKeys,
          auditLogs,
          telemetryRecords: localTelemetry,
          config,
        });
        setDetectedAnomalies(result.anomalies);
        setBenchmarkResult(result.benchmark);
      }

      onAuditLog(
        "LARGE_DATASET_INGESTION",
        "Telemetry Pipeline",
        `Ingested high-volume telemetry stream with ${size} records for stress testing anomaly algorithms.`,
        "Success"
      );
    } catch (e) {
      const localTelemetry = generateLargeTelemetryDataset(size);
      setTelemetryRecords(localTelemetry);
      const result = runComprehensiveAnomalySuite({
        nodes,
        edges,
        vulnerabilities,
        threats,
        masterKeys,
        auditLogs,
        telemetryRecords: localTelemetry,
        config,
      });
      setDetectedAnomalies(result.anomalies);
      setBenchmarkResult(result.benchmark);
    } finally {
      setIsGeneratingData(false);
    }
  };

  // Toggle algorithm on/off
  const toggleAlgorithm = (algo: AnomalyAlgorithmType) => {
    setConfig((prev) => ({
      ...prev,
      enabledAlgorithms: {
        ...prev.enabledAlgorithms,
        [algo]: !prev.enabledAlgorithms[algo],
      },
    }));
  };

  // Escalate anomaly to full security incident via AI / Server
  const handleEscalateIncident = async (anomaly: DetectedAnomaly) => {
    setIsEscalating(true);
    setSelectedAnomaly(anomaly);
    setEscalatedIncidentData(null);

    try {
      const response = await apiClient.post("/api/anomaly/escalate-incident", {
        anomaly,
        contextData: {
          userRole,
          nodesCount: nodes.length,
          edgesCount: edges.length,
          criticalThreats: threats.filter((t) => t.severity === "critical").length,
        },
      });

      if (response.data) {
        const data = response.data;
        setEscalatedIncidentData(data.incident);
      }
    } catch (err) {
      console.warn("Escalate incident request failed, using local model:", err);
    } finally {
      setIsEscalating(false);
    }

    onAuditLog(
      "INCIDENT_ESCALATION",
      anomaly.entityLabel,
      `Escalated anomaly "${anomaly.title}" (Score: ${anomaly.anomalyScore}/100) to full security incident dossier.`,
      "Warning"
    );
  };

  // Quarantine node action
  const handleQuarantineNode = (anomaly: DetectedAnomaly) => {
    if (onUpdateNodes) {
      const updated = nodes.map((n) => {
        if (n.id === anomaly.entityId || n.label === anomaly.entityLabel) {
          return {
            ...n,
            isFlagged: true,
            notes: (n.notes ? n.notes + "\n" : "") + `[QUARANTINED] Flagged by Anomaly Suite (${anomaly.algorithmName}): ${anomaly.title}`,
          };
        }
        return n;
      });
      onUpdateNodes(updated);
    }

    setTriageActionMessage(`Entity "${anomaly.entityLabel}" successfully quarantined and marked in relationship graph.`);
    onAuditLog(
      "ENTITY_QUARANTINE",
      anomaly.entityLabel,
      `Quarantined entity following critical anomaly flag (${anomaly.algorithmName}): ${anomaly.description}`,
      "Success"
    );

    // Update anomaly status
    setDetectedAnomalies((prev) =>
      prev.map((a) => (a.id === anomaly.id ? { ...a, status: "Quarantined" } : a))
    );
  };

  // Export Anomaly Dossier
  const handleExportDossier = () => {
    const reportData = {
      title: "HIGH-STAKES OSINT ANOMALY DETECTION REPORT",
      timestamp: new Date().toISOString(),
      classification: "STRICT // DEFENSE SECURITY AUDIT",
      benchmark: benchmarkResult,
      activeConfig: config,
      flaggedAnomaliesCount: detectedAnomalies.length,
      criticalIncidents: detectedAnomalies.filter((a) => a.severity === "CRITICAL"),
      allAnomalies: detectedAnomalies,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AegisOSINT_Anomaly_Dossier_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    onAuditLog(
      "EXPORT_ANOMALY_DOSSIER",
      "Executive Dossier",
      `Exported comprehensive anomaly analysis dossier with ${detectedAnomalies.length} flagged security deviations.`,
      "Success"
    );
  };

  // Filtered anomalies
  const filteredAnomalies = useMemo(() => {
    return detectedAnomalies.filter((a) => {
      if (selectedSeverity !== "all" && a.severity !== selectedSeverity) return false;
      if (selectedAlgorithm !== "all" && a.algorithm !== selectedAlgorithm) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return (
          a.entityLabel.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.algorithmName.toLowerCase().includes(q) ||
          (a.mitreTechnique && a.mitreTechnique.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [detectedAnomalies, selectedSeverity, selectedAlgorithm, searchFilter]);

  // Algorithm Meta definitions
  const algorithmCards: {
    id: AnomalyAlgorithmType;
    name: string;
    category: string;
    description: string;
    color: string;
    badgeBg: string;
  }[] = [
    {
      id: "isolation_forest",
      name: "Isolation Forest (iForest)",
      category: "High-Dimensional Partitioning",
      description: "Subsamples multi-feature vectors into recursive random split trees; measures path length to isolation.",
      color: "text-cyan-400 border-cyan-500/30",
      badgeBg: "bg-cyan-500/15 text-cyan-300",
    },
    {
      id: "local_outlier_factor",
      name: "Local Outlier Factor (LOF)",
      category: "Density-Based Clustering",
      description: "Computes local reachability densities relative to k-nearest neighbors to isolate sparse covert assets.",
      color: "text-blue-400 border-blue-500/30",
      badgeBg: "bg-blue-500/15 text-blue-300",
    },
    {
      id: "graph_topology",
      name: "Graph Topology & Centrality",
      category: "Network Structural Analysis",
      description: "Identifies abnormal hub nodes, covert choke-point bridges between threats and crown jewels, and OddBall stars.",
      color: "text-purple-400 border-purple-500/30",
      badgeBg: "bg-purple-500/15 text-purple-300",
    },
    {
      id: "robust_zscore_mad",
      name: "Robust MAD & Tukey Fences",
      category: "Distributional Deviation",
      description: "Applies Median Absolute Deviation and Tukey IQR outer fences to flag extreme statistical metrics.",
      color: "text-emerald-400 border-emerald-500/30",
      badgeBg: "bg-emerald-500/15 text-emerald-300",
    },
    {
      id: "temporal_beaconing",
      name: "Temporal Velocity & C2 Beaconing",
      category: "Sequential & Cadence Telemetry",
      description: "Calculates inter-arrival coefficient of variation (CV) to detect automated C2 malware heartbeats.",
      color: "text-rose-400 border-rose-500/30",
      badgeBg: "bg-rose-500/15 text-rose-300",
    },
    {
      id: "vulnerability_correlation",
      name: "Threat & Vulnerability Correlator",
      category: "Compound Threat Analysis",
      description: "Traverses graph links to find unpatched high-CVSS CVEs directly adjacent to live threat actors or KMS keys.",
      color: "text-amber-400 border-amber-500/30",
      badgeBg: "bg-amber-500/15 text-amber-300",
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Tactical Banner */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono text-[10px] font-bold uppercase tracking-wider">
              ALGORITHMIC INTELLIGENCE SUITE
            </span>
            <span className="text-slate-500 text-xs">|</span>
            <span className="font-mono text-xs text-slate-400">
              OPERATIONAL STATUS: <span className="text-emerald-400 font-bold">READY // STREAMING</span>
            </span>
          </div>
          <h1 className="text-lg font-bold text-white font-mono tracking-tight mt-1 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            ADVANCED ANOMALY DETECTION ENGINE
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
            Multi-model algorithmic pipeline executing Isolation Forest, Local Outlier Factor, Graph Centrality, Robust MAD, and C2 Cadence telemetry correlation for high-stakes security analysis.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setShowConfigDrawer(!showConfigDrawer)}
            className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
              showConfigDrawer
                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-200"
                : "bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Algorithm Tuning</span>
          </button>

          <button
            onClick={handleExportDossier}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export SAR Dossier</span>
          </button>

          <button
            onClick={handleExecuteSuite}
            disabled={isRunningAnalysis}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono text-xs font-bold shadow-md flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunningAnalysis ? "animate-spin" : ""}`} />
            <span>{isRunningAnalysis ? "PROCESSING SUITE..." : "RUN FULL SUITE"}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Operational Content */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
          {/* Triage action toast if present */}
          {triageActionMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-emerald-200 font-mono">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{triageActionMessage}</span>
              </div>
              <button
                onClick={() => setTriageActionMessage(null)}
                className="text-emerald-400 hover:text-emerald-200 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] font-mono text-slate-400 uppercase">RECORDS PROCESSED</div>
              <div className="text-xl font-bold font-mono text-white mt-0.5">
                {(benchmarkResult?.totalRecordsProcessed || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-cyan-400 font-mono mt-0.5">
                {benchmarkResult?.throughputPerSec?.toLocaleString() || 0} rec/sec
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] font-mono text-slate-400 uppercase">CRITICAL INCIDENTS</div>
              <div className="text-xl font-bold font-mono text-rose-400 mt-0.5">
                {benchmarkResult?.criticalIncidentsCount || 0}
              </div>
              <div className="text-[10px] text-rose-500 font-mono mt-0.5">Immediate Triage</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] font-mono text-slate-400 uppercase">HIGH DEVIATIONS</div>
              <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                {benchmarkResult?.highSeverityCount || 0}
              </div>
              <div className="text-[10px] text-amber-500 font-mono mt-0.5">Investigating</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] font-mono text-slate-400 uppercase">TOTAL ANOMALIES</div>
              <div className="text-xl font-bold font-mono text-cyan-300 mt-0.5">
                {detectedAnomalies.length}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Multi-Algorithm</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] font-mono text-slate-400 uppercase">LATENCY PROFILE</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {benchmarkResult?.executionTimeMs || 0} ms
              </div>
              <div className="text-[10px] text-emerald-500 font-mono mt-0.5">Real-time compute</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] font-mono text-slate-400 uppercase">ACTIVE ALGORITHMS</div>
              <div className="text-xl font-bold font-mono text-purple-400 mt-0.5">
                {Object.values(config.enabledAlgorithms).filter(Boolean).length} / 6
              </div>
              <div className="text-[10px] text-purple-500 font-mono mt-0.5">Ensemble Active</div>
            </div>
          </div>

          {/* Algorithm Engine Cards & Active Toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400 px-1">
              <span>ALGORITHM ENSEMBLE SUITE ({Object.values(config.enabledAlgorithms).filter(Boolean).length} ACTIVE)</span>
              <span className="text-[10px] text-slate-500">TOGGLE TO ENABLE/DISABLE ENSEMBLE DETECTORS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {algorithmCards.map((algo) => {
                const isEnabled = config.enabledAlgorithms[algo.id];
                const count = benchmarkResult?.algorithmBreakdown?.[algo.id] || 0;

                return (
                  <div
                    key={algo.id}
                    onClick={() => toggleAlgorithm(algo.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isEnabled
                        ? "bg-slate-900/90 border-slate-700 hover:border-cyan-500/40 shadow-sm"
                        : "bg-slate-900/30 border-slate-800/60 opacity-60 hover:opacity-80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${algo.badgeBg}`}>
                          {algo.category}
                        </span>
                        <div className="flex items-center space-x-1.5">
                          {count > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold">
                              {count} flagged
                            </span>
                          )}
                          <div
                            className={`w-3 h-3 rounded-full border ${
                              isEnabled ? "bg-emerald-400 border-emerald-300" : "bg-slate-700 border-slate-600"
                            }`}
                          />
                        </div>
                      </div>

                      <h2 className="text-xs font-bold text-white font-mono mt-2 flex items-center gap-1.5">
                        <Cpu className={`w-3.5 h-3.5 ${isEnabled ? "text-cyan-400" : "text-slate-500"}`} />
                        {algo.name}
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {algo.description}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                      <span className={isEnabled ? "text-emerald-400" : "text-slate-500"}>
                        {isEnabled ? "STATUS: ACTIVE" : "STATUS: DISABLED"}
                      </span>
                      <span className="text-slate-500 hover:text-cyan-300">Click to toggle</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Large Dataset Stream & Benchmark Stress-Testing Control */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-xs font-bold font-mono text-white uppercase">
                    HIGH-VOLUME DATASET STRESS PIPELINE
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Test algorithmic scalability across synthetic NetFlow, proxy sessions, and authentication events with seeded stealth anomalies.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-end sm:self-center">
                <span className="text-[11px] font-mono text-slate-400">Batch Size:</span>
                {[500, 2500, 10000, 25000].map((size) => (
                  <button
                    key={size}
                    onClick={() => handleGenerateLargeDataset(size)}
                    disabled={isGeneratingData}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                      selectedDatasetSize === size
                        ? "bg-cyan-500 text-slate-950"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                    }`}
                  >
                    {size >= 1000 ? `${size / 1000}k` : size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* View Mode Tabs & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* View Mode Select */}
            <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveViewMode("incidents")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  activeViewMode === "incidents"
                    ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Flagged Incidents ({filteredAnomalies.length})</span>
              </button>

              <button
                onClick={() => setActiveViewMode("telemetry")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  activeViewMode === "telemetry"
                    ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Telemetry Ingestion ({telemetryRecords.length})</span>
              </button>

              <button
                onClick={() => setActiveViewMode("benchmarks")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  activeViewMode === "benchmarks"
                    ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Benchmark Analytics</span>
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter entities, MITRE, CVE..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-44 sm:w-56"
                />
              </div>

              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
              >
                <option value="all">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              <select
                value={selectedAlgorithm}
                onChange={(e) => setSelectedAlgorithm(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
              >
                <option value="all">All Algorithms</option>
                <option value="isolation_forest">Isolation Forest</option>
                <option value="local_outlier_factor">LOF Density</option>
                <option value="graph_topology">Graph Topology</option>
                <option value="robust_zscore_mad">Robust MAD</option>
                <option value="temporal_beaconing">C2 Beaconing</option>
                <option value="vulnerability_correlation">Threat & Vuln</option>
              </select>
            </div>
          </div>

          {/* VIEW MODE 1: FLAGGED INCIDENTS GRID */}
          {activeViewMode === "incidents" && (
            <div className="space-y-3">
              {filteredAnomalies.length === 0 ? (
                <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <h3 className="text-sm font-bold font-mono text-slate-200">NO ACTIVE ANOMALIES MATCH CRITERIA</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    The algorithm ensemble has evaluated the target dataset and found no deviations exceeding the sensitivity threshold.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filteredAnomalies.map((anomaly) => {
                    const isCritical = anomaly.severity === "CRITICAL";
                    const isHigh = anomaly.severity === "HIGH";

                    return (
                      <div
                        key={anomaly.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                          isCritical
                            ? "bg-rose-950/20 border-rose-500/40 hover:border-rose-500"
                            : isHigh
                            ? "bg-amber-950/20 border-amber-500/40 hover:border-amber-500"
                            : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div>
                          {/* Header row */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center space-x-2 truncate">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                  isCritical
                                    ? "bg-rose-500 text-slate-950"
                                    : isHigh
                                    ? "bg-amber-500 text-slate-950"
                                    : "bg-blue-500 text-slate-950"
                                }`}
                              >
                                {anomaly.severity}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-200 truncate">
                                {anomaly.entityLabel}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 uppercase">
                                ({anomaly.entityType})
                              </span>
                            </div>

                            <div className="flex items-center space-x-1 shrink-0">
                              <span className="text-xs font-mono font-bold text-cyan-400">
                                {anomaly.anomalyScore}/100
                              </span>
                            </div>
                          </div>

                          {/* Title */}
                          <h4 className="text-xs font-bold font-mono text-white mt-2">
                            {anomaly.title}
                          </h4>

                          {/* Description */}
                          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                            {anomaly.description}
                          </p>

                          {/* Mathematical Basis Box */}
                          <div className="mt-2.5 p-2 bg-slate-950/80 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400 space-y-1">
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="font-semibold text-cyan-300 flex items-center gap-1">
                                <Cpu className="w-3 h-3 text-cyan-400" />
                                {anomaly.algorithmName}
                              </span>
                              {anomaly.mitreTechnique && (
                                <span className="text-amber-400 font-bold">
                                  {anomaly.mitreTechnique}
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400 text-[10px]">
                              {anomaly.mathematicalBasis}
                            </p>

                            {/* Deviating features tags */}
                            {anomaly.deviatingFeatures?.length > 0 && (
                              <div className="pt-1 flex flex-wrap gap-1">
                                {anomaly.deviatingFeatures.map((feat, fIdx) => (
                                  <span
                                    key={fIdx}
                                    className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] border border-slate-700"
                                  >
                                    {feat.feature}: <strong className="text-white">{feat.observed}</strong> (norm: {feat.baseline}
                                    {feat.deviationZ !== undefined ? `, z=${feat.deviationZ}σ` : ""})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap text-[11px] font-mono">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEscalateIncident(anomaly)}
                              className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-semibold flex items-center space-x-1 cursor-pointer"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Escalate Incident</span>
                            </button>

                            <button
                              onClick={() => handleQuarantineNode(anomaly)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center space-x-1 cursor-pointer"
                            >
                              <Lock className="w-3 h-3 text-amber-400" />
                              <span>Quarantine</span>
                            </button>
                          </div>

                          <div className="flex items-center space-x-2">
                            {onNavigateToGraph && (
                              <button
                                onClick={() => onNavigateToGraph(anomaly.entityId)}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 flex items-center space-x-1 cursor-pointer"
                              >
                                <Network className="w-3 h-3" />
                                <span>View on Graph</span>
                              </button>
                            )}

                            {onOpenAICopilotWithPrompt && (
                              <button
                                onClick={() =>
                                  onOpenAICopilotWithPrompt(
                                    `Analyze flagged anomaly for entity "${anomaly.entityLabel}": ${anomaly.title}. Mathematical basis: ${anomaly.mathematicalBasis}. Recommended mitigation action: ${anomaly.recommendedAction}.`
                                  )
                                }
                                className="px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 flex items-center space-x-1 cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>AI Triage</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: TELEMETRY STREAM TABLE */}
          {activeViewMode === "telemetry" && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
                <span>INGESTED NETWORK TELEMETRY RECORDS ({telemetryRecords.length.toLocaleString()})</span>
                <span className="text-slate-500">Live NetFlow & Authorization Ledger</span>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">TIMESTAMP</th>
                      <th className="p-2.5">SOURCE IP</th>
                      <th className="p-2.5">DEST IP : PORT</th>
                      <th className="p-2.5">PROTOCOL</th>
                      <th className="p-2.5">BYTES</th>
                      <th className="p-2.5">DURATION</th>
                      <th className="p-2.5">ACTION</th>
                      <th className="p-2.5">STATUS / FLAGS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {telemetryRecords.slice(0, 80).map((record) => {
                      const isGroundTruth = record.isGroundTruthAnomaly;
                      return (
                        <tr
                          key={record.id}
                          className={`hover:bg-slate-800/40 ${isGroundTruth ? "bg-rose-950/20" : ""}`}
                        >
                          <td className="p-2.5 text-slate-400">
                            {record.timestamp.slice(11, 19)}
                          </td>
                          <td className="p-2.5 font-bold text-white">
                            {record.sourceIp}
                          </td>
                          <td className="p-2.5 text-slate-300">
                            {record.destIp}:{record.destPort}
                          </td>
                          <td className="p-2.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px]">
                              {record.protocol}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono">
                            {record.bytesTransferred > 1000000
                              ? `${(record.bytesTransferred / 1000000).toFixed(1)} MB`
                              : `${(record.bytesTransferred / 1000).toFixed(1)} KB`}
                          </td>
                          <td className="p-2.5 text-slate-400">
                            {record.durationMs} ms
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                record.action === "ALLOW"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-rose-500/20 text-rose-300"
                              }`}
                            >
                              {record.action}
                            </span>
                          </td>
                          <td className="p-2.5">
                            {isGroundTruth ? (
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-bold">
                                {record.anomalyFlags?.[0] || "INJECTED ANOMALY"}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">Normal Baseline</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-2 bg-slate-950 border-t border-slate-800 text-[10px] font-mono text-slate-500 text-center">
                Showing first 80 of {telemetryRecords.length.toLocaleString()} telemetry records. All records processed by backend detection suite.
              </div>
            </div>
          )}

          {/* VIEW MODE 3: BENCHMARK ANALYTICS */}
          {activeViewMode === "benchmarks" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Algorithm Breakdown Chart */}
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <h3 className="text-xs font-bold font-mono text-white uppercase mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    Algorithm Detection Contribution
                  </h3>

                  <div className="space-y-3">
                    {algorithmCards.map((algo) => {
                      const count = benchmarkResult?.algorithmBreakdown?.[algo.id] || 0;
                      const total = benchmarkResult?.totalAnomaliesDetected || 1;
                      const percent = Math.round((count / total) * 100);

                      return (
                        <div key={algo.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-300">{algo.name}</span>
                            <span className="text-cyan-300 font-bold">{count} flags ({percent}%)</span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Scalability & Performance Profile */}
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <h3 className="text-xs font-bold font-mono text-white uppercase mb-3 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    Engine Performance & Complexity
                  </h3>

                  <div className="space-y-2.5 text-xs font-mono">
                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">Throughput:</span>
                      <strong className="text-emerald-400">
                        {benchmarkResult?.throughputPerSec?.toLocaleString()} records/sec
                      </strong>
                    </div>

                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">Total Run Time:</span>
                      <strong className="text-white">
                        {benchmarkResult?.executionTimeMs} ms
                      </strong>
                    </div>

                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">Isolation Forest Subsamples:</span>
                      <strong className="text-cyan-400">
                        {config.isolationTreesCount} trees × {config.subsampleSize} samples
                      </strong>
                    </div>

                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">LOF k-Neighbors Distance:</span>
                      <strong className="text-blue-400">
                        k = {config.lofKNeighbors}
                      </strong>
                    </div>

                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">Statistical Significance Cutoff:</span>
                      <strong className="text-purple-400">
                        |M_i| &ge; {config.zScoreThreshold}&sigma; (MAD)
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Drawer: Algorithm Parameter Tuning Drawer */}
        {showConfigDrawer && (
          <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col justify-between shrink-0 p-4 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold font-mono text-white uppercase">
                    ALGORITHM PARAMETERS
                  </h3>
                </div>
                <button
                  onClick={() => setShowConfigDrawer(false)}
                  className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Contamination Rate Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">Contamination Rate (&nu;)</span>
                  <span className="text-cyan-400 font-bold">{Math.round(config.contaminationRate * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="35"
                  value={Math.round(config.contaminationRate * 100)}
                  onChange={(e) =>
                    setConfig({ ...config, contaminationRate: Number(e.target.value) / 100 })
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 font-sans">
                  Expected proportion of outliers in feature space. Controls cutoff sensitivity.
                </p>
              </div>

              {/* iForest Trees */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">iForest Tree Count</span>
                  <span className="text-cyan-400 font-bold">{config.isolationTreesCount}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="150"
                  value={config.isolationTreesCount}
                  onChange={(e) =>
                    setConfig({ ...config, isolationTreesCount: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* LOF k Neighbors */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">LOF k-Neighbors</span>
                  <span className="text-cyan-400 font-bold">{config.lofKNeighbors}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={config.lofKNeighbors}
                  onChange={(e) =>
                    setConfig({ ...config, lofKNeighbors: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 font-sans">
                  Number of surrounding neighbors used to calculate local reachability density.
                </p>
              </div>

              {/* Robust Z-Score / MAD Threshold */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">MAD Z-Score Cutoff (&sigma;)</span>
                  <span className="text-cyan-400 font-bold">{config.zScoreThreshold.toFixed(1)}&sigma;</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="50"
                  value={Math.round(config.zScoreThreshold * 10)}
                  onChange={(e) =>
                    setConfig({ ...config, zScoreThreshold: Number(e.target.value) / 10 })
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 font-sans">
                  Modified Z-Score deviation threshold computed via Median Absolute Deviation.
                </p>
              </div>

              {/* Beaconing Jitter Max (CV) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">C2 Beaconing Jitter Max (CV)</span>
                  <span className="text-rose-400 font-bold">{config.beaconingJitterMax.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="35"
                  value={Math.round(config.beaconingJitterMax * 100)}
                  onChange={(e) =>
                    setConfig({ ...config, beaconingJitterMax: Number(e.target.value) / 100 })
                  }
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 font-sans">
                  Maximum coefficient of variation for inter-arrival timing before robotic C2 flag.
                </p>
              </div>
            </div>

            {/* Apply & Reset Buttons */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <button
                onClick={handleExecuteSuite}
                className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-colors cursor-pointer"
              >
                APPLY & RE-RUN SUITE
              </button>

              <button
                onClick={() => setConfig(defaultAnomalySuiteConfig)}
                className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-semibold transition-colors cursor-pointer"
              >
                RESET DEFAULTS
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Escalated Incident Modal */}
      {selectedAnomaly && (escalatedIncidentData || isEscalating) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold font-mono text-white uppercase">
                  HIGH-STAKES SECURITY INCIDENT DOSSIER
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedAnomaly(null);
                  setEscalatedIncidentData(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {isEscalating ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                <h4 className="text-xs font-bold font-mono text-slate-300">
                  SYNTHESIZING FORENSIC INCIDENT BRIEFING...
                </h4>
                <p className="text-[11px] text-slate-500">
                  Cross-referencing MITRE ATT&CK techniques, network graph links, and containment playbooks.
                </p>
              </div>
            ) : (
              escalatedIncidentData && (
                <div className="space-y-4 font-mono text-xs">
                  <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-rose-400 uppercase">
                        {escalatedIncidentData.incidentId}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-500 text-slate-950 text-[10px] font-bold uppercase">
                        {escalatedIncidentData.severity}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white">
                      {escalatedIncidentData.title}
                    </h4>
                    <p className="text-slate-300 text-[11px] font-sans">
                      {escalatedIncidentData.executiveBriefing}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="text-slate-400 text-[10px] font-bold uppercase">MITRE ATT&CK MAPPINGS:</div>
                    <div className="flex flex-wrap gap-1">
                      {escalatedIncidentData.mitreAttAndCk?.map((tech: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 text-[10px]">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-slate-400 text-[10px] font-bold uppercase">IMMEDIATE CONTAINMENT PLAYBOOK:</div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                      {escalatedIncidentData.immediateContainmentPlaybook?.map((step: string, i: number) => (
                        <div key={i} className="flex items-start space-x-2 text-slate-300 text-[11px]">
                          <span className="text-cyan-400 font-bold">&bull;</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-slate-400 text-[10px] font-bold uppercase">ARCHITECTURAL DEFENSE HARDENING:</div>
                    <p className="text-slate-400 text-[11px] p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-sans">
                      {escalatedIncidentData.defensePostureHardening}
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      onClick={() => handleQuarantineNode(selectedAnomaly)}
                      className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Execute Quarantine Now</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedAnomaly(null);
                        setEscalatedIncidentData(null);
                      }}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Close Dossier
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
