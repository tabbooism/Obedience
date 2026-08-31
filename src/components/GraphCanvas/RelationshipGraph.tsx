import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  GraphNode, 
  GraphEdge, 
  EntityType, 
  UserRole 
} from "../../types";
import { 
  applyForceDirectedLayout, 
  applyCircularLayout, 
  detectGraphAnomalies 
} from "../../utils/crypto";
import { NodeInspector } from "./NodeInspector";
import { 
  User, 
  Building, 
  Server, 
  Globe, 
  Coins, 
  MapPin, 
  Car, 
  Key, 
  Skull, 
  Plus, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Play, 
  CircleDot, 
  ShieldAlert, 
  SlidersHorizontal, 
  Download, 
  Filter,
  Layers,
  Sparkles,
  Search,
  Eye,
  Activity,
  Radar,
  Radio,
  ExternalLink,
  Lock,
  Trash2,
  Cpu
} from "lucide-react";

interface RelationshipGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onUpdateNodes: (nodes: GraphNode[]) => void;
  onUpdateEdges: (edges: GraphEdge[]) => void;
  userRole: UserRole;
  onOpenAICopilotWithPrompt?: (prompt: string) => void;
  searchFilter: string;
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({
  nodes,
  edges,
  onUpdateNodes,
  onUpdateEdges,
  userRole,
  onOpenAICopilotWithPrompt,
  searchFilter,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Viewport transformation (Pan & Zoom)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging single node
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Interactive link creation mode
  const [linkingSourceNodeId, setLinkingSourceNodeId] = useState<string | null>(null);

  // Selected node for inspector drawer
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id || null);

  // Filter & Anomaly Overlay States
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [minRiskFilter, setMinRiskFilter] = useState<number>(0);
  const [showAnomalies, setShowAnomalies] = useState<boolean>(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showLiveScanModal, setShowLiveScanModal] = useState<boolean>(false);
  const [showOsintModal, setShowOsintModal] = useState<boolean>(false);

  // Live Target Scanner Form State
  const [targetInput, setTargetInput] = useState<string>("");
  const [isScanningTarget, setIsScanningTarget] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<any>(null);

  // Grounded OSINT Search Form State
  const [osintQuery, setOsintQuery] = useState<string>("");
  const [osintType, setOsintType] = useState<string>("domain");
  const [isSearchingOsint, setIsSearchingOsint] = useState<boolean>(false);

  // New Node Form State
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeType, setNewNodeType] = useState<EntityType>("person");
  const [newNodeRisk, setNewNodeRisk] = useState(65);
  const [newNodeClassification, setNewNodeClassification] = useState<any>("Secret");

  // Computed Anomalies
  const anomalies = useMemo(() => detectGraphAnomalies(nodes, edges), [nodes, edges]);
  const anomalyNodeIds = useMemo(() => new Set(anomalies.map((a) => a.nodeId)), [anomalies]);

  // Keep selectedNodeId valid
  useEffect(() => {
    if (!selectedNodeId && nodes.length > 0) {
      setSelectedNodeId(nodes[0].id);
    }
  }, [nodes, selectedNodeId]);

  // Node Icons dictionary
  const getNodeIcon = (type: EntityType) => {
    switch (type) {
      case "person": return User;
      case "organization": return Building;
      case "ip_address": return Server;
      case "domain": return Globe;
      case "crypto_wallet": return Coins;
      case "location": return MapPin;
      case "vehicle": return Car;
      case "digital_key": return Key;
      case "threat_actor": return Skull;
      default: return CircleDot;
    }
  };

  const getNodeColor = (node: GraphNode) => {
    if (node.isFlagged || node.riskScore >= 85) return {
      bg: "fill-rose-950/80 stroke-rose-500",
      glow: "rgba(244, 63, 94, 0.4)",
      badgeBg: "bg-rose-500 text-white",
      text: "text-rose-300"
    };
    if (node.riskScore >= 60) return {
      bg: "fill-amber-950/80 stroke-amber-500",
      glow: "rgba(245, 158, 11, 0.3)",
      badgeBg: "bg-amber-500 text-slate-950",
      text: "text-amber-300"
    };
    return {
      bg: "fill-cyan-950/80 stroke-cyan-500",
      glow: "rgba(6, 182, 212, 0.3)",
      badgeBg: "bg-cyan-500 text-slate-950",
      text: "text-cyan-300"
    };
  };

  // Filtered nodes based on search and filters
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (selectedTypeFilter !== "all" && n.type !== selectedTypeFilter) return false;
      if (n.riskScore < minRiskFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchLabel = n.label.toLowerCase().includes(q);
        const matchTags = n.tags.some((t) => t.toLowerCase().includes(q));
        const matchNotes = (n.notes || "").toLowerCase().includes(q);
        if (!matchLabel && !matchTags && !matchNotes) return false;
      }
      return true;
    });
  }, [nodes, selectedTypeFilter, minRiskFilter, searchFilter]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
  }, [edges, filteredNodeIds]);

  // Selected node object
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Zoom & Pan Handlers
  const handleZoom = (factor: number) => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(Math.max(prev.scale * factor, 0.3), 3.5),
    }));
  };

  const handleResetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const handleMouseDownSvg = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMoveSvg = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    } else if (draggedNodeId) {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;

      const mouseX = (e.clientX - svgRect.left - transform.x) / transform.scale;
      const mouseY = (e.clientY - svgRect.top - transform.y) / transform.scale;

      onUpdateNodes(
        nodes.map((n) => (n.id === draggedNodeId ? { ...n, x: mouseX - dragOffset.x, y: mouseY - dragOffset.y } : n))
      );
    }
  };

  const handleMouseUpSvg = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  // Mobile Touch Event Handlers
  const handleTouchStartSvg = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsPanning(true);
      setPanStart({ x: touch.clientX - transform.x, y: touch.clientY - transform.y });
    }
  };

  const handleTouchMoveSvg = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (isPanning) {
        setTransform((prev) => ({
          ...prev,
          x: touch.clientX - panStart.x,
          y: touch.clientY - panStart.y,
        }));
      } else if (draggedNodeId) {
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return;

        const touchX = (touch.clientX - svgRect.left - transform.x) / transform.scale;
        const touchY = (touch.clientY - svgRect.top - transform.y) / transform.scale;

        onUpdateNodes(
          nodes.map((n) => (n.id === draggedNodeId ? { ...n, x: touchX - dragOffset.x, y: touchY - dragOffset.y } : n))
        );
      }
    }
  };

  const handleTouchEndSvg = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  const handleNodeTouchStart = (e: React.TouchEvent, node: GraphNode) => {
    e.stopPropagation();
    if (e.touches.length === 1) {
      const touch = e.touches[0];

      if (linkingSourceNodeId) {
        if (linkingSourceNodeId !== node.id) {
          const newEdge: GraphEdge = {
            id: `edge-${Date.now()}`,
            source: linkingSourceNodeId,
            target: node.id,
            label: "Linked In Telemetry",
            riskWeight: 70,
            confidence: 90,
            isDirectional: true,
          };
          onUpdateEdges([...edges, newEdge]);
        }
        setLinkingSourceNodeId(null);
        return;
      }

      setSelectedNodeId(node.id);
      setDraggedNodeId(node.id);

      const svgRect = svgRef.current?.getBoundingClientRect();
      if (svgRect) {
        const touchX = (touch.clientX - svgRect.left - transform.x) / transform.scale;
        const touchY = (touch.clientY - svgRect.top - transform.y) / transform.scale;
        setDragOffset({ x: touchX - node.x, y: touchY - node.y });
      }
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();

    if (linkingSourceNodeId) {
      if (linkingSourceNodeId !== node.id) {
        const newEdge: GraphEdge = {
          id: `edge-${Date.now()}`,
          source: linkingSourceNodeId,
          target: node.id,
          label: "Linked In Telemetry",
          riskWeight: 70,
          confidence: 90,
          isDirectional: true,
        };
        onUpdateEdges([...edges, newEdge]);
      }
      setLinkingSourceNodeId(null);
      return;
    }

    setSelectedNodeId(node.id);
    setDraggedNodeId(node.id);

    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
      const mouseX = (e.clientX - svgRect.left - transform.x) / transform.scale;
      const mouseY = (e.clientY - svgRect.top - transform.y) / transform.scale;
      setDragOffset({ x: mouseX - node.x, y: mouseY - node.y });
    }
  };

  // Node Inspector Updates
  const handleUpdateNode = (updated: GraphNode) => {
    onUpdateNodes(nodes.map((n) => (n.id === updated.id ? updated : n)));
  };

  const handleDeleteNode = (id: string) => {
    onUpdateNodes(nodes.filter((n) => n.id !== id));
    onUpdateEdges(edges.filter((e) => e.source !== id && e.target !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  // Layout Trigger Handlers
  const handleApplyForceLayout = () => {
    const arranged = applyForceDirectedLayout(nodes, edges, 900, 600);
    onUpdateNodes(arranged);
  };

  const handleApplyCircularLayout = () => {
    const arranged = applyCircularLayout(nodes, 900, 600);
    onUpdateNodes(arranged);
  };

  // Create Manual Node Handler
  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeLabel.trim()) return;

    const newNode: GraphNode = {
      id: `node-${Date.now()}`,
      label: newNodeLabel.trim(),
      type: newNodeType,
      x: 450 + (Math.random() * 80 - 40),
      y: 300 + (Math.random() * 80 - 40),
      riskScore: newNodeRisk,
      confidence: 88,
      classification: newNodeClassification,
      tags: ["OPERATOR_INGESTED"],
      attributes: {
        "Ingested At": new Date().toISOString(),
        "Ingested By": userRole,
      },
    };

    onUpdateNodes([...nodes, newNode]);
    setSelectedNodeId(newNode.id);
    setNewNodeLabel("");
    setShowAddModal(false);
  };

  // Live Target Scanner Handler (Real DNS / HTTPS Recon)
  const handleRunLiveScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInput.trim()) return;

    setIsScanningTarget(true);
    setScanResult(null);

    try {
      const res = await fetch("/api/live/scan-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: targetInput.trim() }),
      });

      const data = await res.json();
      setScanResult(data);

      if (data.success) {
        // Automatically create graph nodes for the target, resolved IPs, and SSL
        const targetNodeId = `node-target-${Date.now()}`;
        const newNodesToAdd: GraphNode[] = [];
        const newEdgesToAdd: GraphEdge[] = [];

        // Primary Host Node
        const targetNode: GraphNode = {
          id: targetNodeId,
          label: data.host,
          type: "domain",
          x: 450,
          y: 280,
          riskScore: data.riskScore || 30,
          confidence: 98,
          classification: "Secret",
          tags: ["LIVE_SCAN_TARGET", data.http?.server || "WEB_HOST"],
          isFlagged: data.riskScore > 60,
          attributes: {
            "Host": data.host,
            "Latency": `${data.latencyMs}ms`,
            "HTTP Status": data.http?.statusCode?.toString() || "N/A",
            "Server Header": data.http?.server || "Unknown",
            "HSTS": data.http?.hsts ? "Enabled" : "Missing",
            "CSP": data.http?.csp ? "Configured" : "Missing",
          },
          notes: `Live Reconnaissance: Found ${data.detectedIssues?.length || 0} posture issues: ${data.detectedIssues?.join("; ")}`,
        };
        newNodesToAdd.push(targetNode);

        // Resolved IP Nodes
        if (data.dns?.a && data.dns.a.length > 0) {
          data.dns.a.slice(0, 3).forEach((ip: string, idx: number) => {
            const ipNodeId = `node-ip-${Date.now()}-${idx}`;
            const ipNode: GraphNode = {
              id: ipNodeId,
              label: ip,
              type: "ip_address",
              x: 320 + idx * 100,
              y: 420,
              riskScore: 35,
              confidence: 99,
              classification: "Confidential",
              tags: ["DNS_A_RECORD", "HOST_IP"],
              attributes: {
                "IP": ip,
                "DNS Type": "IPv4 A Record",
                "Reverse Host": data.host,
              },
            };
            newNodesToAdd.push(ipNode);

            newEdgesToAdd.push({
              id: `edge-dns-${Date.now()}-${idx}`,
              source: targetNodeId,
              target: ipNodeId,
              label: "DNS Resolves To",
              riskWeight: 40,
              confidence: 100,
              isDirectional: true,
            });
          });
        }

        // SSL Certificate Node
        if (data.ssl) {
          const sslNodeId = `node-ssl-${Date.now()}`;
          const sslNode: GraphNode = {
            id: sslNodeId,
            label: `SSL: ${data.ssl.issuer?.O || data.ssl.issuer?.CN || "TLS Authority"}`,
            type: "digital_key",
            x: 600,
            y: 380,
            riskScore: 20,
            confidence: 95,
            classification: "Secret",
            tags: ["TLS_CERTIFICATE", data.ssl.protocol || "TLSv1.3"],
            attributes: {
              "Cipher": data.ssl.cipher || "N/A",
              "Valid To": data.ssl.validTo || "N/A",
              "Fingerprint (SHA-256)": data.ssl.fingerprint256 || "N/A",
            },
          };
          newNodesToAdd.push(sslNode);

          newEdgesToAdd.push({
            id: `edge-ssl-${Date.now()}`,
            source: targetNodeId,
            target: sslNodeId,
            label: "Bound TLS Certificate",
            riskWeight: 20,
            confidence: 99,
            isDirectional: true,
          });
        }

        onUpdateNodes([...nodes, ...newNodesToAdd]);
        onUpdateEdges([...edges, ...newEdgesToAdd]);
        setSelectedNodeId(targetNodeId);
      }
    } catch (err) {
      console.error("Scan failed:", err);
    } finally {
      setIsScanningTarget(false);
    }
  };

  // Live Grounded OSINT Search Handler
  const handleRunOsintSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!osintQuery.trim()) return;

    setIsSearchingOsint(true);
    try {
      const res = await fetch("/api/live/osint-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: osintQuery.trim(), entityType: osintType }),
      });

      const data = await res.json();
      if (data.intelligence) {
        const intel = data.intelligence;
        const newNodeId = `node-osint-${Date.now()}`;

        const newNode: GraphNode = {
          id: newNodeId,
          label: osintQuery.trim(),
          type: (osintType as EntityType) || "threat_actor",
          x: 450 + (Math.random() * 100 - 50),
          y: 300 + (Math.random() * 100 - 50),
          riskScore: intel.riskScore || 75,
          confidence: intel.confidence || 90,
          classification: intel.classification || "Secret",
          tags: intel.tags || ["OSINT_DISCOVERED", osintType.toUpperCase()],
          isFlagged: (intel.riskScore || 0) > 70,
          attributes: intel.attributes || {
            "Summary": intel.summary,
            "Recommended Action": intel.recommendedAction,
          },
          notes: intel.summary,
        };

        onUpdateNodes([...nodes, newNode]);
        setSelectedNodeId(newNodeId);
        setShowOsintModal(false);
        setOsintQuery("");
      }
    } catch (err) {
      console.error("OSINT search failed:", err);
    } finally {
      setIsSearchingOsint(false);
    }
  };

  return (
    <div className="flex-1 flex h-full relative overflow-hidden bg-slate-950">
      {/* Main Canvas Area */}
      <div ref={containerRef} className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Top Floating Graph Action Bar */}
        <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 z-20 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pointer-events-none">
          {/* Left Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 sm:p-1.5 shadow-xl pointer-events-auto max-w-full overflow-x-auto">
            {/* Live Target Recon Button */}
            <button
              onClick={() => {
                setShowLiveScanModal(true);
                setScanResult(null);
              }}
              className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-950 transition-all cursor-pointer whitespace-nowrap"
              title="Perform real live DNS, SSL, and HTTP header recon on any target domain or IP"
            >
              <Radar className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "12s" }} />
              <span className="hidden xs:inline sm:inline">LIVE SCANNER</span>
              <span className="xs:hidden sm:hidden">SCAN</span>
            </button>

            {/* Grounded OSINT Search Button */}
            <button
              onClick={() => setShowOsintModal(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">GROUNDED OSINT</span>
              <span className="sm:hidden">OSINT</span>
            </button>

            {/* Add Node Manual */}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-2 sm:px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ADD ENTITY</span>
              <span className="sm:hidden">ADD</span>
            </button>

            <div className="h-4 w-px bg-slate-800" />

            {/* Interactive Link Toggle */}
            <button
              onClick={() => {
                if (linkingSourceNodeId) {
                  setLinkingSourceNodeId(null);
                } else if (selectedNodeId) {
                  setLinkingSourceNodeId(selectedNodeId);
                }
              }}
              className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1 transition-all cursor-pointer whitespace-nowrap ${
                linkingSourceNodeId
                  ? "bg-amber-500 text-slate-950 font-bold animate-pulse"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <CircleDot className="w-3.5 h-3.5" />
              <span>{linkingSourceNodeId ? "SELECT TARGET" : "LINK"}</span>
            </button>
          </div>

          {/* Right Floating Controls: Layout & Filters */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 sm:p-1.5 shadow-xl pointer-events-auto max-w-full overflow-x-auto">
            {/* Force Layout */}
            <button
              onClick={handleApplyForceLayout}
              className="px-2 sm:px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono flex items-center space-x-1 transition-colors whitespace-nowrap"
              title="Force-Directed Physics Layout"
            >
              <Play className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">FORCE</span>
            </button>

            {/* Circular Layout */}
            <button
              onClick={handleApplyCircularLayout}
              className="px-2 sm:px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono flex items-center space-x-1 transition-colors whitespace-nowrap"
              title="Radial Circular Layout"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">RADIAL</span>
            </button>

            <div className="h-4 w-px bg-slate-800" />

            {/* Anomaly Overlay Toggle */}
            <button
              onClick={() => setShowAnomalies(!showAnomalies)}
              className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center space-x-1 transition-all whitespace-nowrap ${
                showAnomalies
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{showAnomalies ? `(${anomalies.length})` : "ANOMALIES"}</span>
            </button>

            {/* Filter by Entity Type */}
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono rounded-lg px-1.5 sm:px-2 py-1.5 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="person">Persons</option>
              <option value="organization">Orgs</option>
              <option value="ip_address">IPs</option>
              <option value="domain">Domains</option>
              <option value="crypto_wallet">Wallets</option>
              <option value="threat_actor">Actors</option>
            </select>
          </div>
        </div>

        {/* Floating Zoom Controls */}
        <div className="absolute bottom-4 left-4 z-20 flex flex-col space-y-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 shadow-xl">
          <button
            onClick={() => handleZoom(1.2)}
            className="p-2 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(0.8)}
            className="p-2 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Live Ops Empty State Backdrop if no nodes in graph */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 font-mono">
            <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <Radar className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                    LIVE INVESTIGATION CANVAS
                  </h3>
                </div>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  Workspace is running in clean Live Operations mode with zero mock data. Ingest real targets, probe live networks, or import real-time threat intelligence.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={() => {
                    setShowLiveScanModal(true);
                    setScanResult(null);
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-mono text-xs font-bold shadow-lg shadow-emerald-950 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Radar className="w-4 h-4" />
                  <span>PROBE LIVE TARGET (DOMAIN / IP)</span>
                </button>

                <button
                  onClick={() => setShowOsintModal(true)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl font-mono text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>GROUNDED OSINT INVESTIGATION</span>
                </button>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl font-mono text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>ADD MANUAL ENTITY</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SVG Relationship Graph Canvas */}
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing select-none touch-none"
          onMouseDown={handleMouseDownSvg}
          onMouseMove={handleMouseMoveSvg}
          onMouseUp={handleMouseUpSvg}
          onTouchStart={handleTouchStartSvg}
          onTouchMove={handleTouchMoveSvg}
          onTouchEnd={handleTouchEndSvg}
        >
          {/* Background Grid Pattern */}
          <defs>
            <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(51, 65, 85, 0.2)" strokeWidth="1" />
            </pattern>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
            </marker>
          </defs>

          <rect width="100%" height="100%" fill="url(#graph-grid)" />

          {/* Scaled & Translated Layer */}
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {/* Edges Layer */}
            {filteredEdges.map((edge) => {
              const src = nodes.find((n) => n.id === edge.source);
              const tgt = nodes.find((n) => n.id === edge.target);
              if (!src || !tgt) return null;

              const isAnomalyEdge = anomalyNodeIds.has(src.id) || anomalyNodeIds.has(tgt.id);
              const isHighRisk = edge.riskWeight >= 80;

              return (
                <g key={edge.id} className="transition-opacity duration-300">
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={
                      isAnomalyEdge && showAnomalies
                        ? "#f43f5e"
                        : isHighRisk
                        ? "#f59e0b"
                        : "#0e7490"
                    }
                    strokeWidth={isHighRisk ? 2.5 : 1.5}
                    strokeDasharray={edge.isDirectional ? undefined : "4 4"}
                    markerEnd={edge.isDirectional ? "url(#arrow)" : undefined}
                    className="opacity-70"
                  />
                  {edge.label && (
                    <text
                      x={(src.x + tgt.x) / 2}
                      y={(src.y + tgt.y) / 2 - 6}
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                      className="select-none bg-slate-950 px-1"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes Layer */}
            {filteredNodes.map((node) => {
              const colors = getNodeColor(node);
              const IconComponent = getNodeIcon(node.type);
              const isSelected = selectedNodeId === node.id;
              const isAnomaly = anomalyNodeIds.has(node.id) && showAnomalies;
              const isLinkingSource = linkingSourceNodeId === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  onTouchStart={(e) => handleNodeTouchStart(e, node)}
                  className="cursor-pointer"
                >
                  {/* Anomaly Aura Halo */}
                  {isAnomaly && (
                    <circle
                      r="36"
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      className="animate-spin"
                      style={{ animationDuration: "14s" }}
                    />
                  )}

                  {/* Linking Source Ring */}
                  {isLinkingSource && (
                    <circle
                      r="34"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                      className="animate-ping"
                    />
                  )}

                  {/* Outer Selection Ring */}
                  {isSelected && (
                    <circle
                      r="30"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2"
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Main Node Body Circle */}
                  <circle
                    r="22"
                    className={`${colors.bg} transition-colors duration-200 stroke-2`}
                    filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                  />

                  {/* Node Icon */}
                  <foreignObject x="-10" y="-10" width="20" height="20">
                    <div className="w-full h-full flex items-center justify-center">
                      <IconComponent className={`w-4 h-4 ${colors.text}`} />
                    </div>
                  </foreignObject>

                  {/* Risk Score Pill on Top */}
                  <foreignObject x="-14" y="-32" width="28" height="14">
                    <div
                      className={`text-[9px] font-mono font-bold px-1 rounded-full text-center ${colors.badgeBg} shadow-sm`}
                    >
                      {node.riskScore}
                    </div>
                  </foreignObject>

                  {/* Label Text below */}
                  <text
                    x="0"
                    y="34"
                    fill="#f1f5f9"
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="600"
                    textAnchor="middle"
                    className="select-none pointer-events-none drop-shadow-md"
                  >
                    {node.label.length > 20 ? node.label.slice(0, 18) + "..." : node.label}
                  </text>

                  {/* Type / Tag Subtext */}
                  <text
                    x="0"
                    y="46"
                    fill="#64748b"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="select-none pointer-events-none uppercase"
                  >
                    {node.type.replace("_", " ")}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Right Entity Inspector Drawer */}
      {selectedNode && (
        <NodeInspector
          node={selectedNode}
          edges={edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)}
          allNodes={nodes}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onClose={() => setSelectedNodeId(null)}
          userRole={userRole}
          onOpenAICopilotWithPrompt={onOpenAICopilotWithPrompt}
        />
      )}

      {/* Modal: Live Target Scanner Recon */}
      {showLiveScanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 font-sans max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Radar className="w-5 h-5 text-emerald-400 shrink-0" />
                <h3 className="font-bold text-slate-100 font-mono text-xs sm:text-sm uppercase truncate">
                  LIVE TARGET RECONNAISSANCE SCANNER
                </h3>
              </div>
              <button
                onClick={() => setShowLiveScanModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-100 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRunLiveScan} className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Target Domain or Host IP
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. github.com, cloudflare.com, or custom host"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isScanningTarget}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isScanningTarget ? (
                      <>
                        <Activity className="w-3.5 h-3.5 animate-spin" />
                        <span>PROBING...</span>
                      </>
                    ) : (
                      <>
                        <Radar className="w-3.5 h-3.5" />
                        <span>SCAN & INGEST</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Scan Output Telemetry */}
            {scanResult && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                  <span className="text-emerald-400 font-bold">SCAN COMPLETE</span>
                  <span className="text-slate-500">{scanResult.latencyMs}ms latency</span>
                </div>

                <div className="space-y-1 text-slate-300">
                  <div>
                    <span className="text-slate-500">Resolved IPs: </span>
                    <span className="text-cyan-300 font-bold">
                      {scanResult.dns?.a?.join(", ") || "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">SSL Issuer: </span>
                    <span className="text-slate-200">
                      {scanResult.ssl?.issuer?.O || scanResult.ssl?.issuer?.CN || "Unencrypted / No cert"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Security Score: </span>
                    <span className={scanResult.riskScore > 50 ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                      Risk Index {scanResult.riskScore}/100
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-400 pt-1 font-sans">
                  ✓ Target host, resolved IP nodes, and SSL parameters have been ingested into the relationship graph.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowLiveScanModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold"
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Grounded OSINT Search */}
      {showOsintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 font-sans max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Search className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 font-mono text-xs sm:text-sm uppercase">
                  GROUNDED OSINT INVESTIGATION
                </h3>
              </div>
              <button
                onClick={() => setShowOsintModal(false)}
                className="text-slate-400 hover:text-slate-100 text-sm p-1 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRunOsintSearch} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Investigation Target Query
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lazarus Group, CVE-2025-0282, or Company Name"
                  value={osintQuery}
                  onChange={(e) => setOsintQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Target Entity Classification
                </label>
                <select
                  value={osintType}
                  onChange={(e) => setOsintType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none"
                >
                  <option value="threat_actor">Threat Actor / APT</option>
                  <option value="domain">Domain / Host</option>
                  <option value="organization">Organization / Front Company</option>
                  <option value="person">Subject of Interest / Person</option>
                  <option value="crypto_wallet">Crypto Settlement Address</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOsintModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSearchingOsint}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-mono font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSearchingOsint ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>INVESTIGATING...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>SEARCH & INGEST</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manual Node Add */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 font-sans max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 font-mono text-xs sm:text-sm uppercase">
                  ADD INVESTIGATION ENTITY
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-100 text-sm p-1 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNode} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Entity Identifier / Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe, 194.26.29.11, or Vault Beta"
                  value={newNodeLabel}
                  onChange={(e) => setNewNodeLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Entity Type
                  </label>
                  <select
                    value={newNodeType}
                    onChange={(e: any) => setNewNodeType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none"
                  >
                    <option value="person">Person</option>
                    <option value="organization">Organization</option>
                    <option value="ip_address">IP Address</option>
                    <option value="domain">Domain</option>
                    <option value="crypto_wallet">Crypto Wallet</option>
                    <option value="location">Location / Facility</option>
                    <option value="digital_key">Digital Key</option>
                    <option value="threat_actor">Threat Actor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Classification
                  </label>
                  <select
                    value={newNodeClassification}
                    onChange={(e: any) => setNewNodeClassification(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none"
                  >
                    <option value="Unclassified">Unclassified</option>
                    <option value="Confidential">Confidential</option>
                    <option value="Secret">Secret</option>
                    <option value="Top Secret/SCI">Top Secret/SCI</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Assigned Risk Score ({newNodeRisk}/100)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newNodeRisk}
                  onChange={(e) => setNewNodeRisk(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-mono font-bold"
                >
                  Ingest Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
