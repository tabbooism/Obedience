import * as d3 from "d3";
import { GraphNode, GraphEdge } from "../../types";

export interface D3SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
  riskScore: number;
  confidence: number;
  classification: string;
  tags: string[];
  attributes: Record<string, string | number | boolean>;
  notes?: string;
  isFlagged?: boolean;
  avatarUrl?: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface D3SimulationLink extends d3.SimulationLinkDatum<D3SimulationNode> {
  id: string;
  source: string | D3SimulationNode;
  target: string | D3SimulationNode;
  label: string;
  type?: string;
  confidence: number;
  weight?: number;
  riskWeight?: number;
  isDirectional?: boolean;
}

export interface SimulationConfig {
  chargeStrength: number;
  linkDistance: number;
  collisionRadius: number;
  centerStrength: number;
  clusterByType: boolean;
}

export const defaultSimulationConfig: SimulationConfig = {
  chargeStrength: -380,
  linkDistance: 110,
  collisionRadius: 42,
  centerStrength: 0.05,
  clusterByType: true,
};

// Type cluster centers
export const typeClusterCenters: Record<string, { x: number; y: number }> = {
  person: { x: -160, y: -120 },
  organization: { x: 0, y: -180 },
  threat_actor: { x: 200, y: -120 },
  ip_address: { x: 220, y: 120 },
  domain: { x: 80, y: 180 },
  crypto_wallet: { x: -80, y: 180 },
  digital_key: { x: -220, y: 120 },
  location: { x: -180, y: 0 },
  vehicle: { x: 180, y: 0 },
};

/**
 * Creates and configures a D3 force simulation for OSINT graph layout
 */
export function createD3ForceSimulation(
  nodes: D3SimulationNode[],
  edges: D3SimulationLink[],
  width: number,
  height: number,
  config: SimulationConfig = defaultSimulationConfig,
  onTick?: () => void
): d3.Simulation<D3SimulationNode, D3SimulationLink> {
  const simulation = d3
    .forceSimulation<D3SimulationNode, D3SimulationLink>(nodes)
    // Repulsion force between nodes
    .force(
      "charge",
      d3.forceManyBody<D3SimulationNode>().strength((d) => {
        // High risk nodes have stronger repulsion for visibility
        const riskFactor = (d.riskScore || 50) / 50;
        return config.chargeStrength * riskFactor;
      })
    )
    // Spring link force between connected entities
    .force(
      "link",
      d3
        .forceLink<D3SimulationNode, D3SimulationLink>(edges)
        .id((d) => d.id)
        .distance((d) => {
          const baseDistance = config.linkDistance;
          // Shorter distance for high-confidence connections
          const confidenceFactor = 1.4 - ((d.confidence || 80) / 100) * 0.5;
          return baseDistance * confidenceFactor;
        })
        .strength((d) => {
          return Math.min(1, Math.max(0.1, ((d.riskWeight || 50) / 100) * 0.8));
        })
    )
    // Center gravity force
    .force("center", d3.forceCenter(width / 2, height / 2).strength(config.centerStrength))
    // Collision avoidance
    .force(
      "collision",
      d3.forceCollide<D3SimulationNode>().radius((d) => {
        const isSelectedOrFlagged = d.isFlagged || d.riskScore >= 85;
        return (config.collisionRadius + (isSelectedOrFlagged ? 12 : 4));
      }).iterations(2)
    );

  // Optional entity-type clustering force
  if (config.clusterByType) {
    const cx = width / 2;
    const cy = height / 2;

    simulation.force(
      "typeX",
      d3.forceX<D3SimulationNode>((d) => {
        const offset = typeClusterCenters[d.type] || { x: 0, y: 0 };
        return cx + offset.x;
      }).strength(0.08)
    );

    simulation.force(
      "typeY",
      d3.forceY<D3SimulationNode>((d) => {
        const offset = typeClusterCenters[d.type] || { x: 0, y: 0 };
        return cy + offset.y;
      }).strength(0.08)
    );
  }

  if (onTick) {
    simulation.on("tick", onTick);
  }

  return simulation;
}
