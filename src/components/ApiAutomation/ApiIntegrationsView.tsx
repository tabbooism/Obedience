import React, { useState } from "react";
import { UserRole } from "../../types";
import { 
  Workflow, 
  Code2, 
  Key, 
  Copy, 
  Check, 
  Play, 
  Plus, 
  Zap, 
  Radio, 
  ShieldCheck, 
  Terminal, 
  Cpu, 
  Sliders, 
  CheckCircle2,
  Trash2
} from "lucide-react";
import { AxiosInterceptorConsole } from "./AxiosInterceptorConsole";

interface ApiIntegrationsProps {
  userRole: UserRole;
  onAuditLog: (action: string, target: string, justification: string) => void;
  onOpenReauthModal?: () => void;
}

export const ApiIntegrationsView: React.FC<ApiIntegrationsProps> = ({
  userRole,
  onAuditLog,
  onOpenReauthModal,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Workflow Rules State
  const [workflows, setWorkflows] = useState([
    {
      id: "wf-1",
      name: "Automated Panic Quorum on High Risk Anomaly",
      trigger: "Node Risk >= 85 & Anomaly Aura Detected",
      action: "Execute Master Key Panic Suspension & Dispatch SIEM Webhook",
      status: "ACTIVE",
      executionsCount: 142,
    },
    {
      id: "wf-2",
      name: "Automated Darknet IOC Graph Ingestion",
      trigger: "New Threat Feed item with Critical severity",
      action: "Auto-create Graph Node, link to C2 cluster & query AI enrichment",
      status: "ACTIVE",
      executionsCount: 529,
    },
    {
      id: "wf-3",
      name: "Personnel Clearance Revocation on Active Warrant",
      trigger: "Regional Background Check match with 'Active Warrant'",
      action: "Revoke Master Keys & set Clearance to 'Suspended'",
      status: "ACTIVE",
      executionsCount: 18,
    },
  ]);

  const [apiTokens, setApiTokens] = useState([
    {
      id: "tok-1",
      name: "SIEM & Splunk SOAR Ingestion Pipeline",
      token: "aegis_sec_live_9f81a702b8d9102c91823746a5b",
      scopes: ["read:graph", "write:threats", "execute:enrichment"],
      created: "2026-08-15",
    },
    {
      id: "tok-2",
      name: "Air-Gapped SCIF Badge Reader Relay",
      token: "aegis_sec_live_38d901a8bc891029c01928374a5",
      scopes: ["manage:keys", "read:personnel"],
      created: "2026-08-20",
    },
  ]);

  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowTrigger, setNewWorkflowTrigger] = useState("Node Risk >= 80");
  const [newWorkflowAction, setNewWorkflowAction] = useState("Quarantine Node & Dispatch Alert");
  const [showAddWorkflow, setShowAddWorkflow] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflowName.trim()) return;

    const newWf = {
      id: `wf-${Date.now()}`,
      name: newWorkflowName.trim(),
      trigger: newWorkflowTrigger,
      action: newWorkflowAction,
      status: "ACTIVE",
      executionsCount: 0,
    };

    setWorkflows([...workflows, newWf]);
    setShowAddWorkflow(false);
    onAuditLog(
      "AUTOMATION_WORKFLOW_DEPLOYED",
      `Workflow: ${newWorkflowName}`,
      "Configured automated trigger & action rule in SOAR engine."
    );
    setNewWorkflowName("");
  };

  const handleDeleteWorkflow = (id: string) => {
    setWorkflows(workflows.filter((w) => w.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto p-5 space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Workflow className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 font-mono uppercase">
              API INTEGRATIONS & SOAR WORKFLOW AUTOMATION
            </h2>
            <p className="text-xs text-slate-400">
              Enterprise webhooks, REST endpoints, and automated defensive reaction triggers
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddWorkflow(true)}
          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>NEW SOAR WORKFLOW</span>
        </button>
      </div>

      {/* Axios Interceptor & Auth Resilience Engine Console */}
      <AxiosInterceptorConsole 
        userRole={userRole}
        onAuditLog={onAuditLog}
        onOpenReauthModal={onOpenReauthModal}
      />

      {/* Automated SOAR Playbooks Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-slate-100 font-mono text-sm uppercase">
              ACTIVE DEFENSIVE AUTOMATION WORKFLOWS ({workflows.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">EVENT-DRIVEN SOAR ENGINE</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {wf.status}
                  </span>
                  <button
                    onClick={() => handleDeleteWorkflow(wf.id)}
                    className="text-slate-600 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h4 className="text-xs font-bold text-slate-200 mt-2">{wf.name}</h4>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono bg-slate-900 p-2 rounded border border-slate-850">
                <div>
                  <span className="text-amber-400 block text-[10px] uppercase font-bold">TRIGGER:</span>
                  <span className="text-slate-300">{wf.trigger}</span>
                </div>
                <div>
                  <span className="text-cyan-400 block text-[10px] uppercase font-bold">ACTION:</span>
                  <span className="text-slate-300">{wf.action}</span>
                </div>
              </div>

              <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-850">
                <span>Total Dispatches:</span>
                <span className="font-bold text-slate-200">{wf.executionsCount} runs</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Enterprise API Endpoints & Curl Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* API Tokens */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <Key className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-slate-100 font-mono text-sm uppercase">
              ENTERPRISE API AUTHENTICATION KEYS
            </h3>
          </div>

          <div className="space-y-3">
            {apiTokens.map((tok) => (
              <div key={tok.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">{tok.name}</span>
                  <span className="text-[10px] text-slate-500">Issued: {tok.created}</span>
                </div>

                <div className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-cyan-300 font-bold select-all truncate mr-2">
                    {tok.token.slice(0, 18)}...{tok.token.slice(-6)}
                  </span>
                  <button
                    onClick={() => handleCopy(tok.token, tok.id)}
                    className="text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    {copiedKey === tok.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {tok.scopes.map((s) => (
                    <span key={s} className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* REST API Endpoints Reference */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <Code2 className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-slate-100 font-mono text-sm uppercase">
              REAL-TIME REST API ENDPOINTS
            </h3>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                  POST
                </span>
                <span className="text-slate-200">/api/enrich-entity</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Trigger autonomous OSINT enrichment on IP, Domain, Person, or Hash.
              </p>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                  POST
                </span>
                <span className="text-slate-200">/api/simulate-redteam</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Initiate automated adversarial offensive attack path simulation against critical assets.
              </p>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px]">
                  POST
                </span>
                <span className="text-slate-200">/api/generate-report</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Compile comprehensive classified intelligence dossier with cryptographic verification.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Create Workflow */}
      {showAddWorkflow && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Workflow className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 font-mono">NEW SOAR PLAYBOOK</h3>
              </div>
              <button onClick={() => setShowAddWorkflow(false)} className="text-slate-400 hover:text-slate-100">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorkflow} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Workflow Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Auto-Quarantine C2 Nodes"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Trigger Event Condition
                </label>
                <input
                  type="text"
                  required
                  value={newWorkflowTrigger}
                  onChange={(e) => setNewWorkflowTrigger(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Automated Reaction Action
                </label>
                <input
                  type="text"
                  required
                  value={newWorkflowAction}
                  onChange={(e) => setNewWorkflowAction(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddWorkflow(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold font-mono"
                >
                  Deploy SOAR Playbook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
