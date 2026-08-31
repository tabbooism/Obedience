import React from "react";
import { 
  Network, 
  Crosshair, 
  Flame, 
  UserCheck, 
  Scale, 
  KeyRound, 
  FileText, 
  Workflow, 
  ShieldCheck, 
  Bot,
  Activity,
  Layers,
  Terminal
} from "lucide-react";
import { ActiveTab } from "../types";

export type { ActiveTab };

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeThreatCount: number;
  anomalyCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeThreatCount,
  anomalyCount,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const menuItems = [
    {
      id: "graph" as ActiveTab,
      label: "Relationship Map",
      sublabel: "Data Links & Graph Canvas",
      icon: Network,
      badge: anomalyCount > 0 ? `${anomalyCount} Anomaly` : undefined,
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    {
      id: "redteam" as ActiveTab,
      label: "Red Team & Posture",
      sublabel: "MITRE ATT&CK & Simulations",
      icon: Crosshair,
      badge: "64% Def",
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
    {
      id: "payloads" as ActiveTab,
      label: "Payload Studio",
      sublabel: "Advanced Generator & Obfuscation",
      icon: Terminal,
      badge: "EDR Bypass",
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
    {
      id: "threats" as ActiveTab,
      label: "Threat Intelligence",
      sublabel: "Real-time Alerts & CTI",
      icon: Flame,
      badge: activeThreatCount > 0 ? `${activeThreatCount} Live` : undefined,
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
    {
      id: "people" as ActiveTab,
      label: "People Lookup",
      sublabel: "Personnel & Clearance Vetting",
      icon: UserCheck,
    },
    {
      id: "background" as ActiveTab,
      label: "Criminal & Legal Vetting",
      sublabel: "Regional Registries & OFAC",
      icon: Scale,
    },
    {
      id: "masterkeys" as ActiveTab,
      label: "Master Key Vault",
      sublabel: "SCIF & KMS HSM Access",
      icon: KeyRound,
      badge: "1 Locked",
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    },
    {
      id: "audit" as ActiveTab,
      label: "Compliance Audit Logs",
      sublabel: "Immutable SHA-256 Trail",
      icon: ShieldCheck,
    },
    {
      id: "automations" as ActiveTab,
      label: "SOAR Workflows & APIs",
      sublabel: "REST APIs & Playbooks",
      icon: Workflow,
    },
    {
      id: "reports" as ActiveTab,
      label: "Automated Reports",
      sublabel: "AI Dossier Generator",
      icon: FileText,
    },
    {
      id: "copilot" as ActiveTab,
      label: "AI Tactical Terminal",
      sublabel: "Gemini High Thinking Engine",
      icon: Bot,
      badge: "AI 3.1 Pro",
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    },
  ];

  const handleItemClick = (id: ActiveTab) => {
    setActiveTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderNavContent = () => (
    <>
      {/* Navigation Links */}
      <div className="p-3 space-y-1 overflow-y-auto flex-1">
        <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>OPERATIONAL MODULES</span>
          <Layers className="w-3 h-3 text-slate-400" />
        </div>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all group min-h-[44px] ${
                isActive
                  ? "bg-cyan-500/15 border border-cyan-500/40 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 border border-transparent"
              }`}
            >
              <div className="flex items-center space-x-3 truncate">
                <div
                  className={`p-1.5 rounded-md transition-colors shrink-0 ${
                    isActive
                      ? "bg-cyan-500 text-slate-950 font-bold"
                      : "bg-slate-800 text-slate-400 group-hover:text-cyan-300 group-hover:bg-slate-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <p className={`text-xs font-semibold truncate ${isActive ? "text-cyan-200" : "text-slate-200"}`}>
                    {item.label}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{item.sublabel}</p>
                </div>
              </div>

              {item.badge && (
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ml-2 shrink-0 ${
                    item.badgeColor || "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer System Telemetry Status */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0">
        <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-2.5 space-y-1.5 font-mono text-[10px]">
          <div className="flex items-center justify-between text-slate-400">
            <span>NETWORK POSTURE</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Activity className="w-2.5 h-2.5 animate-pulse" /> ENCRYPTED
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-amber-500 h-full w-[88%]" />
          </div>
          <div className="flex justify-between text-slate-400 pt-0.5">
            <span>SOC2 / ISO 27001</span>
            <span className="text-cyan-300">100% COMPLIANT</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900/95 border-r border-slate-800 flex-col justify-between shrink-0 select-none h-full">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer Backdrop & Sliding Panel */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop Overlay */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Sidebar */}
          <div className="relative w-72 xs:w-80 max-w-[85vw] bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col justify-between z-10 h-full overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                TACTICAL NAVIGATION
              </span>
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-mono"
              >
                ✕ CLOSE
              </button>
            </div>
            {renderNavContent()}
          </div>
        </div>
      )}
    </>
  );
};
