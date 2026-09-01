import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Database,
  FileSearch,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  Menu,
  Network,
  Plus,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ConsoleMode = "overview" | "investigations" | "search" | "evidence" | "sources" | "audit";

const navItems: Array<{ id: ConsoleMode; label: string; detail: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Operations overview", detail: "Workspace posture", icon: LayoutDashboard },
  { id: "investigations", label: "Investigations", detail: "Cases and objectives", icon: FileSearch },
  { id: "search", label: "Public-source search", detail: "Allowlisted intelligence", icon: Globe2 },
  { id: "evidence", label: "Evidence ledger", detail: "Provenance and review", icon: BookOpen },
  { id: "sources", label: "Source health", detail: "Connectors and fallbacks", icon: ServerCog },
  { id: "audit", label: "Audit trail", detail: "Operator accountability", icon: ShieldCheck },
];

function hostMode() {
  if (typeof window === "undefined") return "dashboard";
  return window.location.hostname.startsWith("admin.") ? "admin" : "dashboard";
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "ok" || status === "active" || status === "ready" ? "good" : status === "partial" || status === "paused" ? "warn" : "muted";
  return <span className={`status-pill status-${tone}`}>{status}</span>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-mark"><Database size={17} /></div>
      <div><h3>{title}</h3><p>{detail}</p></div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: number | string; detail: string; icon: typeof Database }) {
  return <article className="metric-card">
    <div className="metric-head"><span>{label}</span><Icon size={16} /></div>
    <strong>{value}</strong>
    <p>{detail}</p>
  </article>;
}

export default function Home() {
  const { user, loading, error, isAuthenticated, logout } = useAuth();
  const [mode, setMode] = useState<ConsoleMode>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [investigationName, setInvestigationName] = useState("");
  const [investigationObjective, setInvestigationObjective] = useState("");
  const [classification, setClassification] = useState<"public" | "internal" | "confidential" | "restricted">("internal");
  const [creating, setCreating] = useState(false);
  const environment = hostMode();

  const dashboard = trpc.intelligence.dashboard.useQuery(undefined, { enabled: isAuthenticated });
  const investigations = trpc.intelligence.investigations.useQuery(undefined, { enabled: isAuthenticated });
  const sources = trpc.intelligence.sources.useQuery(undefined, { enabled: isAuthenticated });
  const audit = trpc.intelligence.audit.useQuery(undefined, { enabled: isAuthenticated });
  const adminHealth = trpc.intelligence.adminHealth.useQuery(undefined, { enabled: isAuthenticated && environment === "admin", retry: false });
  const createInvestigation = trpc.intelligence.createInvestigation.useMutation({
    onSuccess: async () => {
      toast.success("Investigation workspace created");
      setShowCreate(false);
      setInvestigationName("");
      setInvestigationObjective("");
      await Promise.all([investigations.refetch(), dashboard.refetch()]);
    },
    onError: (mutationError) => toast.error(mutationError.message === "DATABASE_UNAVAILABLE" ? "Database unavailable. No record was created." : mutationError.message),
    onSettled: () => setCreating(false),
  });
  const publicSearch = trpc.intelligence.publicSearch.useMutation({
    onSuccess: (result) => {
      setSearchQuery(result.query);
      setMode("search");
    },
    onError: (mutationError) => toast.error(mutationError.message === "DATABASE_UNAVAILABLE" ? "Database unavailable. Search audit was not recorded." : mutationError.message),
  });

  const activeInvestigations = useMemo(() => investigations.data?.filter(item => item.status === "active") ?? [], [investigations.data]);

  if (loading) return <div className="auth-state"><Loader2 className="spin" size={20} /><span>Loading secure session…</span></div>;
  if (!isAuthenticated || !user) return <div className="auth-state auth-screen"><div className="auth-orbit"><LockKeyhole size={24} /></div><p className="eyebrow">OBEDIANCE // CONTROL PLANE</p><h1>Public-source intelligence, with provenance.</h1><p>Sign in to access authorized investigation workspaces, source health, evidence review, and audit controls.</p>{error && <div className="inline-error"><AlertTriangle size={15} />{error.message}</div>}<button className="primary-button" onClick={() => startLogin()}>Sign in to continue <ArrowUpRight size={16} /></button></div>;

  const executeSearch = () => {
    const query = searchText.trim();
    if (query.length < 2) return toast.error("Enter at least 2 characters.");
    publicSearch.mutate({ query });
  };

  const submitInvestigation = (event: React.FormEvent) => {
    event.preventDefault();
    if (investigationName.trim().length < 3 || investigationObjective.trim().length < 10) return toast.error("Name and objective are required.");
    setCreating(true);
    createInvestigation.mutate({ name: investigationName.trim(), objective: investigationObjective.trim(), classification });
  };

  const renderContent = () => {
    if (mode === "overview") return <Overview mode={environment} user={user} dashboard={dashboard.data} dashboardLoading={dashboard.isLoading} investigations={activeInvestigations} onCreate={() => setShowCreate(true)} />;
    if (mode === "investigations") return <Investigations data={investigations.data ?? []} loading={investigations.isLoading} onCreate={() => setShowCreate(true)} />;
    if (mode === "search") return <SearchConsole query={searchQuery} result={publicSearch.data} loading={publicSearch.isPending} searchText={searchText} setSearchText={setSearchText} onSearch={executeSearch} />;
    if (mode === "sources") return <SourceHealth data={sources.data ?? []} loading={sources.isLoading} />;
    if (mode === "audit") return <AuditTrail data={audit.data ?? []} loading={audit.isLoading} />;
    return <EvidenceLedger count={dashboard.data?.evidence ?? 0} />;
  };

  return <div className="console-app">
    <aside className={`console-sidebar ${mobileNav ? "open" : ""}`}>
      <div className="brand-lockup"><div className="brand-emblem"><Network size={20} /></div><div><div className="brand-name">OBEDIANCE</div><div className="brand-meta">INTELLIGENCE CONTROL</div></div><button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="rail-status"><span className="status-dot" />{environment === "admin" ? "ADMIN PLANE" : "OPERATIONS PLANE"}<span className="rail-version">v1</span></div>
      <nav className="console-nav" aria-label="Primary navigation">{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={mode === item.id ? "nav-item active" : "nav-item"} onClick={() => { setMode(item.id); setMobileNav(false); }}><Icon size={16} /><span><strong>{item.label}</strong><small>{item.detail}</small></span><ChevronRight size={14} /></button>; })}</nav>
      <div className="sidebar-footer"><div className="footer-line"><Activity size={14} /><span>DATA PLANE</span><StatusPill status={dashboard.isLoading ? "checking" : dashboard.isError ? "unavailable" : "ready"} /></div><div className="footer-line muted"><span>AUTHENTICATED AS</span></div><div className="account-line"><div className="avatar">{(user.name ?? user.email ?? "O").slice(0, 1).toUpperCase()}</div><div><strong>{user.name ?? "Operator"}</strong><small>{user.email ?? "Session identity"}</small></div></div><button className="text-button" onClick={() => logout()}>End session <ArrowUpRight size={14} /></button></div>
    </aside>
    <main className="console-main">
      <header className="console-header"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19} /></button><div><p className="eyebrow">{environment === "admin" ? "ADMIN // GOVERNANCE" : "LIVE // INVESTIGATION WORKSPACE"}</p><h1>{mode === "overview" ? "Operations overview" : navItems.find(item => item.id === mode)?.label}</h1></div><div className="header-actions"><div className="header-search"><Search size={15} /><input value={searchText} onChange={event => setSearchText(event.target.value)} onKeyDown={event => event.key === "Enter" && executeSearch()} aria-label="Search public sources" placeholder="Search allowlisted sources" /><kbd>↵</kbd></div><button className="secondary-button" onClick={() => { setMode("search"); setTimeout(() => document.querySelector<HTMLInputElement>(".header-search input")?.focus(), 0); }}><Globe2 size={15} /> Search</button></div></header>
      <div className="console-content">{adminHealth.isError && environment === "admin" && <div className="inline-error banner"><AlertTriangle size={15} />Admin permissions are required for governance data.</div>}{renderContent()}</div>
    </main>
    {showCreate && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setShowCreate(false)}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-title"><div className="modal-head"><div><p className="eyebrow">CASE INTAKE</p><h2 id="create-title">Create investigation</h2></div><button className="icon-button" onClick={() => setShowCreate(false)} aria-label="Close"><X size={18} /></button></div><form onSubmit={submitInvestigation}><label>Investigation name<input value={investigationName} onChange={event => setInvestigationName(event.target.value)} maxLength={160} required /></label><label>Objective<textarea value={investigationObjective} onChange={event => setInvestigationObjective(event.target.value)} rows={4} maxLength={5000} required /></label><label>Classification<select value={classification} onChange={event => setClassification(event.target.value as typeof classification)}><option value="public">Public</option><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="restricted">Restricted</option></select></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary-button" disabled={creating}>{creating ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}Create workspace</button></div></form></section></div>}
  </div>;
}

function Overview({ mode, user, dashboard, dashboardLoading, investigations, onCreate }: { mode: string; user: { name?: string | null; email?: string | null }; dashboard?: { investigations: number; entities: number; evidence: number; sources: number }; dashboardLoading: boolean; investigations: Array<{ id: number; name: string; objective: string; classification: string; updatedAt: Date }>; onCreate: () => void }) {
  return <section className="view-stack"><div className="hero-panel"><div><p className="eyebrow violet">SECURE OPERATIONS // {mode.toUpperCase()}</p><h2>Good to see you, {user.name?.split(" ")[0] ?? "operator"}.</h2><p className="hero-copy">Work from source-backed records. Every case, entity, evidence item, and operator action is persisted, permissioned, and reviewable.</p><div className="hero-actions"><button className="primary-button" onClick={onCreate}><Plus size={16} /> New investigation</button><span className="hero-note"><Sparkles size={15} /> No synthetic records loaded</span></div></div><div className="hero-radar"><div className="radar-ring r1" /><div className="radar-ring r2" /><div className="radar-core"><Activity size={17} /></div></div></div><div className="metric-grid">{dashboardLoading ? <div className="loading-card"><Loader2 className="spin" size={18} />Loading persisted metrics…</div> : <><MetricCard label="Investigations" value={dashboard?.investigations ?? 0} detail="Owned workspaces" icon={FileSearch} /><MetricCard label="Entities" value={dashboard?.entities ?? 0} detail="Indexed in current workspace" icon={Network} /><MetricCard label="Evidence" value={dashboard?.evidence ?? 0} detail="Source-backed records" icon={BookOpen} /><MetricCard label="Sources" value={dashboard?.sources ?? 0} detail="Configured for this operator" icon={Globe2} /></>}</div><div className="section-heading"><div><p className="eyebrow">ACTIVE CASES</p><h2>Investigations in motion</h2></div><button className="text-button" onClick={onCreate}>Create case <ArrowUpRight size={14} /></button></div>{investigations.length === 0 ? <EmptyState title="No active investigations" detail="Create a workspace to begin collecting authorized public-source evidence." action={<button className="secondary-button" onClick={onCreate}><Plus size={15} /> Create case</button>} /> : <div className="case-grid">{investigations.slice(0, 3).map(item => <article className="case-card" key={item.id}><div className="case-card-top"><span className="case-id">CASE-{String(item.id).padStart(4, "0")}</span><StatusPill status={item.classification} /></div><h3>{item.name}</h3><p>{item.objective}</p><div className="case-card-foot"><span>Updated {formatDate(item.updatedAt)}</span><ChevronRight size={15} /></div></article>)}</div>}</section>;
}

function Investigations({ data, loading, onCreate }: { data: Array<{ id: number; name: string; objective: string; status: string; classification: string; updatedAt: Date }>; loading: boolean; onCreate: () => void }) {
  if (loading) return <div className="loading-card"><Loader2 className="spin" size={18} />Loading persisted investigations…</div>;
  return <section className="view-stack"><div className="section-heading"><div><p className="eyebrow">CASE MANAGEMENT</p><h2>Investigation workspaces</h2><p className="section-copy">Each workspace has an owner, objective, classification, and immutable creation trail.</p></div><button className="primary-button" onClick={onCreate}><Plus size={16} /> New investigation</button></div>{data.length === 0 ? <EmptyState title="No investigations found" detail="There are no persisted workspaces for this operator yet." action={<button className="secondary-button" onClick={onCreate}><Plus size={15} /> Create workspace</button>} /> : <div className="table-card"><div className="table-row table-header"><span>Case</span><span>Status</span><span>Classification</span><span>Last update</span></div>{data.map(item => <div className="table-row" key={item.id}><span><strong>CASE-{String(item.id).padStart(4, "0")}</strong><small>{item.name}</small></span><StatusPill status={item.status} /><span className="muted-copy">{item.classification}</span><span className="muted-copy">{formatDate(item.updatedAt)}</span></div>)}</div>}</section>;
}

function SearchConsole({ query, result, loading, searchText, setSearchText, onSearch }: { query: string; result?: { status: "complete" | "partial" | "unavailable"; items: Array<{ id: string; title: string; description: string; source: string; sourceUrl: string; observedAt?: string; reference?: string }>; sources: Array<{ source: string; status: string; latencyMs: number; items: unknown[]; error?: string }>; generatedAt: string }; loading: boolean; searchText: string; setSearchText: (value: string) => void; onSearch: () => void }) {
  return <section className="view-stack"><div className="section-heading"><div><p className="eyebrow">ALLOWLISTED COLLECTION</p><h2>Public-source search</h2><p className="section-copy">Searches fixed public sources only. Results retain source URLs, timestamps, and upstream status.</p></div></div><div className="search-panel"><div className="search-input"><Search size={17} /><input value={searchText} onChange={event => setSearchText(event.target.value)} onKeyDown={event => event.key === "Enter" && onSearch()} placeholder="CVE, vulnerability name, or public indicator" /><button className="primary-button" onClick={onSearch} disabled={loading}>{loading ? <Loader2 className="spin" size={15} /> : <Search size={15} />}Search</button></div><div className="source-scope"><span><ShieldCheck size={14} /> CISA KEV</span><span><ShieldCheck size={14} /> NIST NVD</span><span><LockKeyhole size={14} /> No arbitrary URLs</span></div></div>{!result ? <EmptyState title="No search executed" detail="Run an allowlisted public-source search to view real upstream findings." /> : <><div className="result-summary"><span>Query <strong>{query}</strong></span><StatusPill status={result.status} /><span className="muted-copy">Updated {formatDate(result.generatedAt)}</span></div>{result.items.length === 0 ? <EmptyState title="No findings returned" detail="The selected public sources returned no matching records for this query." /> : <div className="result-list">{result.items.map(item => <article className="result-card" key={item.id}><div className="result-card-head"><span className="source-label">{item.source}</span>{item.reference && <span className="case-id">{item.reference}</span>}</div><h3>{item.title}</h3><p>{item.description}</p><div className="result-card-foot"><span>Observed {formatDate(item.observedAt)}</span><a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={13} /></a></div></article>)}</div>}<div className="source-status-list">{result.sources.map(source => <div key={source.source} className="source-status"><span>{source.source}</span><StatusPill status={source.status} /><span className="muted-copy">{source.latencyMs} ms</span>{source.error && <span className="muted-copy">{source.error}</span>}</div>)}</div></>}</section>;
}

function SourceHealth({ data, loading }: { data: Array<{ id: number; name: string; baseUrl: string; sourceType: string; enabled: number; priority: number; lastSuccessAt: Date | null; lastFailureAt: Date | null }>; loading: boolean }) {
  return <section className="view-stack"><div className="section-heading"><div><p className="eyebrow">SOURCE GOVERNANCE</p><h2>Source health</h2><p className="section-copy">Only configured sources appear here. A blank state means no connectors have been registered.</p></div><button className="secondary-button" onClick={() => window.location.reload()}><RefreshCw size={15} /> Refresh</button></div>{loading ? <div className="loading-card"><Loader2 className="spin" size={18} />Loading source registry…</div> : data.length === 0 ? <EmptyState title="No sources configured" detail="Register an approved source before running collection workflows." /> : <div className="source-grid">{data.map(source => <article className="source-card" key={source.id}><div className="source-card-head"><div className="source-icon"><Globe2 size={17} /></div><StatusPill status={source.enabled ? "active" : "paused"} /></div><h3>{source.name}</h3><p>{source.sourceType}</p><a href={source.baseUrl} target="_blank" rel="noreferrer">{source.baseUrl} <ArrowUpRight size={13} /></a><div className="source-card-foot"><span>Priority {source.priority}</span><span>{source.lastSuccessAt ? `Last success ${formatDate(source.lastSuccessAt)}` : "No success recorded"}</span></div></article>)}</div>}</section>;
}

function AuditTrail({ data, loading }: { data: Array<{ id: number; action: string; targetType: string; targetId: string | null; justification: string; requestId: string; createdAt: Date }>; loading: boolean }) {
  return <section className="view-stack"><div className="section-heading"><div><p className="eyebrow">ACCOUNTABILITY</p><h2>Audit trail</h2><p className="section-copy">Recent actions for the authenticated operator. Every event includes a request identifier and justification.</p></div><div className="security-callout"><ShieldCheck size={15} /> Immutable intent log</div></div>{loading ? <div className="loading-card"><Loader2 className="spin" size={18} />Loading audit events…</div> : data.length === 0 ? <EmptyState title="No audit events yet" detail="Operator actions will appear here after the first persisted workspace or source search action." /> : <div className="table-card"><div className="table-row table-header"><span>Action</span><span>Target</span><span>Justification</span><span>Created</span></div>{data.map(item => <div className="table-row" key={item.id}><span><strong>{item.action}</strong><small>Request {item.requestId}</small></span><span className="muted-copy">{item.targetType}{item.targetId ? ` · ${item.targetId}` : ""}</span><span className="muted-copy">{item.justification}</span><span className="muted-copy">{formatDate(item.createdAt)}</span></div>)}</div>}</section>;
}

function EvidenceLedger({ count }: { count: number }) {
  return <section className="view-stack"><div className="section-heading"><div><p className="eyebrow">PROVENANCE // REVIEW</p><h2>Evidence ledger</h2><p className="section-copy">Evidence is only visible after it has been attached to an investigation. Source URL and content hash are required at intake.</p></div><div className="security-callout"><KeyRound size={15} /> Hash-backed records</div></div>{count === 0 ? <EmptyState title="No evidence collected" detail="No source-backed evidence has been attached to the current operator’s investigations." /> : <div className="metric-spotlight"><BookOpen size={22} /><strong>{count}</strong><span>evidence records persisted</span></div>}</section>;
}
