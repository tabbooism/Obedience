import React, { useState, useEffect } from "react";
import { 
  BackgroundRecord, 
  UserRole 
} from "../../types";
import { 
  Scale, 
  Search, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  FileText, 
  ExternalLink, 
  Download, 
  Plus,
  Filter,
  Gavel,
  BadgeAlert
} from "lucide-react";

interface BackgroundCheckProps {
  records: BackgroundRecord[];
  onAddRecord: (rec: BackgroundRecord) => void;
  userRole: UserRole;
  onAuditLog: (action: string, target: string, justification: string) => void;
  searchFilter: string;
}

export const BackgroundCheckView: React.FC<BackgroundCheckProps> = ({
  records,
  onAddRecord,
  userRole,
  onAuditLog,
  searchFilter,
}) => {
  const [query, setQuery] = useState(searchFilter || "");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (searchFilter !== undefined) {
      setQuery(searchFilter);
    }
  }, [searchFilter]);

  // New Record Form
  const [newPersonName, setNewPersonName] = useState("");
  const [newDocket, setNewDocket] = useState("");
  const [newJurisdiction, setNewJurisdiction] = useState("US Federal Court");
  const [newOffense, setNewOffense] = useState("");
  const [newCategory, setNewCategory] = useState<any>("Cyber Espionage");
  const [newDisposition, setNewDisposition] = useState<any>("Convicted");
  const [newSeverity, setNewSeverity] = useState(85);
  const [newSummary, setNewSummary] = useState("");

  const filteredRecords = records.filter((r) => {
    if (selectedJurisdiction !== "all" && r.registrySource !== selectedJurisdiction) return false;
    if (selectedCategory !== "all" && r.category !== selectedCategory) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const matchName = r.personName.toLowerCase().includes(q);
      const matchDocket = r.docketNumber.toLowerCase().includes(q);
      const matchOffense = r.offense.toLowerCase().includes(q);
      const matchSumm = r.caseSummary.toLowerCase().includes(q);
      if (!matchName && !matchDocket && !matchOffense && !matchSumm) return false;
    }
    return true;
  });

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim() || !newDocket.trim()) return;

    const newRec: BackgroundRecord = {
      id: `bg-rec-${Date.now()}`,
      personId: `person-manual-${Date.now()}`,
      personName: newPersonName.trim(),
      docketNumber: newDocket.trim(),
      jurisdiction: newJurisdiction,
      offense: newOffense || "Unauthorized Access to Classified Assets",
      category: newCategory,
      dateOfRecord: new Date().toISOString().split("T")[0],
      disposition: newDisposition,
      severityScore: newSeverity,
      registrySource: newJurisdiction as any,
      caseSummary: newSummary || "Case record indexed from regional court filing.",
      verificationStatus: "Verified",
    };

    onAddRecord(newRec);
    setShowAddModal(false);
    onAuditLog(
      "LEGAL_BACKGROUND_RECORD_INDEXED",
      `Subject: ${newPersonName} (Docket: ${newDocket})`,
      "Manually indexed regional judicial record into defense vetting database."
    );
    setNewPersonName("");
    setNewDocket("");
    setNewSummary("");
  };

  const getDispositionBadge = (disp: string) => {
    if (disp === "Active Warrant" || disp === "Sanction Listed") {
      return "bg-rose-500/20 text-rose-300 border-rose-500/40";
    }
    if (disp === "Convicted" || disp === "Plea Agreement") {
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    }
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden p-5 space-y-5">
      {/* Header & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Scale className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 font-mono uppercase">
              REGIONAL LEGAL & CRIMINAL BACKGROUND REGISTRY
            </h2>
            <p className="text-xs text-slate-400">
              Synchronized with INTERPOL Red Notices, OFAC Sanctions, and Federal Court Dockets
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Target, Docket, Offense..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500 w-44 sm:w-60"
            />
          </div>

          <select
            value={selectedJurisdiction}
            onChange={(e) => setSelectedJurisdiction(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
          >
            <option value="all">All Registries</option>
            <option value="INTERPOL Red Notice">INTERPOL Red Notices</option>
            <option value="OFAC SDN List">OFAC SDN Sanctions</option>
            <option value="US Federal Court">US Federal Courts</option>
            <option value="Regional Municipal Court">Regional Municipal</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>INDEX CASE</span>
          </button>
        </div>
      </div>

      {/* Case Dockets Cards Grid */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filteredRecords.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800 font-mono">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
            <p>No criminal or sanctions records match current search parameters.</p>
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <div
              key={rec.id}
              className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-xl p-4 transition-all shadow-md space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-100 tracking-tight">{rec.personName}</h3>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getDispositionBadge(
                        rec.disposition
                      )}`}
                    >
                      {rec.disposition}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {rec.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    DOCKET: <span className="text-amber-400 font-bold">{rec.docketNumber}</span> • REGISTRY:{" "}
                    <span className="text-slate-200">{rec.registrySource}</span>
                  </p>
                </div>

                <div className="text-right font-mono text-xs">
                  <span className="text-[10px] text-slate-400 block uppercase">SEVERITY IMPACT</span>
                  <span
                    className={`text-base font-black ${
                      rec.severityScore >= 80 ? "text-rose-400" : rec.severityScore === 0 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {rec.severityScore}/100
                  </span>
                </div>
              </div>

              {/* Case Summary */}
              <div className="bg-slate-950/80 border border-slate-850 rounded-lg p-3 space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span className="font-bold text-slate-300">OFFENSE: {rec.offense}</span>
                  <span>RECORD DATE: {rec.dateOfRecord}</span>
                </div>
                <p className="text-slate-300 leading-relaxed font-sans text-xs">{rec.caseSummary}</p>
                <div className="text-[10px] text-cyan-400 pt-1 flex items-center space-x-2">
                  <Gavel className="w-3 h-3 text-cyan-400" />
                  <span>JURISDICTION: {rec.jurisdiction}</span>
                  <span>• VERIFICATION: {rec.verificationStatus}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Index New Case */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Gavel className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-slate-100 font-mono">INDEX REGIONAL JUDICIAL DOCKET</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-100">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Subject Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Victor Vance"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Court Docket / Warrant #
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. US-FED-CR-2026-901"
                    value={newDocket}
                    onChange={(e) => setNewDocket(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Judicial Registry Source
                  </label>
                  <select
                    value={newJurisdiction}
                    onChange={(e) => setNewJurisdiction(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                  >
                    <option value="INTERPOL Red Notice">INTERPOL Red Notice</option>
                    <option value="OFAC SDN List">OFAC SDN List</option>
                    <option value="US Federal Court">US Federal Court</option>
                    <option value="Europol Cyber Vault">Europol Cyber Vault</option>
                    <option value="Regional Municipal Court">Regional Municipal Court</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Disposition Status
                  </label>
                  <select
                    value={newDisposition}
                    onChange={(e) => setNewDisposition(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Active Warrant">Active Warrant</option>
                    <option value="Sanction Listed">Sanction Listed</option>
                    <option value="Convicted">Convicted</option>
                    <option value="Plea Agreement">Plea Agreement</option>
                    <option value="Pending Trial">Pending Trial</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Offense Classification
                </label>
                <input
                  type="text"
                  placeholder="e.g. Export of Cryptographic Articles / Money Laundering"
                  value={newOffense}
                  onChange={(e) => setNewOffense(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Judicial Case Synopsis
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter court findings and statutory violation details..."
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold font-mono"
                >
                  Commit Case to Registry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
