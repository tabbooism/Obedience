import * as d3 from "d3";
import { GraphNode, EntityType } from "../../types";

export interface ClusterHullData {
  type: EntityType;
  pathString: string;
  centroid: [number, number];
  count: number;
  color: string;
}

export const typeColorMap: Record<EntityType, { stroke: string; fill: string; label: string }> = {
  person: { stroke: "#a855f7", fill: "rgba(168, 85, 247, 0.08)", label: "PERSONNEL / SUBJECTS" },
  organization: { stroke: "#10b981", fill: "rgba(16, 185, 129, 0.08)", label: "ORGANIZATIONS" },
  ip_address: { stroke: "#06b6d4", fill: "rgba(6, 182, 212, 0.08)", label: "IP SUBNETS" },
  domain: { stroke: "#3b82f6", fill: "rgba(59, 130, 246, 0.08)", label: "DOMAINS & HOSTS" },
  crypto_wallet: { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.08)", label: "CRYPTO WALLETS" },
  location: { stroke: "#84cc16", fill: "rgba(132, 204, 22, 0.08)", label: "PHYSICAL LOCATIONS" },
  vehicle: { stroke: "#6366f1", fill: "rgba(99, 102, 241, 0.08)", label: "VEHICLES / ASSETS" },
  digital_key: { stroke: "#ec4899", fill: "rgba(236, 72, 153, 0.08)", label: "DIGITAL KEYS" },
  threat_actor: { stroke: "#f43f5e", fill: "rgba(244, 63, 94, 0.12)", label: "THREAT ACTORS / APTS" },
};

/**
 * Calculates smooth padded convex hull polygons around node clusters
 */
export function calculateClusterHulls(nodes: GraphNode[], padding = 45): ClusterHullData[] {
  const groups: Partial<Record<EntityType, GraphNode[]>> = {};

  nodes.forEach((n) => {
    if (!groups[n.type]) groups[n.type] = [];
    groups[n.type]!.push(n);
  });

  const hulls: ClusterHullData[] = [];

  (Object.keys(groups) as EntityType[]).forEach((type) => {
    const clusterNodes = groups[type];
    if (!clusterNodes || clusterNodes.length === 0) return;

    const points: [number, number][] = [];

    // Generate padded multi-points around each node in the cluster
    clusterNodes.forEach((n) => {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        points.push([
          n.x + Math.cos(angle) * padding,
          n.y + Math.sin(angle) * padding,
        ]);
      }
    });

    const hullPoints = d3.polygonHull(points);
    if (!hullPoints || hullPoints.length < 3) return;

    // Compute Centroid
    const centroid = d3.polygonCentroid(hullPoints);

    // Smooth curve generator
    const lineGenerator = d3.line<[number, number]>().curve(d3.curveCatmullRomClosed);
    const pathString = lineGenerator(hullPoints) || "";

    hulls.push({
      type,
      pathString,
      centroid,
      count: clusterNodes.length,
      color: typeColorMap[type]?.stroke || "#06b6d4",
    });
  });

  return hulls;
}
