import React, { useState, useRef, useEffect } from "react";
import { 
  ChatMessage, 
  GraphNode, 
  GraphEdge, 
  UserRole 
} from "../../types";
import { apiClient } from "../../utils/apiClient";
import { 
  Sparkles, 
  Send, 
  X, 
  BrainCircuit, 
  ShieldAlert, 
  Terminal, 
  RotateCcw, 
  Copy, 
  Check, 
  User, 
  Bot, 
  ChevronDown, 
  ChevronRight,
  Zap
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface AICopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: GraphNode[];
  edges: GraphEdge[];
  userRole: UserRole;
  initialPrompt?: string;
}

export const AICopilotModal: React.FC<AICopilotModalProps> = ({
  isOpen,
  onClose,
  nodes,
  edges,
  userRole,
  initialPrompt,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      role: "model",
      content:
        "**Aegis AI OSINT Copilot initialized.** I have full contextual access to your relationship graph (" +
        nodes.length +
        " nodes, " +
        edges.length +
        " links), red team attack surfaces, threat telemetry, and compliance audit logs. How can I assist your investigation?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copilotRole, setCopilotRole] = useState<string>("Lead OSINT Intelligence Officer");
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(true);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.8-flash");
  const [expandedThinkingId, setExpandedThinkingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle initial prompt passed from other views
  useEffect(() => {
    if (initialPrompt && isOpen) {
      setInputPrompt(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim() || isLoading) return;

    const userMessageText = inputPrompt.trim();
    setInputPrompt("");

    const timestamp = Date.now();
    const entropy = Math.random().toString(36).substring(2, 7);
    const newUserMessage: ChatMessage = {
      id: `msg-${timestamp}-${entropy}`,
      role: "user",
      content: userMessageText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...messages, newUserMessage];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      const res = await apiClient.post("/api/chat", {
        messages: newHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        systemRole: copilotRole,
        thinkingEnabled,
        model: selectedModel,
        graphContext: {
          nodesCount: nodes.length,
          edgesCount: edges.length,
          highRiskNodes: nodes.filter((n) => n.riskScore >= 80).map((n) => `${n.label} (${n.type}, Risk: ${n.riskScore})`),
        },
      });

      const data = res.data;
      const modelEntropy = Math.random().toString(36).substring(2, 7);
      const modelReply: ChatMessage = {
        id: `msg-${Date.now()}-${modelEntropy}`,
        role: "model",
        content: data.reply || "No intelligence synthesis returned.",
        thinking: data.thinkingProcess,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages([...newHistory, modelReply]);
    } catch (err: any) {
      const errorEntropy = Math.random().toString(36).substring(2, 7);
      const errorReply: ChatMessage = {
        id: `msg-${Date.now()}-${errorEntropy}`,
        role: "model",
        content: `**Error communicating with AI engine**: ${err?.message || "Unknown error"}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages([...newHistory, errorReply]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputPrompt(prompt);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: "msg-welcome",
        role: "model",
        content: "Conversation history cleared. Ready for new intelligence query.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border-0 sm:border border-slate-800 rounded-none sm:rounded-2xl w-full max-w-4xl h-full sm:h-[85vh] shadow-2xl flex flex-col overflow-hidden font-sans">
        {/* Header Ribbon */}
        <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 sm:space-x-3 truncate">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg text-white shrink-0">
              <BrainCircuit className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-100 font-mono text-xs sm:text-sm uppercase truncate">
                  OSINT AI COPILOT
                </h3>
                <span className="hidden xs:inline text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                  {selectedModel}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Grounded in active graph topology ({nodes.length} nodes) & telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            <button
              onClick={handleClearHistory}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors text-xs font-mono flex items-center space-x-1 min-h-[36px]"
              title="Clear Thread"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Controls Toolbar (Role, Thinking Mode, Model) */}
        <div className="px-3 sm:px-4 py-2 bg-slate-950 border-b border-slate-850 flex flex-wrap items-center justify-between gap-2 text-xs font-mono shrink-0 overflow-x-auto">
          <div className="flex items-center space-x-2 min-w-max">
            <span className="text-slate-400 uppercase text-[10px]">ROLE:</span>
            <select
              value={copilotRole}
              onChange={(e) => setCopilotRole(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="Lead OSINT Intelligence Officer">OSINT Lead Officer</option>
              <option value="Red Team Adversary Specialist">Red Team Adversary</option>
              <option value="Personnel Vetting Officer">Vetting Officer</option>
              <option value="Incident Response Commander">IR Commander</option>
            </select>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4 min-w-max">
            {/* Thinking Mode Toggle */}
            <label className="flex items-center space-x-1.5 sm:space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={thinkingEnabled}
                onChange={(e) => setThinkingEnabled(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
              <span className="text-slate-300 flex items-center gap-1 text-[11px] sm:text-xs">
                <BrainCircuit className="w-3 h-3 text-cyan-400" />
                <span>THINKING</span>
              </span>
            </label>

            {/* Model Selector */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
            >
              <option value="gemini-3.8-flash">3.8 Flash (Recommended)</option>
              <option value="gemini-3.1-pro-preview">3.1 Pro (Deep)</option>
              <option value="gemini-3.1-flash-lite">3.1 Lite (Fast)</option>
            </select>
          </div>
        </div>

        {/* Chat Thread Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${isUser ? "flex-row-reverse space-x-reverse" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isUser
                      ? "bg-cyan-600 text-white"
                      : "bg-slate-800 border border-slate-700 text-cyan-400"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={`space-y-1.5 max-w-[82%] ${isUser ? "text-right" : ""}`}>
                  <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                    <span className="font-bold uppercase">
                      {isUser ? userRole.replace("_", " ") : copilotRole}
                    </span>
                    <span>• {msg.timestamp}</span>
                  </div>

                  {/* Thinking Process Dropdown if present */}
                  {msg.thinking && (
                    <div className="text-left bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 my-1 text-xs font-mono">
                      <button
                        onClick={() =>
                          setExpandedThinkingId(expandedThinkingId === msg.id ? null : msg.id)
                        }
                        className="flex items-center space-x-1.5 text-cyan-400 font-bold hover:text-cyan-300 w-full"
                      >
                        {expandedThinkingId === msg.id ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        <span>AI REASONING & CHAIN-OF-THOUGHT TRACE</span>
                      </button>

                      {expandedThinkingId === msg.id && (
                        <div className="mt-2 pt-2 border-t border-slate-850 text-slate-400 text-[11px] whitespace-pre-wrap leading-relaxed">
                          {msg.thinking}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl p-3.5 text-xs text-left shadow-md ${
                      isUser
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-950 border border-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="prose prose-invert max-w-none text-xs leading-relaxed prose-p:my-1 prose-headings:my-1 prose-ul:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-cyan-400 flex items-center justify-center">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-400 font-mono flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>Thinking & synthesizing multi-modal OSINT telemetry...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-850 flex items-center space-x-2 overflow-x-auto text-[11px] font-mono">
          <span className="text-slate-400 text-[10px] uppercase shrink-0">SUGGESTED PIVOTS:</span>
          <button
            onClick={() =>
              handleQuickPrompt(
                "Analyze the current graph topology for lateral movement hops between high-risk crypto wallets and SCIF facilities."
              )
            }
            className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 whitespace-nowrap shrink-0 transition-colors"
          >
            Detect Lateral Movement Hops
          </button>
          <button
            onClick={() =>
              handleQuickPrompt(
                "Evaluate defensive posture against APT-29 spearphishing campaigns with Master Key compromise."
              )
            }
            className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 whitespace-nowrap shrink-0 transition-colors"
          >
            Assess SCIF Exfiltration Risk
          </button>
          <button
            onClick={() =>
              handleQuickPrompt(
                "Synthesize a vetting risk score recommendation for Victor Vance based on legal records and flight history."
              )
            }
            className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 whitespace-nowrap shrink-0 transition-colors"
          >
            Vetting Risk Profile
          </button>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center space-x-2">
          <input
            type="text"
            placeholder="Ask OSINT Copilot to pivot links, analyze MITRE TTPs, or audit Master Key access..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold font-mono text-xs flex items-center space-x-1.5 shadow-lg shadow-cyan-950/40 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">TRANSMIT</span>
          </button>
        </form>
      </div>
    </div>
  );
};
