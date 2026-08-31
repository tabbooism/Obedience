import React, { useState, useEffect } from "react";
import { 
  PersonProfile, 
  GraphNode, 
  UserRole 
} from "../../types";
import { 
  UserCheck, 
  Search, 
  Shield, 
  Plane, 
  Key, 
  AlertTriangle, 
  Scale, 
  Plus, 
  Sparkles, 
  ExternalLink, 
  Fingerprint, 
  Lock,
  Building,
  Mail,
  Phone
} from "lucide-react";

interface PeopleLookupProps {
  profiles: PersonProfile[];
  onAddNodeToGraph: (node: GraphNode) => void;
  onNavigateToBackground: (personName: string) => void;
  onNavigateToKeys: (keyId: string) => void;
  userRole: UserRole;
  onAuditLog: (action: string, target: string, justification: string) => void;
  onOpenAICopilotWithPrompt?: (prompt: string) => void;
  searchFilter?: string;
  targetProfileId?: string;
}

export const PeopleLookupView: React.FC<PeopleLookupProps> = ({
  profiles,
  onAddNodeToGraph,
  onNavigateToBackground,
  onNavigateToKeys,
  userRole,
  onAuditLog,
  onOpenAICopilotWithPrompt,
  searchFilter = "",
  targetProfileId,
}) => {
  const [searchQuery, setSearchQuery] = useState(searchFilter);
  const [selectedClearance, setSelectedClearance] = useState("all");
  const [selectedProfile, setSelectedProfile] = useState<PersonProfile | null>(
    (targetProfileId && profiles.find((p) => p.id === targetProfileId)) || profiles[0] || null
  );

  useEffect(() => {
    if (searchFilter !== undefined) {
      setSearchQuery(searchFilter);
    }
  }, [searchFilter]);

  useEffect(() => {
    if (targetProfileId) {
      const match = profiles.find((p) => p.id === targetProfileId);
      if (match) {
        setSelectedProfile(match);
      }
    }
  }, [targetProfileId, profiles]);

  const filteredProfiles = profiles.filter((p) => {
    if (selectedClearance !== "all" && p.clearanceLevel !== selectedClearance) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.fullName.toLowerCase().includes(q);
      const matchBadge = p.badgeId.toLowerCase().includes(q);
      const matchEmail = p.email.toLowerCase().includes(q);
      const matchAlias = p.aliases.some((a) => a.toLowerCase().includes(q));
      if (!matchName && !matchBadge && !matchEmail && !matchAlias) return false;
    }
    return true;
  });

  const handleAddPersonToGraph = (person: PersonProfile) => {
    const newNode: GraphNode = {
      id: `node-person-${Date.now()}`,
      label: person.fullName,
      type: "person",
      x: 380 + (Math.random() * 100 - 50),
      y: 280 + (Math.random() * 100 - 50),
      riskScore: person.riskScore,
      confidence: 96,
      classification: person.clearanceLevel as any,
      tags: ["PERSONNEL", person.clearanceStatus.toUpperCase(), person.badgeId],
      attributes: {
        "Badge ID": person.badgeId,
        "Clearance": person.clearanceLevel,
        "Status": person.clearanceStatus,
        "Email": person.email,
        "Role": person.roleTitle,
      },
      notes: person.bio,
    };

    onAddNodeToGraph(newNode);
    onAuditLog(
      "PERSON_NODE_INGESTED_TO_GRAPH",
      `Person: ${person.fullName} (${person.badgeId})`,
      "Imported internal subject into active investigation map."
    );
  };

  const getClearanceBadge = (level: string, status: string) => {
    if (status === "Suspended" || status === "Revoked") {
      return "bg-rose-500/20 text-rose-300 border-rose-500/40";
    }
    if (level.includes("Top Secret")) {
      return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
    }
    return "bg-slate-800 text-slate-300 border-slate-700";
  };

  return (
    <div className="flex-1 flex h-full bg-slate-950 overflow-hidden">
      {/* Left List of Profiles */}
      <div className="w-96 border-r border-slate-800 flex flex-col h-full bg-slate-900/60 shrink-0">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/90">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-slate-100 font-mono text-sm uppercase">
              PERSONNEL LOOKUP & VETTING
            </h2>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Name, Badge ID, Alias, Hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={selectedClearance}
            onChange={(e) => setSelectedClearance(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-200 font-mono focus:outline-none"
          >
            <option value="all">All Clearance Levels</option>
            <option value="Top Secret/SCI">Top Secret/SCI</option>
            <option value="Top Secret">Top Secret</option>
            <option value="Secret">Secret</option>
            <option value="Unclassified">Unclassified</option>
          </select>
        </div>

        {/* Profile List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredProfiles.map((p) => {
            const isSelected = selectedProfile?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProfile(p)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  isSelected
                    ? "bg-cyan-500/15 border-cyan-500/50 shadow-md"
                    : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="truncate mr-2">
                    <h3 className="text-xs font-bold text-slate-100 truncate">{p.fullName}</h3>
                    <p className="text-[10px] text-slate-400 truncate">{p.roleTitle}</p>
                    <span className="text-[10px] text-cyan-400 font-mono">{p.badgeId}</span>
                  </div>
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      p.riskScore >= 80
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    }`}
                  >
                    RISK {p.riskScore}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Detailed Dossier View */}
      {selectedProfile ? (
        <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-6">
          {/* Header Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-cyan-500/30 flex items-center justify-center shadow-lg text-cyan-400 font-mono text-xl font-black">
                  {selectedProfile.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-xl font-black text-slate-100 tracking-tight">
                      {selectedProfile.fullName}
                    </h1>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getClearanceBadge(
                        selectedProfile.clearanceLevel,
                        selectedProfile.clearanceStatus
                      )}`}
                    >
                      {selectedProfile.clearanceLevel} // {selectedProfile.clearanceStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    BADGE: <span className="text-slate-200">{selectedProfile.badgeId}</span> • ORG:{" "}
                    <span className="text-slate-200">{selectedProfile.organization}</span>
                  </p>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono mt-1">
                    <span>Aliases: {selectedProfile.aliases.join(", ")}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleAddPersonToGraph(selectedProfile)}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ADD TO GRAPH</span>
                </button>

                <button
                  onClick={() => onNavigateToBackground(selectedProfile.fullName)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 transition-colors"
                >
                  <Scale className="w-3.5 h-3.5 text-amber-400" />
                  <span>BACKGROUND VETTING</span>
                </button>

                <button
                  onClick={() => {
                    if (onOpenAICopilotWithPrompt) {
                      onOpenAICopilotWithPrompt(
                        `Synthesize an internal investigative intelligence summary on employee '${selectedProfile.fullName}' (Badge ID: ${selectedProfile.badgeId}). Analyze risk indicators, international travel patterns, and assigned Master Keys.`
                      );
                    }
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                  <span>AI PROFILE SYNTHESIS</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800 font-mono text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-400 block uppercase">RISK INDEX</span>
                <span className={`text-lg font-bold ${selectedProfile.riskScore >= 80 ? "text-rose-400" : "text-emerald-400"}`}>
                  {selectedProfile.riskScore}/100
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-400 block uppercase">LEGAL DOCKETS</span>
                <span className="text-lg font-bold text-amber-400">
                  {selectedProfile.criminalRecordCount} MATCHES
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-400 block uppercase">MASTER KEYS</span>
                <span className="text-lg font-bold text-cyan-400">
                  {selectedProfile.masterKeysAssigned.length} TOKENS
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-400 block uppercase">LAST SEEN</span>
                <span className="text-xs font-bold text-slate-200 truncate block">
                  {selectedProfile.lastLocation}
                </span>
              </div>
            </div>
          </div>

          {/* Biological / Forensic Bio & Hashes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-lg">
              <h3 className="text-xs font-bold text-slate-200 uppercase font-mono flex items-center space-x-2">
                <Fingerprint className="w-4 h-4 text-cyan-400" />
                <span>INTELLIGENCE DOSSIER & BIOMETRIC PROFILE</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">{selectedProfile.bio}</p>
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400 space-y-1">
                <div>
                  <span className="text-slate-400">NATIONAL ID SHA-256:</span>{" "}
                  <span className="text-slate-300 select-all">{selectedProfile.nationalIdHash}</span>
                </div>
                <div>
                  <span className="text-slate-400">EMAIL:</span>{" "}
                  <span className="text-cyan-300 select-all">{selectedProfile.email}</span>
                </div>
                <div>
                  <span className="text-slate-400">SECURE SIGNAL:</span>{" "}
                  <span className="text-cyan-300 select-all">{selectedProfile.phone}</span>
                </div>
              </div>
            </div>

            {/* Master Keys Assigned */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 uppercase font-mono flex items-center space-x-2">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>MASTER KEYS & SCIF CLEARANCES</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  {selectedProfile.masterKeysAssigned.length} Physical/Digital Keys
                </span>
              </div>

              <div className="space-y-2">
                {selectedProfile.masterKeysAssigned.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded border border-slate-800">
                    No active Master Keys or SCIF hardware tokens assigned.
                  </p>
                ) : (
                  selectedProfile.masterKeysAssigned.map((keyId) => (
                    <div
                      key={keyId}
                      className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center space-x-2">
                        <Lock className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-slate-200 font-bold">{keyId}</span>
                      </div>
                      <button
                        onClick={() => onNavigateToKeys(keyId)}
                        className="text-cyan-400 hover:text-cyan-300 text-[11px] underline"
                      >
                        Inspect Vault
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* International Travel & Flight Logs */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase font-mono flex items-center space-x-2">
                <Plane className="w-4 h-4 text-cyan-400" />
                <span>CROSS-BORDER TRAVEL & FLIGHT TELEMETRY</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">AUTOMATED APIS BORDER CROSSINGS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {selectedProfile.flightLogs.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No international travel logged in 12 months.</p>
              ) : (
                selectedProfile.flightLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px]">{log.date}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          log.risk === "high"
                            ? "bg-rose-500/20 text-rose-300"
                            : log.risk === "medium"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {log.risk.toUpperCase()} RISK
                      </span>
                    </div>
                    <p className="font-bold text-slate-200 text-sm">{log.destination}</p>
                    <p className="text-[10px] text-slate-400">Flight: {log.flightNo}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
