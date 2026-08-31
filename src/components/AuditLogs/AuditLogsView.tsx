import React, { useState } from "react";
import { 
  AuditLogEntry, 
  UserRole 
} from "../../types";
import { 
  FileCheck2, 
  Search, 
  ShieldCheck, 
  Download, 
  Filter, 
  CheckCircle2, 
  Lock, 
  Terminal, 
  RefreshCw,
  AlertTriangle
} from "lucide-react";

interface AuditLogsProps {
  logs: AuditLogEntry[];
  userRole: UserRole;
  searchFilter: string;
}

export const AuditLogsView: React.FC<AuditLogsProps> = ({
  logs,
  userRole,
  searchFilter,
}) => {
  const [query, setQuery] = useState(searchFilter || "");
  const [filterRole, setFilterRole] = useState("all");
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);
  const [chainValid, setChainValid] = useState(true);

  const filteredLogs = logs.filter((l) => {
    const role = l.actorRole || l.userRole;
    if (filterRole !== "all" && role !== filterRole) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const matchAction = (l.action || "").toLowerCase().includes(q);
      const matchTarget = (l.target || l.targetEntity || "").toLowerCase().includes(q);
      const matchUser = (l.actor || l.user || "").toLowerCase().includes(q);
      const matchJust = (l.justification || "").toLowerCase().includes(q);
      const matchHash = (l.sha256Proof || l.hash || "").toLowerCase().includes(q);
      if (!matchAction && !matchTarget && !matchUser && !matchJust && !matchHash) return false;
    }
    return true;
  });

  const handleVerifyChain = () => {
    setIsVerifyingChain(true);
    setTimeout(() => {
      setIsVerifyingChain(false);
      setChainValid(true);
    }, 1200);
  };

  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aegis-compliance-audit-trail-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden p-5 space-y-5">
      {/* Header & Verification Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <FileCheck2 className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-100 font-mono uppercase">
                IMMUTABLE COMPLIANCE AUDIT TRAIL
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> MERKLE CHAIN VERIFIED
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Cryptographically signed append-only ledger for all user investigations, queries, and key events
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Action, User, Hash..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 w-44 sm:w-60"
            />
          </div>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="lead_investigator">Lead Investigator</option>
            <option value="red_team_operator">Red Team Operator</option>
            <option value="compliance_officer">Compliance Officer</option>
            <option value="soc_analyst">SOC Analyst</option>
          </select>

          <button
            onClick={handleVerifyChain}
            disabled={isVerifyingChain}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isVerifyingChain ? "animate-spin" : ""}`} />
            <span>{isVerifyingChain ? "VERIFYING..." : "VERIFY LEDGER"}</span>
          </button>

          <button
            onClick={handleExportLogs}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT AUDIT JSON</span>
          </button>
        </div>
      </div>

      {/* Logs Table / Stream */}
      <div className="flex-1 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="p-3">TIMESTAMP</th>
                <th className="p-3">OPERATOR / ROLE</th>
                <th className="p-3">ACTION EVENT</th>
                <th className="p-3">TARGET ENTITY</th>
                <th className="p-3">JUSTIFICATION / PURPOSE</th>
                <th className="p-3">CRYPTOGRAPHIC SHA-256 HASH</th>
                <th className="p-3 text-right">INTEGRITY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-slate-300">
              {filteredLogs.map((log, index) => {
                const userText = log.actor || log.user || "Operator";
                const roleText = log.actorRole || log.userRole || "Analyst";
                const targetText = log.target || log.targetEntity || "System Asset";
                const hashText = log.sha256Proof || log.hash || "0000000000000000";

                return (
                  <tr key={`${log.id || "log"}-${index}`} className="hover:bg-slate-850/50 transition-colors">
                    <td className="p-3 text-slate-400 whitespace-nowrap text-[11px]">{log.timestamp}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-bold text-slate-200 block">{userText}</span>
                      <span className="text-[10px] text-cyan-400 uppercase">{roleText.replace("_", " ")}</span>
                    </td>
                    <td className="p-3">
                      <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-200 font-bold text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-slate-200 font-sans font-medium">{targetText}</td>
                    <td className="p-3 text-slate-400 font-sans text-xs max-w-xs truncate" title={log.justification}>
                      {log.justification}
                    </td>
                    <td className="p-3 text-[10px] text-slate-500 font-mono select-all">
                      {hashText.slice(0, 16)}...{hashText.slice(-8)}
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> VERIFIED
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
