import React, { useState, useEffect } from "react";
import { 
  MasterKeyItem, 
  UserRole 
} from "../../types";
import { generateLiveCryptoKey } from "../../utils/cryptoVault";
import { 
  KeyRound, 
  Lock, 
  Unlock, 
  ShieldAlert, 
  CheckCircle2, 
  RotateCw, 
  AlertOctagon, 
  Users, 
  Building2, 
  Cpu, 
  Clock, 
  Plus,
  Radio,
  FileCheck,
  Key,
  Copy,
  Check,
  Download
} from "lucide-react";

interface MasterKeyProps {
  masterKeys: MasterKeyItem[];
  onUpdateMasterKeys: (keys: MasterKeyItem[]) => void;
  userRole: UserRole;
  onAuditLog: (action: string, target: string, justification: string) => void;
  targetKeyId?: string;
}

export const MasterKeyManager: React.FC<MasterKeyProps> = ({
  masterKeys,
  onUpdateMasterKeys,
  userRole,
  onAuditLog,
  targetKeyId,
}) => {
  const [selectedKey, setSelectedKey] = useState<MasterKeyItem | null>(
    (targetKeyId && masterKeys.find((k) => k.id === targetKeyId)) || masterKeys[0] || null
  );

  useEffect(() => {
    if (targetKeyId) {
      const match = masterKeys.find((k) => k.id === targetKeyId);
      if (match) {
        setSelectedKey(match);
      }
    }
  }, [targetKeyId, masterKeys]);

  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedPem, setCopiedPem] = useState<boolean>(false);

  // New key form
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScope, setNewKeyScope] = useState("SCIF Delta Access & Cryptographic HSM");
  const [newKeyAlgorithm, setNewKeyAlgorithm] = useState<"RSA-4096" | "ECDSA-P256" | "AES-256-GCM">("RSA-4096");
  const [newKeyQuorum, setNewKeyQuorum] = useState(3);
  const [newKeyCustodian, setNewKeyCustodian] = useState("Chief Security Officer");

  const handleEmergencyLockdown = (key: MasterKeyItem) => {
    const updated = masterKeys.map((k) =>
      k.id === key.id
        ? {
            ...k,
            currentStatus: "EMERGENCY SUSPENDED" as const,
            anomalyDetected: true,
            anomalyReason: "Operator triggered Emergency Panic Lockdown.",
          }
        : k
    );
    onUpdateMasterKeys(updated);
    if (selectedKey?.id === key.id) {
      setSelectedKey({
        ...selectedKey,
        currentStatus: "EMERGENCY SUSPENDED",
        anomalyDetected: true,
        anomalyReason: "Operator triggered Emergency Panic Lockdown.",
      });
    }

    onAuditLog(
      "MASTER_KEY_PANIC_LOCKDOWN",
      `Key ID: ${key.id} (${key.keyName})`,
      `Immediate revocation of physical/digital credentials by ${userRole}.`
    );
  };

  const handleApproveQuorum = (key: MasterKeyItem) => {
    const newApproved = Math.min(key.quorumRequired, key.quorumApproved + 1);
    const newStatus = newApproved >= key.quorumRequired ? ("Active" as const) : ("Quorum Locked" as const);

    const updated = masterKeys.map((k) =>
      k.id === key.id
        ? {
            ...k,
            quorumApproved: newApproved,
            currentStatus: newStatus,
            anomalyDetected: newStatus === "Active" ? false : k.anomalyDetected,
          }
        : k
    );
    onUpdateMasterKeys(updated);
    if (selectedKey?.id === key.id) {
      setSelectedKey({
        ...selectedKey,
        quorumApproved: newApproved,
        currentStatus: newStatus,
        anomalyDetected: newStatus === "Active" ? false : selectedKey.anomalyDetected,
      });
    }

    onAuditLog(
      "MASTER_KEY_QUORUM_APPROVAL_VOTE",
      `Key ID: ${key.id}`,
      `Quorum signature contributed by ${userRole} (${newApproved}/${key.quorumRequired}).`
    );
  };

  const handleRotateKey = async (key: MasterKeyItem) => {
    const newCrypto = await generateLiveCryptoKey("RSA-4096");
    const updated = masterKeys.map((k) =>
      k.id === key.id
        ? {
            ...k,
            publicKeyPem: newCrypto.publicKeyPem,
            fingerprint: newCrypto.fingerprint,
            lastAccessed: "Just now (Rotated)",
            currentStatus: "Active" as const,
            anomalyDetected: false,
          }
        : k
    );
    onUpdateMasterKeys(updated);
    if (selectedKey?.id === key.id) {
      setSelectedKey({
        ...selectedKey,
        publicKeyPem: newCrypto.publicKeyPem,
        fingerprint: newCrypto.fingerprint,
        lastAccessed: "Just now (Rotated)",
        currentStatus: "Active",
        anomalyDetected: false,
      });
    }

    onAuditLog(
      "MASTER_KEY_CRYPTOGRAPHIC_ROTATION",
      `Key ID: ${key.id}`,
      `Generated new cryptographic keypair via Web Crypto API: ${newCrypto.fingerprint}`
    );
  };

  const handleGenerateLiveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsGenerating(true);
    try {
      const cryptoResult = await generateLiveCryptoKey(newKeyAlgorithm);

      const newKey: MasterKeyItem = {
        id: `key-live-${Date.now()}`,
        keyName: newKeyName.trim(),
        keyType: cryptoResult.keyType as any,
        accessScope: newKeyScope,
        authorizedRoles: ["Lead Investigator", "Facility Security Officer"],
        currentCustodian: newKeyCustodian,
        quorumRequired: newKeyQuorum,
        quorumApproved: newKeyQuorum,
        currentStatus: "Active",
        publicKeyPem: cryptoResult.publicKeyPem,
        fingerprint: cryptoResult.fingerprint,
        lastAccessed: "Just now (Provisioned)",
        anomalyDetected: false,
      };

      const updated = [newKey, ...masterKeys];
      onUpdateMasterKeys(updated);
      setSelectedKey(newKey);

      onAuditLog(
        "MASTER_KEY_LIVE_PROVISIONED",
        `Key: ${newKey.keyName} (${cryptoResult.fingerprint})`,
        `Cryptographic hardware token provisioned via Web Crypto API by ${userRole}.`
      );

      setNewKeyName("");
      setShowGenerateModal(false);
    } catch (err) {
      console.error("Key generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPem(true);
    setTimeout(() => setCopiedPem(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    if (status === "EMERGENCY SUSPENDED") {
      return "bg-rose-500/20 text-rose-300 border-rose-500/40";
    }
    if (status === "Quorum Locked" || status === "Rotating") {
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    }
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  };

  return (
    <div className="flex-1 flex h-full bg-slate-950 overflow-hidden">
      {/* Left List of Keys */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/60">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-100 font-mono uppercase">
                MASTER KEY MANAGEMENT
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                {masterKeys.length} ENCLAVE TOKENS
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowGenerateModal(true)}
            className="p-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors cursor-pointer"
            title="Generate New Cryptographic Key Token"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* List of Keys */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {masterKeys.length === 0 ? (
            <div className="p-6 text-center text-slate-400 font-mono text-xs space-y-3">
              <Key className="w-8 h-8 mx-auto text-slate-600" />
              <p>No active master keys registered in enclave.</p>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-bold"
              >
                + Generate First Key
              </button>
            </div>
          ) : (
            masterKeys.map((key) => {
              const isSelected = selectedKey?.id === key.id;
              return (
                <div
                  key={key.id}
                  onClick={() => setSelectedKey(key)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? "bg-slate-800 border-cyan-500/50 shadow-md shadow-cyan-950"
                      : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-slate-200">{key.keyName}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">{key.keyType}</p>
                    </div>
                    <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${getStatusBadge(key.currentStatus)}`}>
                      {key.currentStatus}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
                    <span>QUORUM: {key.quorumApproved}/{key.quorumRequired}</span>
                    <span className="text-slate-500 truncate max-w-[100px]">{key.currentCustodian}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Key Details & Quorum Actions */}
      <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto p-6">
        {selectedKey ? (
          <div className="max-w-3xl w-full mx-auto space-y-6">
            {/* Top Overview Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${getStatusBadge(selectedKey.currentStatus)}`}>
                      {selectedKey.currentStatus}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">ID: {selectedKey.id}</span>
                  </div>
                  <h1 className="text-lg font-bold text-slate-100">{selectedKey.keyName}</h1>
                  <p className="text-xs text-slate-400 font-mono">{selectedKey.accessScope}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleRotateKey(selectedKey)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>ROTATE KEYPAIR</span>
                  </button>

                  <button
                    onClick={() => handleEmergencyLockdown(selectedKey)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 shadow-lg shadow-rose-950 transition-all cursor-pointer"
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>PANIC LOCKDOWN</span>
                  </button>
                </div>
              </div>

              {/* Grid Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] uppercase block">Hardware/Key Type</span>
                  <span className="text-slate-200 font-semibold">{selectedKey.keyType}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] uppercase block">Designated Custodian</span>
                  <span className="text-slate-200 font-semibold">{selectedKey.currentCustodian}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] uppercase block">Last Access Sync</span>
                  <span className="text-cyan-400 font-semibold">{selectedKey.lastAccessed}</span>
                </div>
              </div>
            </div>

            {/* Quorum Signature Section */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-slate-100 font-mono uppercase">
                    MULTI-CUSTODY QUORUM AUTHORIZATION
                  </h3>
                </div>
                <span className="text-xs font-mono text-cyan-300 font-bold">
                  {selectedKey.quorumApproved} OF {selectedKey.quorumRequired} SIGNATURES
                </span>
              </div>

              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${(selectedKey.quorumApproved / selectedKey.quorumRequired) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-400 font-sans">
                  Requires {selectedKey.quorumRequired} authorized FSO/Investigator hardware signatures to unlock sensitive facilities or export audit logs.
                </p>

                <button
                  onClick={() => handleApproveQuorum(selectedKey)}
                  disabled={selectedKey.quorumApproved >= selectedKey.quorumRequired}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>SIGN QUORUM</span>
                </button>
              </div>
            </div>

            {/* Public Key & Enclave Fingerprint */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 uppercase text-[11px] font-bold">
                  PUBLIC KEY CERTIFICATE & FINGERPRINT
                </span>
                <button
                  onClick={() => copyToClipboard(selectedKey.publicKeyPem || selectedKey.fingerprint || "")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] text-slate-300 flex items-center space-x-1 transition-colors"
                >
                  {copiedPem ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPem ? "COPIED" : "COPY"}</span>
                </button>
              </div>

              {selectedKey.fingerprint && (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500 text-[10px]">FINGERPRINT:</span>
                  <span className="text-cyan-300 font-bold select-all">{selectedKey.fingerprint}</span>
                </div>
              )}

              {selectedKey.publicKeyPem && (
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-300 overflow-x-auto select-all leading-tight font-mono">
                  {selectedKey.publicKeyPem}
                </pre>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-mono space-y-3">
            <KeyRound className="w-12 h-12 text-slate-600" />
            <p>Select or generate a master key to inspect multi-custody quorum.</p>
          </div>
        )}
      </div>

      {/* Modal: Generate New Live Cryptographic Key */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 font-mono text-sm uppercase">
                  PROVISION CRYPTOGRAPHIC ENCLAVE KEY
                </h3>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-slate-100 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateLiveKey} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Master Key Identifier
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SCIF Alpha Hardware HSM Root"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Cryptographic Algorithm
                </label>
                <select
                  value={newKeyAlgorithm}
                  onChange={(e: any) => setNewKeyAlgorithm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none"
                >
                  <option value="RSA-4096">RSA 2048/4096-bit Asymmetric HSM</option>
                  <option value="ECDSA-P256">ECDSA NIST P-256 Auth Key</option>
                  <option value="AES-256-GCM">AES-256-GCM Hardware Token</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Access Scope
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SCIF Perimeter & Vault Ledger"
                  value={newKeyScope}
                  onChange={(e) => setNewKeyScope(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Designated Custodian
                  </label>
                  <input
                    type="text"
                    value={newKeyCustodian}
                    onChange={(e) => setNewKeyCustodian(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Quorum Threshold
                  </label>
                  <select
                    value={newKeyQuorum}
                    onChange={(e) => setNewKeyQuorum(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none"
                  >
                    <option value={1}>1 Custodian</option>
                    <option value={2}>2 Custodians</option>
                    <option value={3}>3 Custodians (Recommended)</option>
                    <option value={5}>5 Custodians (Strict)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-mono font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{isGenerating ? "GENERATING KEYPAIR..." : "GENERATE & SIGN"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
