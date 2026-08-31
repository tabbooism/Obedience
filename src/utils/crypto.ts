import { GraphNode, GraphEdge } from "../types";

// Simulated SHA-256 string generator
export function generateHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  const randomSalt = "7fa490b82e1c9441";
  return `${hex}${randomSalt}${hex.split("").reverse().join("")}`.padEnd(64, "f");
}

// Anomaly Detection Algorithm for Graph & Access Events
export function detectGraphAnomalies(nodes: GraphNode[], edges: GraphEdge[]) {
  const anomalies: {
    nodeId: string;
    label: string;
    type: "high_centrality" | "suspicious_bridge" | "high_risk_cluster" | "unverified_isolated";
    description: string;
    riskBoost: number;
  }[] = [];

  const degreeMap: Record<string, number> = {};
  edges.forEach((e) => {
    degreeMap[e.source] = (degreeMap[e.source] || 0) + 1;
    degreeMap[e.target] = (degreeMap[e.target] || 0) + 1;
  });

  nodes.forEach((n) => {
    const degree = degreeMap[n.id] || 0;
    
    // High Centrality / Hub Entity
    if (degree >= 3) {
      anomalies.push({
        nodeId: n.id,
        label: n.label,
        type: "high_centrality",
        description: `Key Hub Entity: Connected to ${degree} distinct network nodes across boundaries.`,
        riskBoost: 12,
      });
    }

    // High Risk Bridge (Connected to dark web/threat actor)
    const connectedEdges = edges.filter((e) => e.source === n.id || e.target === n.id);
    const hasThreatActorLink = connectedEdges.some((e) => {
      const otherId = e.source === n.id ? e.target : e.source;
      const otherNode = nodes.find((node) => node.id === otherId);
      return otherNode?.type === "threat_actor" || otherNode?.type === "crypto_wallet" || otherNode?.type === "domain";
    });

    if (hasThreatActorLink && n.type === "person") {
      anomalies.push({
        nodeId: n.id,
        label: n.label,
        type: "suspicious_bridge",
        description: "Suspicious Insider Bridge: Direct link to external threat infrastructure or cryptocurrency mixing pool.",
        riskBoost: 25,
      });
    }

    // High risk score standalone
    if (n.riskScore >= 85) {
      anomalies.push({
        nodeId: n.id,
        label: n.label,
        type: "high_risk_cluster",
        description: `Critical Threat Score (${n.riskScore}/100) requires immediate mitigation review.`,
        riskBoost: 10,
      });
    }
  });

  return anomalies;
}

// Force-Directed Layout Physics Step
export function applyForceDirectedLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  iterations = 40
): GraphNode[] {
  const updatedNodes = nodes.map((n) => ({ ...n, vx: 0, vy: 0 }));
  const k = Math.sqrt((width * height) / (nodes.length + 1));
  const repulsionForce = k * 1.6;
  const springLength = k * 0.9;

  for (let iter = 0; iter < iterations; iter++) {
    // 1. Repulsion between all pairs
    for (let i = 0; i < updatedNodes.length; i++) {
      for (let j = i + 1; j < updatedNodes.length; j++) {
        const u = updatedNodes[i];
        const v = updatedNodes[j];
        let dx = u.x - v.x;
        let dy = u.y - v.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > 500) continue;

        const force = (repulsionForce * repulsionForce) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        u.vx = (u.vx || 0) + fx * 0.04;
        u.vy = (u.vy || 0) + fy * 0.04;
        v.vx = (v.vx || 0) - fx * 0.04;
        v.vy = (v.vy || 0) - fy * 0.04;
      }
    }

    // 2. Attraction along edges
    for (const edge of edges) {
      const u = updatedNodes.find((n) => n.id === edge.source);
      const v = updatedNodes.find((n) => n.id === edge.target);
      if (!u || !v) continue;

      let dx = v.x - u.x;
      let dy = v.y - u.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist * dist) / springLength;
      const fx = (dx / dist) * force * 0.03;
      const fy = (dy / dist) * force * 0.03;

      u.vx = (u.vx || 0) + fx;
      u.vy = (u.vy || 0) + fy;
      v.vx = (v.vx || 0) - fx;
      v.vy = (v.vy || 0) - fy;
    }

    // 3. Gravity towards center & bounds
    const cx = width / 2;
    const cy = height / 2;
    for (const node of updatedNodes) {
      const gx = (cx - node.x) * 0.015;
      const gy = (cy - node.y) * 0.015;
      node.vx = (node.vx || 0) + gx;
      node.vy = (node.vy || 0) + gy;

      node.x += Math.max(-20, Math.min(20, node.vx || 0));
      node.y += Math.max(-20, Math.min(20, node.vy || 0));

      // Damping
      node.vx = (node.vx || 0) * 0.75;
      node.vy = (node.vy || 0) * 0.75;

      // Keep within canvas padding
      node.x = Math.max(60, Math.min(width - 60, node.x));
      node.y = Math.max(60, Math.min(height - 60, node.y));
    }
  }

  return updatedNodes;
}

// Circular Layout Algorithm
export function applyCircularLayout(nodes: GraphNode[], width: number, height: number): GraphNode[] {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;
  const angleStep = (2 * Math.PI) / (nodes.length || 1);

  return nodes.map((node, index) => {
    const angle = index * angleStep;
    return {
      ...node,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}
