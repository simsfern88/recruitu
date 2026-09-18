/**
 * RecruitU — data model (Drizzle schema)
 *
 * Faithful to data-model.md v1. The whole model lives here even though only
 * some surfaces are built in the MVP: the schema is the backbone; the deferred
 * pieces (Share Grant, advisor/admin surfaces) still need their tables laid
 * down correctly now so nothing has to be retrofitted later.
 *
 * Two load-bearing ideas encoded here:
 *   - A tracked job carries TWO orthogonal progress dimensions:
 *       A. application outcome  -> `status` + append-only `statusEvents`
 *       B. prep progress        -> `prepProgress` checklist (presence/absence)
 *   - Visibility is two entirely separate layers. The ONLY path into an
 *     individual's data is an active Share Grant they created. That guarantee
 *     is enforced in the database (see db/rls.sql), not by application policy.
 */

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ enums */

export const userRole = pgEnum("user_role", ["seeker", "advisor", "admin"]);

export const sourceType = pgEnum("source_type", [
  "paste",
  "screenshot_ocr",
  "url",
  "manual",
]);

export const workMode = pgEnum("work_mode", ["onsite", "hybrid", "remote"]);

export const employmentType = pgEnum("employment_type", [
  "full_time",
  "contract",
  "internship",
]);

// Dimension A — canonical outcome stages. Terminal side-exits included.
// All eight are user-toggleable from the job page; `statusEvents` logs every
// transition so the switch is never lossy.
export const outcomeStatus = pgEnum("outcome_status", [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
  "no_response",
]);

export const artifactType = pgEnum("artifact_type", [
  "resume",
  "cover_letter",
  "cheat_sheet",
  "question_pack",
  "mock_session",
]);

export const shareScope = pgEnum("share_scope", ["single_job", "whole_workspace"]);
export const shareStatus = pgEnum("share_status", ["active", "revoked"]);
export const interestLevel = pgEnum("interest_level", ["low", "medium", "high"]);
export const priorityLevel = pgEnum("priority_level", ["low", "medium", "high"]);

/* ---------------------------------------------------------------- helpers */

const id = () => uuid("id").defaultRandom().primaryKey();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------ institution */
/**
 * Not fleshed out in the MVP, but the FK target exists so users can be
 * affiliated and cohort grouping (§5, aggregate layer) has something to hang
 * off of. Roster/SSO onboarding is a later companion spec.
 */
export const institutions = pgTable("institutions", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

/* -------------------------------------------------------------------- user */

export const users = pgTable("users", {
  id: id(),
  role: userRole("role").notNull().default("seeker"),
  institutionId: uuid("institution_id").references(() => institutions.id, {
    onDelete: "set null",
  }), // nullable: a seeker may be unaffiliated
  program: text("program"), // for aggregate grouping; nullable
  cohort: text("cohort"),

  // auth (SSO-compatible seam: a federated user simply has a null passwordHash
  // and a row in `federatedIdentities` instead — added when SSO lands)
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // null once SSO-only
  displayName: text("display_name"),

  createdAt: createdAt(),
});

/* ---------------------------------------------------------------- sessions */

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // opaque token (hashed at rest — see lib/session.ts)
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/* ---------------------------------------------------------- master profile */
/**
 * One per seeker. The source of truth; a tracked job never contradicts it.
 * `version` increments on every material edit (design decision §4.2) so a fit
 * assessment can record which version it was scored against and go stale
 * honestly.
 */
export const masterProfiles = pgTable("master_profiles", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  version: integer("version").notNull().default(1),
  masterCvRef: text("master_cv_ref"), // storage ref to the canonical CV
  // Best-effort accent color detected from an uploaded PDF CV (see
  // lib/cv-style.ts) — applied to all generated documents for a uniform,
  // CV-matching look. Null if not detected (plain-text CV, no clear accent).
  styleAccentColor: text("style_accent_color"),
  extractedSkills: jsonb("extracted_skills").$type<string[]>().notNull().default([]),
  targetRoles: jsonb("target_roles").$type<string[]>().notNull().default([]),
  summaryFacts: jsonb("summary_facts").$type<SummaryFacts>(),

  // The actual CV content, as structured + user-editable elements — pre-filled
  // by extraction, then correctable by hand (CV extraction is best-effort and
  // will miss things). This is what tailored resumes/cover letters/prep draw
  // on directly, rather than re-parsing the raw CV text on every generation.
  contact: jsonb("contact").$type<ProfileContact>(),
  experience: jsonb("experience").$type<ProfileExperienceEntry[]>().notNull().default([]),
  education: jsonb("education").$type<ProfileEducationEntry[]>().notNull().default([]),
  languages: jsonb("languages").$type<string[]>().notNull().default([]),
  certifications: jsonb("certifications").$type<string[]>().notNull().default([]),
  licenses: jsonb("licenses").$type<string[]>().notNull().default([]),

  updatedAt: updatedAt(),
});

export type SummaryFacts = {
  yearsExperience?: number;
  education?: string[];
  certifications?: string[];
  locations?: string[];
};

export type ProfileContact = {
  email?: string;
  phone?: string;
  location?: string;
  links?: string[];
};

export type ProfileExperienceEntry = {
  id: string;
  company: string;
  title: string;
  dates?: string;
  location?: string;
  bullets: string[];
};

export type ProfileEducationEntry = {
  id: string;
  school: string;
  credential?: string;
  dates?: string;
  details?: string;
};

/* ------------------------------------------------------------- tracked job */
/**
 * The hub. Owns a parsed job snapshot + fit assessment + application state,
 * borrows the profile, parents the artifacts. Snapshot / fit / application
 * state are kept as columns + jsonb structs on this row; artifacts are separate
 * rows (they are versioned and reusable — §4.4).
 */
export const trackedJobs = pgTable("tracked_jobs", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // source & provenance — raw source is kept forever so a bad parse can re-run
  sourceType: sourceType("source_type").notNull(),
  sourceRaw: text("source_raw").notNull(),
  sourceUrl: text("source_url"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),

  // job snapshot (parsed once; read by BOTH scoring and, later, tailoring)
  company: text("company"),
  title: text("title"),
  companyUrl: text("company_url"), // the company's own site, given at capture time
  location: text("location"),
  workMode: workMode("work_mode"),
  employmentType: employmentType("employment_type"),
  compRange: text("comp_range"),
  deadline: date("deadline"),
  description: text("description"), // the role itself: duties, day-to-day
  companyDescription: text("company_description"), // the company: mission, product, culture
  companyResearch: text("company_research"), // raw scrape of companyUrl — kept forever, like sourceRaw, for re-use/re-parsing
  requirements: jsonb("requirements").$type<JobRequirements>(),
  keywords: jsonb("keywords").$type<string[]>().default([]),

  // fit assessment — always a structure, never a bare number (§3, decision)
  fit: jsonb("fit").$type<FitAssessment>(),

  // Dimension A — application outcome
  status: outcomeStatus("status").notNull().default("saved"),
  dateApplied: date("date_applied"),
  nextAction: text("next_action"),
  nextActionDue: date("next_action_due"),

  // Dimension B — prep progress checklist (presence/absence, any order)
  prepProgress: jsonb("prep_progress").$type<PrepProgress>().notNull().default({
    scored: false,
    resume_tailored: false,
    cover_letter: false,
    cheat_sheet: false,
    question_pack: false,
    mock_interviews_run: false,
  }),

  // user meta — the person's own view, kept apart from the system's scoring
  interestLevel: interestLevel("interest_level"), // user-set — never derived from fit
  priority: priorityLevel("priority"),
  tags: jsonb("tags").$type<string[]>().default([]),
  notes: text("notes"),

  // contacts / interviewer prep. Interviewer is role & likely style ONLY —
  // never a dossier on a named private person (product guardrail).
  contacts: jsonb("contacts").$type<Contact[]>().default([]),
  interviewerProfile: jsonb("interviewer_profile").$type<InterviewerProfile>(),

  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type JobRequirements = {
  must_have: string[];
  nice_to_have: string[];
};

export type FitBreakdownItem = {
  requirement: string;
  verdict: "met" | "partial" | "gap" | "unknown";
  evidence?: string; // why we judged it this way, drawn from the profile
};

export type FitGap = {
  requirement: string;
  howToClose: string; // "how to close or reframe" — never "don't apply"
};

// Anchors the number to a plain-language read so a solid match doesn't scan
// like a failing test score: 85-100 Strong Match, 70-84 Good Fit,
// 50-69 Worth Pursuing, 0-49 Reach. Assigned by the model in the same pass as
// the score so the two never disagree — see MATCH_LABEL_BANDS in lib/anthropic.ts.
export type MatchLabel = "Strong Match" | "Good Fit" | "Worth Pursuing" | "Reach";

export type FitAssessment = {
  overallScore: number; // 0–100, always shown WITH the breakdown
  matchLabel: MatchLabel;
  headline: string;
  breakdown: FitBreakdownItem[];
  gaps: FitGap[];
  scoredAgainstProfileVersion: number; // ties to masterProfiles.version
  scoredAt: string; // ISO — powers the "recompute?" nudge when profile advances
};

export type PrepProgress = {
  scored: boolean;
  resume_tailored: boolean;
  cover_letter: boolean;
  cheat_sheet: boolean;
  question_pack: boolean;
  mock_interviews_run: boolean;
};

export type Contact = {
  name: string;
  relationship?: string;
  email?: string;
  linkedin?: string;
  notes?: string;
};

export type InterviewerProfile = {
  role?: string;
  likelyStyle?: string; // e.g. "behavioral-heavy", "systems design"
};

/* --------------------------------------------------- application status log */
/**
 * Append-only. This — not the denormalized `status` column — is what makes the
 * institutional funnel possible (§4.5). Status is stored twice on purpose:
 * once for display, once as history for analytics.
 */
export const statusEvents = pgTable("status_events", {
  id: id(),
  trackedJobId: uuid("tracked_job_id")
    .notNull()
    .references(() => trackedJobs.id, { onDelete: "cascade" }),
  fromStatus: outcomeStatus("from_status"),
  toStatus: outcomeStatus("to_status").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------------------------------------------------------- artifacts */
/**
 * Separate, versioned objects the job points at — not fields inside the job.
 * A job may hold resume v1, v2, …; a resume can be reused across jobs (§4.4).
 */
export const artifacts = pgTable("artifacts", {
  id: id(),
  trackedJobId: uuid("tracked_job_id")
    .notNull()
    .references(() => trackedJobs.id, { onDelete: "cascade" }),
  type: artifactType("type").notNull(),
  version: integer("version").notNull().default(1),
  basedOnProfileVersion: integer("based_on_profile_version"),
  contentRef: text("content_ref"), // storage ref to the document/transcript
  content: jsonb("content"), // small inline content (e.g. Q&A pack)
  createdAt: createdAt(),
});

/* ------------------------------------------------------------- share grant */
/**
 * The ONLY path into a student's actual applications. Student-created, scoped,
 * revocable. Deferred as a *surface* in the MVP, but the table exists so RLS
 * can key the advisor-visibility policy off it from day one.
 */
export const shareGrants = pgTable("share_grants", {
  id: id(),
  grantedBy: uuid("granted_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }), // always the student
  grantedTo: uuid("granted_to")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }), // a named advisor
  scope: shareScope("scope").notNull(),
  trackedJobId: uuid("tracked_job_id").references(() => trackedJobs.id, {
    onDelete: "cascade",
  }), // set when scope = single_job
  status: shareStatus("status").notNull().default("active"),
  createdAt: createdAt(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

/* ------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [users.institutionId],
    references: [institutions.id],
  }),
  masterProfile: one(masterProfiles),
  trackedJobs: many(trackedJobs),
}));

export const masterProfilesRelations = relations(masterProfiles, ({ one }) => ({
  user: one(users, {
    fields: [masterProfiles.userId],
    references: [users.id],
  }),
}));

export const trackedJobsRelations = relations(trackedJobs, ({ one, many }) => ({
  user: one(users, { fields: [trackedJobs.userId], references: [users.id] }),
  statusEvents: many(statusEvents),
  artifacts: many(artifacts),
}));

export const statusEventsRelations = relations(statusEvents, ({ one }) => ({
  trackedJob: one(trackedJobs, {
    fields: [statusEvents.trackedJobId],
    references: [trackedJobs.id],
  }),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  trackedJob: one(trackedJobs, {
    fields: [artifacts.trackedJobId],
    references: [trackedJobs.id],
  }),
}));

/* --------------------------------------------------------- inferred types */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type MasterProfile = typeof masterProfiles.$inferSelect;
export type TrackedJob = typeof trackedJobs.$inferSelect;
export type NewTrackedJob = typeof trackedJobs.$inferInsert;
export type StatusEvent = typeof statusEvents.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type ShareGrant = typeof shareGrants.$inferSelect;

// Keep sql import referenced for callers that build raw fragments against RLS.
export const _sql = sql;
