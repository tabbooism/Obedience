import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  Key, 
  Lock, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Sparkles,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { 
  onAuthRequired, 
  AuthRequiredContext, 
  setApiKey, 
  getApiKey, 
  DEFAULT_CREDENTIALS,
  setRefreshToken,
  logInterceptorEvent
} from "../../utils/apiClient";
import { UserRole } from "../../types";

interface ReAuthModalProps {
  // Optional controlled props if parent wants to control visibility
  isOpen?: boolean;
  onClose?: () => void;
  currentUserRole?: UserRole;
  onAuditLog?: (action: string, target: string, justification: string) => void;
}

export const ReAuthModal: React.FC<ReAuthModalProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  currentUserRole = "Lead Investigator",
  onAuditLog,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [authContext, setAuthContext] = useState<AuthRequiredContext | null>(null);

  // Form State
  const [inputApiKey, setInputApiKey] = useState("");
  const [showKeyText, setShowKeyText] = useState(false);
  const [badgeId, setBadgeId] = useState("AEGIS-OP-8821");
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUserRole);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Determine actual visibility
  const isVisible = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  // Listen to 401 interceptor notifications
  useEffect(() => {
    const unsubscribe = onAuthRequired((context) => {
      setAuthContext(context);
      setInputApiKey(context.currentApiKey || getApiKey());
      setErrorMessage(null);
      setSuccessMessage(null);
      setInternalIsOpen(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Update role if prop changes
  useEffect(() => {
    setSelectedRole(currentUserRole);
  }, [currentUserRole]);

  const handleClose = () => {
    if (authContext) {
      try {
        authContext.cancelRequest("Operator dismissed re-authentication modal");
      } catch (e) {
        // Ignored
      }
    }
    setInternalIsOpen(false);
    if (controlledOnClose) {
      controlledOnClose();
    }
    setAuthContext(null);
  };

  const handleGenerateFreshKey = () => {
    const randomHex = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const newKey = `aegis_sec_live_${randomHex}`;
    setInputApiKey(newKey);
    setErrorMessage(null);
  };

  const handleUseDefaultKey = () => {
    setInputApiKey(DEFAULT_CREDENTIALS.API_KEY);
    setErrorMessage(null);
  };

  const handleCopyKey = () => {
    if (!inputApiKey) return;
    navigator.clipboard.writeText(inputApiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleAuthenticateAndRetry = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!inputApiKey || inputApiKey.trim().length < 8) {
      setErrorMessage("Please provide a valid API Key (minimum 8 characters).");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const cleanKey = inputApiKey.trim();

    try {
      // Persist the verified API key and replenish refresh token
      setApiKey(cleanKey);
      const newRefreshToken = `aegis_ref_tok_${Date.now().toString(16)}_${Math.random().toString(36).substring(2, 7)}`;
      setRefreshToken(newRefreshToken);

      logInterceptorEvent({
        type: "reauth_completed",
        url: authContext?.failedUrl || "/api/auth/reauthenticate",
        message: `Operator re-authenticated with clearance [${selectedRole}], badge [${badgeId}]. Replaying blocked requests...`,
        apiKeyAttached: `${cleanKey.substring(0, 14)}...`,
      });

      if (onAuditLog) {
        onAuditLog(
          "Session Re-Authentication",
          authContext?.failedUrl || "Axios Interceptor Auth Boundary",
          `User re-authenticated following 401 Unauthorized via Modal (Role: ${selectedRole}, Badge: ${badgeId})`
        );
      }

      setSuccessMessage("Authentication verified. Replaying blocked requests...");

      // Retry original request if context exists
      if (authContext && authContext.retryRequest) {
        await authContext.retryRequest(cleanKey);
      }

      setTimeout(() => {
        setIsSubmitting(false);
        setInternalIsOpen(false);
        if (controlledOnClose) {
          controlledOnClose();
        }
        setAuthContext(null);
      }, 600);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || "Failed to re-authenticate or retry request.");
    }
  };

  if (!isVisible) return null;

  const failureReasonLabel = () => {
    if (!authContext) return "Manual Authentication Verification";
    switch (authContext.reason) {
      case "unauthorized_401":
        return "401 Unauthorized: Invalid or Revoked API Key";
      case "refresh_failed":
        return "Automatic Session Refresh Failed: Refresh Token Expired";
      case "no_refresh_token":
        return "No Refresh Token Available in Storage";
      case "token_expired":
        return "Session Token Expired";
      default:
        return "Authentication Verification Required";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl shadow-amber-950/40 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Warning Accent Bar */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" />

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5 animate-bounce" style={{ animationDuration: "2s" }} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-100 font-mono tracking-wide">
                  SECURITY RE-AUTHENTICATION REQUIRED
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  HTTP 401
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Axios Interceptor caught an unauthorized boundary response
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors"
            title="Dismiss Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleAuthenticateAndRetry} className="p-5 space-y-4 overflow-y-auto">
          {/* Failure Context Box */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-lg space-y-2">
            <div className="flex items-start justify-between text-xs font-mono">
              <span className="text-slate-400">Trigger Reason:</span>
              <span className="text-amber-400 font-semibold text-right">{failureReasonLabel()}</span>
            </div>
            {authContext?.failedUrl && (
              <div className="flex items-start justify-between text-xs font-mono">
                <span className="text-slate-400">Blocked Endpoint:</span>
                <span className="text-cyan-400 font-bold break-all ml-2">{authContext.failedUrl}</span>
              </div>
            )}
            <div className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2">
              The application's Axios interceptor automatically intercepted this request. To resume operations without data loss, enter a valid operator API key below or select a preset credential.
            </div>
          </div>

          {/* API Key Input Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-semibold text-slate-300 flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                <span>USER API KEY (ATTACHED TO OUTGOING REQUESTS)</span>
              </label>
              <div className="flex items-center space-x-1.5 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={handleUseDefaultKey}
                  className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                >
                  Use Default
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={handleGenerateFreshKey}
                  className="text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  Generate Fresh
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type={showKeyText ? "text" : "password"}
                value={inputApiKey}
                onChange={(e) => setInputApiKey(e.target.value)}
                placeholder="e.g., aegis_sec_live_9f81a702b8d9102c91823746a5b"
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg pl-3 pr-20 py-2 text-xs font-mono text-slate-200 placeholder-slate-600"
                autoFocus
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setShowKeyText(!showKeyText)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                  title={showKeyText ? "Hide API Key" : "Show API Key"}
                >
                  {showKeyText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="p-1 text-slate-400 hover:text-slate-200"
                  title="Copy Key to Clipboard"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              The interceptor will inject this key into both the <code className="text-cyan-400 font-semibold">Authorization: Bearer</code> and <code className="text-cyan-400 font-semibold">X-API-Key</code> headers.
            </p>
          </div>

          {/* Clearance & Badge Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono font-semibold text-slate-300 flex items-center space-x-1">
                <Lock className="w-3 h-3 text-cyan-400" />
                <span>OPERATOR CLEARANCE</span>
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:border-cyan-500"
              >
                <option value="Lead Investigator">Lead Investigator</option>
                <option value="Threat Hunter">Threat Hunter</option>
                <option value="Red Team Operator">Red Team Operator</option>
                <option value="Compliance Auditor">Compliance Auditor</option>
                <option value="Facility Security Officer">Facility Security Officer</option>
                <option value="Executive Viewer">Executive Viewer</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-semibold text-slate-300">
                SECURITY BADGE ID
              </label>
              <input
                type="text"
                value={badgeId}
                onChange={(e) => setBadgeId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Feedback Banners */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-mono flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-mono flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold transition-colors cursor-pointer"
            >
              Cancel & Abort Request
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-gradient-to-r from-amber-600 via-cyan-600 to-blue-600 hover:from-amber-500 hover:via-cyan-500 hover:to-blue-500 text-white text-xs font-mono font-bold flex items-center justify-center space-x-2 shadow-lg shadow-cyan-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>RE-AUTHENTICATING & RETRYING...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  <span>AUTHENTICATE & RETRY REQUEST</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
