import React, { useState } from "react";
import { 
  GraphNode, 
  GraphEdge, 
  UserRole 
} from "../../types";
import { 
  X, 
  Sparkles, 
  ShieldAlert, 
  Link as LinkIcon, 
  Trash2, 
  ExternalLink, 
  Tag, 
  Plus, 
  FileText,
  AlertTriangle,
  Fingerprint,
  Radio,
  CheckCircle2
} from "lucide-react";

interface NodeInspectorProps {
  node: GraphNode | null;
  edges: GraphEdge[];
  allNodes: GraphNode[];
  onClose: () => void;
  onUpdateNode: (updated: GraphNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddEdge?: (source: string, target: string, label: string, type: any) => void;
  onDeleteEdge?: (edgeId: string) => void;
  userRole: UserRole;
  onRunAIEvaluation?: (node: GraphNode) => void;
  onOpenAICopilotWithPrompt?: (prompt: string) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  edges,
  allNodes,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onAddEdge,
  onDeleteEdge,
  userRole,
  onRunAIEvaluation,
  onOpenAICopilotWithPrompt,
}) => {
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState<any>(null);
  const [newTag, setNewTag] = useState("");
  const [notes, setNotes] = useState(node?.notes || "");
  const [connectTargetId, setConnectTargetId] = useState("");
  const [connectLabel, setConnectLabel] = useState("associated_with");
  const [isAddingConnection, setIsAddingConnection] = useState(false);

  if (!node) return null;

  const connectedEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id
  );

  const handleEnrich = async () => {
    setIsEnriching(true);
    try {
      const res = await fetch("/api/enrich-entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: node.type,
          entityValue: node.label,
        }),
      });
      const data = await res.json();
      if (data.enriched) {
        setEnrichmentResult(data.enriched);
        // Automatically append discovered tags
        const newTags = Array.from(
          new Set([...node.tags, ...(data.enriched.threatCategories || [])])
        );
        onUpdateNode({
          ...node,
          tags: newTags,
          riskScore: Math.max(node.riskScore, data.enriched.riskScore || 0),
          notes: (node.notes ? node.notes + "\n\n" : "") + `[AI ENRICHMENT]: ${data.enriched.summary || "Enriched via OSINT telemetry."}`,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    if (!node.tags.includes(newTag.trim())) {
      onUpdateNode({
        ...node,
        tags: [...node.tags, newTag.trim()],
      });
    }
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateNode({
      ...node,
      tags: node.tags.filter((t) => t !== tagToRemove),
    });
  };

  const handleSaveNotes = () => {
    onUpdateNode({
      ...node,
      notes,
    });
  };

  const handleCreateConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectTargetId) return;
    onAddEdge(node.id, connectTargetId, connectLabel, "affiliated_with");
    setIsAddingConnection(false);
    setConnectTargetId("");
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-rose-400 bg-rose-500/10 border-rose-500/30";
    if (score >= 50) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-30 sm:hidden transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="fixed sm:relative inset-y-0 right-0 z-40 sm:z-20 w-full sm:w-80 lg:w-96 max-w-full bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <Fingerprint className="w-4 h-4 text-cyan-400 shrink-0" />
            <h3 className="text-sm font-bold text-slate-100 truncate font-mono uppercase">
              {node.type.replace("_", " ")} DOSSIER
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      {/* Body Content */}
      <div className="p-4 space-y-5 overflow-y-auto flex-1 text-xs">
        {/* Node Entity Primary Info */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400">ENTITY IDENTIFIER</span>
              <h2 className="text-base font-bold text-slate-100 tracking-tight">{node.label}</h2>
              <span className="text-[10px] font-mono text-cyan-400">{node.classification}</span>
            </div>
            <div className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold ${getRiskColor(node.riskScore)}`}>
              RISK: {node.riskScore}/100
            </div>
          </div>

          {/* Quick AI Enrichment Button */}
          <button
            onClick={handleEnrich}
            disabled={isEnriching}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 border border-cyan-400/30 text-white font-semibold flex items-center justify-center space-x-2 shadow-sm transition-all disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 text-cyan-200 ${isEnriching ? "animate-spin" : ""}`} />
            <span>{isEnriching ? "QUERYING OSINT TELEMETRY..." : "AI DEEP OSINT ENRICHMENT"}</span>
          </button>
        </div>

        {/* AI OSINT Enrichment Result Box */}
        {enrichmentResult && (
          <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-xl p-3 space-y-2 font-mono">
            <div className="flex items-center space-x-1.5 text-cyan-400 font-bold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>OSINT ENRICHMENT SYNOPSIS</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed font-sans">{enrichmentResult.summary}</p>
            {enrichmentResult.recommendedPivot && (
              <div className="p-2 bg-slate-950/80 rounded border border-cyan-500/20 text-[10px] text-cyan-300">
                <span className="font-bold text-slate-400">RECOMMENDED PIVOT: </span>
                {enrichmentResult.recommendedPivot}
              </div>
            )}
          </div>
        )}

        {/* Attributes Table */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
            <span>DISCOVERED ATTRIBUTES</span>
            <span className="text-slate-400">{Object.keys(node.attributes || {}).length} Fields</span>
          </span>
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-2.5 space-y-1.5 font-mono">
            {Object.entries(node.attributes || {}).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-850 last:border-0">
                <span className="text-slate-400">{key}:</span>
                <span className="text-slate-200 font-medium truncate max-w-[170px]" title={String(val)}>
                  {String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tags Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400 font-bold">
            <span>INTELLIGENCE TAGS</span>
            <Tag className="w-3 h-3 text-slate-400" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {node.tags.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono flex items-center space-x-1"
              >
                <span>{t}</span>
                <button onClick={() => handleRemoveTag(t)} className="text-slate-500 hover:text-rose-400">
                  ×
                </button>
              </span>
            ))}
          </div>
          <form onSubmit={handleAddTag} className="flex gap-1 pt-1">
            <input
              type="text"
              placeholder="Add tag (e.g. C2-Node)..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-md font-mono"
            >
              +
            </button>
          </form>
        </div>

        {/* Connected Links & Relationship Pivot */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400 font-bold">
            <span>LINKED ENTITIES ({connectedEdges.length})</span>
            <button
              onClick={() => setIsAddingConnection(!isAddingConnection)}
              className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
            >
              <Plus className="w-3 h-3" />
              <span>LINK ENTITY</span>
            </button>
          </div>

          {/* Add Connection Form */}
          {isAddingConnection && (
            <form onSubmit={handleCreateConnection} className="bg-slate-950 border border-cyan-500/30 rounded-lg p-2.5 space-y-2">
              <div>
                <label className="text-[10px] text-slate-400 font-mono">TARGET ENTITY</label>
                <select
                  value={connectTargetId}
                  onChange={(e) => setConnectTargetId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-200"
                >
                  <option value="">Select target node...</option>
                  {allNodes
                    .filter((n) => n.id !== node.id)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label} ({n.type})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono">RELATIONSHIP LABEL</label>
                <input
                  type="text"
                  value={connectLabel}
                  onChange={(e) => setConnectLabel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-200 font-mono"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingConnection(false)}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!connectTargetId}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  Create Link
                </button>
              </div>
            </form>
          )}

          {/* Connected Edges List */}
          <div className="space-y-1.5">
            {connectedEdges.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic p-2 bg-slate-950/40 rounded border border-slate-800">
                No active links mapped to this entity.
              </p>
            ) : (
              connectedEdges.map((e) => {
                const otherNodeId = e.source === node.id ? e.target : e.source;
                const otherNode = allNodes.find((n) => n.id === otherNodeId);
                return (
                  <div
                    key={e.id}
                    className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-lg flex items-center justify-between group hover:border-slate-700"
                  >
                    <div className="truncate mr-2">
                      <p className="font-semibold text-slate-200 truncate">{otherNode?.label || otherNodeId}</p>
                      <p className="text-[10px] text-cyan-400 font-mono truncate">{e.label}</p>
                    </div>
                    <button
                      onClick={() => onDeleteEdge(e.id)}
                      className="text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      title="Remove Link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Investigator Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400 font-bold">
            <span>INVESTIGATOR CASE NOTES</span>
            <FileText className="w-3 h-3 text-slate-400" />
          </div>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add chain-of-custody or forensic notes here..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 leading-relaxed font-mono"
          />
          <button
            onClick={handleSaveNotes}
            className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs border border-slate-700 transition-colors"
          >
            Save Case Notes
          </button>
        </div>
      </div>

      {/* Footer Danger Zone */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
        <button
          onClick={() => onRunAIEvaluation(node)}
          className="text-cyan-400 hover:text-cyan-300 text-xs font-mono flex items-center space-x-1"
        >
          <Radio className="w-3 h-3 animate-pulse" />
          <span>RUN AI THREAT SCAN</span>
        </button>
        <button
          onClick={() => onDeleteNode(node.id)}
          className="text-rose-400 hover:text-rose-300 text-xs font-mono flex items-center space-x-1 hover:bg-rose-500/10 px-2 py-1 rounded"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>DELETE</span>
        </button>
      </div>
    </div>
    </>
  );
};
