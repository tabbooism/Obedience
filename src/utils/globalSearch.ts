import { 
  GraphNode, 
  ThreatFeedItem, 
  BackgroundRecord, 
  PersonProfile, 
  MasterKeyItem, 
  AuditLogEntry, 
  ActiveTab 
} from "../types";

export type SearchCategory = 
  | "all" 
  | "nodes" 
  | "threats" 
  | "background" 
  | "people" 
  | "masterkeys" 
  | "audit";

export interface MatchedField {
  field: string;
  snippet: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  module: ActiveTab;
  moduleLabel: string;
  category: SearchCategory;
  iconType: "node" | "threat" | "background" | "person" | "key" | "audit";
  riskScore?: number;
  severity?: "critical" | "high" | "medium" | "low";
  badge: string;
  badgeColor: string;
  matchedFields: MatchedField[];
  targetId: string;
  targetFilter: string;
  timestamp?: string;
  score: number;
  rawItem: any;
}

export interface GlobalSearchResults {
  items: SearchResultItem[];
  stats: {
    total: number;
    nodes: number;
    threats: number;
    background: number;
    people: number;
    masterkeys: number;
    audit: number;
  };
}

function createSnippet(text: string, queryTerms: string[], maxLen = 85): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  let firstIdx = -1;
  for (const term of queryTerms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }

  if (firstIdx === -1) {
    return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
  }

  const start = Math.max(0, firstIdx - 20);
  const end = Math.min(text.length, firstIdx + maxLen - 20);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}

export function searchCrossModuleData(
  query: string,
  data: {
    nodes: GraphNode[];
    threats: ThreatFeedItem[];
    backgroundRecords: BackgroundRecord[];
    profiles: PersonProfile[];
    masterKeys: MasterKeyItem[];
    auditLogs: AuditLogEntry[];
  },
  activeCategory: SearchCategory = "all"
): GlobalSearchResults {
  const trimmed = query.trim();
  const rawTerms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);

  const results: SearchResultItem[] = [];
  const counts = {
    total: 0,
    nodes: 0,
    threats: 0,
    background: 0,
    people: 0,
    masterkeys: 0,
    audit: 0,
  };

  // If query is empty, return high-risk priority previews or top items
  if (rawTerms.length === 0) {
    // Top critical nodes
    data.nodes.slice(0, 4).forEach((n) => {
      counts.nodes++;
      counts.total++;
      results.push({
        id: `node-${n.id}`,
        title: n.label,
        subtitle: `Type: ${n.type.toUpperCase()} • Classification: ${n.classification}`,
        module: "graph",
        moduleLabel: "Relationship Graph",
        category: "nodes",
        iconType: "node",
        riskScore: n.riskScore,
        badge: `${n.type}`,
        badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
        matchedFields: [{ field: "Entity", snippet: `${n.label} (${n.classification})` }],
        targetId: n.id,
        targetFilter: n.label,
        score: (n.riskScore || 50) + 10,
        rawItem: n,
      });
    });

    // Top threats
    data.threats.slice(0, 4).forEach((t) => {
      counts.threats++;
      counts.total++;
      results.push({
        id: `threat-${t.id}`,
        title: t.title,
        subtitle: `IoC: ${t.iocValue} (${t.iocType}) • Source: ${t.source}`,
        module: "threats",
        moduleLabel: "Threat Feeds",
        category: "threats",
        iconType: "threat",
        severity: t.severity,
        badge: t.severity.toUpperCase(),
        badgeColor: 
          t.severity === "critical" 
            ? "bg-rose-500/15 text-rose-400 border-rose-500/40" 
            : t.severity === "high" 
            ? "bg-amber-500/15 text-amber-400 border-amber-500/40" 
            : "bg-blue-500/15 text-blue-400 border-blue-500/40",
        matchedFields: [{ field: "IOC", snippet: `${t.iocValue} - ${t.description}` }],
        targetId: t.id,
        targetFilter: t.iocValue || t.title,
        timestamp: t.timestamp,
        score: t.severity === "critical" ? 95 : t.severity === "high" ? 85 : 70,
        rawItem: t,
      });
    });

    // Top background records
    data.backgroundRecords.slice(0, 3).forEach((r) => {
      counts.background++;
      counts.total++;
      results.push({
        id: `bg-${r.id}`,
        title: `${r.personName} - ${r.offense}`,
        subtitle: `Docket: ${r.docketNumber} • ${r.registrySource} • Status: ${r.disposition}`,
        module: "background",
        moduleLabel: "Background Checks",
        category: "background",
        iconType: "background",
        riskScore: r.severityScore,
        badge: r.category,
        badgeColor: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
        matchedFields: [{ field: "Case", snippet: `${r.offense} (${r.disposition})` }],
        targetId: r.id,
        targetFilter: r.personName,
        score: r.severityScore,
        rawItem: r,
      });
    });

    // Top people profiles
    data.profiles.slice(0, 3).forEach((p) => {
      counts.people++;
      counts.total++;
      results.push({
        id: `person-${p.id}`,
        title: p.fullName,
        subtitle: `Role: ${p.roleTitle} • Org: ${p.organization} • Badge: ${p.badgeId}`,
        module: "people",
        moduleLabel: "Personnel Registry",
        category: "people",
        iconType: "person",
        riskScore: p.riskScore,
        badge: p.clearanceLevel,
        badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        matchedFields: [{ field: "Identity", snippet: `${p.fullName} - ${p.organization} (${p.clearanceLevel})` }],
        targetId: p.id,
        targetFilter: p.fullName,
        score: p.riskScore,
        rawItem: p,
      });
    });

    const filtered = activeCategory === "all" 
      ? results 
      : results.filter((item) => item.category === activeCategory);

    return {
      items: filtered.sort((a, b) => b.score - a.score),
      stats: counts,
    };
  }

  // 1. Index & Query Graph Nodes
  data.nodes.forEach((node) => {
    let score = 0;
    const matches: MatchedField[] = [];
    const lowerLabel = node.label.toLowerCase();
    const lowerType = node.type.toLowerCase();
    const lowerNotes = (node.notes || "").toLowerCase();
    const lowerClass = (node.classification || "").toLowerCase();
    const tagsStr = (node.tags || []).join(" ").toLowerCase();
    const attrValues = Object.entries(node.attributes || {})
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(" ")
      .toLowerCase();

    for (const term of rawTerms) {
      if (lowerLabel.includes(term)) {
        score += lowerLabel === term ? 100 : 60;
        matches.push({ field: "Label", snippet: createSnippet(node.label, rawTerms) });
      }
      if (lowerType.includes(term)) {
        score += 35;
        matches.push({ field: "Type", snippet: createSnippet(node.type, rawTerms) });
      }
      if (tagsStr.includes(term)) {
        score += 30;
        matches.push({ field: "Tag", snippet: createSnippet((node.tags || []).join(", "), rawTerms) });
      }
      if (attrValues.includes(term)) {
        score += 25;
        matches.push({ field: "Attribute", snippet: createSnippet(attrValues, rawTerms) });
      }
      if (lowerNotes.includes(term)) {
        score += 20;
        matches.push({ field: "Notes", snippet: createSnippet(node.notes || "", rawTerms) });
      }
      if (lowerClass.includes(term)) {
        score += 15;
        matches.push({ field: "Classification", snippet: node.classification });
      }
    }

    if (score > 0) {
      counts.nodes++;
      counts.total++;
      results.push({
        id: `node-${node.id}`,
        title: node.label,
        subtitle: `Type: ${node.type.toUpperCase()} • Risk: ${node.riskScore}/100 • Classification: ${node.classification}`,
        module: "graph",
        moduleLabel: "Relationship Graph",
        category: "nodes",
        iconType: "node",
        riskScore: node.riskScore,
        badge: node.type.toUpperCase(),
        badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
        matchedFields: matches.slice(0, 2),
        targetId: node.id,
        targetFilter: node.label,
        score: score + (node.riskScore ? node.riskScore / 10 : 0),
        rawItem: node,
      });
    }
  });

  // 2. Index & Query Threat Feeds
  data.threats.forEach((threat) => {
    let score = 0;
    const matches: MatchedField[] = [];
    const lowerTitle = threat.title.toLowerCase();
    const lowerIoc = (threat.iocValue || "").toLowerCase();
    const lowerDesc = (threat.description || "").toLowerCase();
    const lowerSource = (threat.source || "").toLowerCase();
    const lowerMitre = (threat.mitreTechnique || "").toLowerCase();
    const lowerEntities = (threat.affectedEntities || []).join(" ").toLowerCase();

    for (const term of rawTerms) {
      if (lowerIoc.includes(term)) {
        score += lowerIoc === term ? 100 : 70;
        matches.push({ field: "IoC Value", snippet: createSnippet(threat.iocValue, rawTerms) });
      }
      if (lowerTitle.includes(term)) {
        score += 60;
        matches.push({ field: "Title", snippet: createSnippet(threat.title, rawTerms) });
      }
      if (lowerMitre.includes(term)) {
        score += 45;
        matches.push({ field: "MITRE ATT&CK", snippet: threat.mitreTechnique || "" });
      }
      if (lowerDesc.includes(term)) {
        score += 30;
        matches.push({ field: "Description", snippet: createSnippet(threat.description, rawTerms) });
      }
      if (lowerEntities.includes(term)) {
        score += 25;
        matches.push({ field: "Target", snippet: createSnippet((threat.affectedEntities || []).join(", "), rawTerms) });
      }
      if (lowerSource.includes(term)) {
        score += 20;
        matches.push({ field: "Source", snippet: threat.source });
      }
    }

    if (score > 0) {
      counts.threats++;
      counts.total++;
      results.push({
        id: `threat-${threat.id}`,
        title: threat.title,
        subtitle: `IoC: ${threat.iocValue} (${threat.iocType}) • Source: ${threat.source}`,
        module: "threats",
        moduleLabel: "Threat Feeds",
        category: "threats",
        iconType: "threat",
        severity: threat.severity,
        badge: threat.severity.toUpperCase(),
        badgeColor: 
          threat.severity === "critical" 
            ? "bg-rose-500/15 text-rose-400 border-rose-500/40" 
            : threat.severity === "high" 
            ? "bg-amber-500/15 text-amber-400 border-amber-500/40" 
            : "bg-blue-500/15 text-blue-400 border-blue-500/40",
        matchedFields: matches.slice(0, 2),
        targetId: threat.id,
        targetFilter: threat.iocValue || threat.title,
        timestamp: threat.timestamp,
        score: score + (threat.severity === "critical" ? 15 : threat.severity === "high" ? 10 : 0),
        rawItem: threat,
      });
    }
  });

  // 3. Index & Query Background Records
  data.backgroundRecords.forEach((record) => {
    let score = 0;
    const matches: MatchedField[] = [];
    const lowerName = record.personName.toLowerCase();
    const lowerOffense = record.offense.toLowerCase();
    const lowerDocket = record.docketNumber.toLowerCase();
    const lowerSource = record.registrySource.toLowerCase();
    const lowerCategory = (record.category || "").toLowerCase();
    const lowerSummary = (record.caseSummary || "").toLowerCase();
    const lowerJurisdiction = (record.jurisdiction || "").toLowerCase();

    for (const term of rawTerms) {
      if (lowerName.includes(term)) {
        score += lowerName === term ? 100 : 70;
        matches.push({ field: "Subject Name", snippet: createSnippet(record.personName, rawTerms) });
      }
      if (lowerDocket.includes(term)) {
        score += 80;
        matches.push({ field: "Docket #", snippet: record.docketNumber });
      }
      if (lowerOffense.includes(term)) {
        score += 50;
        matches.push({ field: "Offense", snippet: createSnippet(record.offense, rawTerms) });
      }
      if (lowerSummary.includes(term)) {
        score += 30;
        matches.push({ field: "Case Summary", snippet: createSnippet(record.caseSummary, rawTerms) });
      }
      if (lowerSource.includes(term)) {
        score += 25;
        matches.push({ field: "Registry", snippet: record.registrySource });
      }
      if (lowerCategory.includes(term)) {
        score += 20;
        matches.push({ field: "Category", snippet: record.category });
      }
      if (lowerJurisdiction.includes(term)) {
        score += 15;
        matches.push({ field: "Jurisdiction", snippet: record.jurisdiction });
      }
    }

    if (score > 0) {
      counts.background++;
      counts.total++;
      results.push({
        id: `bg-${record.id}`,
        title: `${record.personName} - ${record.offense}`,
        subtitle: `Docket: ${record.docketNumber} • ${record.registrySource} • Severity: ${record.severityScore}/100`,
        module: "background",
        moduleLabel: "Background Checks",
        category: "background",
        iconType: "background",
        riskScore: record.severityScore,
        badge: record.category,
        badgeColor: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
        matchedFields: matches.slice(0, 2),
        targetId: record.id,
        targetFilter: record.personName,
        score: score + (record.severityScore ? record.severityScore / 10 : 0),
        rawItem: record,
      });
    }
  });

  // 4. Index & Query Person Profiles
  data.profiles.forEach((profile) => {
    let score = 0;
    const matches: MatchedField[] = [];
    const lowerName = profile.fullName.toLowerCase();
    const lowerBadge = profile.badgeId.toLowerCase();
    const lowerEmail = profile.email.toLowerCase();
    const lowerOrg = profile.organization.toLowerCase();
    const lowerRole = profile.roleTitle.toLowerCase();
    const lowerAliases = (profile.aliases || []).join(" ").toLowerCase();
    const lowerClearance = profile.clearanceLevel.toLowerCase();
    const lowerBio = (profile.bio || "").toLowerCase();

    for (const term of rawTerms) {
      if (lowerName.includes(term)) {
        score += lowerName === term ? 100 : 70;
        matches.push({ field: "Full Name", snippet: createSnippet(profile.fullName, rawTerms) });
      }
      if (lowerBadge.includes(term)) {
        score += 85;
        matches.push({ field: "Badge ID", snippet: profile.badgeId });
      }
      if (lowerEmail.includes(term)) {
        score += 65;
        matches.push({ field: "Email", snippet: profile.email });
      }
      if (lowerAliases.includes(term)) {
        score += 55;
        matches.push({ field: "Alias", snippet: (profile.aliases || []).join(", ") });
      }
      if (lowerOrg.includes(term) || lowerRole.includes(term)) {
        score += 35;
        matches.push({ field: "Role/Org", snippet: `${profile.roleTitle} @ ${profile.organization}` });
      }
      if (lowerClearance.includes(term)) {
        score += 25;
        matches.push({ field: "Clearance", snippet: profile.clearanceLevel });
      }
      if (lowerBio.includes(term)) {
        score += 15;
        matches.push({ field: "Bio", snippet: createSnippet(profile.bio, rawTerms) });
      }
    }

    if (score > 0) {
      counts.people++;
      counts.total++;
      results.push({
        id: `person-${profile.id}`,
        title: profile.fullName,
        subtitle: `Badge: ${profile.badgeId} • ${profile.roleTitle} (${profile.organization})`,
        module: "people",
        moduleLabel: "Personnel Registry",
        category: "people",
        iconType: "person",
        riskScore: profile.riskScore,
        badge: profile.clearanceLevel,
        badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        matchedFields: matches.slice(0, 2),
        targetId: profile.id,
        targetFilter: profile.fullName,
        score: score + (profile.riskScore ? profile.riskScore / 10 : 0),
        rawItem: profile,
      });
    }
  });

  // 5. Index & Query Master Keys
  data.masterKeys.forEach((key) => {
    let score = 0;
    const matches: MatchedField[] = [];
    const lowerName = key.keyName.toLowerCase();
    const lowerCategory = (key.category || "").toLowerCase();
    const lowerZone = (key.securityZone || "").toLowerCase();
    const lowerLocation = (key.facilityLocation || "").toLowerCase();
    const lowerStatus = key.currentStatus.toLowerCase();
    const lowerAnomaly = (key.anomalyReason || "").toLowerCase();
    const holders = (key.assignedHolders || []).map((h) => `${h.name} ${h.badgeId}`).join(" ").toLowerCase();

    for (const term of rawTerms) {
      if (lowerName.includes(term)) {
        score += lowerName === term ? 100 : 70;
        matches.push({ field: "Key Identifier", snippet: createSnippet(key.keyName, rawTerms) });
      }
      if (holders.includes(term)) {
        score += 50;
        matches.push({ field: "Custodian", snippet: createSnippet(holders, rawTerms) });
      }
      if (lowerZone.includes(term) || lowerLocation.includes(term)) {
        score += 35;
        matches.push({ field: "Facility/Zone", snippet: `${key.facilityLocation} • ${key.securityZone}` });
      }
      if (lowerStatus.includes(term)) {
        score += 30;
        matches.push({ field: "Key Status", snippet: key.currentStatus });
      }
      if (lowerCategory.includes(term)) {
        score += 25;
        matches.push({ field: "Category", snippet: key.category || "" });
      }
      if (lowerAnomaly.includes(term)) {
        score += 40;
        matches.push({ field: "Anomaly Flag", snippet: createSnippet(key.anomalyReason || "", rawTerms) });
      }
    }

    if (score > 0) {
      counts.masterkeys++;
      counts.total++;
      results.push({
        id: `key-${key.id}`,
        title: key.keyName,
        subtitle: `Zone: ${key.securityZone || "N/A"} • Facility: ${key.facilityLocation || "N/A"} • Status: ${key.currentStatus}`,
        module: "masterkeys",
        moduleLabel: "Master Cryptographic Keys",
        category: "masterkeys",
        iconType: "key",
        badge: key.currentStatus,
        badgeColor: key.anomalyDetected ? "bg-rose-500/15 text-rose-400 border-rose-500/40" : "bg-amber-500/15 text-amber-400 border-amber-500/30",
        matchedFields: matches.slice(0, 2),
        targetId: key.id,
        targetFilter: key.keyName,
        score: score + (key.anomalyDetected ? 20 : 0),
        rawItem: key,
      });
    }
  });

  // 6. Index & Query Audit Logs
  data.auditLogs.forEach((log) => {
    let score = 0;
    const matches: MatchedField[] = [];
    const lowerAction = log.action.toLowerCase();
    const lowerTarget = (log.target || log.targetEntity || "").toLowerCase();
    const lowerActor = (log.actor || log.user || "").toLowerCase();
    const lowerJust = (log.justification || "").toLowerCase();
    const lowerHash = (log.sha256Proof || log.hash || "").toLowerCase();

    for (const term of rawTerms) {
      if (lowerTarget.includes(term)) {
        score += 55;
        matches.push({ field: "Target", snippet: createSnippet(log.target || log.targetEntity || "", rawTerms) });
      }
      if (lowerAction.includes(term)) {
        score += 45;
        matches.push({ field: "Action", snippet: log.action });
      }
      if (lowerActor.includes(term)) {
        score += 35;
        matches.push({ field: "Operator", snippet: log.actor || log.user || "" });
      }
      if (lowerJust.includes(term)) {
        score += 25;
        matches.push({ field: "Justification", snippet: createSnippet(log.justification || "", rawTerms) });
      }
      if (lowerHash.includes(term)) {
        score += 60;
        matches.push({ field: "SHA-256", snippet: (log.sha256Proof || log.hash || "").slice(0, 16) + "..." });
      }
    }

    if (score > 0) {
      counts.audit++;
      counts.total++;
      results.push({
        id: `log-${log.id}`,
        title: `${log.action} on ${log.target || log.targetEntity}`,
        subtitle: `Actor: ${log.actor || log.user} • SHA-256: ${(log.sha256Proof || log.hash || "").slice(0, 12)}...`,
        module: "audit",
        moduleLabel: "Immutable Audit Ledger",
        category: "audit",
        iconType: "audit",
        badge: "VERIFIED HASH",
        badgeColor: "bg-slate-700/50 text-slate-300 border-slate-600",
        matchedFields: matches.slice(0, 2),
        targetId: log.id,
        targetFilter: log.target || log.targetEntity || log.action,
        timestamp: log.timestamp,
        score: score,
        rawItem: log,
      });
    }
  });

  const filtered = activeCategory === "all"
    ? results
    : results.filter((item) => item.category === activeCategory);

  return {
    items: filtered.sort((a, b) => b.score - a.score),
    stats: counts,
  };
}
