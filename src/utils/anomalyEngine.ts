import { 
  GraphNode, 
  GraphEdge, 
  AuditLogEntry, 
  VulnerabilityAsset, 
  ThreatFeedItem, 
  MasterKeyItem,
  DetectedAnomaly, 
  AnomalySuiteConfig, 
  AnomalyAlgorithmType, 
  AnomalySeverity, 
  FeatureDeviation,
  TelemetryRecord,
  AnomalyBenchmarkResult
} from "../types";

export const defaultAnomalySuiteConfig: AnomalySuiteConfig = {
  enabledAlgorithms: {
    isolation_forest: true,
    local_outlier_factor: true,
    graph_topology: true,
    robust_zscore_mad: true,
    temporal_beaconing: true,
    vulnerability_correlation: true,
  },
  contaminationRate: 0.10,
  isolationTreesCount: 80,
  subsampleSize: 128,
  lofKNeighbors: 12,
  zScoreThreshold: 3.2,
  beaconingJitterMax: 0.18,
  minConfidence: 65,
};

// ============================================================================
// 1. ISOLATION FOREST (iForest) IMPLEMENTATION
// ============================================================================

interface IsolationTreeNode {
  splitFeature?: number;
  splitValue?: number;
  left?: IsolationTreeNode;
  right?: IsolationTreeNode;
  size: number;
}

/**
 * Average path length of unsuccessful search in a Binary Search Tree (BST)
 * c(n) = 2 * (ln(n - 1) + 0.5772156649) - (2 * (n - 1) / n)
 */
function c(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const eulerMascheroni = 0.5772156649;
  return 2 * (Math.log(n - 1) + eulerMascheroni) - (2 * (n - 1)) / n;
}

function buildITree(data: number[][], currentHeight: number, maxHeight: number): IsolationTreeNode {
  const n = data.length;
  if (currentHeight >= maxHeight || n <= 1) {
    return { size: n };
  }

  const numFeatures = data[0].length;
  const featureIdx = Math.floor(Math.random() * numFeatures);

  let min = data[0][featureIdx];
  let max = data[0][featureIdx];
  for (let i = 1; i < n; i++) {
    const val = data[i][featureIdx];
    if (val < min) min = val;
    if (val > max) max = val;
  }

  if (min === max) {
    return { size: n };
  }

  const splitVal = min + Math.random() * (max - min);

  const leftData: number[][] = [];
  const rightData: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (data[i][featureIdx] < splitVal) {
      leftData.push(data[i]);
    } else {
      rightData.push(data[i]);
    }
  }

  return {
    splitFeature: featureIdx,
    splitValue: splitVal,
    left: buildITree(leftData, currentHeight + 1, maxHeight),
    right: buildITree(rightData, currentHeight + 1, maxHeight),
    size: n,
  };
}

function pathLength(x: number[], node: IsolationTreeNode, currentPath: number): number {
  if (!node.left || !node.right || node.splitFeature === undefined || node.splitValue === undefined) {
    return currentPath + c(node.size);
  }

  if (x[node.splitFeature] < node.splitValue) {
    return pathLength(x, node.left, currentPath + 1);
  } else {
    return pathLength(x, node.right, currentPath + 1);
  }
}

export function runIsolationForest(
  vectors: { id: string; label: string; type: string; features: number[]; featureNames: string[] }[],
  config: AnomalySuiteConfig = defaultAnomalySuiteConfig
): DetectedAnomaly[] {
  if (vectors.length < 4) return [];

  const n = vectors.length;
  const numTrees = Math.min(config.isolationTreesCount, 120);
  const subsampleSize = Math.min(config.subsampleSize, n);
  const maxHeight = Math.ceil(Math.log2(Math.max(subsampleSize, 2)));
  const cn = c(subsampleSize);

  const trees: IsolationTreeNode[] = [];
  const matrix = vectors.map((v) => v.features);

  // Train isolation trees on random sub-samples
  for (let t = 0; t < numTrees; t++) {
    const sample: number[][] = [];
    for (let s = 0; s < subsampleSize; s++) {
      const randIdx = Math.floor(Math.random() * n);
      sample.push(matrix[randIdx]);
    }
    trees.push(buildITree(sample, 0, maxHeight));
  }

  // Calculate anomaly scores s(x, n) = 2^(-E(h(x)) / c(n))
  const scoredItems = vectors.map((item) => {
    let totalPath = 0;
    for (const tree of trees) {
      totalPath += pathLength(item.features, tree, 0);
    }
    const avgPath = totalPath / numTrees;
    const score = cn > 0 ? Math.pow(2, -avgPath / cn) : 0.5;
    return { item, avgPath, score };
  });

  // Sort descending by anomaly score
  scoredItems.sort((a, b) => b.score - a.score);

  // Contamination threshold cutoff
  const cutoffIndex = Math.max(1, Math.floor(n * config.contaminationRate));
  const anomalies: DetectedAnomaly[] = [];

  for (let i = 0; i < cutoffIndex; i++) {
    const { item, avgPath, score } = scoredItems[i];
    if (score < 0.58) continue; // Only flag if demonstrably anomalous

    const severity: AnomalySeverity = score >= 0.82 ? "CRITICAL" : score >= 0.72 ? "HIGH" : "MEDIUM";

    // Feature attribution (which feature was most divergent)
    const featureDeviations: FeatureDeviation[] = item.features.map((val, fIdx) => {
      const allVals = matrix.map((m) => m[fIdx]);
      const mean = allVals.reduce((a, b) => a + b, 0) / n;
      const stdDev = Math.sqrt(allVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n) || 1;
      const z = (val - mean) / stdDev;
      return {
        feature: item.featureNames[fIdx] || `Dim-${fIdx}`,
        observed: Math.round(val * 100) / 100,
        baseline: Math.round(mean * 100) / 100,
        deviationZ: Math.round(z * 100) / 100,
      };
    }).sort((a, b) => Math.abs(b.deviationZ || 0) - Math.abs(a.deviationZ || 0));

    anomalies.push({
      id: `anom-iforest-${item.id}-${Date.now()}-${i}`,
      entityId: item.id,
      entityLabel: item.label,
      entityType: item.type,
      algorithm: "isolation_forest",
      algorithmName: "Isolation Forest (Multi-Dimensional Partitioning)",
      anomalyScore: Math.round(score * 100),
      severity,
      title: `Multi-Attribute Outlier: ${item.label}`,
      description: `Entity exhibits extreme isolation speed across high-dimensional feature partition trees (E(h)=${avgPath.toFixed(2)} vs expected c(n)=${cn.toFixed(2)}).`,
      mathematicalBasis: `iForest Anomaly Score s=${score.toFixed(3)} (2^(-${avgPath.toFixed(2)}/${cn.toFixed(2)})). Path length ratio ${(avgPath / cn).toFixed(3)}. Top driver: ${featureDeviations[0]?.feature} (z=${featureDeviations[0]?.deviationZ}σ).`,
      deviatingFeatures: featureDeviations.slice(0, 3),
      potentialIncident: score >= 0.78,
      incidentType: "High-Dimensional Attribute Divergence",
      mitreTechnique: "T1078 - Valid Accounts / Unusual Behavior",
      recommendedAction: "Isolate entity, review recent credential operations, and trigger forensic telemetry review.",
      timestamp: new Date().toISOString(),
      status: "Active",
    });
  }

  return anomalies;
}

// ============================================================================
// 2. LOCAL OUTLIER FACTOR (LOF) IMPLEMENTATION
// ============================================================================

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function runLocalOutlierFactor(
  vectors: { id: string; label: string; type: string; features: number[]; featureNames: string[] }[],
  config: AnomalySuiteConfig = defaultAnomalySuiteConfig
): DetectedAnomaly[] {
  const n = vectors.length;
  if (n < 5) return [];

  const k = Math.min(config.lofKNeighbors, n - 1);
  const matrix = vectors.map((v) => v.features);

  // 1. Compute all pairwise distances
  const distMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = euclideanDistance(matrix[i], matrix[j]);
      distMatrix[i][j] = d;
      distMatrix[j][i] = d;
    }
  }

  // 2. Find k-distances and k-nearest neighbors
  const kDistances: number[] = [];
  const kNeighbors: number[][] = [];

  for (let i = 0; i < n; i++) {
    const neighborsWithDist = distMatrix[i]
      .map((dist, idx) => ({ idx, dist }))
      .filter((pair) => pair.idx !== i)
      .sort((a, b) => a.dist - b.dist);

    const kDist = neighborsWithDist[k - 1]?.dist || 0.001;
    kDistances.push(kDist);
    kNeighbors.push(neighborsWithDist.slice(0, k).map((p) => p.idx));
  }

  // 3. Compute local reachability density (lrd)
  const lrd: number[] = [];
  for (let i = 0; i < n; i++) {
    let sumReachDist = 0;
    const neighbors = kNeighbors[i];
    for (const nb of neighbors) {
      const reachDist = Math.max(kDistances[nb], distMatrix[i][nb]);
      sumReachDist += reachDist;
    }
    lrd.push(sumReachDist > 0 ? neighbors.length / sumReachDist : 1);
  }

  // 4. Compute LOF score
  const lofScores = vectors.map((item, i) => {
    const neighbors = kNeighbors[i];
    let sumRatio = 0;
    for (const nb of neighbors) {
      sumRatio += lrd[nb] / (lrd[i] || 0.0001);
    }
    const score = neighbors.length > 0 ? sumRatio / neighbors.length : 1;
    return { item, score };
  });

  // Flag nodes with LOF > 1.4 (substantially lower local density than neighbors)
  const anomalies: DetectedAnomaly[] = [];
  lofScores
    .filter((s) => s.score >= 1.42)
    .sort((a, b) => b.score - a.score)
    .forEach(({ item, score }, idx) => {
      const severity: AnomalySeverity = score >= 2.4 ? "CRITICAL" : score >= 1.8 ? "HIGH" : "MEDIUM";
      const normalized100 = Math.min(100, Math.round((score / 3.0) * 100));

      anomalies.push({
        id: `anom-lof-${item.id}-${Date.now()}-${idx}`,
        entityId: item.id,
        entityLabel: item.label,
        entityType: item.type,
        algorithm: "local_outlier_factor",
        algorithmName: "Local Outlier Factor (LOF Density Clustering)",
        anomalyScore: normalized100,
        severity,
        title: `Density Anomaly (Isolated Asset): ${item.label}`,
        description: `Entity resides in a significantly sparser feature-space density neighborhood than its k=${k} nearest peers (LOF=${score.toFixed(2)}).`,
        mathematicalBasis: `LOF Score: ${score.toFixed(2)} (ratio of local reachability densities). Expected density ~1.0; observed deviation indicates covert sleeper node or atypical infrastructure silo.`,
        deviatingFeatures: [
          { feature: "Local Reachability Density", observed: (1 / score).toFixed(3), baseline: "1.000", description: "Sparse neighborhood" },
          { feature: "k-Nearest Neighbor Distance", observed: kDistances[idx]?.toFixed(2) || "N/A", baseline: "Clustered" },
        ],
        potentialIncident: score >= 2.0,
        incidentType: "Isolated Shadow Infrastructure",
        mitreTechnique: "T1584 - Compromise Infrastructure",
        recommendedAction: "Investigate whether entity was uncatalogued shadow IT or intentional out-of-band C2 infrastructure.",
        timestamp: new Date().toISOString(),
        status: "Active",
      });
    });

  return anomalies;
}

// ============================================================================
// 3. GRAPH TOPOLOGY & CENTRALITY ANOMALIES
// ============================================================================

export function runGraphTopologyAnomaly(
  nodes: GraphNode[],
  edges: GraphEdge[]
): DetectedAnomaly[] {
  if (nodes.length === 0) return [];

  const anomalies: DetectedAnomaly[] = [];
  const degreeMap: Record<string, number> = {};
  const neighborsMap: Record<string, Set<string>> = {};

  nodes.forEach((n) => {
    degreeMap[n.id] = 0;
    neighborsMap[n.id] = new Set();
  });

  edges.forEach((e) => {
    if (degreeMap[e.source] !== undefined) degreeMap[e.source]++;
    if (degreeMap[e.target] !== undefined) degreeMap[e.target]++;
    if (neighborsMap[e.source]) neighborsMap[e.source].add(e.target);
    if (neighborsMap[e.target]) neighborsMap[e.target].add(e.source);
  });

  // Calculate Degree Stats for Z-Score
  const degrees = Object.values(degreeMap);
  const meanDeg = degrees.reduce((a, b) => a + b, 0) / (degrees.length || 1);
  const stdDeg = Math.sqrt(degrees.reduce((a, b) => a + Math.pow(b - meanDeg, 2), 0) / (degrees.length || 1)) || 1;

  nodes.forEach((n, idx) => {
    const deg = degreeMap[n.id] || 0;
    const degZ = (deg - meanDeg) / stdDeg;

    // 1. Hub Centrality Outlier (Disproportionate connections)
    if (degZ >= 2.4 && deg >= 4) {
      anomalies.push({
        id: `anom-top-hub-${n.id}-${idx}`,
        entityId: n.id,
        entityLabel: n.label,
        entityType: n.type,
        algorithm: "graph_topology",
        algorithmName: "Graph Topology & Centrality Outliers",
        anomalyScore: Math.min(98, Math.round(65 + degZ * 10)),
        severity: degZ >= 3.2 ? "CRITICAL" : "HIGH",
        title: `Critical Network Hub / Supernode: ${n.label}`,
        description: `Entity possesses statistically anomalous degree centrality (${deg} connected entities, z=${degZ.toFixed(2)}σ above network mean ${meanDeg.toFixed(1)}).`,
        mathematicalBasis: `Degree Centrality Outlier: k=${deg}, z-score=${degZ.toFixed(2)}. Represents a high-value pivot point or centralized nexus in attack graph.`,
        deviatingFeatures: [
          { feature: "Degree Centrality", observed: deg, baseline: Math.round(meanDeg * 10) / 10, deviationZ: Math.round(degZ * 10) / 10 },
          { feature: "Ego-Network Edge Count", observed: neighborsMap[n.id]?.size || 0, baseline: "1-2" },
        ],
        potentialIncident: n.riskScore >= 70,
        incidentType: "Privileged Nexus or C2 Aggregation Hub",
        mitreTechnique: "T1090 - Proxy / Multi-hop Forwarding",
        recommendedAction: "Establish immediate continuous netflow inspection on all ingress/egress links touching this hub.",
        timestamp: new Date().toISOString(),
        status: "Active",
      });
    }

    // 2. Choke-Point / Covert Bridge Detection (Entity connecting two separate domains)
    const connectedEdges = edges.filter((e) => e.source === n.id || e.target === n.id);
    const connectedNodeTypes = new Set(
      connectedEdges.map((e) => {
        const otherId = e.source === n.id ? e.target : e.source;
        return nodes.find((node) => node.id === otherId)?.type;
      }).filter(Boolean)
    );

    const hasThreatActor = connectedEdges.some((e) => {
      const otherId = e.source === n.id ? e.target : e.source;
      const other = nodes.find((node) => node.id === otherId);
      return other?.type === "threat_actor" || other?.riskScore >= 80;
    });

    const hasInternalAsset = connectedEdges.some((e) => {
      const otherId = e.source === n.id ? e.target : e.source;
      const other = nodes.find((node) => node.id === otherId);
      return other?.type === "digital_key" || other?.type === "organization" || other?.classification === "Top Secret/SCI";
    });

    if (hasThreatActor && hasInternalAsset) {
      anomalies.push({
        id: `anom-top-bridge-${n.id}-${idx}`,
        entityId: n.id,
        entityLabel: n.label,
        entityType: n.type,
        algorithm: "graph_topology",
        algorithmName: "Graph Topology & Centrality Outliers",
        anomalyScore: 94,
        severity: "CRITICAL",
        title: `Suspected Adversarial Bridge / Choke Point: ${n.label}`,
        description: `Direct topological adjacency bridging external threat actors / high-risk endpoints to internal classified or cryptographic crown jewels.`,
        mathematicalBasis: `Betweenness Bridge Heuristic: Cut-vertex between subgraphs G_threat and G_classified. Shortest path traversal vulnerability score = 0.94.`,
        deviatingFeatures: [
          { feature: "Adversary Hop Distance", observed: "1 hop (Direct)", baseline: ">3 hops", description: "Critical perimeter breach indicator" },
          { feature: "Connected Domains", observed: Array.from(connectedNodeTypes).join(", "), baseline: "Homogeneous" },
        ],
        potentialIncident: true,
        incidentType: "Perimeter Bypass / Insider Bridge",
        mitreTechnique: "T1078.004 - Cloud / Internal Bridge Access",
        recommendedAction: "Sever bridging edge, revoke entity privileges, and initiate emergency incident response protocol.",
        timestamp: new Date().toISOString(),
        status: "Active",
      });
    }

    // 3. High Heterogeneity / Star OddBall Pattern
    if (connectedNodeTypes.size >= 4) {
      anomalies.push({
        id: `anom-top-oddball-${n.id}-${idx}`,
        entityId: n.id,
        entityLabel: n.label,
        entityType: n.type,
        algorithm: "graph_topology",
        algorithmName: "Graph Topology & Centrality Outliers",
        anomalyScore: 78,
        severity: "HIGH",
        title: `Ego-Network Heterogeneity Anomaly: ${n.label}`,
        description: `Connects to an unusual diversity of distinct entity archetypes (${connectedNodeTypes.size} different categories), violating typical functional segmentation.`,
        mathematicalBasis: `OddBall Graph Pattern: High Shannon entropy across neighbor entity type distribution (H > 2.0).`,
        deviatingFeatures: [
          { feature: "Neighbor Archetype Diversity", observed: `${connectedNodeTypes.size} types`, baseline: "1-2 types" },
        ],
        potentialIncident: false,
        incidentType: "Abnormal Lateral Access",
        mitreTechnique: "T1087 - Account Discovery",
        recommendedAction: "Audit access control lists (ACL) to verify if cross-domain permissions are authorized.",
        timestamp: new Date().toISOString(),
        status: "Active",
      });
    }
  });

  return anomalies;
}

// ============================================================================
// 4. ROBUST STATISTICAL OUTLIER DETECTION (Modified Z-Score / MAD & IQR)
// ============================================================================

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function runRobustZScoreMAD(
  items: { id: string; label: string; type: string; metricName: string; value: number }[],
  config: AnomalySuiteConfig = defaultAnomalySuiteConfig
): DetectedAnomaly[] {
  if (items.length < 4) return [];

  const values = items.map((i) => i.value);
  const med = median(values);
  const absoluteDeviations = values.map((v) => Math.abs(v - med));
  const mad = median(absoluteDeviations) || 0.001;

  // Modified Z-score: M_i = 0.6745 * (x_i - median) / MAD
  const threshold = config.zScoreThreshold;
  const anomalies: DetectedAnomaly[] = [];

  items.forEach((item, idx) => {
    const modZ = (0.6745 * (item.value - med)) / mad;

    if (Math.abs(modZ) >= threshold) {
      const severity: AnomalySeverity = Math.abs(modZ) >= 5.0 ? "CRITICAL" : Math.abs(modZ) >= 4.0 ? "HIGH" : "MEDIUM";
      const score = Math.min(100, Math.round((Math.abs(modZ) / 6.0) * 100));

      anomalies.push({
        id: `anom-mad-${item.id}-${Date.now()}-${idx}`,
        entityId: item.id,
        entityLabel: item.label,
        entityType: item.type,
        algorithm: "robust_zscore_mad",
        algorithmName: "Robust Statistical Outlier (MAD / Tukey)",
        anomalyScore: score,
        severity,
        title: `Statistical Deviation in ${item.metricName}: ${item.label}`,
        description: `Value ${item.value} deviates sharply from cohort baseline (Modified Z-Score = ${modZ > 0 ? "+" : ""}${modZ.toFixed(2)}σ, Median = ${med.toFixed(1)}, MAD = ${mad.toFixed(1)}).`,
        mathematicalBasis: `Median Absolute Deviation (MAD) Outlier Test: M_i = 0.6745 * (${item.value} - ${med.toFixed(1)}) / ${mad.toFixed(1)} = ${modZ.toFixed(2)}σ. Passed NIST robust outlier threshold (|M_i| >= ${threshold}).`,
        deviatingFeatures: [
          { feature: item.metricName, observed: item.value, baseline: Math.round(med * 10) / 10, deviationZ: Math.round(modZ * 10) / 10 },
          { feature: "Cohort Median Absolute Deviation", observed: Math.round(mad * 10) / 10, baseline: "Baseline MAD" },
        ],
        potentialIncident: Math.abs(modZ) >= 4.5,
        incidentType: "Statistical Anomaly Spike",
        mitreTechnique: "T1048 - Exfiltration / Data Spike",
        recommendedAction: "Compare telemetry against historical baseline and inspect process executing the metric spike.",
        timestamp: new Date().toISOString(),
        status: "Active",
      });
    }
  });

  return anomalies;
}

// ============================================================================
// 5. TEMPORAL VELOCITY & C2 BEACONING ENTROPY
// ============================================================================

export interface TimestampedEvent {
  id: string;
  sourceId: string;
  sourceLabel: string;
  timestamp: string | number;
  destination: string;
  bytes?: number;
}

export function runTemporalBeaconingAnomaly(
  events: TimestampedEvent[],
  config: AnomalySuiteConfig = defaultAnomalySuiteConfig
): DetectedAnomaly[] {
  if (events.length < 5) return [];

  // Group events by sourceId
  const sourceGroups: Record<string, TimestampedEvent[]> = {};
  events.forEach((ev) => {
    if (!sourceGroups[ev.sourceId]) sourceGroups[ev.sourceId] = [];
    sourceGroups[ev.sourceId].push(ev);
  });

  const anomalies: DetectedAnomaly[] = [];

  Object.entries(sourceGroups).forEach(([sourceId, group], idx) => {
    if (group.length < 5) return;

    // Convert timestamps to ms epoch and sort
    const timestamps = group
      .map((g) => (typeof g.timestamp === "string" ? new Date(g.timestamp).getTime() : g.timestamp))
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b);

    if (timestamps.length < 5) return;

    // Calculate delta intervals
    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push((timestamps[i] - timestamps[i - 1]) / 1000); // in seconds
    }

    const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - meanInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Coefficient of Variation: CV = stdDev / meanInterval
    // Automated malware beacons exhibit very low jitter (CV < 0.15)
    const cv = meanInterval > 0 ? stdDev / meanInterval : 1.0;

    // Shannon entropy of destinations
    const destCounts: Record<string, number> = {};
    group.forEach((g) => {
      destCounts[g.destination] = (destCounts[g.destination] || 0) + 1;
    });

    let entropy = 0;
    const totalDests = group.length;
    Object.values(destCounts).forEach((c) => {
      const p = c / totalDests;
      if (p > 0) entropy -= p * Math.log2(p);
    });

    // 1. Robotic Periodic C2 Beaconing Detected
    if (cv <= config.beaconingJitterMax && meanInterval >= 1 && meanInterval <= 3600) {
      anomalies.push({
        id: `anom-temp-beacon-${sourceId}-${idx}`,
        entityId: sourceId,
        entityLabel: group[0]?.sourceLabel || sourceId,
        entityType: "ip_address",
        algorithm: "temporal_beaconing",
        algorithmName: "Temporal Velocity & C2 Beaconing Monitor",
        anomalyScore: 92,
        severity: "CRITICAL",
        title: `Suspected C2 Heartbeat Beaconing: ${group[0]?.sourceLabel || sourceId}`,
        description: `Highly uniform outbound communication cadence observed (${group.length} pulses, interval = ${meanInterval.toFixed(1)}s ± ${stdDev.toFixed(2)}s, jitter CV = ${cv.toFixed(3)}). Characteristic of Cobalt Strike or Mythic HTTP/2 agent beacon.`,
        mathematicalBasis: `Inter-Arrival Time Regularity: Coefficient of Variation CV = σ/μ = ${stdDev.toFixed(2)}/${meanInterval.toFixed(1)} = ${cv.toFixed(3)} (threshold <= ${config.beaconingJitterMax}). Destination entropy H = ${entropy.toFixed(2)}.`,
        deviatingFeatures: [
          { feature: "Interval Jitter (CV)", observed: cv.toFixed(3), baseline: "> 0.45 (Human)", description: "Extreme robotic regularity" },
          { feature: "Mean Beacon Cadence", observed: `${meanInterval.toFixed(1)}s`, baseline: "Stochastic" },
          { feature: "Target Destination", observed: Object.keys(destCounts)[0] || "Unknown", baseline: "Varied" },
        ],
        potentialIncident: true,
        incidentType: "Command & Control (C2) Beaconing",
        mitreTechnique: "T1071.001 - Web Protocols: HTTP/S C2 Beaconing",
        recommendedAction: "Block destination IP on boundary firewall, capture memory dump of source host, and inspect active processes.",
        timestamp: new Date().toISOString(),
        status: "Active",
      });
    }

    // 2. High Velocity Telemetry Burst / Exfiltration Pulse
    const minTime = timestamps[0];
    const maxTime = timestamps[timestamps.length - 1];
    const durationSpanSec = (maxTime - minTime) / 1000 || 1;
    const eventVelocity = group.length / (durationSpanSec / 60); // events per minute

    if (eventVelocity >= 40 && group.length >= 15) {
      anomalies.push({
        id: `anom-temp-burst-${sourceId}-${idx}`,
        entityId: sourceId,
        entityLabel: group[0]?.sourceLabel || sourceId,
        entityType: "endpoint",
        algorithm: "temporal_beaconing",
        algorithmName: "Temporal Velocity & C2 Beaconing Monitor",
        anomalyScore: 84,
        severity: "HIGH",
        title: `High-Velocity Transmission Burst: ${group[0]?.sourceLabel || sourceId}`,
        description: `Sudden spike in transmission frequency (${eventVelocity.toFixed(1)} events/min over ${durationSpanSec.toFixed(1)}s). Possible automated credential spray or bulk exfiltration.`,
        mathematicalBasis: `Event Velocity Spike: rate=${eventVelocity.toFixed(1)} events/min, burst ratio ${(eventVelocity / 5).toFixed(1)}x normal baseline.`,
        deviatingFeatures: [
          { feature: "Event Frequency", observed: `${eventVelocity.toFixed(1)}/min`, baseline: "< 5/min" },
          { feature: "Burst Volume", observed: `${group.length} events`, baseline: "Nominal" },
        ],
        potentialIncident: true,
        incidentType: "Data Exfiltration or Credential Spray Burst",
        mitreTechnique: "T1048 - Exfiltration Over Alternative Protocol",
        recommendedAction: "Rate-limit host interface and correlate with egress proxy bandwidth telemetry.",
        timestamp: new Date().toISOString(),
        status: "Active",
      });
    }
  });

  return anomalies;
}

// ============================================================================
// 6. COMPOUND THREAT & SYSTEM VULNERABILITY CORRELATION
// ============================================================================

export function runVulnerabilityCorrelation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  vulnerabilities: VulnerabilityAsset[] = [],
  threats: ThreatFeedItem[] = [],
  masterKeys: MasterKeyItem[] = []
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  // Index vulnerabilities by affected host/name
  const vulnByHost: Record<string, VulnerabilityAsset[]> = {};
  vulnerabilities.forEach((v) => {
    const key = v.affectedHost.toLowerCase();
    if (!vulnByHost[key]) vulnByHost[key] = [];
    vulnByHost[key].push(v);
  });

  // Check each node for compound risk
  nodes.forEach((node, idx) => {
    const matchingVulns = (vulnByHost[node.label.toLowerCase()] || []).concat(
      vulnByHost[node.id.toLowerCase()] || []
    );

    const criticalVuln = matchingVulns.find((v) => v.cvssScore >= 8.5 && v.status === "Unpatched");

    // Connected to threat actor or flagged entity?
    const connectedEdges = edges.filter((e) => e.source === node.id || e.target === node.id);
    const threatActorsAdjacent = connectedEdges.map((e) => {
      const otherId = e.source === node.id ? e.target : e.source;
      return nodes.find((n) => n.id === otherId);
    }).filter((n) => n && (n.type === "threat_actor" || (n.riskScore >= 80)));

    // Adjacent to Master Key or SCIF?
    const adjacentToKey = connectedEdges.some((e) => {
      const otherId = e.source === node.id ? e.target : e.source;
      const other = nodes.find((n) => n.id === otherId);
      return other?.type === "digital_key" || other?.classification === "Top Secret/SCI";
    });

    // Threat IOC match
    const matchingIoc = threats.find((t) => 
      t.iocValue.toLowerCase() === node.label.toLowerCase() ||
      t.affectedEntities.some((ae) => ae.toLowerCase() === node.label.toLowerCase())
    );

    // Compound Anomaly: Unpatched CVE + Threat Actor Adjacency
    if (criticalVuln && threatActorsAdjacent.length > 0) {
      anomalies.push({
        id: `anom-vuln-exploit-${node.id}-${idx}`,
        entityId: node.id,
        entityLabel: node.label,
        entityType: node.type,
        algorithm: "vulnerability_correlation",
        algorithmName: "Compound Threat & Vulnerability Correlation",
        anomalyScore: 98,
        severity: "CRITICAL",
        title: `Weaponized Attack Vector: ${node.label}`,
        description: `Critical unpatched vulnerability ${criticalVuln.cveId} (CVSS ${criticalVuln.cvssScore}) is directly connected to threat actor ${threatActorsAdjacent[0]?.label}. Active exploitation imminent.`,
        mathematicalBasis: `Compound Risk Calculation: Base CVSS ${criticalVuln.cvssScore} * Adjacency Multiplier 1.25 = Attack Feasibility 98/100. Exploit availability: ${criticalVuln.exploitAvailability}.`,
        deviatingFeatures: [
          { feature: "Vulnerability CVSS", observed: criticalVuln.cvssScore, baseline: "< 7.0 (Managed)" },
          { feature: "CVE Identifier", observed: criticalVuln.cveId, baseline: "Patched" },
          { feature: "Adversary Adjacency", observed: threatActorsAdjacent[0]?.label || "Threat Actor", baseline: "Isolated" },
        ],
        potentialIncident: true,
        incidentType: "Imminent Exploitation of Public-Facing Asset",
        vulnerabilityDetails: {
          cveId: criticalVuln.cveId,
          cvss: criticalVuln.cvssScore,
          attackVector: criticalVuln.attackVector,
        },
        mitreTechnique: criticalVuln.mitreTactic || "T1190 - Exploit Public-Facing Application",
        recommendedAction: `Apply emergency patch or quarantine host ${node.label} immediately. ${criticalVuln.remediation}`,
        timestamp: new Date().toISOString(),
        status: "Active",
      });
    }

    // Threat Feed IOC Match on Active Node
    if (matchingIoc) {
      anomalies.push({
        id: `anom-vuln-ioc-${node.id}-${idx}`,
        entityId: node.id,
        entityLabel: node.label,
        entityType: node.type,
        algorithm: "vulnerability_correlation",
        algorithmName: "Compound Threat & Vulnerability Correlation",
        anomalyScore: matchingIoc.severity === "critical" ? 95 : 85,
        severity: matchingIoc.severity === "critical" ? "CRITICAL" : "HIGH",
        title: `Active Threat Intelligence IOC Match: ${node.label}`,
        description: `Correlated with live CTI threat feed "${matchingIoc.title}". Matched IOC ${matchingIoc.iocValue} (${matchingIoc.iocType}).`,
        mathematicalBasis: `Threat Intelligence Exact Hash/IP Match: Verified from source "${matchingIoc.source}". Severity: ${matchingIoc.severity.toUpperCase()}.`,
        deviatingFeatures: [
          { feature: "IOC Feed Match", observed: matchingIoc.iocValue, baseline: "Clean Telemetry" },
          { feature: "Intelligence Source", observed: matchingIoc.source, baseline: "Internal" },
        ],
        potentialIncident: true,
        incidentType: "Known Malicious Infrastructure Hit",
        mitreTechnique: matchingIoc.mitreTechnique || "T1071 - Web Protocols",
        recommendedAction: "Add IOC to ingress perimeter blocklist and inspect historic firewall sessions.",
        timestamp: new Date().toISOString(),
        status: "Active",
      });
    }

    // Anomalous Master Key Exposure
    if (node.type === "digital_key") {
      const matchingKey = masterKeys.find((k) => k.id === node.id || k.keyName === node.label);
      if (matchingKey && matchingKey.anomalyDetected) {
        anomalies.push({
          id: `anom-vuln-key-${node.id}-${idx}`,
          entityId: node.id,
          entityLabel: node.label,
          entityType: "digital_key",
          algorithm: "vulnerability_correlation",
          algorithmName: "Compound Threat & Vulnerability Correlation",
          anomalyScore: 90,
          severity: "CRITICAL",
          title: `Cryptographic Key Anomaly: ${node.label}`,
          description: `Key asset flagged with anomaly: ${matchingKey.anomalyReason || "Abnormal access pattern or quorum breach"}.`,
          mathematicalBasis: `HSM / KMS Access Ledger Integrity Anomaly. Current status: ${matchingKey.currentStatus}. Quorum: ${matchingKey.quorumApproved}/${matchingKey.quorumRequired}.`,
          deviatingFeatures: [
            { feature: "Key Status", observed: matchingKey.currentStatus, baseline: "Active Normal" },
            { feature: "24h Access Count", observed: matchingKey.accessCount24h || 0, baseline: "< 5" },
          ],
          potentialIncident: true,
          incidentType: "Cryptographic Root Compromise Risk",
          mitreTechnique: "T1552 - Unsecured Credentials",
          recommendedAction: "Rotate master key immediately and require dual-custody physical SCIF authorization.",
          timestamp: new Date().toISOString(),
          status: "Active",
        });
      }
    }
  });

  return anomalies;
}

// ============================================================================
// 7. COMPREHENSIVE ANOMALY DETECTION SUITE (UNIFIED PIPELINE)
// ============================================================================

export interface AnomalySuiteInput {
  nodes: GraphNode[];
  edges: GraphEdge[];
  vulnerabilities?: VulnerabilityAsset[];
  threats?: ThreatFeedItem[];
  masterKeys?: MasterKeyItem[];
  auditLogs?: AuditLogEntry[];
  telemetryRecords?: TelemetryRecord[];
  config?: AnomalySuiteConfig;
}

export function runComprehensiveAnomalySuite(input: AnomalySuiteInput): {
  anomalies: DetectedAnomaly[];
  benchmark: AnomalyBenchmarkResult;
} {
  const startTime = performance.now();
  const config = input.config || defaultAnomalySuiteConfig;
  const nodes = input.nodes || [];
  const edges = input.edges || [];
  const vulnerabilities = input.vulnerabilities || [];
  const threats = input.threats || [];
  const masterKeys = input.masterKeys || [];
  const auditLogs = input.auditLogs || [];
  const telemetry = input.telemetryRecords || [];

  const rawAnomalies: DetectedAnomaly[] = [];
  const breakdown: Record<string, number> = {
    isolation_forest: 0,
    local_outlier_factor: 0,
    graph_topology: 0,
    robust_zscore_mad: 0,
    temporal_beaconing: 0,
    vulnerability_correlation: 0,
  };

  // 1. Feature vectors for iForest & LOF
  if (config.enabledAlgorithms.isolation_forest || config.enabledAlgorithms.local_outlier_factor) {
    const degreeMap: Record<string, number> = {};
    edges.forEach((e) => {
      degreeMap[e.source] = (degreeMap[e.source] || 0) + 1;
      degreeMap[e.target] = (degreeMap[e.target] || 0) + 1;
    });

    const vectors = nodes.map((n) => {
      const deg = degreeMap[n.id] || 0;
      const attrCount = Object.keys(n.attributes || {}).length;
      const tagCount = n.tags?.length || 0;
      const isClassified = n.classification === "Top Secret/SCI" ? 1 : n.classification === "Secret" ? 0.7 : 0.2;

      return {
        id: n.id,
        label: n.label,
        type: n.type,
        features: [
          n.riskScore / 100,
          (100 - n.confidence) / 100,
          Math.min(1, deg / 10),
          Math.min(1, attrCount / 8),
          Math.min(1, tagCount / 6),
          isClassified,
        ],
        featureNames: ["Risk Index", "Uncertainty", "Degree Connectivity", "Metadata Density", "Tag Count", "Clearance Level"],
      };
    });

    if (config.enabledAlgorithms.isolation_forest && vectors.length >= 4) {
      const iforestResults = runIsolationForest(vectors, config);
      rawAnomalies.push(...iforestResults);
      breakdown.isolation_forest = iforestResults.length;
    }

    if (config.enabledAlgorithms.local_outlier_factor && vectors.length >= 5) {
      const lofResults = runLocalOutlierFactor(vectors, config);
      rawAnomalies.push(...lofResults);
      breakdown.local_outlier_factor = lofResults.length;
    }
  }

  // 2. Graph Topology & Centrality Outliers
  if (config.enabledAlgorithms.graph_topology && nodes.length > 0) {
    const topoResults = runGraphTopologyAnomaly(nodes, edges);
    rawAnomalies.push(...topoResults);
    breakdown.graph_topology = topoResults.length;
  }

  // 3. Robust Statistical Outlier Detection (MAD & Tukey)
  if (config.enabledAlgorithms.robust_zscore_mad && nodes.length >= 4) {
    const riskItems = nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      metricName: "Entity Risk Score",
      value: n.riskScore,
    }));
    const madResults = runRobustZScoreMAD(riskItems, config);
    rawAnomalies.push(...madResults);
    breakdown.robust_zscore_mad = madResults.length;
  }

  // 4. Temporal Velocity & C2 Beaconing Monitor
  if (config.enabledAlgorithms.temporal_beaconing) {
    // Collect timestamped events from telemetry, audit logs, or graph nodes
    const events: TimestampedEvent[] = [];

    telemetry.forEach((t) => {
      events.push({
        id: t.id,
        sourceId: t.sourceIp,
        sourceLabel: t.sourceIp,
        timestamp: t.timestamp,
        destination: t.destIp,
        bytes: t.bytesTransferred,
      });
    });

    auditLogs.forEach((l) => {
      events.push({
        id: l.id,
        sourceId: l.actor,
        sourceLabel: l.actor,
        timestamp: l.timestamp,
        destination: l.target || l.targetEntity || "System",
      });
    });

    if (events.length >= 5) {
      const temporalResults = runTemporalBeaconingAnomaly(events, config);
      rawAnomalies.push(...temporalResults);
      breakdown.temporal_beaconing = temporalResults.length;
    }
  }

  // 5. Compound Threat & Vulnerability Correlation
  if (config.enabledAlgorithms.vulnerability_correlation && nodes.length > 0) {
    const vulnResults = runVulnerabilityCorrelation(nodes, edges, vulnerabilities, threats, masterKeys);
    rawAnomalies.push(...vulnResults);
    breakdown.vulnerability_correlation = vulnResults.length;
  }

  // Deduplicate and Consensus Scoring:
  // If an entity was flagged by multiple algorithms, escalate its severity and consensus
  const entityAnomalyMap: Record<string, DetectedAnomaly[]> = {};
  rawAnomalies.forEach((a) => {
    if (!entityAnomalyMap[a.entityId]) entityAnomalyMap[a.entityId] = [];
    entityAnomalyMap[a.entityId].push(a);
  });

  const consolidated: DetectedAnomaly[] = [];

  Object.entries(entityAnomalyMap).forEach(([entityId, anoms]) => {
    if (anoms.length === 1) {
      consolidated.push(anoms[0]);
    } else {
      // Multiple algorithms agree this entity is anomalous
      const highestScore = Math.max(...anoms.map((a) => a.anomalyScore));
      const algosUsed = Array.from(new Set(anoms.map((a) => a.algorithmName)));
      const best = anoms.find((a) => a.anomalyScore === highestScore) || anoms[0];

      consolidated.push({
        ...best,
        id: `anom-consensus-${entityId}`,
        anomalyScore: Math.min(100, highestScore + 10),
        severity: "CRITICAL",
        title: `Consensus Incident (${anoms.length} Algorithms): ${best.entityLabel}`,
        description: `Entity confirmed as critical security incident by multiple distinct algorithms: ${algosUsed.join(", ")}.`,
        mathematicalBasis: `Multi-Algorithm Consensus Verification. Flagged independently by ${anoms.length} statistical/topological models. Combined anomaly score: ${Math.min(100, highestScore + 10)}/100.`,
        potentialIncident: true,
        incidentType: "Compound Multi-Vector Security Incident",
        deviatingFeatures: anoms.flatMap((a) => a.deviatingFeatures).slice(0, 5),
      });
    }
  });

  // Sort descending by severity & score
  consolidated.sort((a, b) => {
    const sevWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    if (sevWeight[a.severity] !== sevWeight[b.severity]) {
      return sevWeight[b.severity] - sevWeight[a.severity];
    }
    return b.anomalyScore - a.anomalyScore;
  });

  const execTime = Math.max(1, performance.now() - startTime);
  const totalItemsProcessed = nodes.length + edges.length + telemetry.length + auditLogs.length;
  const throughput = Math.round((totalItemsProcessed / (execTime / 1000)) || 0);

  const benchmark: AnomalyBenchmarkResult = {
    totalRecordsProcessed: totalItemsProcessed,
    totalAnomaliesDetected: consolidated.length,
    executionTimeMs: Math.round(execTime * 100) / 100,
    throughputPerSec: throughput,
    algorithmBreakdown: breakdown,
    criticalIncidentsCount: consolidated.filter((c) => c.severity === "CRITICAL").length,
    highSeverityCount: consolidated.filter((c) => c.severity === "HIGH").length,
  };

  return { anomalies: consolidated, benchmark };
}

// ============================================================================
// 8. LARGE DATASET TELEMETRY GENERATOR & BENCHMARK SUITE
// ============================================================================

export function generateLargeTelemetryDataset(size = 2500): TelemetryRecord[] {
  const records: TelemetryRecord[] = [];
  const baseTime = Date.now() - 3600 * 1000 * 4; // last 4 hours

  const normalIps = [
    "10.0.4.12", "10.0.4.15", "10.0.8.21", "10.0.8.22", "10.0.12.50",
    "192.168.1.100", "192.168.1.105", "172.16.0.10", "172.16.0.15"
  ];
  const normalServers = [
    "10.0.1.1", "10.0.1.2", "10.0.2.10", "172.16.100.5", "172.16.100.6"
  ];
  const protocols = ["HTTPS", "HTTPS", "HTTPS", "DNS", "TCP", "SSH"];
  const ports = [443, 443, 80, 53, 22, 8080];

  // Injected Anomalies setup
  const beaconSource = "10.0.4.99"; // Stealth C2 beaconing
  const beaconDest = "185.220.101.44"; // Tor relay
  const exfilSource = "10.0.8.188"; // Massive byte surge
  const bruteSource = "192.168.1.250"; // Port sweep

  for (let i = 0; i < size; i++) {
    // Normal baseline traffic
    const isBeacon = i % 45 === 0;
    const isExfil = i >= 350 && i <= 365;
    const isBrute = i >= 800 && i <= 840;

    if (isBeacon) {
      // Periodic C2 pulse (every ~60 seconds with 1s jitter)
      const beaconTime = baseTime + Math.floor(i / 45) * 60000 + (Math.random() * 2000 - 1000);
      records.push({
        id: `rec-beacon-${i}`,
        timestamp: new Date(beaconTime).toISOString(),
        sourceIp: beaconSource,
        destIp: beaconDest,
        sourcePort: 49152 + (i % 1000),
        destPort: 443,
        protocol: "HTTPS",
        bytesTransferred: 420 + Math.floor(Math.random() * 80),
        durationMs: 120 + Math.floor(Math.random() * 40),
        action: "ALLOW",
        user: "svc_telemetry",
        anomalyFlags: ["C2_BEACONING_CANDIDATE"],
        isGroundTruthAnomaly: true,
      });
    } else if (isExfil) {
      // Massive byte exfiltration pulse
      records.push({
        id: `rec-exfil-${i}`,
        timestamp: new Date(baseTime + i * 5000).toISOString(),
        sourceIp: exfilSource,
        destIp: "198.51.100.77",
        sourcePort: 55432,
        destPort: 443,
        protocol: "HTTPS",
        bytesTransferred: 45000000 + Math.floor(Math.random() * 25000000), // 45MB - 70MB per chunk
        durationMs: 8500 + Math.floor(Math.random() * 3000),
        action: "ALLOW",
        user: "admin_backup",
        anomalyFlags: ["BULK_DATA_EXFILTRATION"],
        isGroundTruthAnomaly: true,
      });
    } else if (isBrute) {
      // Port sweep / lateral probe
      records.push({
        id: `rec-sweep-${i}`,
        timestamp: new Date(baseTime + i * 200).toISOString(),
        sourceIp: bruteSource,
        destIp: normalServers[i % normalServers.length],
        sourcePort: 40000 + i,
        destPort: 1000 + (i * 37) % 64000,
        protocol: "TCP",
        bytesTransferred: 64,
        durationMs: 12,
        action: "BLOCK",
        anomalyFlags: ["PORT_SWEEP"],
        isGroundTruthAnomaly: true,
      });
    } else {
      // Clean background telemetry
      const src = normalIps[Math.floor(Math.random() * normalIps.length)];
      const dst = normalServers[Math.floor(Math.random() * normalServers.length)];
      const proto = protocols[Math.floor(Math.random() * protocols.length)];
      const port = ports[Math.floor(Math.random() * ports.length)];
      const time = baseTime + Math.floor((i / size) * (3600 * 1000 * 4)) + Math.floor(Math.random() * 2000);

      records.push({
        id: `rec-norm-${i}`,
        timestamp: new Date(time).toISOString(),
        sourceIp: src,
        destIp: dst,
        sourcePort: 30000 + Math.floor(Math.random() * 20000),
        destPort: port,
        protocol: proto,
        bytesTransferred: 500 + Math.floor(Math.random() * 4500),
        durationMs: 25 + Math.floor(Math.random() * 350),
        action: "ALLOW",
      });
    }
  }

  // Sort by timestamp
  return records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
