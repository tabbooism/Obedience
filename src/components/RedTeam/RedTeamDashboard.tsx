import React, { useState } from "react";
import { 
  VulnerabilityAsset, 
  GraphNode, 
  UserRole 
} from "../../types";
import { apiClient } from "../../utils/apiClient";
import { 
  Crosshair, 
  ShieldAlert, 
  Play, 
  Flame, 
  ShieldCheck, 
  Activity, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  Radio, 
  Cpu, 
  Lock, 
  RefreshCw,
  Sparkles,
  Zap,
  Server
} from "lucide-react";

interface RedTeamDashboardProps {
  vulnerabilities: VulnerabilityAsset[];
  onUpdateVulnerabilities: (vulns: VulnerabilityAsset[]) => void;
  nodes: GraphNode[];
  userRole: UserRole;
  onAuditLog: (action: string, target: string, justification: string) => void;
  onNavigateToPayloads?: () => void;
  onOpenMetamorphicTester?: (targetDomain?: string) => void;
}

export const RedTeamDashboard: React.FC<RedTeamDashboardProps> = ({
  vulnerabilities,
  onUpdateVulnerabilities,
  nodes,
  userRole,
  onAuditLog,
  onNavigateToPayloads,
  onOpenMetamorphicTester,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>(
    "APT29_SCIF_EXFILTRATION"
  );
  const [targetAsset, setTargetAsset] = useState<string>("SCIF Delta Gateway Server 01");
  const [defenseLevel, setDefenseLevel] = useState<string>("Hardened Zero-Trust");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [postureScore, setPostureScore] = useState<number>(64);

  // MITRE ATT&CK Matrix tactics
  const mitreTactics = [
    { id: "recon", name: "Reconnaissance", count: 4, status: "Detected" },
    { id: "initial", name: "Initial Access", count: 7, status: "High Risk" },
    { id: "exec", name: "Execution", count: 5, status: "Active PoC" },
    { id: "persist", name: "Persistence", count: 3, status: "Monitored" },
    { id: "priv", name: "Priv Escalation", count: 6, status: "Critical Gap" },
    { id: "evade", name: "Defense Evasion", count: 4, status: "Detected" },
    { id: "creds", name: "Credential Access", count: 8, status: "Active Threat" },
    { id: "discover", name: "Discovery", count: 3, status: "Monitored" },
    { id: "lateral", name: "Lateral Movement", count: 5, status: "High Risk" },
    { id: "collect", name: "Collection", count: 2, status: "Protected" },
    { id: "c2", name: "Command & Control", count: 6, status: "Active Beacon" },
    { id: "exfil", name: "Exfiltration", count: 3, status: "Blocked" },
  ];

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    setSimulationLogs(["[INIT] Initializing Red Team offensive engine harness..."]);

    try {
      // Streamed step logs
      setTimeout(() => {
        setSimulationLogs((prev) => [
          ...prev,
          "[PHASE 1] Fingerprinting perimeter attack surface & open RPC listeners...",
          "[T1190] Exploit payload delivered: Testing memory offset on SCIF Delta Gateway...",
        ]);
      }, 700);

      setTimeout(() => {
        setSimulationLogs((prev) => [
          ...prev,
          "[T1078.004] Attempting lateral token spray using extracted contractor credentials...",
          "[DEFENSE] SOC SIEM alert triggered in 4.2 seconds. Behavioral heuristic match.",
        ]);
      }, 1400);

      const res = await apiClient.post("/api/simulate-redteam", {
        attackVector: selectedScenario,
        targetAsset,
        targetDefenseLevel: defenseLevel,
      });
      const data = res.data;

      setTimeout(() => {
        setSimulationResult(data.simulation);
        setSimulationLogs((prev) => [
          ...prev,
          "[COMPLETED] Adversary simulation executed. Full TTP gap analysis compiled.",
        ]);
        setIsSimulating(false);
        onAuditLog(
          "RED_TEAM_SIMULATION_EXECUTED",
          `Scenario: ${selectedScenario} against ${targetAsset}`,
          "Adversary testing validation for defensive posture baseline."
        );
      }, 2100);
    } catch (e) {
      setIsSimulating(false);
      console.error(e);
    }
  };

  const handleMitigateVuln = (vulnId: string) => {
    onUpdateVulnerabilities(
      vulnerabilities.map((v) =>
        v.id === vulnId ? { ...v, status: "Mitigated" } : v
      )
    );
    setPostureScore((prev) => Math.min(98, prev + 8));
    onAuditLog(
      "VULNERABILITY_HOTPATCH_APPLIED",
      `Vuln ID: ${vulnId}`,
      "Emergency patch remediation applied from Red Team console."
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto p-3 sm:p-5 space-y-4 sm:space-y-6">
      {/* Top Banner: Offensive Simulation & Posture Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Posture Score Meter */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
              <h3 className="font-bold text-slate-100 font-mono text-xs sm:text-sm uppercase">DEFENSIVE POSTURE INDEX</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap">
              HIGH EXPOSURE
            </span>
          </div>

          <div className="py-4 flex items-center justify-between">
            <div>
              <div className="text-3xl sm:text-4xl font-black font-mono text-slate-100 tracking-tight">
                {postureScore}<span className="text-xl text-slate-400">/100</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Calculated across 42 MITRE ATT&CK techniques</p>
            </div>
            <div className="w-16 h-16 sm:w-20 sm:h-20 relative flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-rose-500 transition-all duration-1000"
                  strokeDasharray={`${postureScore}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <Crosshair className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 absolute" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono border-t border-slate-800 pt-3">
            <div className="bg-slate-950 p-1.5 rounded">
              <span className="text-slate-400 block">LATERAL HOP</span>
              <span className="text-rose-400 font-bold">HIGH RISK</span>
            </div>
            <div className="bg-slate-950 p-1.5 rounded">
              <span className="text-slate-400 block">SCIF PERIMETER</span>
              <span className="text-amber-400 font-bold">GUARDED</span>
            </div>
            <div className="bg-slate-950 p-1.5 rounded">
              <span className="text-slate-400 block">HSM MESH</span>
              <span className="text-emerald-400 font-bold">ISOLATED</span>
            </div>
          </div>
        </div>

        {/* Live Attack Simulator Control Panel */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
            <div className="flex items-center space-x-2">
              <Crosshair className="w-5 h-5 text-rose-500 animate-spin shrink-0" style={{ animationDuration: "10s" }} />
              <div>
                <h3 className="font-bold text-slate-100 font-mono text-xs sm:text-sm uppercase">
                  ATTACK SIMULATION ENGINE
                </h3>
                <p className="text-[11px] text-slate-400 line-clamp-1 sm:line-clamp-none">Automated Red Team exploit validation & gap analysis</p>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded whitespace-nowrap">
              AI POWERED HARNESS
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 text-xs">
            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                ATTACK SCENARIO
              </label>
              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-rose-500"
              >
                <option value="APT29_SCIF_EXFILTRATION">APT29 SCIF Exfiltration Campaign</option>
                <option value="RANSOMWARE_MASTER_KEY_HOP">Master Key Credential Spray & Lateral Hop</option>
                <option value="SPEARPHISH_ZERO_DAY_RCE">Spearphishing Kernel 0-Day (CVE-2026-3809)</option>
                <option value="HSM_SIDECHANNEL_TAMPER">HSM Token Side-Channel Memory Leak</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                TARGET ASSET
              </label>
              <select
                value={targetAsset}
                onChange={(e) => setTargetAsset(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-rose-500"
              >
                <option value="SCIF Delta Gateway Server 01">SCIF Delta Gateway Server 01 (10.0.14.8)</option>
                <option value="Executive Workstations">Executive Workstations (Policy 12)</option>
                <option value="SCIF Door Badge Controller">SCIF Door Badge Reader v2.4</option>
                <option value="KMS Root Hardware Vault">KMS Root Hardware Vault (Air-Gapped)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                DEFENSIVE POSTURE
              </label>
              <select
                value={defenseLevel}
                onChange={(e) => setDefenseLevel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-rose-500"
              >
                <option value="Standard Enterprise">Standard Enterprise Perimeter</option>
                <option value="Hardened Zero-Trust">Hardened Zero-Trust Segmentation</option>
                <option value="Air-Gapped Strict Quorum">Air-Gapped Strict Quorum Mode</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 gap-2 border-t border-slate-800/80">
            <span className="text-[10px] font-mono text-slate-400">
              OPERATOR CLEARANCE: <span className="text-cyan-400 font-bold">{userRole}</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {onOpenMetamorphicTester && (
                <button
                  id="btn-redteam-metamorphic-test"
                  onClick={() => onOpenMetamorphicTester("auth-defense-portal.com")}
                  className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg font-mono text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                  title="Trigger Metamorphic HTTP Injection Resilience Tests (XSS, SQLi, Command Injection)"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">TRIGGER RESILIENCE TESTS</span>
                  <span className="sm:hidden">RESILIENCE TESTS</span>
                </button>
              )}
              {onNavigateToPayloads && (
                <button
                  onClick={onNavigateToPayloads}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-mono text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">PAYLOAD STUDIO & OBFUSCATION</span>
                  <span className="sm:hidden">PAYLOAD STUDIO</span>
                </button>
              )}
              <button
                onClick={handleRunSimulation}
                disabled={isSimulating}
                className="px-3.5 sm:px-4 py-2 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white rounded-lg font-mono font-bold text-xs flex items-center space-x-2 shadow-lg shadow-rose-950/40 disabled:opacity-50 cursor-pointer"
              >
                <Play className={`w-3.5 h-3.5 ${isSimulating ? "animate-spin" : ""}`} />
                <span>{isSimulating ? "SIMULATING..." : "LAUNCH SIMULATION"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Simulation Console & Result Stream */}
      {simulationLogs.length > 0 && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs shadow-xl space-y-3">
          <div className="flex items-center justify-between text-slate-400 border-b border-slate-850 pb-2">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="font-bold uppercase text-slate-200">OFFENSIVE SIMULATION TELEMETRY LOG</span>
            </div>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE STREAM
            </span>
          </div>

          <div className="space-y-1.5 text-slate-300 max-h-36 overflow-y-auto">
            {simulationLogs.map((log, idx) => (
              <div key={idx} className="flex items-start space-x-2 text-[11px]">
                <span className="text-slate-600">[{idx + 1}]</span>
                <span className={log.includes("DEFENSE") ? "text-cyan-300" : log.includes("T1") ? "text-amber-300" : "text-slate-300"}>
                  {log}
                </span>
              </div>
            ))}
          </div>

          {/* Detailed Attack Results Breakdown */}
          {simulationResult && (
            <div className="mt-3 pt-3 border-t border-slate-850 grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-900/60 p-3 rounded-xl">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">EXPLOIT SUCCESS PROBABILITY</span>
                <span className="text-xl font-bold font-mono text-rose-400">
                  {simulationResult.successProbability || 68}%
                </span>
                <p className="text-[10px] text-slate-400">Probability of reaching target objective undetected</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">DEFENSIVE DETECTION TIME</span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {simulationResult.alertTimeSec || 4.2}s
                </span>
                <p className="text-[10px] text-slate-400">Time elapsed before SIEM behavioral alert trigger</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">IDENTIFIED CRITICAL GAP</span>
                <p className="text-[11px] text-amber-300 font-sans">
                  {simulationResult.defensiveGaps?.[0] || "Missing hardware MFA on admin console"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MITRE ATT&CK Matrix Interactive Heatmap */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-slate-100 font-mono text-sm uppercase">
              MITRE ATT&CK ENTERPRISE MATRIX HEATMAP
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">12 TACTICAL COLUMNS // 42 TECHNIQUES</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {mitreTactics.map((tac) => {
            const isHigh = tac.status === "High Risk" || tac.status === "Critical Gap" || tac.status === "Active Threat";
            return (
              <div
                key={tac.id}
                className={`p-2.5 rounded-xl border transition-all ${
                  isHigh
                    ? "bg-rose-950/20 border-rose-500/40 hover:border-rose-500"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>{tac.count} TTPs</span>
                  <span
                    className={`font-bold px-1.5 py-0.2 rounded text-[9px] ${
                      isHigh ? "bg-rose-500/20 text-rose-300" : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {tac.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 mt-1 font-mono truncate">{tac.name}</h4>
              </div>
            );
          })}
        </div>
      </div>

      {/* Discovered Attack Surface Vulnerabilities */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-slate-100 font-mono text-sm uppercase">
              ATTACK SURFACE ASSET VULNERABILITY AUDIT ({vulnerabilities.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">CONTINUOUS PERIMETER SCANNING</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {vulnerabilities.map((vuln) => (
            <div
              key={vuln.id}
              className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs text-rose-400">{vuln.cveId}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      CVSS {vuln.cvssScore}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-100 mt-0.5">{vuln.name}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">HOST: {vuln.affectedHost}</p>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    vuln.status === "Mitigated"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  }`}
                >
                  {vuln.status}
                </span>
              </div>

              <div className="text-[11px] text-slate-300 bg-slate-900 p-2 rounded border border-slate-850 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 font-bold block">REMEDIATION PLAYBOOK:</span>
                <p>{vuln.remediation}</p>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-[10px] font-mono text-slate-400">TACTIC: {vuln.mitreTactic}</span>
                {vuln.status !== "Mitigated" && (
                  <button
                    onClick={() => handleMitigateVuln(vuln.id)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-mono text-[11px] font-semibold flex items-center space-x-1"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span>APPLY HOTPATCH</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
