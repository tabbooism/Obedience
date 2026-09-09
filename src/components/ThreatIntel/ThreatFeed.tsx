import React, { useState, useEffect } from "react";
import { 
  ThreatFeedItem, 
  GraphNode, 
  UserRole 
} from "../../types";
import { apiClient } from "../../utils/apiClient";
import { 
  Flame, 
  Radio, 
  ShieldAlert, 
  Search, 
  Filter, 
  Plus, 
  ExternalLink, 
  Lock, 
  Sparkles, 
  CheckCircle2, 
  Terminal, 
  Globe, 
  AlertTriangle,
  RefreshCw,
  Zap,
  Share2
} from "lucide-react";

interface ThreatFeedProps {
  threats: ThreatFeedItem[];
  onAddThreat: (threat: ThreatFeedItem) => void;
  onAddNodeToGraph: (node: GraphNode) => void;
  userRole: UserRole;
  onAuditLog: (action: string, target: string, justification: string) => void;
  onOpenAICopilotWithPrompt?: (prompt: string) => void;
  searchFilter?: string;
}

export const ThreatFeed: React.FC<ThreatFeedProps> = ({
  threats,
  onAddThreat,
  onAddNodeToGraph,
  userRole,
  onAuditLog,
  onOpenAICopilotWithPrompt,
  searchFilter = "",
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>(searchFilter);
  const [autoStream, setAutoStream] = useState<boolean>(true);
  const [isLoadingLiveFeed, setIsLoadingLiveFeed] = useState<boolean>(false);
  const [showAddCustomModal, setShowAddCustomModal] = useState<boolean>(false);

  useEffect(() => {
    if (searchFilter !== undefined) {
      setSearchQuery(searchFilter);
    }
  }, [searchFilter]);

  // Custom IOC input
  const [customTitle, setCustomTitle] = useState("");
  const [customIoc, setCustomIoc] = useState("");
  const [customType, setCustomType] = useState<"IP" | "Domain" | "Hash" | "CVE" | "Wallet">("IP");
  const [customSeverity, setCustomSeverity] = useState<"critical" | "high" | "medium">("high");
  const [customSource, setCustomSource] = useState("Live Tactical Sensor");
  const [customDescription, setCustomDescription] = useState("");

  // Fetch real live CTI from backend
  const fetchLiveFeeds = async () => {
    setIsLoadingLiveFeed(true);
    try {
      const res = await apiClient.get("/api/live/threat-feed");
      const data = res.data;
      if (data.feeds && Array.isArray(data.feeds)) {
        data.feeds.forEach((feed: ThreatFeedItem) => {
          // Avoid duplicate IDs
          if (!threats.some((t) => t.iocValue === feed.iocValue)) {
            onAddThreat(feed);
          }
        });
      }
    } catch (e) {
      console.error("Live feed fetch error:", e);
    } finally {
      setIsLoadingLiveFeed(false);
    }
  };

  // On mount and streaming interval
  useEffect(() => {
    fetchLiveFeeds();
  }, []);

  useEffect(() => {
    if (!autoStream) return;
    const interval = setInterval(() => {
      fetchLiveFeeds();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoStream]);

  const filteredThreats = threats.filter((t) => {
    if (filterSeverity !== "all" && t.severity !== filterSeverity) return false;
    if (filterSource !== "all" && t.source !== filterSource) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchIoc = t.iocValue.toLowerCase().includes(q);
      const matchDesc = t.description.toLowerCase().includes(q);
      if (!matchTitle && !matchIoc && !matchDesc) return false;
    }
    return true;
  });

  const handleAddIocToGraph = (threat: ThreatFeedItem) => {
    let nodeType: any = "ip_address";
    if (threat.iocType === "Domain") nodeType = "domain";
    if (threat.iocType === "Wallet") nodeType = "crypto_wallet";
    if (threat.iocType === "Email") nodeType = "person";
    if (threat.iocType === "CVE") nodeType = "threat_actor";

    const newNode: GraphNode = {
      id: `node-cti-${Date.now()}`,
      label: threat.iocValue,
      type: nodeType,
      x: 400 + (Math.random() * 160 - 80),
      y: 300 + (Math.random() * 160 - 80),
      riskScore: threat.severity === "critical" ? 95 : threat.severity === "high" ? 78 : 55,
      confidence: 92,
      classification: "Secret",
      tags: ["LIVE_CTI", threat.source.toUpperCase(), threat.iocType],
      attributes: {
        "Discovered Via": threat.source,
        "Threat Title": threat.title,
        "Mitre ATT&CK": threat.mitreTechnique || "T1190",
        "Ingested At": new Date().toISOString(),
      },
      notes: `Imported from live threat feed: ${threat.description}`,
    };

    onAddNodeToGraph(newNode);
    onAuditLog(
      "LIVE_THREAT_IOC_INGESTED_TO_GRAPH",
      `IOC: ${threat.iocValue} (${threat.iocType})`,
      `Target ingested into relationship graph by ${userRole}.`
    );
  };

  const handleQuarantine = (threat: ThreatFeedItem) => {
    onAuditLog(
      "EMERGENCY_IOC_QUARANTINE",
      `Target: ${threat.iocValue}`,
      `Edge perimeter firewall rule auto-dispatched by ${userRole}.`
    );
  };

  const handleCreateCustomIoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customIoc.trim() || !customTitle.trim()) return;

    const newThreat: ThreatFeedItem = {
      id: `threat-custom-${Date.now()}`,
      title: customTitle,
      source: customSource,
      severity: customSeverity,
      timestamp: "Live - Just now",
      description: customDescription || `Operator ingested live indicator of compromise: ${customIoc}`,
      iocValue: customIoc.trim(),
      iocType: customType,
      mitreTechnique: "T1190 - Exploit Public-Facing Application",
      affectedEntities: ["Target Asset", "Network Perimeter"],
      status: "active",
    };

    onAddThreat(newThreat);
    onAuditLog(
      "CUSTOM_IOC_INGESTED",
      `IOC: ${customIoc} (${customType})`,
      "Analyst recorded custom live telemetry indicator."
    );

    setCustomTitle("");
    setCustomIoc("");
    setCustomDescription("");
    setShowAddCustomModal(false);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "high":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "medium":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden p-3 sm:p-5 space-y-3 sm:space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 text-rose-400 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-100 font-mono uppercase tracking-tight">
                CYBER THREAT FEED
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE OPS
              </span>
            </div>
            <p className="text-xs text-slate-400 line-clamp-1 sm:line-clamp-none">
              Real-time CISA KEV alerts, active CVEs, darknet chatter, and C2 telemetry
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search IOC, CVE..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-rose-500 w-full sm:w-44"
            />
          </div>

          {/* Severity Select */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
          >
            <option value="all">Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>

          {/* Manual Poll Button */}
          <button
            onClick={fetchLiveFeeds}
            disabled={isLoadingLiveFeed}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium flex items-center space-x-1 sm:space-x-1.5 border border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLiveFeed ? "animate-spin" : ""}`} />
            <span className="hidden xs:inline">{isLoadingLiveFeed ? "POLLING..." : "FETCH"}</span>
          </button>

          {/* Add Custom IOC */}
          <button
            onClick={() => setShowAddCustomModal(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-semibold flex items-center space-x-1 sm:space-x-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>INGEST IOC</span>
          </button>
        </div>
      </div>

      {/* Threats Stream List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filteredThreats.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800 font-mono space-y-3 p-6 text-center">
            <ShieldAlert className="w-12 h-12 text-slate-600" />
            <div>
              <p className="text-sm font-bold text-slate-300">NO ACTIVE THREAT INDICATORS IN QUEUE</p>
              <p className="text-xs text-slate-500 mt-1">Live CTI feed is ready for telemetry ingestion or manual polling.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchLiveFeeds}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-mono text-cyan-300 border border-cyan-500/30"
              >
                Fetch Live CTI Feed
              </button>
              <button
                onClick={() => setShowAddCustomModal(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-xs font-mono text-white"
              >
                Add Target IOC
              </button>
            </div>
          </div>
        ) : (
          filteredThreats.map((threat) => (
            <div
              key={threat.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all shadow-md space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${getSeverityBadge(threat.severity)}`}>
                      {threat.severity}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">SOURCE: {threat.source}</span>
                    <span className="text-[11px] font-mono text-slate-500">• {threat.timestamp}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 tracking-tight">{threat.title}</h3>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleAddIocToGraph(threat)}
                    className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>INGEST TO GRAPH</span>
                  </button>

                  <button
                    onClick={() => handleQuarantine(threat)}
                    className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>QUARANTINE</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-300 font-sans leading-relaxed">{threat.description}</p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500 uppercase text-[10px]">IOC VALUE:</span>
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-cyan-300 font-bold select-all">
                    {threat.iocValue}
                  </span>
                  <span className="text-[10px] text-slate-400">({threat.iocType})</span>
                </div>

                {threat.mitreTechnique && (
                  <div className="flex items-center space-x-1 text-slate-400">
                    <span className="text-[10px] uppercase text-slate-500">MITRE:</span>
                    <span className="text-amber-400 font-semibold">{threat.mitreTechnique}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Add Custom IOC */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Flame className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-slate-100 font-mono text-xs sm:text-sm uppercase">
                  INGEST LIVE THREAT IOC
                </h3>
              </div>
              <button
                onClick={() => setShowAddCustomModal(false)}
                className="text-slate-400 hover:text-slate-100 text-sm p-1 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomIoc} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Threat Event Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unauthenticated RCE on Edge Gateway"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    IOC Type
                  </label>
                  <select
                    value={customType}
                    onChange={(e: any) => setCustomType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none"
                  >
                    <option value="IP">IP Address</option>
                    <option value="Domain">Domain</option>
                    <option value="CVE">CVE Identifier</option>
                    <option value="Hash">File Hash (SHA-256)</option>
                    <option value="Wallet">Crypto Wallet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Severity
                  </label>
                  <select
                    value={customSeverity}
                    onChange={(e: any) => setCustomSeverity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  IOC Indicator Value
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 194.26.29.11 or CVE-2025-0282"
                  value={customIoc}
                  onChange={(e) => setCustomIoc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Tactical Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Observed activity, beacon frequency, or vulnerability notes..."
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-sans focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold font-mono"
                >
                  Ingest Live Indicator
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
