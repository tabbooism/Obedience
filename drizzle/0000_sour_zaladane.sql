CREATE TABLE `intelligence_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int NOT NULL,
	`investigationId` int,
	`action` varchar(96) NOT NULL,
	`targetType` varchar(48) NOT NULL,
	`targetId` varchar(128),
	`justification` text NOT NULL,
	`requestId` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intelligence_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intelligence_entities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`investigationId` int NOT NULL,
	`entityType` varchar(48) NOT NULL,
	`canonicalValue` varchar(512) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`confidence` int NOT NULL DEFAULT 0,
	`riskScore` int NOT NULL DEFAULT 0,
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intelligence_entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intelligence_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`investigationId` int NOT NULL,
	`entityId` int,
	`sourceName` varchar(160) NOT NULL,
	`sourceUrl` varchar(1024) NOT NULL,
	`sourceType` varchar(48) NOT NULL,
	`title` varchar(512) NOT NULL,
	`excerpt` text,
	`contentHash` varchar(128) NOT NULL,
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	`observedAt` timestamp,
	`confidence` int NOT NULL DEFAULT 0,
	`reviewStatus` enum('unreviewed','corroborated','disputed','rejected') NOT NULL DEFAULT 'unreviewed',
	CONSTRAINT `intelligence_evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intelligence_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`baseUrl` varchar(512) NOT NULL,
	`sourceType` varchar(48) NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`priority` int NOT NULL DEFAULT 100,
	`timeoutMs` int NOT NULL DEFAULT 8000,
	`lastSuccessAt` timestamp,
	`lastFailureAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intelligence_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `investigations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`objective` text NOT NULL,
	`status` enum('active','paused','closed') NOT NULL DEFAULT 'active',
	`classification` enum('public','internal','confidential','restricted') NOT NULL DEFAULT 'internal',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investigations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `intelligence_audit_events` (`actorId`);--> statement-breakpoint
CREATE INDEX `audit_investigation_idx` ON `intelligence_audit_events` (`investigationId`);--> statement-breakpoint
CREATE INDEX `entities_investigation_idx` ON `intelligence_entities` (`investigationId`);--> statement-breakpoint
CREATE INDEX `entities_value_idx` ON `intelligence_entities` (`canonicalValue`);--> statement-breakpoint
CREATE INDEX `evidence_investigation_idx` ON `intelligence_evidence` (`investigationId`);--> statement-breakpoint
CREATE INDEX `evidence_hash_idx` ON `intelligence_evidence` (`contentHash`);--> statement-breakpoint
CREATE INDEX `sources_owner_idx` ON `intelligence_sources` (`ownerId`);--> statement-breakpoint
CREATE INDEX `investigations_owner_idx` ON `investigations` (`ownerId`);