type SourceStatus = "ok" | "degraded" | "unavailable";

export type SourceResult<T> = {
  source: string;
  status: SourceStatus;
  latencyMs: number;
  items: T[];
  error?: string;
};

export type OsintFinding = {
  id: string;
  title: string;
  description: string;
  source: string;
  sourceUrl: string;
  observedAt?: string;
  severity?: "critical" | "high" | "medium" | "low";
  reference?: string;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;

async function fetchJson<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: "application/json", "user-agent": "Obediance-Intelligence-Platform/1.0" },
      });
      if (!response.ok) throw new Error(`UPSTREAM_HTTP_${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("UPSTREAM_REQUEST_FAILED");
}

async function runSource<T>(source: string, work: () => Promise<T[]>): Promise<SourceResult<T>> {
  const started = Date.now();
  try {
    const items = await work();
    return { source, status: "ok", latencyMs: Date.now() - started, items };
  } catch (error) {
    return {
      source,
      status: "unavailable",
      latencyMs: Date.now() - started,
      items: [],
      error: error instanceof Error ? error.message : "UPSTREAM_REQUEST_FAILED",
    };
  }
}

const kevUrl = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

type KevPayload = {
  vulnerabilities?: Array<{ cveID?: string; vulnerabilityName?: string; shortDescription?: string; dateAdded?: string; dueDate?: string }>;
};

async function queryKev(query: string): Promise<OsintFinding[]> {
  const payload = await fetchJson<KevPayload>(kevUrl);
  const normalized = query.trim().toLowerCase();
  return (payload.vulnerabilities ?? [])
    .filter(item => [item.cveID, item.vulnerabilityName, item.shortDescription].some(value => value?.toLowerCase().includes(normalized)))
    .slice(0, 25)
    .map(item => ({
      id: `cisa-kev:${item.cveID ?? item.vulnerabilityName}`,
      title: item.vulnerabilityName ?? item.cveID ?? "Known exploited vulnerability",
      description: item.shortDescription ?? "No description supplied by source.",
      source: "CISA KEV",
      sourceUrl: kevUrl,
      observedAt: item.dateAdded,
      severity: "high" as const,
      reference: item.cveID,
    }));
}

const nvdUrl = "https://services.nvd.nist.gov/rest/json/cves/2.0";

type NvdPayload = {
  vulnerabilities?: Array<{ cve?: { id?: string; descriptions?: Array<{ lang?: string; value?: string }>; published?: string } }>;
};

async function queryNvd(query: string): Promise<OsintFinding[]> {
  const url = new URL(nvdUrl);
  url.searchParams.set("keywordSearch", query.trim());
  url.searchParams.set("resultsPerPage", "25");
  const payload = await fetchJson<NvdPayload>(url.toString());
  return (payload.vulnerabilities ?? []).flatMap(item => {
    const cve = item.cve;
    if (!cve?.id) return [];
    return [{
      id: `nvd:${cve.id}`,
      title: cve.id,
      description: cve.descriptions?.find(description => description.lang === "en")?.value ?? "No English description supplied by source.",
      source: "NIST NVD",
      sourceUrl: `${nvdUrl}?keywordSearch=${encodeURIComponent(query.trim())}`,
      observedAt: cve.published,
      reference: cve.id,
    }];
  });
}

export async function searchPublicSources(query: string) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2 || normalizedQuery.length > 180) {
    throw new Error("QUERY_MUST_BE_BETWEEN_2_AND_180_CHARACTERS");
  }
  const sources = await Promise.all([
    runSource("CISA KEV", () => queryKev(normalizedQuery)),
    runSource("NIST NVD", () => queryNvd(normalizedQuery)),
  ]);
  const available = sources.filter(source => source.status === "ok");
  return {
    query: normalizedQuery,
    status: available.length === sources.length ? "complete" as const : available.length > 0 ? "partial" as const : "unavailable" as const,
    sources,
    items: available.flatMap(source => source.items),
    generatedAt: new Date().toISOString(),
  };
}
