import React, { useState } from "react";
import { 
  Shield, 
  Search, 
  Radio, 
  Sparkles, 
  Lock,
  Flame,
  Menu,
  X,
  Key
} from "lucide-react";
import { UserRole } from "../types";

interface HeaderProps {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  activeInvestigationName: string;
  onOpenAICopilot: () => void;
  threatAlertCount: number;
  onOpenThreats: () => void;
  onQuickSearch: (query: string) => void;
  searchQuery: string;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  onOpenGlobalSearch?: () => void;
  onOpenReauthModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  setCurrentRole,
  activeInvestigationName,
  onOpenAICopilot,
  threatAlertCount,
  onOpenThreats,
  onQuickSearch,
  searchQuery,
  isMobileMenuOpen = false,
  onToggleMobileMenu,
  onOpenGlobalSearch,
  onOpenReauthModal,
}) => {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const roles: UserRole[] = [
    "Lead Investigator",
    "Threat Hunter",
    "Red Team Operator",
    "Compliance Auditor",
    "Facility Security Officer",
    "Executive Viewer"
  ];

  return (
    <header className="h-16 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between z-30 sticky top-0 shrink-0">
      {/* Left: Mobile Menu Trigger + Branding & Active Investigation */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 text-cyan-400" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30 shrink-0">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="truncate">
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold tracking-wider text-xs sm:text-sm text-slate-100 uppercase font-mono truncate">
                Aegis<span className="text-cyan-400">OSINT</span>
              </span>
              <span className="hidden xs:flex text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
                <span className="hidden sm:inline">SEC-NET</span> V4.2
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate max-w-[130px] sm:max-w-[200px] md:max-w-xs font-mono">
              <span className="hidden sm:inline">ACTIVE: </span>
              <span className="text-slate-200 font-semibold">{activeInvestigationName}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Center: Global Search Bar (Desktop) */}
      <div className="hidden md:flex items-center max-w-md w-full mx-4">
        <div 
          onClick={onOpenGlobalSearch}
          className="relative w-full cursor-pointer group"
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-cyan-400 transition-colors pointer-events-none" />
          <input
            type="text"
            readOnly
            placeholder="Global search: Nodes, Background, Threats, Keys..."
            value={searchQuery}
            onClick={onOpenGlobalSearch}
            className="w-full bg-slate-950/70 border border-slate-700/80 group-hover:border-cyan-500/60 rounded-lg pl-9 pr-20 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono transition-all cursor-pointer select-none"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700 rounded shadow-sm group-hover:text-cyan-300 group-hover:border-cyan-500/40">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Mobile Search Overlay Bar */}
      {isMobileSearchOpen && (
        <div className="absolute inset-x-0 top-16 bg-slate-900 border-b border-slate-800 p-2.5 shadow-2xl z-40 md:hidden flex items-center space-x-2">
          <button
            onClick={() => {
              setIsMobileSearchOpen(false);
              if (onOpenGlobalSearch) onOpenGlobalSearch();
            }}
            className="relative flex-1 bg-slate-950 border border-cyan-500/50 rounded-lg pl-9 pr-4 py-2 text-xs text-left text-slate-300 font-mono flex items-center"
          >
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
            <span className="truncate">{searchQuery || "Search all cross-module data..."}</span>
          </button>
          <button
            onClick={() => setIsMobileSearchOpen(false)}
            className="px-2.5 py-2 text-xs font-mono text-slate-300 bg-slate-800 rounded-lg"
          >
            Close
          </button>
        </div>
      )}

      {/* Right: Role Switcher, Threats Alert, Mobile Search Button, AI Copilot */}
      <div className="flex items-center space-x-1.5 sm:space-x-3">
        {/* Mobile Search Toggle */}
        <button
          onClick={() => {
            if (onOpenGlobalSearch) {
              onOpenGlobalSearch();
            } else {
              setIsMobileSearchOpen(!isMobileSearchOpen);
            }
          }}
          className="md:hidden p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white min-w-[38px] min-h-[38px] flex items-center justify-center"
          title="Open Global Search (Nodes, Threats, Dossiers, Keys)"
        >
          <Search className="w-4 h-4 text-cyan-400" />
        </button>

        {/* Threat Alert Ticker Button */}
        <button
          onClick={onOpenThreats}
          className="relative px-2 sm:px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 text-xs font-mono font-medium flex items-center space-x-1 sm:space-x-1.5 transition-all shadow-sm min-h-[38px]"
          title="Threat Feeds & Real-time Alerts"
        >
          <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          <span className="hidden sm:inline">ALERTS:</span>
          <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
            {threatAlertCount}
          </span>
        </button>

        {/* API Key / Session Status Badge */}
        {onOpenReauthModal && (
          <button
            onClick={onOpenReauthModal}
            id="header-btn-api-key-status"
            className="hidden sm:flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 text-xs font-mono transition-all min-h-[38px] cursor-pointer"
            title="Axios Interceptor API Key Status - Click to inspect credentials or trigger re-authentication"
          >
            <Key className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xl:inline text-[10px] text-emerald-400 font-bold">KEY:</span>
            <span className="text-[11px] font-bold text-emerald-300">ACTIVE</span>
          </button>
        )}

        {/* Granular RBAC Role Selector */}
        <div className="flex items-center space-x-1 bg-slate-950/80 border border-slate-800 rounded-lg px-1.5 sm:px-2 py-1 min-h-[38px]">
          <Lock className="w-3 h-3 text-cyan-400 hidden sm:inline" />
          <span className="text-[11px] text-slate-400 font-mono hidden lg:inline mr-1">ROLE:</span>
          <select
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value as UserRole)}
            className="bg-transparent text-[11px] sm:text-xs text-cyan-300 font-mono font-semibold focus:outline-none cursor-pointer max-w-[90px] xs:max-w-[120px] sm:max-w-none truncate"
          >
            {roles.map((r) => (
              <option key={r} value={r} className="bg-slate-900 text-slate-200">
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* AI Tactical Copilot Trigger */}
        <button
          onClick={onOpenAICopilot}
          className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-900/30 border border-cyan-400/40 transition-all cursor-pointer min-h-[38px] shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-200 animate-spin" style={{ animationDuration: "6s" }} />
          <span className="hidden sm:inline">AI COPILOT</span>
          <span className="sm:hidden text-[11px] font-mono">AI</span>
        </button>
      </div>
    </header>
  );
};
