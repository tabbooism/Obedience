import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { ENV } from "./_core/env";
import { isAuthorizedApiKey } from "./apiAuth";
import { getUserByOpenId } from "./db";
import {
  createEntity,
  createEvidence,
  createInvestigation,
  getDashboardCounts,
  getInvestigationForOwner,
  isDatabaseUnavailable,
  listEntities,
  listEvidence,
  listInvestigations,
  listSources,
  recordAuditEvent,
} from "./intelligenceDb";
import { searchPublicSources } from "./osintSources";

const windowMs = 60_000;
const maxRequestsPerWindow = 60;
const requests = new Map<string, { startedAt: number; count: number }>();
const classification = z.enum(["public", "internal", "confidential", "restricted"]);

function requestId(req: Request) {
  return req.header("x-request-id")?.slice(0, 96) || crypto.randomUUID();
}

function clientKey(req: Request) {
  return req.header("cf-connecting-ip") || req.ip || "unknown-client";
}

function rateLimit(req: Request) {
  const key = clientKey(req);
  const now = Date.now();
  const current = requests.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    requests.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= maxRequestsPerWindow;
}

function sendError(res: Response, status: number, code: string, message: string, id: string) {
  res.status(status).json({ ok: false, error: { code, message }, requestId: id });
}

function requireApiKey(req: Request, res: Response, id: string) {
  if (!isAuthorizedApiKey(req.header("authorization") ?? undefined)) {
    sendError(res, 401, "UNAUTHORIZED", "A valid bearer token is required.", id);
    return false;
  }
  if (!rateLimit(req)) {
    res.setHeader("Retry-After", "60");
    sendError(res, 429, "RATE_LIMITED", "Request rate exceeded. Retry after the current window.", id);
    return false;
  }
  return true;
}

function parseId(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function ownerId() {
  if (!ENV.ownerOpenId) return undefined;
  const owner = await getUserByOpenId(ENV.ownerOpenId);
  return owner?.id;
}

async function writeAudit(actorId: number, action: string, targetType: string, targetId: string | undefined, justification: string, investigationId?: number) {
  await recordAuditEvent({ actorId, action, targetType, targetId, justification, investigationId, requestId: crypto.randomUUID() });
}

function handleFailure(res: Response, id: string, error: unknown) {
  if (isDatabaseUnavailable(error)) {
    sendError(res, 503, "DATABASE_UNAVAILABLE", "The persistence layer is unavailable; no change was committed.", id);
    return;
  }
  sendError(res, 500, "INTERNAL_ERROR", "The operation could not be completed.", id);
}

const createInvestigationBody = z.object({ name: z.string().trim().min(3).max(160), objective: z.string().trim().min(10).max(5000), classification });
const createEntityBody = z.object({ investigationId: z.number().int().positive(), entityType: z.string().trim().min(2).max(48), canonicalValue: z.string().trim().min(1).max(512), displayName: z.string().trim().min(1).max(255), confidence: z.number().int().min(0).max(100).default(0), riskScore: z.number().int().min(0).max(100).default(0) });
const createEvidenceBody = z.object({ investigationId: z.number().int().positive(), entityId: z.number().int().positive().optional(), sourceName: z.string().trim().min(2).max(160), sourceUrl: z.string().url().max(1024), sourceType: z.string().trim().min(2).max(48), title: z.string().trim().min(1).max(512), excerpt: z.string().max(10000).optional(), contentHash: z.string().trim().min(16).max(128), confidence: z.number().int().min(0).max(100).default(0), observedAt: z.coerce.date().optional() });

export function registerIntelligenceApi(app: Express) {
  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true, service: "obediance-intelligence-api", version: "v1", timestamp: new Date().toISOString() });
  });

  app.use("/api/v1", async (req, res, next) => {
    const id = requestId(req);
    res.setHeader("x-request-id", id);
    if (!requireApiKey(req, res, id)) return;
    res.locals.requestId = id;
    next();
  });

  app.get("/api/v1/investigations", async (req, res) => {
    const id = res.locals.requestId as string;
    try {
      const actorId = await ownerId();
      if (!actorId) return sendError(res, 424, "OWNER_NOT_PROVISIONED", "The owner must complete one authenticated session before API-owned workspaces can be addressed.", id);
      const data = await listInvestigations(actorId);
      res.json({ ok: true, requestId: id, data });
    } catch (error) { handleFailure(res, id, error); }
  });

  app.post("/api/v1/investigations", async (req, res) => {
    const id = res.locals.requestId as string;
    const parsed = createInvestigationBody.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "INVALID_REQUEST", "name, objective, and classification are required.", id);
    try {
      const actorId = await ownerId();
      if (!actorId) return sendError(res, 424, "OWNER_NOT_PROVISIONED", "The owner must complete one authenticated session before API-owned workspaces can be addressed.", id);
      const investigation = await createInvestigation({ ...parsed.data, ownerId: actorId });
      await writeAudit(actorId, "api.investigation.created", "investigation", String(investigation.id), "External tool created an investigation through the authenticated API.", investigation.id);
      res.status(201).json({ ok: true, requestId: id, data: investigation });
    } catch (error) { handleFailure(res, id, error); }
  });

  app.get("/api/v1/investigations/:investigationId", async (req, res) => {
    const id = res.locals.requestId as string;
    const investigationId = parseId(req.params.investigationId);
    if (!investigationId) return sendError(res, 400, "INVALID_ID", "investigationId must be a positive integer.", id);
    try {
      const actorId = await ownerId();
      if (!actorId) return sendError(res, 424, "OWNER_NOT_PROVISIONED", "The owner must complete one authenticated session before API-owned workspaces can be addressed.", id);
      const investigation = await getInvestigationForOwner(investigationId, actorId);
      if (!investigation) return sendError(res, 404, "NOT_FOUND", "Investigation not found.", id);
      const [entities, evidence] = await Promise.all([listEntities(investigationId), listEvidence(investigationId)]);
      res.json({ ok: true, requestId: id, data: { investigation, entities, evidence } });
    } catch (error) { handleFailure(res, id, error); }
  });

  app.get("/api/v1/entities", async (req, res) => {
    const id = res.locals.requestId as string;
    const investigationId = parseId(typeof req.query.investigationId === "string" ? req.query.investigationId : undefined);
    if (!investigationId) return sendError(res, 400, "INVALID_INVESTIGATION_ID", "investigationId is required and must be a positive integer.", id);
    try {
      const actorId = await ownerId();
      if (!actorId) return sendError(res, 424, "OWNER_NOT_PROVISIONED", "The owner must complete one authenticated session before API-owned workspaces can be addressed.", id);
      if (!(await getInvestigationForOwner(investigationId, actorId))) return sendError(res, 404, "NOT_FOUND", "Investigation not found.", id);
      res.json({ ok: true, requestId: id, data: await listEntities(investigationId) });
    } catch (error) { handleFailure(res, id, error); }
  });

  app.post("/api/v1/entities", async (req, res) => {
    const id = res.locals.requestId as string;
    const parsed = createEntityBody.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "INVALID_REQUEST", "A valid investigationId, entityType, canonicalValue, and displayName are required.", id);
    try {
      const actorId = await ownerId();
      if (!actorId) return sendError(res, 424, "OWNER_NOT_PROVISIONED", "The owner must complete one authenticated session before API-owned workspaces can be addressed.", id);
      if (!(await getInvestigationForOwner(parsed.data.investigationId, actorId))) return sendError(res, 404, "NOT_FOUND", "Investigation not found.", id);
      const entity = await createEntity(parsed.data);
      await writeAudit(actorId, "api.entity.created", "entity", String(entity.id), "External tool added an entity through the authenticated API.", parsed.data.investigationId);
      res.status(201).json({ ok: true, requestId: id, data: entity });
    } catch (error) { handleFailure(res, id, error); }
  });

  app.get("/api/v1/evidence", async (req, res) => {
    const id = res.locals.requestId as string;
    const investigationId = parseId(typeof req.query.investigationId === "string" ? req.query.investigationId : undefined);
    if (!investigationId) return sendError(res, 400, "INVALID_INVESTIGATION_ID", "investigationId is required and must be a positive integer.", id);
    try {
      const actorId = await ownerId();
      if (!actorId) return sendError(res, 424, "OWNER_NOT_PROVISIONED", "The owner must complete one authenticated session before API-owned workspaces can be addressed.", id);
      if (!(await getInvestigationForOwner(investigationId, actorId))) return sendError(res, 404, "NOT_FOUND", "Investigation not found.", id);
      res.json({ ok: true, requestId: id, data: await listEvidence(investigationId) });
    } catch (error) { handleFailure(res, id, error); }
  });

  app.post("/api/v1/evidence", async (req, res) => {
    const id = res.locals.requestId as string;
    const parsed = createEvidenceBody.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "INVALID_REQUEST", "A valid investigationId, sourceName, sourceUrl, sourceType, title, contentHash, and confidence are required.", id);
    try {
      const actorId = await ownerId();
      if (!actorId) return sendError(res, 424, "OWNER_NOT_PROVISIONED", "The owner must complete one authenticated session before API-owned workspaces can be addressed.", id);
      if (!(await getInvestigationForOwner(parsed.data.investigationId, actorId))) return sendError(res, 404, "NOT_FOUND", "Investigation not found.", id);
      const evidence = await createEvidence(parsed.data);
      await writeAudit(actorId, "api.evidence.created", "evidence", String(evidence.id), "External tool attached source evidence through the authenticated API.", parsed.data.investigationId);
      res.status(201).json({ ok: true, requestId: id, data: evidence });
    } catch (error) { handleFailure(res, id, error); }
  });

  app.get("/api/v1/sources", async (_req, res) => {
    const id = res.locals.requestId as string;
    try {
      const actorId = await ownerId();
      if (!actorId) return sendError(res, 424, "OWNER_NOT_PROVISIONED", "The owner must complete one authenticated session before API-owned workspaces can be addressed.", id);
      res.json({ ok: true, requestId: id, data: await listSources(actorId) });
    } catch (error) { handleFailure(res, id, error); }
  });

  app.post("/api/v1/enrichment", async (req, res) => {
    const id = res.locals.requestId as string;
    const parsed = z.object({ query: z.string().trim().min(2).max(180) }).safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "INVALID_QUERY", "query must be between 2 and 180 characters.", id);
    try {
      const actorId = await ownerId();
      if (!actorId) return sendError(res, 424, "OWNER_NOT_PROVISIONED", "The owner must complete one authenticated session before API-owned workspaces can be addressed.", id);
      const result = await searchPublicSources(parsed.data.query);
      await writeAudit(actorId, "api.enrichment.executed", "public_sources", parsed.data.query.slice(0, 128), "External tool requested allowlisted public-source enrichment.");
      res.json({ ok: true, requestId: id, data: result });
    } catch (error) { handleFailure(res, id, error); }
  });

  app.post("/api/v1/reports", async (req, res) => {
    const id = res.locals.requestId as string;
    const parsed = z.object({ investigationId: z.number().int().positive() }).safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "INVALID_INVESTIGATION_ID", "investigationId must be a positive integer.", id);
    try {
      const actorId = await ownerId();
      if (!actorId) return sendError(res, 424, "OWNER_NOT_PROVISIONED", "The owner must complete one authenticated session before API-owned workspaces can be addressed.", id);
      const investigation = await getInvestigationForOwner(parsed.data.investigationId, actorId);
      if (!investigation) return sendError(res, 404, "NOT_FOUND", "Investigation not found.", id);
      const [entities, evidence] = await Promise.all([listEntities(investigation.id), listEvidence(investigation.id)]);
      const content = [`# ${investigation.name}`, "", `**Objective:** ${investigation.objective}`, `**Classification:** ${investigation.classification}`, `**Generated:** ${new Date().toISOString()}`, "", "## Collection summary", `- Entities: ${entities.length}`, `- Evidence records: ${evidence.length}`, "", "## Evidence index", ...evidence.map(item => `- [${item.title}](${item.sourceUrl}) — ${item.sourceName}; confidence ${item.confidence}%; status ${item.reviewStatus}`)].join("\n");
      await writeAudit(actorId, "api.report.generated", "investigation", String(investigation.id), "External tool generated a report from persisted investigation records.", investigation.id);
      res.json({ ok: true, requestId: id, data: { investigationId: investigation.id, title: investigation.name, generatedAt: new Date().toISOString(), contentMarkdown: content } });
    } catch (error) { handleFailure(res, id, error); }
  });

  app.get("/api/v1/dashboard", async (_req, res) => {
    const id = res.locals.requestId as string;
    try {
      const actorId = await ownerId();
      if (!actorId) return sendError(res, 424, "OWNER_NOT_PROVISIONED", "The owner must complete one authenticated session before API-owned workspaces can be addressed.", id);
      res.json({ ok: true, requestId: id, data: await getDashboardCounts(actorId) });
    } catch (error) { handleFailure(res, id, error); }
  });
}
