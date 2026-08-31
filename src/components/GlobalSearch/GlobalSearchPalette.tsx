import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  GraphNode, 
  ThreatFeedItem, 
  BackgroundRecord, 
  PersonProfile, 
  MasterKeyItem, 
  AuditLogEntry, 
  ActiveTab,
  UserRole
} from "../../types";
import { 
  searchCrossModuleData, 
  SearchCategory, 
  SearchResultItem 
} from "../../utils/globalSearch";
import { 
  Search, 
  X, 
  Network, 
  Flame, 
  Scale, 
  Users, 
  Key, 
  FileCheck, 
  ArrowRight, 
  Sparkles, 
  Plus, 
  CornerDownLeft, 
  SlidersHorizontal,
  Tag,
  ShieldAlert,
  Terminal,
  Clock,
  ExternalLink
} from "lucide-react";

interface GlobalSearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  nodes: GraphNode[];
  threats: ThreatFeedItem[];
  backgroundRecords: BackgroundRecord[];
  profiles: PersonProfile[];
  masterKeys: MasterKeyItem[];
  auditLogs: AuditLogEntry[];
  onNavigateToModule: (module: ActiveTab, targetFilter?: string, targetId?: string) => void;
  onAddNodeToGraph?: (node: GraphNode) => void;
  onOpenAICopilotWithPrompt?: (prompt: string) => void;
  userRole: UserRole;
}

export const GlobalSearchPalette: React.FC<GlobalSearchPaletteProps> = ({
  isOpen,
  onClose,
  query,
  onQueryChange,
  nodes,
  threats,
  backgroundRecords,
  profiles,
  masterKeys,
  auditLogs,
  onNavigateToModule,
  onAddNodeToGraph,
  onOpenAICopilotWithPrompt,
  userRole,
}) => {
  const [activeCategory, setActiveCategory] = useState<SearchCategory>("all");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Execute Cross-Module Index Search
  const { items, stats } = useMemo(() => {
    return searchCrossModuleData(
      query,
      {
        nodes,
        threats,
        backgroundRecords,
        profiles,
        masterKeys,
        auditLogs,
      },
      activeCategory
    );
  }, [query, nodes, threats, backgroundRecords, profiles, masterKeys, auditLogs, activeCategory]);

  // Reset selected index when query or category changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter" && items[selectedIndex]) {
      e.preventDefault();
      handleSelectResult(items[selectedIndex]);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && items.length > 0) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, items.length]);

  const handleSelectResult = (item: SearchResultItem) => {
    onNavigateToModule(item.module, item.targetFilter, item.targetId);
    onClose();
  };

  const handleQuickIngest = (e: React.MouseEvent, item: SearchResultItem) => {
    e.stopPropagation();
    if (!onAddNodeToGraph) return;

    if (item.category === "threats" && item.rawItem) {
      const t = item.rawItem as ThreatFeedItem;
      const newNode: GraphNode = {
        id: `node-threat-${Date.now()}`,
        label: t.iocValue || t.title,
        type: t.iocType === "Domain" ? "domain" : t.iocType === "IP" ? "ip_address" : "threat_actor",
        x: 400 + Math.random() * 80 - 40,
        y: 300 + Math.random() * 80 - 40,
        riskScore: t.severity === "critical" ? 95 : t.severity === "high" ? 80 : 50,
        confidence: 90,
        classification: "Secret",
        tags: ["THREAT_FEED_INGEST", t.severity.toUpperCase()],
        attributes: {
          "Source": t.source,
          "IoC": t.iocValue,
          "MITRE": t.mitreTechnique || "N/A",
        },
        notes: t.description,
      };
      onAddNodeToGraph(newNode);
      onNavigateToModule("graph", newNode.label, newNode.id);
      onClose();
    } else if (item.category === "people" && item.rawItem) {
      const p = item.rawItem as PersonProfile;
      const newNode: GraphNode = {
        id: `node-person-${Date.now()}`,
        label: p.fullName,
        type: "person",
        x: 400 + Math.random() * 80 - 40,
        y: 300 + Math.random() * 80 - 40,
        riskScore: p.riskScore,
        confidence: 95,
        classification: p.clearanceLevel as any,
        tags: ["PERSONNEL_INGEST", p.organization],
        attributes: {
          "Badge": p.badgeId,
          "Org": p.organization,
          "Role": p.roleTitle,
        },
        notes: p.bio,
      };
      onAddNodeToGraph(newNode);
      onNavigateToModule("graph", newNode.label, newNode.id);
      onClose();
    } else if (item.category === "background" && item.rawItem) {
      const r = item.rawItem as BackgroundRecord;
      const newNode: GraphNode = {
        id: `node-bg-${Date.now()}`,
        label: `${r.personName} (${r.offense.slice(0, 18)})`,
        type: "person",
        x: 400 + Math.random() * 80 - 40,
        y: 300 + Math.random() * 80 - 40,
        riskScore: r.severityScore,
        confidence: 92,
        classification: "Confidential",
        tags: ["BACKGROUND_INGEST", r.category],
        attributes: {
          "Docket": r.docketNumber,
          "Jurisdiction": r.jurisdiction,
          "Registry": r.registrySource,
        },
        notes: r.caseSummary,
      };
      onAddNodeToGraph(newNode);
      onNavigateToModule("graph", newNode.label, newNode.id);
      onClose();
    } else if (item.category === "masterkeys" && item.rawItem) {
      const k = item.rawItem as MasterKeyItem;
      const newNode: GraphNode = {
        id: `node-key-${Date.now()}`,
        label: k.keyName,
        type: "digital_key",
        x: 400 + Math.random() * 80 - 40,
        y: 300 + Math.random() * 80 - 40,
        riskScore: k.anomalyDetected ? 90 : 30,
        confidence: 99,
        classification: "Top Secret/SCI",
        tags: ["MASTER_KEY_INGEST", k.currentStatus],
        attributes: {
          "Zone": k.securityZone || "N/A",
          "Location": k.facilityLocation || "N/A",
          "Anomaly": k.anomalyDetected ? "YES" : "NO",
        },
      };
      onAddNodeToGraph(newNode);
      onNavigateToModule("graph", newNode.label, newNode.id);
      onClose();
    }
  };

  const handleAiPivot = (e: React.MouseEvent, item: SearchResultItem) => {
    e.stopPropagation();
    if (onOpenAICopilotWithPrompt) {
      onOpenAICopilotWithPrompt(
        `Perform an in-depth cross-module intelligence audit on target "${item.title}" (${item.moduleLabel}). Cross-reference known threat indicators, background legal records, personnel access, and graph topology.`
      );
      onClose();
    }
  };

  const getModuleIcon = (iconType: string) => {
    switch (iconType) {
      case "node":
        return <Network className="w-4 h-4 text-cyan-400" />;
      case "threat":
        return <Flame className="w-4 h-4 text-rose-400" />;
      case "background":
        return <Scale className="w-4 h-4 text-indigo-400" />;
      case "person":
        return <Users className="w-4 h-4 text-emerald-400" />;
      case "key":
        return <Key className="w-4 h-4 text-amber-400" />;
      case "audit":
        return <FileCheck className="w-4 h-4 text-slate-400" />;
      default:
        return <Search className="w-4 h-4 text-cyan-400" />;
    }
  };

  if (!isOpen) return null;

  const categories: { id: SearchCategory; label: string; count: number }[] = [
    { id: "all", label: "All Modules", count: stats.total },
    { id: "nodes", label: "Graph Entities", count: stats.nodes },
    { id: "threats", label: "Threat Feeds", count: stats.threats },
    { id: "background", label: "Background Checks", count: stats.background },
    { id: "people", label: "Personnel", count: stats.people },
    { id: "masterkeys", label: "Master Keys", count: stats.masterkeys },
    { id: "audit", label: "Audit Ledger", count: stats.audit },
  ];

  const quickPresets = [
    "APT29",
    "198.51.100.22",
    "Suspended",
    "SCIF Access",
    "INTERPOL",
    "OFAC",
    "C2 Beacon",
    "Root KMS",
  ];

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 animate-in fade-in duration-150"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div 
        className="w-full max-w-3xl bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/50 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Search className="w-4 h-4 text-cyan-400" />
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search across all modules: Entities, IPs, CVEs, Dockets, Master Keys, Names..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="flex-1 bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-500 font-mono focus:outline-none"
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Clear Search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700 rounded shadow-sm">
            ESC
          </kbd>
        </div>

        {/* Quick Module Filter Pills */}
        <div className="px-3 sm:px-4 py-2 bg-slate-900/90 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none text-xs font-mono">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                activeCategory === cat.id
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm shadow-cyan-950/30"
                  : "bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent"
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeCategory === cat.id 
                  ? "bg-cyan-500/30 text-cyan-200" 
                  : "bg-slate-700 text-slate-300"
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Query Presets Banner (when query is short or empty) */}
        {query.trim().length === 0 && (
          <div className="px-3.5 sm:px-4 py-2 bg-slate-950/50 border-b border-slate-800/50 flex items-center gap-2 overflow-x-auto text-[11px] font-mono text-slate-400">
            <span className="text-slate-500 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" /> Presets:
            </span>
            {quickPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => onQueryChange(preset)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-colors shrink-0 border border-slate-700/60"
              >
                {preset}
              </button>
            ))}
          </div>
        )}

        {/* Search Results List */}
        <div 
          ref={listRef} 
          className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 divide-y divide-slate-800/30 max-h-[55vh]"
        >
          {items.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-5 h-5 text-slate-500" />
              </div>
              <h4 className="text-sm font-bold text-slate-300 font-mono">
                NO CROSS-MODULE MATCHES FOUND
              </h4>
              <p className="text-xs text-slate-500 font-sans max-w-sm mx-auto">
                No entities, threat feeds, background records, or keys matched <span className="text-cyan-400 font-mono">"{query}"</span>. Try adjusting your search query or selecting "All Modules".
              </p>
            </div>
          ) : (
            items.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={`${item.id}-${index}`}
                  onClick={() => handleSelectResult(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group ${
                    isSelected
                      ? "bg-slate-800/90 border-cyan-500/50 shadow-md shadow-cyan-950/30"
                      : "bg-slate-900/60 border-slate-800/70 hover:bg-slate-800/50 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg shrink-0 mt-0.5 border ${
                      item.category === "threats" 
                        ? "bg-rose-500/10 border-rose-500/30" 
                        : item.category === "nodes" 
                        ? "bg-cyan-500/10 border-cyan-500/30" 
                        : item.category === "background" 
                        ? "bg-indigo-500/10 border-indigo-500/30" 
                        : item.category === "people" 
                        ? "bg-emerald-500/10 border-emerald-500/30" 
                        : item.category === "masterkeys"
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-slate-800 border-slate-700"
                    }`}>
                      {getModuleIcon(item.iconType)}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors truncate">
                          {item.title}
                        </span>

                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${item.badgeColor}`}>
                          {item.badge}
                        </span>

                        <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800">
                          {item.moduleLabel}
                        </span>

                        {item.riskScore !== undefined && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                            item.riskScore >= 80 
                              ? "text-rose-400 bg-rose-950/40 border border-rose-800/50" 
                              : item.riskScore >= 50 
                              ? "text-amber-400 bg-amber-950/40 border border-amber-800/50" 
                              : "text-emerald-400 bg-emerald-950/40 border border-emerald-800/50"
                          }`}>
                            RISK {item.riskScore}/100
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 font-mono truncate">
                        {item.subtitle}
                      </p>

                      {item.matchedFields && item.matchedFields.length > 0 && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap pt-0.5">
                          {item.matchedFields.map((mf, i) => (
                            <span key={i} className="inline-flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 font-mono text-[10px]">
                              <Tag className="w-2.5 h-2.5 text-cyan-400" />
                              <span className="text-slate-500">{mf.field}:</span>
                              <span className="text-slate-300 font-semibold">{mf.snippet}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions right side */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {/* Add to Graph Action for non-node items */}
                    {item.category !== "nodes" && onAddNodeToGraph && (
                      <button
                        onClick={(e) => handleQuickIngest(e, item)}
                        className="px-2 py-1 bg-slate-800 hover:bg-cyan-900/50 hover:text-cyan-300 text-slate-300 rounded text-[10px] sm:text-[11px] font-mono font-medium flex items-center gap-1 border border-slate-700 transition-colors"
                        title="Ingest entity directly into Graph Canvas"
                      >
                        <Plus className="w-3 h-3 text-cyan-400" />
                        <span className="hidden md:inline">Ingest</span> Graph
                      </button>
                    )}

                    {/* AI Copilot Pivot */}
                    {onOpenAICopilotWithPrompt && (
                      <button
                        onClick={(e) => handleAiPivot(e, item)}
                        className="px-2 py-1 bg-gradient-to-r from-cyan-900/40 to-blue-900/40 hover:from-cyan-800/60 hover:to-blue-800/60 text-cyan-300 rounded text-[10px] sm:text-[11px] font-mono font-medium flex items-center gap-1 border border-cyan-500/30 transition-colors"
                        title="Investigate with AI Copilot"
                      >
                        <Sparkles className="w-3 h-3 text-cyan-300" />
                        <span className="hidden md:inline">AI</span> Audit
                      </button>
                    )}

                    {/* Go to View */}
                    <button
                      onClick={() => handleSelectResult(item)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isSelected 
                          ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm" 
                          : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
                      }`}
                      title={`Jump to ${item.moduleLabel}`}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-3 sm:px-4 py-2 bg-slate-950 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>
              MATCHES: <strong className="text-slate-200">{items.length}</strong>
            </span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="hidden sm:inline text-slate-500">
              Active Role: <strong className="text-cyan-400">{userRole}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono flex items-center gap-0.5">
                <CornerDownLeft className="w-2.5 h-2.5" />
                ENTER
              </kbd>
              <span>to open</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
