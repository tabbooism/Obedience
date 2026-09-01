import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { isAuthorizedApiKey } from "./apiAuth";
import { searchPublicSources } from "./osintSources";

const windowMs = 60_000;
const maxRequestsPerWindow = 60;
const requests = new Map<string, { startedAt: number; count: number }>();

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

export function registerIntelligenceApi(app: Express) {
  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true, service: "obediance-intelligence-api", version: "v1", timestamp: new Date().toISOString() });
  });

  app.post("/api/v1/osint/search", async (req, res) => {
    const id = requestId(req);
    res.setHeader("x-request-id", id);
    if (!requireApiKey(req, res, id)) return;
    const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    if (query.length < 2 || query.length > 180) {
      sendError(res, 400, "INVALID_QUERY", "Query must be between 2 and 180 characters.", id);
      return;
    }
    try {
      const result = await searchPublicSources(query);
      res.json({ ok: true, requestId: id, result });
    } catch (error) {
      sendError(res, 502, "UPSTREAM_UNAVAILABLE", "No allowlisted public source returned a usable response.", id);
    }
  });
}
