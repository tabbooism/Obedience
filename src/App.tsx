import React, { useState, useEffect } from "react";
import { 
  GraphNode, 
  GraphEdge, 
  ThreatFeedItem, 
  PersonProfile, 
  BackgroundRecord, 
  MasterKeyItem, 
  AuditLogEntry, 
  VulnerabilityAsset, 
  UserRole 
} from "./types";
import { 
  initialGraphNodes, 
  initialGraphEdges, 
  initialThreatFeeds, 
  initialPeopleProfiles, 
  initialBackgroundRecords, 
  initialMasterKeys, 
  initialAuditLogs, 
  initialVulnerabilities 
} from "./data/initialData";
import { 
  loadLiveWorkspace, 
  saveLiveWorkspace, 
  clearLiveWorkspace, 
  exportWorkspaceJson 
} from "./utils/liveStorage";
import { calculateSha256 } from "./utils/cryptoVault";
import { Header } from "./components/Header";
import { Sidebar, ActiveTab } from "./components/Sidebar";
import { RelationshipGraph } from "./components/GraphCanvas/RelationshipGraph";
import { RedTeamDashboard } from "./components/RedTeam/RedTeamDashboard";
import { PayloadStudio } from "./components/RedTeam/PayloadStudio";
import { ThreatFeed } from "./components/ThreatIntel/ThreatFeed";
import { PeopleLookupView } from "./components/PeopleLookup/PeopleLookupView";
import { BackgroundCheckView } from "./components/BackgroundCheck/BackgroundCheckView";
import { MasterKeyManager } from "./components/MasterKeys/MasterKeyManager";
import { AuditLogsView } from "./components/AuditLogs/AuditLogsView";
import { ReportGenerator } from "./components/AutomatedReports/ReportGenerator";
import { ApiIntegrationsView } from "./components/ApiAutomation/ApiIntegrationsView";
import { AICopilotModal } from "./components/AICopilot/AICopilotModal";
import { GlobalSearchPalette } from "./components/GlobalSearch/GlobalSearchPalette";
import { Download, Trash2, Radio, CheckCircle2, Network, Crosshair, Terminal, Flame, Layers } from "lucide-react";

export const App: React.FC = () => {
  // Global State
  const [activeTab, setActiveTab] = useState<ActiveTab>("graph");
  const [userRole, setUserRole] = useState<UserRole>("Lead Investigator");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState<boolean>(false);
  const [targetProfileId, setTargetProfileId] = useState<string | undefined>(undefined);

  // Initialize from persisted workspace or live clean state
  const savedState = loadLiveWorkspace();

  const [nodes, setNodes] = useState<GraphNode[]>(savedState?.nodes || initialGraphNodes);
  const [edges, setEdges] = useState<GraphEdge[]>(savedState?.edges || initialGraphEdges);
  const [threats, setThreats] = useState<ThreatFeedItem[]>(savedState?.threats || initialThreatFeeds);
  const [profiles, setProfiles] = useState<PersonProfile[]>(savedState?.profiles || initialPeopleProfiles);
  const [backgroundRecords, setBackgroundRecords] = useState<BackgroundRecord[]>(savedState?.backgroundRecords || initialBackgroundRecords);
  const [masterKeys, setMasterKeys] = useState<MasterKeyItem[]>(savedState?.masterKeys || initialMasterKeys);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(savedState?.auditLogs || initialAuditLogs);
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityAsset[]>(savedState?.vulnerabilities || initialVulnerabilities);

  // AI Copilot state
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [copilotInitialPrompt, setCopilotInitialPrompt] = useState<string>("");

  // Target Key focus state for Master Keys navigation
  const [focusedKeyId, setFocusedKeyId] = useState<string | undefined>(undefined);

  // Global Keyboard Shortcut listener for Global Search (Cmd+K / Ctrl+K / /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsGlobalSearchOpen((prev) => !prev);
      } else if (
        e.key === "/" &&
        !isGlobalSearchOpen &&
        !(
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement ||
          document.activeElement?.getAttribute("contenteditable") === "true"
        )
      ) {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGlobalSearchOpen]);

  // Save workspace changes automatically
  useEffect(() => {
    saveLiveWorkspace({
      nodes,
      edges,
      threats,
      profiles,
      backgroundRecords,
      masterKeys,
      auditLogs,
      vulnerabilities,
      lastUpdated: new Date().toISOString(),
    });
  }, [nodes, edges, threats, profiles, backgroundRecords, masterKeys, auditLogs, vulnerabilities]);

  // Real SHA-256 Audit Log generator with unique non-colliding IDs
  const appendAuditLog = async (action: string, target: string, justification: string) => {
    const timestamp = Date.now();
    const entropy = Math.random().toString(36).substring(2, 9);
    const rawString = `${timestamp}-${entropy}-${action}-${target}-${justification}-${userRole}`;
    const realSha256 = await calculateSha256(rawString);

    const newLog: AuditLogEntry = {
      id: `log-${timestamp}-${entropy}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      actor: `${userRole} (Active Session)`,
      user: `${userRole} (Active Session)`,
      actorRole: userRole,
      userRole,
      action,
      target,
      targetEntity: target,
      category: "Graph Modification",
      status: "Success",
      justification,
      sha256Proof: realSha256,
      hash: realSha256,
      integrityVerified: true,
    };

    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Open AI Copilot with prompt helper
  const handleOpenAICopilotWithPrompt = (prompt: string) => {
    setCopilotInitialPrompt(prompt);
    setIsCopilotOpen(true);
  };

  // Cross-Module Navigation from Global Search or Inter-Module Links
  const handleNavigateFromSearch = (module: ActiveTab, targetFilter?: string, targetId?: string) => {
    if (targetFilter !== undefined) {
      setSearchFilter(targetFilter);
    }
    if (module === "people" && targetId) {
      setTargetProfileId(targetId);
    }
    if (module === "masterkeys" && targetId) {
      setFocusedKeyId(targetId);
    }
    setActiveTab(module);
    appendAuditLog(
      "GLOBAL_SEARCH_NAVIGATE",
      `Module: ${module.toUpperCase()}`,
      `Navigated via Cross-Module Search to target: ${targetFilter || targetId || module}`
    );
  };

  // Cross-Navigation Handlers
  const handleNavigateToBackground = (personName: string) => {
    setSearchFilter(personName);
    setActiveTab("background");
  };

  const handleNavigateToKeys = (keyId: string) => {
    setFocusedKeyId(keyId);
    setActiveTab("masterkeys");
  };

  const handleAddNodeToGraph = (newNode: GraphNode) => {
    const safeNode = {
      ...newNode,
      id: newNode.id || `node-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    };
    setNodes((prev) => [...prev, safeNode]);
    appendAuditLog(
      "NODE_INGESTED_TO_GRAPH",
      `${safeNode.label} (${safeNode.type})`,
      "Entity ingested into live relationship graph."
    );
  };

  const handleAddEdgeToGraph = (source: string, target: string, label: string, type: string) => {
    const newEdge: GraphEdge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      source,
      target,
      label,
      type,
      confidence: 90,
      isDirectional: true,
    };
    setEdges((prev) => [...prev, newEdge]);
  };

  const handleAddThreat = (newThreat: ThreatFeedItem) => {
    setThreats((prev) => [newThreat, ...prev]);
  };

  const handleAddBackgroundRecord = (newRec: BackgroundRecord) => {
    setBackgroundRecords((prev) => [newRec, ...prev]);
  };

  // Reset workspace / Clean Slate
  const handleResetWorkspace = () => {
    if (confirm("Are you sure you want to reset the current live workspace to a clean slate? All unsaved in-memory entities will be cleared.")) {
      clearLiveWorkspace();
      setNodes([]);
      setEdges([]);
      setThreats([]);
      setProfiles([]);
      setBackgroundRecords([]);
      setMasterKeys([]);
      setVulnerabilities([]);
      appendAuditLog("WORKSPACE_PURGED_CLEAN_SLATE", "Live Environment", "Operator initiated fresh operation.");
    }
  };

  // Export current workspace
  const handleExportDossier = () => {
    exportWorkspaceJson({
      nodes,
      edges,
      threats,
      profiles,
      backgroundRecords,
      masterKeys,
      auditLogs,
      vulnerabilities,
      lastUpdated: new Date().toISOString(),
    });
    appendAuditLog("DOSSIER_EXPORTED_JSON", "Live Investigation Session", "Full workspace state exported.");
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Top Application Header */}
      <Header
        currentRole={userRole}
        setCurrentRole={setUserRole}
        activeInvestigationName="Live Operations (Active Ingestion)"
        onOpenAICopilot={() => {
          setCopilotInitialPrompt("");
          setIsCopilotOpen(true);
        }}
        threatAlertCount={threats.filter((t) => t.severity === "critical").length}
        onOpenThreats={() => setActiveTab("threats")}
        onQuickSearch={(q) => setSearchFilter(q)}
        searchQuery={searchFilter}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
      />

      {/* Sub-bar: Live Operations Quick Controls */}
      <div className="min-h-9 bg-slate-900 border-b border-slate-800/80 px-3 sm:px-4 py-1 flex items-center justify-between text-xs font-mono overflow-x-auto whitespace-nowrap shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] sm:text-xs">
            <Radio className="w-3 h-3 animate-pulse" />
            <span className="hidden xs:inline">LIVE OPS</span> READY
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 text-[10px] sm:text-[11px]">
            NODES: <span className="text-slate-200 font-bold">{nodes.length}</span>
          </span>
          <span className="text-slate-400 text-[10px] sm:text-[11px]">
            EDGES: <span className="text-slate-200 font-bold">{edges.length}</span>
          </span>
          <span className="text-slate-400 text-[10px] sm:text-[11px]">
            ALERTS: <span className="text-rose-400 font-bold">{threats.length}</span>
          </span>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2 pl-2">
          <button
            onClick={handleExportDossier}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] sm:text-[11px] flex items-center space-x-1 border border-slate-700 transition-colors shrink-0"
            title="Export Full Live Investigation Dossier as JSON"
          >
            <Download className="w-3 h-3 text-cyan-400" />
            <span className="hidden xs:inline">EXPORT</span> JSON
          </button>

          <button
            onClick={handleResetWorkspace}
            className="px-2 py-1 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 rounded text-[10px] sm:text-[11px] flex items-center space-x-1 border border-slate-700 transition-colors shrink-0"
            title="Reset Workspace & Start Clean Operation"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden xs:inline">CLEAN</span> SLATE
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Tactical Navigation Sidebar (Desktop + Mobile Drawer) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeThreatCount={threats.filter((t) => t.severity === "critical").length}
          anomalyCount={masterKeys.filter((k) => k.anomalyDetected).length}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* View Routing */}
        <main className="flex-1 flex overflow-hidden relative">
          {activeTab === "graph" && (
            <RelationshipGraph
              nodes={nodes}
              edges={edges}
              onUpdateNodes={setNodes}
              onUpdateEdges={setEdges}
              userRole={userRole}
              onOpenAICopilotWithPrompt={handleOpenAICopilotWithPrompt}
              searchFilter={searchFilter}
            />
          )}

          {activeTab === "redteam" && (
            <RedTeamDashboard
              vulnerabilities={vulnerabilities}
              onUpdateVulnerabilities={setVulnerabilities}
              nodes={nodes}
              userRole={userRole}
              onAuditLog={appendAuditLog}
              onNavigateToPayloads={() => setActiveTab("payloads")}
            />
          )}

          {activeTab === "payloads" && (
            <PayloadStudio
              userRole={userRole}
              nodes={nodes}
              onAddNodeToGraph={handleAddNodeToGraph}
              onAddEdgeToGraph={handleAddEdgeToGraph}
              onAuditLog={appendAuditLog}
            />
          )}

          {activeTab === "threats" && (
            <ThreatFeed
              threats={threats}
              onAddThreat={handleAddThreat}
              onAddNodeToGraph={handleAddNodeToGraph}
              userRole={userRole}
              onAuditLog={appendAuditLog}
              onOpenAICopilotWithPrompt={handleOpenAICopilotWithPrompt}
              searchFilter={searchFilter}
            />
          )}

          {activeTab === "people" && (
            <PeopleLookupView
              profiles={profiles}
              onAddNodeToGraph={handleAddNodeToGraph}
              onNavigateToBackground={handleNavigateToBackground}
              onNavigateToKeys={handleNavigateToKeys}
              userRole={userRole}
              onAuditLog={appendAuditLog}
              onOpenAICopilotWithPrompt={handleOpenAICopilotWithPrompt}
              searchFilter={searchFilter}
              targetProfileId={targetProfileId}
            />
          )}

          {activeTab === "background" && (
            <BackgroundCheckView
              records={backgroundRecords}
              onAddRecord={handleAddBackgroundRecord}
              userRole={userRole}
              onAuditLog={appendAuditLog}
              searchFilter={searchFilter}
            />
          )}

          {activeTab === "masterkeys" && (
            <MasterKeyManager
              masterKeys={masterKeys}
              onUpdateMasterKeys={setMasterKeys}
              userRole={userRole}
              onAuditLog={appendAuditLog}
              targetKeyId={focusedKeyId}
            />
          )}

          {activeTab === "audit" && (
            <AuditLogsView
              logs={auditLogs}
              userRole={userRole}
              searchFilter={searchFilter}
            />
          )}

          {activeTab === "reports" && (
            <ReportGenerator
              nodes={nodes}
              edges={edges}
              userRole={userRole}
              onAuditLog={appendAuditLog}
            />
          )}

          {activeTab === "automations" && (
            <ApiIntegrationsView
              userRole={userRole}
              onAuditLog={appendAuditLog}
            />
          )}

          {activeTab === "copilot" && (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                  <span className="font-mono font-bold text-lg">AI</span>
                </div>
                <h3 className="text-base font-bold text-slate-100 font-mono uppercase">
                  TACTICAL AI COPILOT READY
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Click the button below to launch the multi-turn intelligence copilot in focused modal view.
                </p>
                <button
                  onClick={() => setIsCopilotOpen(true)}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-mono text-xs font-bold shadow-lg cursor-pointer"
                >
                  LAUNCH MULTI-TURN AI COPILOT
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Quick Navigation Bar */}
      <nav aria-label="Mobile Navigation" className="md:hidden h-14 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-2 z-30 shrink-0 select-none">
        <button
          onClick={() => {
            setActiveTab("graph");
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-colors min-h-[44px] ${
            activeTab === "graph" ? "text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Network className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] font-mono">Graph</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("redteam");
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-colors min-h-[44px] ${
            activeTab === "redteam" ? "text-rose-400 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Crosshair className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] font-mono">Red Team</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("payloads");
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-colors min-h-[44px] ${
            activeTab === "payloads" ? "text-rose-400 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Terminal className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] font-mono">Payloads</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("threats");
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-colors min-h-[44px] relative ${
            activeTab === "threats" ? "text-amber-400 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="relative">
            <Flame className="w-4 h-4 mb-0.5" />
            {threats.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {threats.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono">Threats</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-colors min-h-[44px] ${
            isMobileMenuOpen ? "text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] font-mono">Modules</span>
        </button>
      </nav>

      {/* Multi-Turn AI Copilot Modal */}
      <AICopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        nodes={nodes}
        edges={edges}
        userRole={userRole}
        initialPrompt={copilotInitialPrompt}
      />

      {/* Global Cross-Module Search Palette */}
      <GlobalSearchPalette
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        query={searchFilter}
        onQueryChange={(q) => setSearchFilter(q)}
        nodes={nodes}
        threats={threats}
        backgroundRecords={backgroundRecords}
        profiles={profiles}
        masterKeys={masterKeys}
        auditLogs={auditLogs}
        onNavigateToModule={handleNavigateFromSearch}
        onAddNodeToGraph={handleAddNodeToGraph}
        onOpenAICopilotWithPrompt={handleOpenAICopilotWithPrompt}
        userRole={userRole}
      />
    </div>
  );
};

export default App;
