import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const investigations = mysqlTable("investigations", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  objective: text("objective").notNull(),
  status: mysqlEnum("status", ["active", "paused", "closed"]).default("active").notNull(),
  classification: mysqlEnum("classification", ["public", "internal", "confidential", "restricted"]).default("internal").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ ownerIdx: index("investigations_owner_idx").on(table.ownerId) }));
export type Investigation = typeof investigations.$inferSelect;
export type InsertInvestigation = typeof investigations.$inferInsert;

export const intelligenceEntities = mysqlTable("intelligence_entities", {
  id: int("id").autoincrement().primaryKey(),
  investigationId: int("investigationId").notNull(),
  entityType: varchar("entityType", { length: 48 }).notNull(),
  canonicalValue: varchar("canonicalValue", { length: 512 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  confidence: int("confidence").default(0).notNull(),
  riskScore: int("riskScore").default(0).notNull(),
  firstSeenAt: timestamp("firstSeenAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ investigationIdx: index("entities_investigation_idx").on(table.investigationId), valueIdx: index("entities_value_idx").on(table.canonicalValue) }));
export type IntelligenceEntity = typeof intelligenceEntities.$inferSelect;
export type InsertIntelligenceEntity = typeof intelligenceEntities.$inferInsert;

export const intelligenceEvidence = mysqlTable("intelligence_evidence", {
  id: int("id").autoincrement().primaryKey(),
  investigationId: int("investigationId").notNull(),
  entityId: int("entityId"),
  sourceName: varchar("sourceName", { length: 160 }).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 1024 }).notNull(),
  sourceType: varchar("sourceType", { length: 48 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  excerpt: text("excerpt"),
  contentHash: varchar("contentHash", { length: 128 }).notNull(),
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
  observedAt: timestamp("observedAt"),
  confidence: int("confidence").default(0).notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["unreviewed", "corroborated", "disputed", "rejected"]).default("unreviewed").notNull(),
}, table => ({ investigationIdx: index("evidence_investigation_idx").on(table.investigationId), hashIdx: index("evidence_hash_idx").on(table.contentHash) }));
export type IntelligenceEvidence = typeof intelligenceEvidence.$inferSelect;
export type InsertIntelligenceEvidence = typeof intelligenceEvidence.$inferInsert;

export const intelligenceSources = mysqlTable("intelligence_sources", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  baseUrl: varchar("baseUrl", { length: 512 }).notNull(),
  sourceType: varchar("sourceType", { length: 48 }).notNull(),
  enabled: int("enabled").default(1).notNull(),
  priority: int("priority").default(100).notNull(),
  timeoutMs: int("timeoutMs").default(8000).notNull(),
  lastSuccessAt: timestamp("lastSuccessAt"),
  lastFailureAt: timestamp("lastFailureAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ ownerIdx: index("sources_owner_idx").on(table.ownerId) }));
export type IntelligenceSource = typeof intelligenceSources.$inferSelect;
export type InsertIntelligenceSource = typeof intelligenceSources.$inferInsert;

export const intelligenceAuditEvents = mysqlTable("intelligence_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId").notNull(),
  investigationId: int("investigationId"),
  action: varchar("action", { length: 96 }).notNull(),
  targetType: varchar("targetType", { length: 48 }).notNull(),
  targetId: varchar("targetId", { length: 128 }),
  justification: text("justification").notNull(),
  requestId: varchar("requestId", { length: 96 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ actorIdx: index("audit_actor_idx").on(table.actorId), investigationIdx: index("audit_investigation_idx").on(table.investigationId) }));
export type IntelligenceAuditEvent = typeof intelligenceAuditEvents.$inferSelect;
export type InsertIntelligenceAuditEvent = typeof intelligenceAuditEvents.$inferInsert;