import React, { useState, useMemo } from "react";
import { 
  chatboxPretextTemplates, 
  ChatboxPretextTemplate, 
  generateShortenedVanityUrl, 
  calculateUrlMetrics,
  calculateShannonEntropy,
  encodeBase64 
} from "../../utils/payloadEngine";
import { 
  MessageSquare, 
  Globe, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  AlertTriangle, 
  Smartphone, 
  Laptop, 
  Lock, 
  Layers, 
  Terminal, 
  RefreshCw, 
  Link2, 
  QrCode, 
  Send, 
  Sliders, 
  Zap, 
  Eye, 
  Flame,
  CheckCircle2
} from "lucide-react";

interface ScenarioPreviewVisualizerProps {
  currentPayload: string;
  payloadFilename: string;
  obfuscationMethod: string;
  entropy: number;
  onAuditLog: (action: string, target: string, justification: string) => void;
  onSendToGraph?: (url: string, scenarioType: string) => void;
}

export const ScenarioPreviewVisualizer: React.FC<ScenarioPreviewVisualizerProps> = ({
  currentPayload,
  payloadFilename,
  obfuscationMethod,
  entropy,
  onAuditLog,
  onSendToGraph,
}) => {
  // Mode switcher: "chatbox" | "omnibox" | "shortener"
  const [activeTab, setActiveTab] = useState<"chatbox" | "omnibox" | "shortener">("chatbox");

  // Domain configuration
  const [selectedDomain, setSelectedDomain] = useState<string>("runehall.com");
  const [customDomainInput, setCustomDomainInput] = useState<string>("");
  const activeDomain = selectedDomain === "custom" ? (customDomainInput || "example.com") : selectedDomain;

  // Chatbox Scenario State
  const [selectedPretextId, setSelectedPretextId] = useState<string>("runehall_reward_drop");
  const [chatDeliveryFormat, setChatDeliveryFormat] = useState<"markdown" | "shortlink" | "raw_url" | "code_block" | "zerowidth">("markdown");
  const [customChatMessage, setCustomChatMessage] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: string; avatar: string; role: string; content: string; isBot: boolean; time: string }>>([]);
  const [interactiveSimResult, setInteractiveSimResult] = useState<{ title: string; desc: string; type: "success" | "warning" | "blocked" } | null>(null);

  // Omnibox URL Scenario State
  const [urlRouteType, setUrlRouteType] = useState<"hash_spa" | "query_param" | "base64_param" | "shortlink" | "double_encoded">("hash_spa");
  const [customRoutePath, setCustomRoutePath] = useState<string>("app/#/duel");
  const [customParamName, setCustomParamName] = useState<string>("token");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // URL Shortener State
  const [shortSlug, setShortSlug] = useState<string>("duel-wager");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Active Pretext
  const currentPretext = useMemo(() => {
    return chatboxPretextTemplates.find((p) => p.id === selectedPretextId) || chatboxPretextTemplates[0];
  }, [selectedPretextId]);

  // Derived Shortened URL
  const vanityInfo = useMemo(() => {
    return generateShortenedVanityUrl(activeDomain, shortSlug);
  }, [activeDomain, shortSlug]);

  // Derived Full Target URL based on active settings
  const generatedTargetUrl = useMemo(() => {
    const base = `https://${activeDomain}`;
    // Prepare payload string
    const samplePayloadSnippet = currentPayload ? currentPayload.slice(0, 150) : "test_payload_sample_token";
    
    if (urlRouteType === "hash_spa") {
      return `${base}/${customRoutePath}?${customParamName}=${encodeURIComponent(samplePayloadSnippet)}`;
    } else if (urlRouteType === "query_param") {
      return `${base}/arena?${customParamName}=${encodeURIComponent(samplePayloadSnippet)}`;
    } else if (urlRouteType === "base64_param") {
      const b64 = encodeBase64(samplePayloadSnippet, false);
      return `${base}/login?state=${encodeURIComponent(b64)}`;
    } else if (urlRouteType === "double_encoded") {
      const doubleEnc = encodeURIComponent(encodeURIComponent(samplePayloadSnippet));
      return `${base}/api/proxy?redirect=${doubleEnc}`;
    } else {
      return vanityInfo.shortUrl;
    }
  }, [activeDomain, urlRouteType, customRoutePath, customParamName, currentPayload, vanityInfo]);

  // URL Metrics
  const urlMetrics = useMemo(() => {
    return calculateUrlMetrics(generatedTargetUrl);
  }, [generatedTargetUrl]);

  // Derived Chat message formatted content
  const formattedChatMessage = useMemo(() => {
    const targetLink = chatDeliveryFormat === "shortlink" ? vanityInfo.shortUrl : generatedTargetUrl;
    
    if (chatDeliveryFormat === "markdown") {
      return `${currentPretext.defaultHeadline}\n\n${currentPretext.defaultBody}\n\n👉 [**${currentPretext.callToAction}**](${targetLink})`;
    } else if (chatDeliveryFormat === "shortlink") {
      return `${currentPretext.defaultHeadline}\n\n${currentPretext.defaultBody}\n\nSecure Access: ${vanityInfo.shortUrl}`;
    } else if (chatDeliveryFormat === "code_block") {
      return `[SYSTEM RUNTIME EXECUTION]\n\`\`\`js\n// Target Domain: ${activeDomain}\nconst payload = "${targetLink}";\n\`\`\``;
    } else if (chatDeliveryFormat === "zerowidth") {
      // Insert zero-width non-joiners
      const zeroWidthDomain = activeDomain.split(".").join("\u200C.\u200D");
      return `${currentPretext.defaultHeadline}\n\nVerified by https://${zeroWidthDomain}\nDirect link: ${targetLink}`;
    } else {
      return `${currentPretext.defaultHeadline}\n\n${currentPretext.defaultBody}\n\n${targetLink}`;
    }
  }, [currentPretext, chatDeliveryFormat, generatedTargetUrl, vanityInfo, activeDomain]);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    onAuditLog("SCENARIO_PAYLOAD_COPIED", activeDomain, `Copied format: ${key}`);
  };

  // Add custom chat message to simulation feed
  const handleSendSimulatedMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customChatMessage.trim()) return;

    setChatMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: "Operator (Red Ops)",
        avatar: "⚡",
        role: "Attacking Terminal",
        content: customChatMessage,
        isBot: false,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setCustomChatMessage("");
  };

  // Click on simulated link in chat
  const handleSimulatedLinkClick = (url: string) => {
    if (url.includes("runehall.com")) {
      setInteractiveSimResult({
        title: "RuneHall SPA Client Router Handshake",
        desc: `Parsed Hash Fragment: ${url}. Client route recognized '/#/duel'. Verifying token parameter integrity in localStorage store...`,
        type: "success",
      });
    } else if (url.includes("opduel.com")) {
      setInteractiveSimResult({
        title: "OpDuel Arena Matchmaking WebSocket Handshake",
        desc: `Target: ${url}. Intercepting postMessage event. Origin validated against 'https://opduel.com'. Ready for socket frame transmission.`,
        type: "success",
      });
    } else {
      setInteractiveSimResult({
        title: "Simulated Endpoint Navigation",
        desc: `Target URI: ${url}. Payload size: ${url.length} chars. Ready for domain resilience validation.`,
        type: "warning",
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Visualizer Top Control Bar */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 sm:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs sm:text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">
                SCENARIO & OBFUSCATION PREVIEW
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                LIVE EMULATION
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
              Realistic Chatbox pretext, Browser Omnibox URL deep-links, and vanity shorteners for SPA domain resilience.
            </p>
          </div>
        </div>

        {/* Tab Selector & Target Domain Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 space-x-1">
            <button
              onClick={() => setActiveTab("chatbox")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold flex items-center space-x-1.5 transition-all min-h-[34px] ${
                activeTab === "chatbox"
                  ? "bg-cyan-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>CHATBOX SCENARIO</span>
            </button>

            <button
              onClick={() => setActiveTab("omnibox")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold flex items-center space-x-1.5 transition-all min-h-[34px] ${
                activeTab === "omnibox"
                  ? "bg-cyan-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>BROWSER OMNIBOX & URL</span>
            </button>

            <button
              onClick={() => setActiveTab("shortener")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold flex items-center space-x-1.5 transition-all min-h-[34px] ${
                activeTab === "shortener"
                  ? "bg-cyan-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>URL SHORTENER & QR</span>
            </button>
          </div>

          {/* Target Domain Preset Switcher */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <span className="text-[10px] font-mono text-slate-500 px-2 uppercase">DOMAIN:</span>
            <button
              onClick={() => setSelectedDomain("runehall.com")}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors min-h-[30px] ${
                selectedDomain === "runehall.com"
                  ? "bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              runehall.com (SPA)
            </button>
            <button
              onClick={() => setSelectedDomain("opduel.com")}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors min-h-[30px] ${
                selectedDomain === "opduel.com"
                  ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              opduel.com (SPA)
            </button>
            <button
              onClick={() => setSelectedDomain("custom")}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors min-h-[30px] ${
                selectedDomain === "custom"
                  ? "bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Custom
            </button>
          </div>
        </div>
      </div>

      {/* Main Visualizer Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Settings & Parameter Panel */}
        <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/40 p-4 sm:p-5 overflow-y-auto space-y-4 shrink-0">
          {selectedDomain === "custom" && (
            <div>
              <label className="block text-[10px] font-mono uppercase text-indigo-400 mb-1">
                Custom Domain FQDN
              </label>
              <input
                type="text"
                value={customDomainInput}
                onChange={(e) => setCustomDomainInput(e.target.value)}
                placeholder="portal.target-domain.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          )}

          {/* Context Controls: Chatbox Mode */}
          {activeTab === "chatbox" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Pretext Narrative Template
                </label>
                <select
                  value={selectedPretextId}
                  onChange={(e) => setSelectedPretextId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
                >
                  {chatboxPretextTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.senderAvatar} {tpl.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Chat Payload Disguise / Embedding Format
                </label>
                <select
                  value={chatDeliveryFormat}
                  onChange={(e) => setChatDeliveryFormat(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 font-bold focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="markdown">Markdown Hyperlink Masking ([Claim Bonus](url))</option>
                  <option value="shortlink">Shortened Vanity Redirect Link (https://s.domain/v/...)</option>
                  <option value="zerowidth">Zero-Width Space Homoglyph Domain Masking</option>
                  <option value="raw_url">Raw Deep-Link Parameter Embed</option>
                  <option value="code_block">Code Snippet Fenced Block (```js ... ```)</option>
                </select>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Sender Persona:</span>
                  <span className="text-slate-200 font-bold">{currentPretext.senderName}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Target Environment:</span>
                  <span className="text-rose-400 font-bold">{activeDomain}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Obfuscation Layer:</span>
                  <span className="text-cyan-400 font-bold uppercase">{obfuscationMethod}</span>
                </div>
              </div>
            </div>
          )}

          {/* Context Controls: Omnibox & URL Mode */}
          {activeTab === "omnibox" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  SPA URL Delivery Vector
                </label>
                <select
                  value={urlRouteType}
                  onChange={(e) => setUrlRouteType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 font-bold focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="hash_spa">SPA Hash Fragment Routing (/#/duel?token=...)</option>
                  <option value="query_param">Standard Query Parameter (?arena=...)</option>
                  <option value="base64_param">Base64 URL-Safe Encoded Param (?state=...)</option>
                  <option value="double_encoded">Double URL Encoded Bypass (%2520...)</option>
                  <option value="shortlink">Shortened Vanity Link Redirect</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Route / Path
                  </label>
                  <input
                    type="text"
                    value={customRoutePath}
                    onChange={(e) => setCustomRoutePath(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Param Key
                  </label>
                  <input
                    type="text"
                    value={customParamName}
                    onChange={(e) => setCustomParamName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Device Omnibox Viewport
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`py-1.5 rounded-lg text-xs font-mono flex items-center justify-center space-x-1.5 transition-colors min-h-[36px] ${
                      previewDevice === "desktop"
                        ? "bg-slate-800 text-cyan-300 font-bold border border-cyan-500/30"
                        : "bg-slate-950 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5" />
                    <span>Desktop (Full)</span>
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={`py-1.5 rounded-lg text-xs font-mono flex items-center justify-center space-x-1.5 transition-colors min-h-[36px] ${
                      previewDevice === "mobile"
                        ? "bg-slate-800 text-cyan-300 font-bold border border-cyan-500/30"
                        : "bg-slate-950 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile (Truncated)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Context Controls: Shortener & QR Mode */}
          {activeTab === "shortener" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Custom Vanity Slug
                </label>
                <input
                  type="text"
                  value={shortSlug}
                  onChange={(e) => setShortSlug(e.target.value)}
                  placeholder="duel-vip-2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 font-bold focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Short Domain:</span>
                  <span className="text-emerald-400 font-bold">{vanityInfo.shortDomain}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Redirect Type:</span>
                  <span className="text-amber-400 font-bold">HTTP 302 Found (SPA)</span>
                </div>
              </div>
            </div>
          )}

          {/* URL & Payload Telemetry Gauge */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                OMNIBOX & RESILIENCE METRICS
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  urlMetrics.status === "safe"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : urlMetrics.status === "warning"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                {urlMetrics.length} BYTES ({urlMetrics.status.toUpperCase()})
              </span>
            </div>

            {/* Length Bar */}
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  urlMetrics.length > 256
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, (urlMetrics.length / 500) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 font-mono leading-tight">
              {urlMetrics.note}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={() => handleCopy(generatedTargetUrl, "url")}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-colors min-h-[38px]"
            >
              {copiedKey === "url" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === "url" ? "COPIED SCENARIO URL" : "COPY SCENARIO URL"}</span>
            </button>

            <button
              onClick={() => handleCopy(formattedChatMessage, "chat_msg")}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-colors min-h-[38px]"
            >
              {copiedKey === "chat_msg" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <MessageSquare className="w-3.5 h-3.5" />}
              <span>{copiedKey === "chat_msg" ? "COPIED CHAT TEXT" : "COPY FORMATTED CHAT"}</span>
            </button>
          </div>
        </div>

        {/* Right Preview Canvas */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-4 sm:p-6 space-y-6">
          {/* VIEW 1: CHATBOX SCENARIO SIMULATION */}
          {activeTab === "chatbox" && (
            <div className="space-y-4 max-w-4xl mx-auto w-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  REAL-TIME CHAT INTERFACE SIMULATION ({activeDomain.toUpperCase()})
                </span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  CHANNEL ACTIVE
                </span>
              </div>

              {/* Chat Container Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[480px]">
                {/* Chat Window Titlebar */}
                <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg shadow-inner">
                      {currentPretext.senderAvatar}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold font-mono text-slate-100">
                          {currentPretext.senderName}
                        </span>
                        <span className="px-1.5 py-0.2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-[9px] font-mono font-bold">
                          BOT / VERIFIED
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {currentPretext.senderRole} • #{activeDomain.split(".")[0]}-public-lobby
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                      Encrypted Channel
                    </span>
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                </div>

                {/* Chat Message Stream */}
                <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-gradient-to-b from-slate-900/90 to-slate-950">
                  {/* System Announcement / Timestamp */}
                  <div className="text-center">
                    <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-slate-500">
                      Today at {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Primary Pretext Message Card */}
                  <div className="flex items-start space-x-3 max-w-2xl">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-base shrink-0 mt-0.5">
                      {currentPretext.senderAvatar}
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xs font-bold font-mono text-slate-200">
                          {currentPretext.senderName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Message Bubble & Rich Card Embed */}
                      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl rounded-tl-none p-4 shadow-lg space-y-3">
                        <p className="text-xs font-sans text-slate-200 leading-relaxed whitespace-pre-line font-medium">
                          {currentPretext.defaultHeadline}
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed font-sans">
                          {currentPretext.defaultBody}
                        </p>

                        {/* Interactive Clickable Embed Card */}
                        <div className="mt-3 bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 hover:border-cyan-500/50 transition-all group">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-1.5 text-cyan-400 text-xs font-mono font-bold">
                                <Flame className="w-3.5 h-3.5 text-rose-400" />
                                <span>{activeDomain.toUpperCase()} VIP ARENA</span>
                              </div>
                              <p className="text-[11px] font-mono text-slate-400 truncate max-w-md">
                                {chatDeliveryFormat === "shortlink" ? vanityInfo.shortUrl : generatedTargetUrl}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono shrink-0">
                              EXPIRING SOON
                            </span>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
                            <button
                              onClick={() => handleSimulatedLinkClick(generatedTargetUrl)}
                              className="px-4 py-1.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>{currentPretext.callToAction}</span>
                            </button>

                            <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Verified SSL
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Render simulated operator reply messages */}
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="flex items-start space-x-3 max-w-2xl">
                      <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-700 flex items-center justify-center text-sm shrink-0 mt-0.5">
                        {msg.avatar}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-baseline space-x-2">
                          <span className="text-xs font-bold font-mono text-indigo-300">
                            {msg.sender}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">{msg.time}</span>
                        </div>
                        <div className="bg-indigo-950/60 border border-indigo-800/60 rounded-2xl rounded-tl-none p-3 text-xs font-mono text-slate-200">
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat Input Bar */}
                <form
                  onSubmit={handleSendSimulatedMessage}
                  className="bg-slate-950 p-3 border-t border-slate-800 flex items-center space-x-2"
                >
                  <input
                    type="text"
                    value={customChatMessage}
                    onChange={(e) => setCustomChatMessage(e.target.value)}
                    placeholder={`Message #${activeDomain.split(".")[0]}-public-lobby...`}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors cursor-pointer min-h-[38px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">SEND</span>
                  </button>
                </form>
              </div>

              {/* Interactive Simulation Result Modal / Alert */}
              {interactiveSimResult && (
                <div className="bg-slate-900 border border-cyan-500/40 rounded-xl p-4 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold font-mono text-cyan-300">
                        {interactiveSimResult.title}
                      </h4>
                    </div>
                    <p className="text-xs font-mono text-slate-300 leading-relaxed">
                      {interactiveSimResult.desc}
                    </p>
                  </div>
                  <button
                    onClick={() => setInteractiveSimResult(null)}
                    className="text-xs text-slate-500 hover:text-slate-300 font-mono px-2 py-1"
                  >
                    DISMISS
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: BROWSER OMNIBOX & URL DEEP-LINK SIMULATION */}
          {activeTab === "omnibox" && (
            <div className="space-y-4 max-w-4xl mx-auto w-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  BROWSER OMNIBOX & TRUNCATION VIEWPORT
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Target: <strong className="text-slate-200">{activeDomain}</strong>
                </span>
              </div>

              {/* Realistic Browser Window Frame */}
              <div
                className={`bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all ${
                  previewDevice === "mobile" ? "max-w-sm mx-auto border-cyan-500/30" : "w-full"
                }`}
              >
                {/* Browser Window Header & Tabs */}
                <div className="bg-slate-950 px-3 sm:px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    <div className="ml-2 hidden sm:flex items-center space-x-1.5 px-3 py-1 bg-slate-900 rounded-t-lg border-t border-x border-slate-800 text-[11px] font-mono text-slate-300">
                      <Flame className="w-3 h-3 text-rose-400" />
                      <span className="truncate max-w-[140px]">{activeDomain}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-500">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                      {previewDevice.toUpperCase()} ENGINE
                    </span>
                  </div>
                </div>

                {/* Omnibox Address Bar */}
                <div className="bg-slate-900 px-3 sm:px-4 py-2 border-b border-slate-800 flex items-center space-x-2">
                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 flex items-center space-x-2 text-xs font-mono overflow-hidden shadow-inner">
                    <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-400 font-bold shrink-0">https://</span>
                    <span className="text-slate-100 font-bold shrink-0">{activeDomain}</span>
                    <span className="text-slate-400 truncate">
                      {generatedTargetUrl.replace(`https://${activeDomain}`, "")}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopy(generatedTargetUrl, "omnibox")}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono transition-colors shrink-0"
                    title="Copy full URL"
                  >
                    {copiedKey === "omnibox" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Simulated SPA Viewport Content */}
                <div className="p-6 sm:p-8 bg-slate-950 flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-xl">
                    <Globe className="w-7 h-7" />
                  </div>

                  <div className="space-y-1 max-w-md">
                    <h4 className="text-sm font-bold font-mono text-slate-100 uppercase">
                      {activeDomain} SPA Client Application
                    </h4>
                    <p className="text-xs text-slate-400 font-mono">
                      Single Page Application routing state and client token receiver active.
                    </p>
                  </div>

                  <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 text-left font-mono text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] border-b border-slate-800 pb-1.5">
                      <span className="text-slate-400">Captured Query / State:</span>
                      <span className="text-cyan-400 font-bold">{customParamName}</span>
                    </div>
                    <div className="text-[11px] text-slate-300 break-all bg-slate-950 p-2 rounded border border-slate-800/80 font-mono select-text">
                      {generatedTargetUrl}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => handleSimulatedLinkClick(generatedTargetUrl)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors shadow-md min-h-[38px]"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>DISPATCH SPA TEST REQUEST</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: URL SHORTENER & QR CODE DELIVERY */}
          {activeTab === "shortener" && (
            <div className="space-y-4 max-w-4xl mx-auto w-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-emerald-400" />
                  VANITY URL SHORTENER & MOBILE QR STAGER
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Target Domain: <strong className="text-slate-200">{activeDomain}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Vanity URL Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Link2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold font-mono text-slate-100 uppercase">
                          COMPACT VANITY REDIRECTOR
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400">
                          Bypasses chat truncation & char limits
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[10px] font-mono text-slate-400 block uppercase">
                        Shortened Vanity Link:
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {vanityInfo.shortUrl}
                        </span>
                        <button
                          onClick={() => handleCopy(vanityInfo.shortUrl, "short_link")}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono flex items-center space-x-1"
                        >
                          {copiedKey === "short_link" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === "short_link" ? "COPIED" : "COPY"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-[11px] font-mono">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Original Payload Size:</span>
                        <span className="text-slate-200 font-bold">{currentPayload.length} bytes</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Vanity URI Length:</span>
                        <span className="text-emerald-400 font-bold">{vanityInfo.shortUrl.length} chars (92% reduction)</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Simulated HTTP Status:</span>
                        <span className="text-amber-300 font-bold">302 Temporary Redirect</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSimulatedLinkClick(vanityInfo.shortUrl)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-md min-h-[40px]"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>TEST REDIRECT HOP ENGINE</span>
                  </button>
                </div>

                {/* QR Code Visualizer Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-between text-center space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-center space-x-2">
                      <QrCode className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-xs font-bold font-mono text-slate-100 uppercase">
                        MOBILE CAMERA QR STAGER
                      </h4>
                    </div>
                    <p className="text-[10px] font-mono text-slate-400">
                      Tests smartphone camera scanner parsing & deep-link routing.
                    </p>
                  </div>

                  {/* Procedural High-Contrast QR Code Mockup */}
                  <div className="p-4 bg-white rounded-2xl shadow-xl flex flex-col items-center justify-center">
                    <div className="w-36 h-36 border-4 border-slate-900 rounded-lg p-1.5 flex flex-col justify-between bg-white">
                      <div className="flex justify-between">
                        <div className="w-8 h-8 bg-slate-950 rounded-sm flex items-center justify-center">
                          <div className="w-4 h-4 bg-white rounded-xs flex items-center justify-center">
                            <div className="w-2 h-2 bg-slate-950" />
                          </div>
                        </div>
                        <div className="w-8 h-8 bg-slate-950 rounded-sm flex items-center justify-center">
                          <div className="w-4 h-4 bg-white rounded-xs flex items-center justify-center">
                            <div className="w-2 h-2 bg-slate-950" />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center text-slate-900 font-mono text-[9px] font-bold">
                        {activeDomain.slice(0, 10)}
                      </div>

                      <div className="flex justify-between">
                        <div className="w-8 h-8 bg-slate-950 rounded-sm flex items-center justify-center">
                          <div className="w-4 h-4 bg-white rounded-xs flex items-center justify-center">
                            <div className="w-2 h-2 bg-slate-950" />
                          </div>
                        </div>
                        <div className="w-6 h-6 bg-slate-900 rounded-sm grid grid-cols-2 gap-0.5 p-0.5">
                          <div className="bg-white" />
                          <div className="bg-slate-900" />
                          <div className="bg-slate-900" />
                          <div className="bg-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    Encodes: <code className="text-cyan-400">{vanityInfo.shortUrl}</code>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
