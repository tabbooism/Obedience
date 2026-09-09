import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  Key, 
  Lock, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Sparkles, 
  Play, 
  Trash2, 
  Radio, 
  ArrowRight, 
  ShieldCheck,
  Server,
  Layers,
  Settings2,
  Terminal
} from "lucide-react";
import { 
  apiClient, 
  getApiKey, 
  setApiKey, 
  getRefreshToken, 
  setRefreshToken, 
  isAutoRefreshEnabled, 
  setAutoRefreshEnabled,
  DEFAULT_CREDENTIALS,
  onInterceptorLog,
  getInterceptorLogs,
  clearInterceptorLogs,
  InterceptorEvent
} from "../../utils/apiClient";
import { UserRole } from "../../types";

interface AxiosInterceptorConsoleProps {
  userRole?: UserRole;
  onAuditLog?: (action: string, target: string, justification: string) => void;
  onOpenReauthModal?: () => void;
}

export const AxiosInterceptorConsole: React.FC<AxiosInterceptorConsoleProps> = ({
  userRole = "Lead Investigator",
  onAuditLog,
  onOpenReauthModal,
}) => {
  // Credentials State
  const [activeKey, setActiveKeyState] = useState<string>(getApiKey());
  const [activeRefreshToken, setActiveRefreshTokenState] = useState<string>(getRefreshToken());
  const [autoRefresh, setAutoRefreshState] = useState<boolean>(isAutoRefreshEnabled());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Test Bench State
  const [isRunningTest, setIsRunningTest] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    title: string;
    status: "success" | "error" | "pending";
    statusCode?: number;
    requestHeaders?: Record<string, string>;
    responsePayload?: any;
    message: string;
    timestamp: string;
  } | null>(null);

  // Live Interceptor Event Stream
  const [logs, setLogs] = useState<InterceptorEvent[]>(getInterceptorLogs());

  // Subscribe to live interceptor events
  useEffect(() => {
    const unsubscribe = onInterceptorLog((event) => {
      setLogs((prev) => [event, ...prev.slice(0, 49)]);
      // Update key state if refreshed or rotated
      if (event.type === "session_refreshed" || event.type === "reauth_completed") {
        setActiveKeyState(getApiKey());
        setActiveRefreshTokenState(getRefreshToken());
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleUpdateApiKey = (newKey: string) => {
    setActiveKeyState(newKey);
    setApiKey(newKey);
    if (onAuditLog) {
      onAuditLog(
        "API_KEY_ROTATED",
        "Axios Interceptor Auth State",
        `Operator updated user API key to ${newKey.substring(0, 14)}...`
      );
    }
  };

  const handleGenerateFreshKey = () => {
    const randomHex = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const newKey = `aegis_sec_live_${randomHex}`;
    handleUpdateApiKey(newKey);
  };

  const handleResetDefaultKey = () => {
    handleUpdateApiKey(DEFAULT_CREDENTIALS.API_KEY);
    setRefreshToken(DEFAULT_CREDENTIALS.REFRESH_TOKEN);
    setActiveRefreshTokenState(DEFAULT_CREDENTIALS.REFRESH_TOKEN);
  };

  const handleToggleAutoRefresh = (enabled: boolean) => {
    setAutoRefreshState(enabled);
    setAutoRefreshEnabled(enabled);
    if (onAuditLog) {
      onAuditLog(
        "AUTO_REFRESH_TOGGLED",
        "Axios Interceptor",
        `Auto-refresh on 401 set to ${enabled ? "ENABLED" : "DISABLED"}`
      );
    }
  };

  const handleSetRefreshToken = (token: string) => {
    setActiveRefreshTokenState(token);
    setRefreshToken(token);
  };

  // Test 1: Standard Authenticated Request (Verifies automatic API Key attachment)
  const runAuthenticatedRequestTest = async () => {
    setIsRunningTest("standard");
    setTestResult(null);

    try {
      const response = await apiClient.get("/api/auth/test-protected");
      setTestResult({
        id: "test-standard",
        title: "Standard Authenticated Request",
        status: "success",
        statusCode: response.status,
        requestHeaders: {
          Authorization: `Bearer ${getApiKey().substring(0, 14)}...`,
          "X-API-Key": `${getApiKey().substring(0, 14)}...`,
        },
        responsePayload: response.data,
        message: "API key was automatically injected into Authorization & X-API-Key headers by Axios Interceptor.",
        timestamp: new Date().toLocaleTimeString(),
      });
      if (onAuditLog) {
        onAuditLog("AXIOS_INTERCEPTOR_TEST", "/api/auth/test-protected", "Verified automatic API key injection on standard request.");
      }
    } catch (err: any) {
      setTestResult({
        id: "test-standard",
        title: "Standard Authenticated Request Failed",
        status: "error",
        statusCode: err.response?.status || 500,
        responsePayload: err.response?.data || { error: err.message },
        message: err.message || "Failed to make authenticated request.",
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsRunningTest(null);
    }
  };

  // Test 2: Simulate 401 with Automated Session Refresh
  const runAutoRefreshTest = async () => {
    setIsRunningTest("auto-refresh");
    setTestResult(null);

    try {
      // Endpoint responds with 401, Interceptor catches it, calls /api/auth/refresh, rotates key, and retries!
      const response = await apiClient.get("/api/auth/test-protected?force401=true");
      setActiveKeyState(getApiKey());
      setActiveRefreshTokenState(getRefreshToken());

      setTestResult({
        id: "test-refresh",
        title: "Simulated 401 with Transparent Token Refresh",
        status: "success",
        statusCode: response.status,
        requestHeaders: {
          Authorization: `Bearer ${getApiKey().substring(0, 14)}... (Rotated)`,
          "X-API-Key": `${getApiKey().substring(0, 14)}...`,
        },
        responsePayload: response.data,
        message: "Server returned 401. Axios response interceptor intercepted the error, automatically negotiated fresh credentials with /api/auth/refresh, updated local storage, and replayed the request transparently!",
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setTestResult({
        id: "test-refresh",
        title: "Automated Refresh Simulation Error",
        status: "error",
        statusCode: err.response?.status || 500,
        responsePayload: err.response?.data || { error: err.message },
        message: err.message || "Unexpected error during refresh test.",
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsRunningTest(null);
    }
  };

  // Test 3: Simulate 401 with Refresh Failure (Triggers Re-Authentication Modal)
  const runModalTriggerTest = async () => {
    setIsRunningTest("modal-trigger");
    setTestResult(null);

    try {
      // Pass failRefreshSimulation flag so interceptor refresh fails and triggers modal
      const response = await apiClient.get("/api/auth/test-protected?force401=true", {
        failRefreshSimulation: true,
      } as any);

      setTestResult({
        id: "test-modal",
        title: "Re-Authentication Modal Resolved Request",
        status: "success",
        statusCode: response.status,
        responsePayload: response.data,
        message: "Re-authentication modal was displayed, user validated new API key, and queued request replayed successfully!",
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setTestResult({
        id: "test-modal",
        title: "Re-Authentication Cancelled or Aborted",
        status: "error",
        statusCode: err.response?.status || 401,
        responsePayload: err.response?.data || { error: err.message },
        message: err.message || "User dismissed modal or re-authentication failed.",
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsRunningTest(null);
    }
  };

  const getEventBadge = (type: InterceptorEvent["type"]) => {
    switch (type) {
      case "request_intercepted":
        return <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-bold">REQ_INJECTED</span>;
      case "401_caught":
        return <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-mono font-bold">401_CAUGHT</span>;
      case "session_refreshing":
        return <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold">REFRESHING</span>;
      case "session_refreshed":
        return <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">REFRESHED</span>;
      case "refresh_failed":
        return <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-mono font-bold">REFRESH_FAILED</span>;
      case "reauth_prompted":
        return <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px] font-mono font-bold">MODAL_PROMPTED</span>;
      case "reauth_completed":
        return <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">REAUTH_COMPLETE</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">EVENT</span>;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Top Banner & Armed Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-100 font-mono text-sm uppercase tracking-wide">
                AXIOS INTERCEPTOR & AUTH RESILIENCE ENGINE
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1" />
                ARMED & ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatically injects user API key to every outgoing request and handles 401 Unauthorized via transparent session refresh or re-authentication modal.
            </p>
          </div>
        </div>

        {/* Global Modal Open Trigger */}
        {onOpenReauthModal && (
          <button
            onClick={onOpenReauthModal}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Open Re-Auth Modal</span>
          </button>
        )}
      </div>

      {/* Grid: Active Credentials & Interceptor Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: User API Key Management */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-mono font-bold text-slate-200 uppercase">
                ACTIVE USER API KEY (OUTGOING INJECTION)
              </h4>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
              Header: Authorization & X-API-Key
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <input
                type="text"
                value={activeKey}
                onChange={(e) => handleUpdateApiKey(e.target.value)}
                placeholder="aegis_sec_live_..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-cyan-300 focus:border-cyan-500 focus:outline-none"
              />
              <button
                onClick={() => handleCopy(activeKey, "apiKey")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                title="Copy API Key"
              >
                {copiedField === "apiKey" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
              <button
                onClick={handleGenerateFreshKey}
                className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Generate Fresh Key</span>
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={handleResetDefaultKey}
                className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                Reset Default Key
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed font-sans">
            Every request issued through <code className="text-cyan-400 font-mono">apiClient</code> is automatically intercepted. The interceptor binds this key to <code className="text-slate-200 font-mono">Authorization: Bearer &lt;key&gt;</code> and <code className="text-slate-200 font-mono">X-API-Key: &lt;key&gt;</code>.
          </div>
        </div>

        {/* Card 2: Session Refresh & 401 Recovery Engine */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-mono font-bold text-slate-200 uppercase">
                SESSION REFRESH & 401 POLICY
              </h4>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              Autonomous Failover
            </span>
          </div>

          {/* Auto Refresh Toggle */}
          <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <div>
              <div className="text-xs font-mono font-semibold text-slate-200">
                Transparent 401 Session Refresh
              </div>
              <div className="text-[11px] text-slate-400">
                Automatically negotiate session renewal via <code className="text-cyan-400 font-mono">/api/auth/refresh</code> before displaying UI modal.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => handleToggleAutoRefresh(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Rolling Refresh Token Field */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">
              Current Rolling Refresh Token:
            </label>
            <div className="relative">
              <input
                type="text"
                value={activeRefreshToken}
                onChange={(e) => handleSetRefreshToken(e.target.value)}
                placeholder="aegis_ref_tok_..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 py-1.5 text-xs font-mono text-emerald-300 focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={() => handleCopy(activeRefreshToken, "refreshToken")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                title="Copy Refresh Token"
              >
                {copiedField === "refreshToken" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
              <button
                onClick={() => handleSetRefreshToken("expired")}
                className="text-amber-400 hover:text-amber-300 underline cursor-pointer"
                title="Sets token to 'expired' so the refresh endpoint will fail and trigger ReAuthModal"
              >
                Simulate Expired Token
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={() => handleSetRefreshToken("")}
                className="text-rose-400 hover:text-rose-300 underline cursor-pointer"
                title="Empties refresh token to force instant modal prompt"
              >
                Clear Token
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={() => handleSetRefreshToken(DEFAULT_CREDENTIALS.REFRESH_TOKEN)}
                className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                Restore Valid Token
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Resilience Testing Bench */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-200 uppercase flex items-center space-x-2">
              <Play className="w-3.5 h-3.5 text-cyan-400" />
              <span>LIVE INTERCEPTOR RESILIENCE TEST BENCH</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Trigger real HTTP requests through the Axios client to observe header injection, 401 interception, session renewal, and modal re-authentication.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Target: /api/auth/test-protected</span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Action 1: Standard Authenticated Request */}
          <button
            onClick={runAuthenticatedRequestTest}
            disabled={!!isRunningTest}
            className="p-3 bg-slate-900 hover:bg-slate-800/80 border border-cyan-500/30 rounded-xl text-left transition-all hover:border-cyan-500/60 cursor-pointer disabled:opacity-50 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-400">1. VERIFY KEY ATTACHMENT</span>
              {isRunningTest === "standard" ? (
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Sends GET request. Interceptor attaches active API key; verifies 200 OK receipt.
            </p>
          </button>

          {/* Action 2: Simulate 401 with Automated Refresh */}
          <button
            onClick={runAutoRefreshTest}
            disabled={!!isRunningTest}
            className="p-3 bg-slate-900 hover:bg-slate-800/80 border border-emerald-500/30 rounded-xl text-left transition-all hover:border-emerald-500/60 cursor-pointer disabled:opacity-50 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-400">2. SIMULATE 401 (AUTO REFRESH)</span>
              {isRunningTest === "auto-refresh" ? (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Forces 401 error. Interceptor catches it, calls <code className="text-emerald-400 font-mono">/api/auth/refresh</code>, and replays request!
            </p>
          </button>

          {/* Action 3: Simulate 401 with Refresh Failure (Triggers Modal) */}
          <button
            onClick={runModalTriggerTest}
            disabled={!!isRunningTest}
            className="p-3 bg-slate-900 hover:bg-slate-800/80 border border-amber-500/30 rounded-xl text-left transition-all hover:border-amber-500/60 cursor-pointer disabled:opacity-50 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-400">3. SIMULATE 401 (PROMPT MODAL)</span>
              {isRunningTest === "modal-trigger" ? (
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Forces 401 with refresh failure. Interceptor displays the Re-Authentication Modal directly!
            </p>
          </button>
        </div>

        {/* Test Result Inspection Card */}
        {testResult && (
          <div className={`p-4 rounded-xl border ${
            testResult.status === "success" 
              ? "bg-emerald-950/20 border-emerald-500/40" 
              : "bg-rose-950/20 border-rose-500/40"
          } space-y-3 animate-in fade-in duration-150`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {testResult.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                <span className="text-xs font-mono font-bold text-slate-100">
                  {testResult.title}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[10px] font-mono">
                <span className={`px-2 py-0.5 rounded font-bold ${
                  testResult.status === "success" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                }`}>
                  HTTP {testResult.statusCode || (testResult.status === "success" ? 200 : 500)}
                </span>
                <span className="text-slate-400">{testResult.timestamp}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              {testResult.message}
            </p>

            {testResult.requestHeaders && (
              <div className="text-[11px] font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Attached Request Headers:</span>
                {Object.entries(testResult.requestHeaders).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-slate-300">
                    <span className="text-cyan-400">{k}:</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {testResult.responsePayload && (
              <div className="text-[11px] font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Server Response Payload:</span>
                <pre className="text-slate-300 overflow-x-auto text-[10px] leading-relaxed">
                  {JSON.stringify(testResult.responsePayload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Interceptor Event Stream Terminal */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-mono font-bold text-slate-200 uppercase">
              LIVE INTERCEPTOR EVENT STREAM ({logs.length})
            </h4>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono text-slate-400">Auto-capturing request & response lifecycle</span>
            <button
              onClick={() => {
                clearInterceptorLogs();
                setLogs([]);
              }}
              className="text-[10px] font-mono text-slate-400 hover:text-rose-400 flex items-center space-x-1 cursor-pointer"
              title="Clear event logs"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">
              No interceptor events recorded yet. Run a test above or navigate the app to generate network traffic.
            </div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id} 
                className="p-2.5 bg-slate-900/70 border border-slate-800/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  {getEventBadge(log.type)}
                  <span className="text-cyan-400 font-bold text-[11px]">{log.method || "HTTP"}</span>
                  <span className="text-slate-300 text-[11px] break-all">{log.url}</span>
                </div>

                <div className="flex items-center space-x-2 text-[10px] text-slate-400 shrink-0">
                  {log.apiKeyAttached && (
                    <span className="text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded">
                      Key: {log.apiKeyAttached}
                    </span>
                  )}
                  {log.statusCode && (
                    <span className={`font-bold ${log.statusCode === 401 ? "text-rose-400" : "text-emerald-400"}`}>
                      {log.statusCode}
                    </span>
                  )}
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
