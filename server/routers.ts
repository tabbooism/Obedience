import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createEntity,
  createEvidence,
  createInvestigation,
  getDashboardCounts,
  getInvestigationForOwner,
  getLatestAuditEvents,
  isDatabaseUnavailable,
  listEntities,
  listEvidence,
  listInvestigations,
  listSources,
  recordAuditEvent,
} from "./intelligenceDb";
import { searchPublicSources } from "./osintSources";

const classification = z.enum(["public", "internal", "confidential", "restricted"]);

function requestId() {
  return crypto.randomUUID();
}

function mapDatabaseError(error: unknown): never {
  if (isDatabaseUnavailable(error)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "DATABASE_UNAVAILABLE" });
  }
  throw error;
}

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ status: "ok" as const, service: "obediance-api", timestamp: new Date().toISOString() })),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  intelligence: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await getDashboardCounts(ctx.user.id);
      } catch (error) {
        return mapDatabaseError(error);
      }
    }),
    investigations: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listInvestigations(ctx.user.id);
      } catch (error) {
        return mapDatabaseError(error);
      }
    }),
    createInvestigation: protectedProcedure
      .input(z.object({ name: z.string().trim().min(3).max(160), objective: z.string().trim().min(10).max(5000), classification }))
      .mutation(async ({ ctx, input }) => {
        try {
          const investigation = await createInvestigation({ ...input, ownerId: ctx.user.id });
          await recordAuditEvent({ actorId: ctx.user.id, investigationId: investigation.id, action: "investigation.created", targetType: "investigation", targetId: String(investigation.id), justification: "Operator created investigation workspace.", requestId: requestId() });
          return investigation;
        } catch (error) {
          return mapDatabaseError(error);
        }
      }),
    workspace: protectedProcedure
      .input(z.object({ investigationId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        try {
          const investigation = await getInvestigationForOwner(input.investigationId, ctx.user.id);
          if (!investigation) throw new TRPCError({ code: "NOT_FOUND", message: "INVESTIGATION_NOT_FOUND" });
          const [entities, evidence] = await Promise.all([listEntities(input.investigationId), listEvidence(input.investigationId)]);
          return { investigation, entities, evidence };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          return mapDatabaseError(error);
        }
      }),
    createEntity: protectedProcedure
      .input(z.object({ investigationId: z.number().int().positive(), entityType: z.string().trim().min(2).max(48), canonicalValue: z.string().trim().min(1).max(512), displayName: z.string().trim().min(1).max(255), confidence: z.number().int().min(0).max(100).default(0), riskScore: z.number().int().min(0).max(100).default(0) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const investigation = await getInvestigationForOwner(input.investigationId, ctx.user.id);
          if (!investigation) throw new TRPCError({ code: "NOT_FOUND", message: "INVESTIGATION_NOT_FOUND" });
          const entity = await createEntity(input);
          await recordAuditEvent({ actorId: ctx.user.id, investigationId: input.investigationId, action: "entity.created", targetType: "entity", targetId: String(entity.id), justification: "Operator added entity to investigation.", requestId: requestId() });
          return entity;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          return mapDatabaseError(error);
        }
      }),
    createEvidence: protectedProcedure
      .input(z.object({ investigationId: z.number().int().positive(), entityId: z.number().int().positive().optional(), sourceName: z.string().trim().min(2).max(160), sourceUrl: z.string().url().max(1024), sourceType: z.string().trim().min(2).max(48), title: z.string().trim().min(1).max(512), excerpt: z.string().max(10000).optional(), contentHash: z.string().trim().min(16).max(128), confidence: z.number().int().min(0).max(100).default(0), observedAt: z.coerce.date().optional() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const investigation = await getInvestigationForOwner(input.investigationId, ctx.user.id);
          if (!investigation) throw new TRPCError({ code: "NOT_FOUND", message: "INVESTIGATION_NOT_FOUND" });
          const evidence = await createEvidence(input);
          await recordAuditEvent({ actorId: ctx.user.id, investigationId: input.investigationId, action: "evidence.created", targetType: "evidence", targetId: String(evidence.id), justification: "Operator attached source evidence to investigation.", requestId: requestId() });
          return evidence;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          return mapDatabaseError(error);
        }
      }),
    sources: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listSources(ctx.user.id);
      } catch (error) {
        return mapDatabaseError(error);
      }
    }),
    audit: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await getLatestAuditEvents(ctx.user.id);
      } catch (error) {
        return mapDatabaseError(error);
      }
    }),
    publicSearch: protectedProcedure
      .input(z.object({ query: z.string().trim().min(2).max(180) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await searchPublicSources(input.query);
          await recordAuditEvent({ actorId: ctx.user.id, action: "osint.search", targetType: "public_sources", targetId: input.query.slice(0, 128), justification: "Operator requested an allowlisted public-source search.", requestId: requestId() });
          return result;
        } catch (error) {
          return mapDatabaseError(error);
        }
      }),
    adminHealth: adminProcedure.query(async ({ ctx }) => ({ actor: ctx.user.email ?? ctx.user.name ?? String(ctx.user.id), status: "ready" as const, timestamp: new Date().toISOString() })),
  }),
});

export type AppRouter = typeof appRouter;
