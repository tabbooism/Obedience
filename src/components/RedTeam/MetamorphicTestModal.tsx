import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Zap,
  Play,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Code2,
  Sliders,
  Terminal,
  Database,
  Globe,
  Share2,
  X,
  Info
} from "lucide-react";
import {
  PayloadFactory,
  MetamorphicPayload,
  MutationStrategy,
  PayloadCategory,
  ResilienceTestResult,
} from "../../utils/PayloadFactory";
import { GraphNode } from "../../types";
import { apiClient } from "../../utils/apiClient";

interface MetamorphicTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDomainInitial?: string;
  graphNodes?: GraphNode[];
  onAddNodeToGraph?: (node: GraphNode) => void;
  onAuditLog?: (action: string, target: string, justification: string) => void;
}

export const MetamorphicTestModal: React.FC<MetamorphicTestModalProps> = ({
  isOpen,
  onClose,
  targetDomainInitial = "auth-defense-portal.com",
  graphNodes = [],
  onAddNodeToGraph,
  onAuditLog,
}) => {
  const [targetDomain, setTargetDomain] = useState<string>(targetDomainInitial);
  const [category, setCategory] = useState<PayloadCategory | "all">("all");
  const [strategy, setStrategy] = useState<MutationStrategy>("mixed_metamorphic");
  const [targetParam, setTargetParam] = useState<string>("q");
  const [previewPayloads, setPreviewPayloads] = useState<MetamorphicPayload[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Test Execution State
  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<ResilienceTestResult[] | null>(null);
  const [testSummary, setTestSummary] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"builder" | "results">("builder");

  // Domain suggestions from graph nodes
  const domainNodes = graphNodes
    .filter((n) => n.type === "domain" || n.label.includes(".") || n.tags.includes("LIVE_SCAN_TARGET"))
    .map((n) => n.label);
  const suggestedDomains = Array.from(
    new Set([
      targetDomainInitial,
      ...domainNodes,
      "auth-defense-portal.com",
      "defense-contractor.corp",
      "api.staging-defense.internal",
      "identity-sso-gateway.net",
    ])
  ).filter(Boolean);

  // Re-generate local preview payloads when category or strategy changes
  useEffect(() => {
    const factory = new PayloadFactory();
    let base: MetamorphicPayload[] = [];
    if (category === "xss") {
      base = factory.generateMetamorphicXSS(targetParam);
    } else if (category === "sqli") {
      base = factory.generateMetamorphicSQLi(targetParam);
    } else if (category === "cmd") {
      base = factory.generateMetamorphicCommandInjection(targetParam);
    } else {
      base = factory.generateAllPayloads(targetParam);
    }

    if (strategy && strategy !== "mixed_metamorphic") {
      base = base.map((p) => ({
        ...p,
        mutated: PayloadFactory.mutate(p.raw, strategy),
        mutationStrategy: strategy,
      }));
    }

    setPreviewPayloads(base);
  }, [category, strategy, targetParam]);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunResilienceTest = async () => {
    if (!targetDomain.trim()) return;

    setIsRunningTest(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post("/api/payload/resilience-test", {
        targetDomain: targetDomain.trim(),
        category,
        strategy,
        targetParam,
      });

      const data = res.data;
      if (!data.success) {
        throw new Error(data.error || "Resilience test dispatch failed");
      }

      setTestResults(data.results);
      setTestSummary(data.summary);
      setActiveTab("results");

      if (onAuditLog) {
        onAuditLog(
          "METAMORPHIC_RESILIENCE_TEST_TRIGGERED",
          targetDomain.trim(),
          `Executed ${data.results.length} metamorphic test vectors (${category}, ${strategy}) against target domain.`
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to communicate with test engine");
    } finally {
      setIsRunningTest(false);
    }
  };

  const handleIngestToGraph = () => {
    if (!testSummary || !onAddNodeToGraph) return;

    const cleanHost = targetDomain.trim().replace(/^https?:\/\//i, "").split("/")[0];
    const nodeId = `node-resilience-${Date.now()}`;
    const riskScore = Math.max(20, 100 - (testSummary.resilienceScore || 50));

    const evaluatedNode: GraphNode = {
      id: nodeId,
      label: `${cleanHost} (Resilience Assessed)`,
      type: "domain",
      x: 450 + Math.random() * 80 - 40,
      y: 300 + Math.random() * 80 - 40,
      riskScore,
      confidence: 95,
      classification: "Secret",
      tags: [
        "METAMORPHIC_TESTED",
        testSummary.postureClassification,
        `RESILIENCE_${testSummary.resilienceScore}%`,
      ],
      isFlagged: riskScore > 65,
      attributes: {
        "Target Host": cleanHost,
        "Resilience Score": `${testSummary.resilienceScore}%`,
        "Posture": testSummary.postureClassification,
        "401 Auth Gated": testSummary.authProtected401.toString(),
        "403 WAF Blocked": testSummary.wafBlocked403.toString(),
        "Evaded / Accepted": testSummary.filterEvaded.toString(),
        "Total Tests": testSummary.totalTests.toString(),
      },
      notes: `Metamorphic Injection Resilience: Assessed ${testSummary.totalTests} mutated vectors. Posture evaluated as ${testSummary.postureClassification}.`,
    };

    onAddNodeToGraph(evaluatedNode);
    if (onAuditLog) {
      onAuditLog(
        "RESILIENCE_ASSESSMENT_INGESTED_TO_GRAPH",
        cleanHost,
        `Imported evaluated domain node into relationship canvas with score ${testSummary.resilienceScore}%.`
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-100 font-mono text-sm tracking-wide uppercase">
                  METAMORPHIC HTTP PAYLOAD RESILIENCE TESTER
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  PayloadFactory Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated metamorphic generation (XSS, SQLi, Command Injection) with filter-evasion mutations.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Toggle Tabs */}
        <div className="px-4 pt-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab("builder")}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-t-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === "builder"
                  ? "bg-slate-800 text-cyan-300 border-t-2 border-cyan-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>TEST CONFIGURATION & PAYLOADS</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-[10px] text-slate-400">
                {previewPayloads.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("results")}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-t-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === "results"
                  ? "bg-slate-800 text-cyan-300 border-t-2 border-cyan-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>EXECUTION TELEMETRY & RESULTS</span>
              {testResults && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-[10px] text-emerald-300">
                  {testResults.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2 pb-2">
            <button
              onClick={handleRunResilienceTest}
              disabled={isRunningTest || !targetDomain.trim()}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-mono font-bold rounded-lg flex items-center space-x-1.5 shadow-lg transition-colors"
            >
              {isRunningTest ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              <span>{isRunningTest ? "TESTING..." : "DISPATCH TESTS"}</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === "builder" ? (
            <div className="space-y-4">
              {/* Target & Parameters Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-cyan-400" /> Target Domain / Host
                  </label>
                  <input
                    type="text"
                    value={targetDomain}
                    onChange={(e) => setTargetDomain(e.target.value)}
                    placeholder="e.g. auth-defense-portal.com"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                  {suggestedDomains.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {suggestedDomains.slice(0, 3).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setTargetDomain(d)}
                          className="text-[9px] font-mono text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/60 px-1.5 py-0.5 rounded border border-cyan-900/40"
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Code2 className="w-3 h-3 text-amber-400" /> Vulnerability Vector
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">All Vectors (XSS + SQLi + CMD)</option>
                    <option value="xss">Cross-Site Scripting (XSS)</option>
                    <option value="sqli">SQL Injection (SQLi)</option>
                    <option value="cmd">Command Injection (OS Cmd)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-emerald-400" /> Metamorphic Mutation
                  </label>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="mixed_metamorphic">Mixed Metamorphic (Compound)</option>
                    <option value="case_variation">Alternating Case Variation</option>
                    <option value="comment_injection">Inline Comment Splitting (/**/)</option>
                    <option value="double_url_encode">Double URL Encoding (%25xx)</option>
                    <option value="whitespace_bypass">Whitespace Bypass (${"{IFS}"}, /)</option>
                    <option value="hex_encode">Hex Literal Encoding (0x...)</option>
                    <option value="html_entity">HTML Entity Encoding (&#x...;)</option>
                    <option value="concat_bypass">String Concat Bypass</option>
                    <option value="unicode_escape">Unicode Script Escaping</option>
                  </select>
                </div>
              </div>

              {/* Explanatory Notice */}
              <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs text-slate-300 flex items-start space-x-2.5">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-200">
                    Metamorphic Defense Resilience Mechanics:
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    PayloadFactory mutates structural tokens, keyword delimiters, and execution stagers without altering their semantic payload behavior. This exercises upstream WAF rules, parameter decoders, and application reflection points. If the target returns <span className="font-mono text-amber-300 font-bold">HTTP 401 Unauthorized</span>, authentication gates enforce boundary defense before parameter processing.
                  </p>
                </div>
              </div>

              {/* Generated Payloads List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
                    ACTIVE METAMORPHIC TEST SUITE ({previewPayloads.length} VECTORS)
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">
                    Param: ?{targetParam}=&lt;mutated_vector&gt;
                  </span>
                </div>

                <div className="space-y-2">
                  {previewPayloads.map((p) => (
                    <div
                      key={p.id}
                      className="bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              p.category === "xss"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : p.category === "sqli"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            }`}
                          >
                            {p.category}
                          </span>
                          <span className="font-bold text-slate-200">{p.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {p.mitreTechnique}
                          </span>
                        </div>

                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                          {p.mutationStrategy}
                        </span>
                      </div>

                      {/* Raw vs Mutated Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px]">
                        <div className="bg-slate-900/90 p-2 rounded border border-slate-800/80">
                          <div className="text-[9px] text-slate-500 uppercase mb-1">Standard Raw Vector</div>
                          <div className="text-slate-300 truncate select-all">{p.raw}</div>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded border border-amber-900/30">
                          <div className="flex items-center justify-between text-[9px] text-amber-400 uppercase mb-1">
                            <span>Metamorphic Mutated Vector</span>
                            <button
                              onClick={() => handleCopy(p.mutated, p.id)}
                              className="text-slate-400 hover:text-slate-200"
                            >
                              {copiedId === p.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="text-amber-200 truncate select-all font-bold">{p.mutated}</div>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>{p.description}</span>
                        <span className="text-slate-500 text-[10px]">{p.bypassMechanism}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Telemetry Summary Header */}
              {testSummary ? (
                <div className="space-y-3">
                  {/* Status Banner */}
                  {testSummary.authProtected401 > 0 ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start space-x-3">
                      <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold font-mono text-sm uppercase">
                          HTTP 401 UNAUTHORIZED: TARGET AUTHENTICATION GATE ACTIVE
                        </div>
                        <p className="text-[11px] text-amber-200/90 mt-0.5">
                          Target host <span className="font-mono font-bold text-amber-300">{testSummary.targetDomain || targetDomain}</span> requires authentication credentials (Basic, Bearer, or Session token). All injection payloads were intercepted prior to parameter reflection.
                        </p>
                      </div>
                    </div>
                  ) : testSummary.wafBlocked403 > 0 ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start space-x-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold font-mono text-sm uppercase">
                          WAF BLOCKS RECORDED (HTTP 403 FORBIDDEN)
                        </div>
                        <p className="text-[11px] text-emerald-200/90 mt-0.5">
                          Target perimeter security dropped metamorphic signatures. Security filters are actively evaluating HTTP parameters.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-xs text-cyan-300 flex items-start space-x-3">
                      <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold font-mono text-sm uppercase">
                          RESILIENCE ASSESSMENT COMPLETED (HTTP 200 PROCESSED)
                        </div>
                        <p className="text-[11px] text-cyan-200/90 mt-0.5">
                          Payloads transmitted and evaluated against parameter reflection rules.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center font-mono">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">Resilience Score</div>
                      <div className="text-xl font-bold text-cyan-300 mt-1">
                        {testSummary.resilienceScore}%
                      </div>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">Total Tests</div>
                      <div className="text-xl font-bold text-slate-200 mt-1">
                        {testSummary.totalTests}
                      </div>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">401 Auth Gated</div>
                      <div className="text-xl font-bold text-amber-400 mt-1">
                        {testSummary.authProtected401}
                      </div>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">403 WAF Blocks</div>
                      <div className="text-xl font-bold text-emerald-400 mt-1">
                        {testSummary.wafBlocked403}
                      </div>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">Filter Evaded</div>
                      <div className="text-xl font-bold text-rose-400 mt-1">
                        {testSummary.filterEvaded}
                      </div>
                    </div>
                  </div>

                  {/* Action row to ingest to Relationship Graph */}
                  {onAddNodeToGraph && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleIngestToGraph}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors shadow-md"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>INGEST TARGET RESILIENCE NODE TO GRAPH</span>
                      </button>
                    </div>
                  )}

                  {/* Results Breakdown Table */}
                  <div className="space-y-2">
                    <h4 className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
                      VECTOR TEST EXECUTION LOGS
                    </h4>

                    <div className="space-y-2">
                      {testResults?.map((r, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  r.httpStatus === 401
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : r.httpStatus === 403
                                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                    : r.httpStatus === 200
                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                HTTP {r.httpStatus || "ERR"} {r.statusText}
                              </span>
                              <span className="font-bold text-slate-200 font-sans">
                                {r.payloadName}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                              <span>Latency: {r.latencyMs}ms</span>
                              <span
                                className={`px-1.5 py-0.5 rounded uppercase font-bold ${
                                  r.executionOutcome === "AUTH_REQUIRED_401"
                                    ? "bg-amber-950/60 text-amber-300"
                                    : r.executionOutcome === "BLOCKED_BY_WAF"
                                    ? "bg-purple-950/60 text-purple-300"
                                    : r.executionOutcome === "FILTER_EVADED"
                                    ? "bg-rose-950/60 text-rose-300"
                                    : "bg-slate-800 text-slate-300"
                                }`}
                              >
                                {r.executionOutcome}
                              </span>
                            </div>
                          </div>

                          <div className="bg-slate-900 p-2 rounded text-[11px] text-slate-300 truncate select-all">
                            <span className="text-slate-500 mr-2 font-bold">SENT:</span>
                            {r.sentPayload}
                          </div>

                          <div className="text-[11px] text-slate-400 font-sans">
                            {r.analysisNotes}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center space-y-3 bg-slate-950 rounded-xl border border-slate-800">
                  <Terminal className="w-10 h-10 text-slate-600 mx-auto" />
                  <div className="font-mono text-sm text-slate-400">
                    NO ACTIVE RESILIENCE TEST RUN YET
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto font-sans">
                    Configure target domain and metamorphic vectors, then click "Dispatch Tests" to evaluate target resilience and perimeter posture.
                  </p>
                  <button
                    onClick={handleRunResilienceTest}
                    disabled={isRunningTest}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-bold inline-flex items-center space-x-1.5 transition-colors shadow-lg"
                  >
                    <Zap className="w-4 h-4" />
                    <span>TRIGGER FIRST RESILIENCE TEST</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-500">
          <div>
            <span>Engine: PayloadFactory Metamorphic Transformer v2.5</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
