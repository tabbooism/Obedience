// Workspace Storage manager for Live Operations

export interface LiveWorkspaceState {
  nodes: any[];
  edges: any[];
  threats: any[];
  profiles: any[];
  backgroundRecords: any[];
  masterKeys: any[];
  auditLogs: any[];
  vulnerabilities: any[];
  lastUpdated: string;
}

const STORAGE_KEY = "aegis_live_ops_workspace_v2";

export function loadLiveWorkspace(): Partial<LiveWorkspaceState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load workspace:", e);
    return null;
  }
}

export function saveLiveWorkspace(data: LiveWorkspaceState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save workspace:", e);
  }
}

export function clearLiveWorkspace(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear workspace:", e);
  }
}

export function exportWorkspaceJson(data: LiveWorkspaceState, filename = "aegis_live_ops_dossier.json"): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
