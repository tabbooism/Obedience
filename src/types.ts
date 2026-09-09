export type UserRole = 
  | "Lead Investigator"
  | "Threat Hunter"
  | "Red Team Operator"
  | "Compliance Auditor"
  | "Facility Security Officer"
  | "Executive Viewer";

export type ActiveTab = 
  | "graph" 
  | "anomalies"
  | "redteam" 
  | "payloads"
  | "threats" 
  | "people" 
  | "background" 
  | "masterkeys"
  | "keys" 
  | "audit" 
  | "reports" 
  | "automations"
  | "api"
  | "copilot";

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  thinking?: string;
  timestamp?: string;
}

export type EntityType = 
  | "person"
  | "organization"
  | "ip_address"
  | "domain"
  | "crypto_wallet"
  | "location"
  | "vehicle"
  | "digital_key"
  | "threat_actor";

export interface GraphNode {
  id: string;
  label: string;
  type: EntityType;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  riskScore: number; // 0 - 100
  confidence: number; // 0 - 100
  classification: "Unclassified" | "Confidential" | "Secret" | "Top Secret/SCI";
  tags: string[];
  attributes: Record<string, string | number | boolean>;
  notes?: string;
  isFlagged?: boolean;
  avatarUrl?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type?: 
    | "financial_transfer"
    | "owns"
    | "communicated_with"
    | "affiliated_with"
    | "c2_traffic"
    | "physical_access"
    | "co_conspirator"
    | "shares_infrastructure"
    | string;
  confidence: number; // 0 - 100
  weight?: number;
  riskWeight?: number;
  isDirectional?: boolean;
  timestamp?: string;
  details?: string;
}

export interface ThreatFeedItem {
  id: string;
  title: string;
  source: string;
  severity: "critical" | "high" | "medium" | "low";
  timestamp: string;
  description: string;
  iocValue: string;
  iocType: "IP" | "Hash" | "Domain" | "Email" | "Wallet" | "CVE" | string;
  mitreTechnique?: string;
  affectedEntities: string[];
  status: "active" | "mitigated" | "investigating";
  rawJson?: string;
}

export interface PersonProfile {
  id: string;
  fullName: string;
  aliases: string[];
  badgeId: string;
  email: string;
  phone: string;
  nationalIdHash: string;
  organization: string;
  roleTitle: string;
  clearanceLevel: "Unclassified" | "Secret" | "Top Secret" | "Top Secret/SCI";
  clearanceStatus: "Active" | "Under Investigation" | "Suspended" | "Revoked";
  riskScore: number;
  criminalRecordCount: number;
  masterKeysAssigned: string[];
  associatedIps: string[];
  lastLocation: string;
  lastAccessTime: string;
  photoUrl?: string;
  bio: string;
  flightLogs: { date: string; destination: string; flightNo: string; risk: "low" | "medium" | "high" }[];
}

export interface BackgroundRecord {
  id: string;
  personId: string;
  personName: string;
  docketNumber: string;
  jurisdiction: string;
  offense: string;
  category: "Financial Fraud" | "Cyber Espionage" | "Sanction Violation" | "Unauthorized Access" | "Extortion" | "Clean Record" | string;
  dateOfRecord: string;
  disposition: "Convicted" | "Active Warrant" | "Plea Agreement" | "Pending Trial" | "Sanction Listed" | "Dismissed" | string;
  severityScore: number;
  registrySource: "INTERPOL Red Notice" | "OFAC SDN List" | "US Federal Court" | "Europol Cyber Vault" | "Regional Municipal Court" | string;
  caseSummary: string;
  verificationStatus: "Verified" | "Under Review" | "Expunged";
}

export interface MasterKeyItem {
  id: string;
  keyName: string;
  category?: "Physical SCIF" | "Server Room HSM" | "Cloud KMS Root" | "Zero-Trust Mesh" | "Air-Gapped Terminal" | string;
  facilityLocation?: string;
  securityZone?: "Zone 1 (Perimeter)" | "Zone 2 (Secured Office)" | "Zone 3 (Data Center)" | "Zone 4 (SCIF Class A)" | "Zone 5 (Bunker HSM)" | string;
  currentStatus: "Active" | "Rotating" | "Quorum Locked" | "EMERGENCY SUSPENDED";
  assignedHolders?: { name: string; badgeId: string; role: string; authorizedUntil: string }[];
  lastAccessed: string;
  accessCount24h?: number;
  anomalyDetected: boolean;
  anomalyReason?: string;
  quorumRequired: number;
  quorumApproved: number;
  encryptionAlgorithm?: string;
  publicKeyPem?: string;
  fingerprint?: string;
  keyType?: string;
  accessScope?: string;
  authorizedRoles?: UserRole[];
  currentCustodian?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  user?: string;
  actorRole: UserRole;
  userRole?: UserRole;
  action: string;
  target: string;
  targetEntity?: string;
  category: "Access Control" | "Graph Modification" | "AI Query" | "Key Revocation" | "Report Export" | "Red Team Simulation" | "Compliance & Vetting" | "Offensive Testing" | string;
  status: "Success" | "Blocked" | "Warning" | "Requires Quorum";
  ipAddress?: string;
  sha256Proof?: string;
  hash?: string;
  justification: string;
  integrityVerified?: boolean;
}

export interface VulnerabilityAsset {
  id: string;
  cveId: string;
  name: string;
  affectedHost: string;
  cvssScore: number;
  attackVector: "Network" | "Adjacent" | "Local" | "Physical";
  exploitAvailability: "Public PoC" | "Active In Wild" | "Theoretical" | "Weaponized";
  mitreTactic: string;
  status: "Unpatched" | "Simulated Exploit" | "Mitigated" | "Quarantined";
  remediation: string;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  triggerEvent: string;
  condition: string;
  actions: string[];
  isEnabled: boolean;
  lastExecution?: string;
  executionCount: number;
}

export interface SOARIntegration {
  id: string;
  name: string;
  category: "Threat Intel" | "Endpoint & SIEM" | "Vulnerability Scanner" | "SOAR Orchestrator";
  status: "Connected" | "Degraded" | "Syncing" | "Offline";
  lastPing: string;
  eventsProcessedToday: number;
  apiKeyMasked: string;
}

export interface GeneratedReport {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  author: string;
  riskRating: "CRITICAL" | "HIGH" | "ELEVATED" | "GUARDED";
  threatScore: number;
  contentMarkdown: string;
  tags: string[];
}

export interface PayloadArtifact {
  id: string;
  name: string;
  targetOS: "windows" | "linux" | "macos" | "web" | "cloud" | "network";
  architecture: "x64" | "x86" | "arm64" | "any";
  category: "reverse_shell" | "stager" | "process_injection" | "lolbas" | "cloud_escape" | "web_probe" | "persistence";
  language: "powershell" | "bash" | "python" | "csharp" | "c" | "yaml" | "raw";
  filename: string;
  rawCode: string;
  obfuscatedCode?: string;
  obfuscationMethod?: "none" | "base64" | "xor_mask" | "hex_array" | "env_var_concat" | "ps_backtick_mask";
  lhost: string;
  lport: number | string;
  evasionLevel: "standard" | "high" | "hardened_edr";
  edrTarget?: string;
  mitreTechniques: string[];
  yaraRule?: string;
  sigmaRule?: string;
  edrEvasionAnalysis?: string;
  riskScore: number;
  createdAt: string;
}

export interface PayloadAnalysisResult {
  entropy: number;
  entropyClassification: string;
  lengthBytes: number;
  detectedIps: string[];
  detectedUrls: string[];
  suspiciousApis: string[];
  estimatedThreatLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  deobfuscatedPreview: string;
  mitreMapping: string[];
  behavioralSummary: string;
  recommendedQuarantineAction: string;
  yaraRule?: string;
}

export type AnomalyAlgorithmType = 
  | "isolation_forest" 
  | "local_outlier_factor" 
  | "graph_topology" 
  | "robust_zscore_mad" 
  | "temporal_beaconing" 
  | "vulnerability_correlation";

export type AnomalySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface FeatureDeviation {
  feature: string;
  observed: number | string;
  baseline: number | string;
  deviationZ?: number;
  description?: string;
}

export interface DetectedAnomaly {
  id: string;
  entityId: string;
  entityLabel: string;
  entityType: EntityType | "network_flow" | "user_session" | "endpoint" | string;
  algorithm: AnomalyAlgorithmType;
  algorithmName: string;
  anomalyScore: number; // 0 - 100
  severity: AnomalySeverity;
  title: string;
  description: string;
  mathematicalBasis: string;
  deviatingFeatures: FeatureDeviation[];
  potentialIncident: boolean;
  incidentType?: string;
  vulnerabilityDetails?: {
    cveId?: string;
    cvss?: number;
    attackVector?: string;
  };
  mitreTechnique?: string;
  recommendedAction: string;
  timestamp: string;
  status: "Active" | "Investigating" | "Quarantined" | "Dismissed";
}

export interface AnomalySuiteConfig {
  enabledAlgorithms: Record<AnomalyAlgorithmType, boolean>;
  contaminationRate: number; // 0.01 to 0.35 (default: 0.10)
  isolationTreesCount: number; // default: 100
  subsampleSize: number; // default: 256
  lofKNeighbors: number; // default: 15
  zScoreThreshold: number; // default: 3.5
  beaconingJitterMax: number; // default: 0.15 (coefficient of variation)
  minConfidence: number; // default: 60
}

export interface TelemetryRecord {
  id: string;
  timestamp: string;
  sourceIp: string;
  destIp: string;
  sourcePort: number;
  destPort: number;
  protocol: "TCP" | "UDP" | "HTTPS" | "DNS" | "SSH" | string;
  bytesTransferred: number;
  durationMs: number;
  action: "ALLOW" | "BLOCK" | "ALERT";
  user?: string;
  anomalyFlags?: string[];
  isGroundTruthAnomaly?: boolean;
}

export interface AnomalyBenchmarkResult {
  totalRecordsProcessed: number;
  totalAnomaliesDetected: number;
  executionTimeMs: number;
  throughputPerSec: number;
  algorithmBreakdown: Record<string, number>;
  criticalIncidentsCount: number;
  highSeverityCount: number;
}

