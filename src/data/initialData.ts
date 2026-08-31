import { 
  GraphNode, 
  GraphEdge, 
  ThreatFeedItem, 
  PersonProfile, 
  BackgroundRecord, 
  MasterKeyItem, 
  AuditLogEntry, 
  VulnerabilityAsset 
} from "../types";

// Clean Live Ops Initial State (Zero Mock Data)
export const initialGraphNodes: GraphNode[] = [];
export const initialGraphEdges: GraphEdge[] = [];
export const initialThreatFeeds: ThreatFeedItem[] = [];
export const initialPeopleProfiles: PersonProfile[] = [];
export const initialBackgroundRecords: BackgroundRecord[] = [];
export const initialMasterKeys: MasterKeyItem[] = [];
export const initialVulnerabilities: VulnerabilityAsset[] = [];

// Genesis live operational audit log
export const initialAuditLogs: AuditLogEntry[] = [
  {
    id: `log-genesis-${Date.now()}`,
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    actor: "System Kernel",
    user: "System Kernel",
    actorRole: "Lead Investigator",
    userRole: "Lead Investigator",
    action: "LIVE_OPS_INITIALIZED",
    target: "Command Center Workspace",
    targetEntity: "Command Center Workspace",
    category: "Access Control",
    status: "Success",
    ipAddress: "127.0.0.1",
    justification: "Live Operations environment initialized. Mock datasets purged. Ready for live target ingestion and CTI streaming.",
    sha256Proof: "0000000000000000a1b2c3d4e5f67890123456789abcdef0123456789abcdef0",
    hash: "0000000000000000a1b2c3d4e5f67890123456789abcdef0123456789abcdef0",
    integrityVerified: true,
  },
];
