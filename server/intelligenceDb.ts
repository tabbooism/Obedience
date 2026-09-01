import { desc, eq } from "drizzle-orm";
import {
  InsertIntelligenceEntity,
  InsertIntelligenceEvidence,
  InsertInvestigation,
  intelligenceAuditEvents,
  intelligenceEntities,
  intelligenceEvidence,
  intelligenceSources,
  investigations,
} from "../drizzle/schema";
import { getDb } from "./db";

export async function listInvestigations(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.select().from(investigations).where(eq(investigations.ownerId, ownerId)).orderBy(desc(investigations.updatedAt));
}

export async function createInvestigation(input: InsertInvestigation) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const result = await db.insert(investigations).values(input);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(investigations).where(eq(investigations.id, id)).limit(1);
  return rows[0];
}

export async function listEntities(investigationId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.select().from(intelligenceEntities).where(eq(intelligenceEntities.investigationId, investigationId)).orderBy(desc(intelligenceEntities.lastSeenAt));
}

export async function createEntity(input: InsertIntelligenceEntity) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const result = await db.insert(intelligenceEntities).values(input);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(intelligenceEntities).where(eq(intelligenceEntities.id, id)).limit(1);
  return rows[0];
}

export async function listEvidence(investigationId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.select().from(intelligenceEvidence).where(eq(intelligenceEvidence.investigationId, investigationId)).orderBy(desc(intelligenceEvidence.collectedAt));
}

export async function createEvidence(input: InsertIntelligenceEvidence) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const result = await db.insert(intelligenceEvidence).values(input);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(intelligenceEvidence).where(eq(intelligenceEvidence.id, id)).limit(1);
  return rows[0];
}

export async function listSources(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.select().from(intelligenceSources).where(eq(intelligenceSources.ownerId, ownerId)).orderBy(intelligenceSources.priority);
}

export async function recordAuditEvent(input: typeof intelligenceAuditEvents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.insert(intelligenceAuditEvents).values(input);
}

export async function getInvestigationForOwner(investigationId: number, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db.select().from(investigations).where(eq(investigations.id, investigationId)).limit(1);
  const investigation = rows[0];
  if (!investigation || investigation.ownerId !== ownerId) return undefined;
  return investigation;
}

export async function getDashboardCounts(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const ownerInvestigations = await db.select({ id: investigations.id }).from(investigations).where(eq(investigations.ownerId, ownerId));
  const investigationIds = ownerInvestigations.map(row => row.id);
  if (investigationIds.length === 0) {
    return { investigations: 0, entities: 0, evidence: 0, sources: (await listSources(ownerId)).length };
  }
  const entities = await db.select({ id: intelligenceEntities.id }).from(intelligenceEntities).where(eq(intelligenceEntities.investigationId, investigationIds[0]));
  const evidence = await db.select({ id: intelligenceEvidence.id }).from(intelligenceEvidence).where(eq(intelligenceEvidence.investigationId, investigationIds[0]));
  return { investigations: investigationIds.length, entities: entities.length, evidence: evidence.length, sources: (await listSources(ownerId)).length };
}

export async function getLatestAuditEvents(actorId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.select().from(intelligenceAuditEvents).where(eq(intelligenceAuditEvents.actorId, actorId)).orderBy(desc(intelligenceAuditEvents.createdAt)).limit(20);
}

export function isDatabaseUnavailable(error: unknown) {
  return error instanceof Error && error.message === "DATABASE_UNAVAILABLE";
}
