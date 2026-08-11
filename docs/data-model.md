# RecruitU — Data Model (v1)

> Design specification for the core data model. This is a conceptual/logical
> model — field names and types are indicative, not final DDL. It captures the
> entities, their relationships, and the design decisions behind them so the
> build has a stable backbone.

---

## 1. The big picture

Five things a job seeker's world is made of:

- **User** — a person with a role (job-seeker, advisor, or admin).
- **Master Profile** — the source of truth about a job-seeker (CV, skills, target roles).
- **Tracked Job** — the central object; one per job pursued. Owns a job snapshot
  and application state; borrows the profile; parents the artifacts.
- **Artifact** — a generated document or session tied to one tracked job
  (tailored resume, cover letter, cheat sheet, question pack, mock interview).
- **Share Grant** — a student-created, revocable permission letting a named
  advisor see a specific application or the whole workspace.

Two things that are read-only rollups, never a way into anyone's data:

- **Aggregate View** — anonymized cohort statistics for the institution.

---

## 2. Two dimensions of a tracked job (the key insight)

A tracked job has **two independent progress dimensions**. They are orthogonal —
neither drives the other — and conflating them into one pipeline breaks against
real behavior (people routinely apply *before* doing any prep).

### Dimension A — Application outcome (the funnel)

A single status, plus an append-only event log. This is what rolls up into
institutional analytics.

Canonical stages: `saved` → `applied` → `interviewing` → `offer` → `accepted`
Terminal side-exits: `rejected`, `withdrawn`, `no_response` *(derived: applied
with no forward event past a threshold — computed, never a manual button)*

A job may **enter at any stage** (log one already applied to, or already
interviewed for). A recruiter screen is the first *event* inside `interviewing`,
not its own stage.

### Dimension B — Prep progress (a checklist, not a status)

Which tool-generated artifacts exist yet for this job. Not a funnel — just
presence/absence, in any order, before or after applying:

`scored` · `resume_tailored` · `cover_letter` · `cheat_sheet` ·
`question_pack` · `mock_interviews_run`

---

## 3. Entities

### 3.1 User

| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| role | enum | `seeker` \| `advisor` \| `admin` |
| institution_id | uuid (FK) | nullable (a seeker may be unaffiliated) |
| program / cohort | string | for aggregate grouping; nullable |
| auth fields | — | SSO-compatible for institutions |
| created_at | timestamp | |

### 3.2 Master Profile

One per seeker. The source of truth; the tracked job never contradicts it.

| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | owner |
| version | int | **increments on every material edit** (see §4) |
| master_cv | document ref | the canonical CV |
| extracted_skills | list | parsed from the CV |
| target_roles | list | job titles/positions to look for |
| summary_facts | struct | years of experience, education, certs, locations |
| updated_at | timestamp | |

### 3.3 Tracked Job (the hub)

**Source & provenance**

| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | owner |
| source_type | enum | `paste` \| `screenshot_ocr` \| `url` \| `manual` |
| source_raw | text | the original text/OCR — **kept for re-parsing** |
| source_url | string | nullable |
| captured_at | timestamp | |

**Job snapshot (parsed once, read by scoring AND tailoring)**

| Field | Type | Notes |
|---|---|---|
| company | string | |
| title | string | |
| location / work_mode | string / enum | onsite \| hybrid \| remote |
| employment_type | enum | full-time \| contract \| internship |
| comp_range | string | nullable |
| deadline | date | nullable |
| description | text | cleaned |
| requirements | struct | `must_have[]`, `nice_to_have[]` |
| keywords | list | for ATS mirroring + scoring |

**Fit assessment (a structure, never a bare number)**

| Field | Type | Notes |
|---|---|---|
| overall_score | number | always shown WITH the breakdown |
| breakdown | list | per requirement: `met` \| `partial` \| `gap` \| `unknown` |
| gaps | list | each gap + how to close or reframe it |
| scored_against_profile_version | int | ties to Master Profile.version |
| scored_at | timestamp | powers the "recompute?" nudge |

**Application state**

| Field | Type | Notes |
|---|---|---|
| status | enum | current outcome stage (Dimension A) |
| status_events | list (append-only) | `{from, to, at}` — the analytics substrate |
| date_applied | date | nullable until applied |
| next_action | string | nullable |
| next_action_due | date | nullable |
| prep_progress | struct | the Dimension B checklist |

**Contacts**

| Field | Type | Notes |
|---|---|---|
| contacts | list | `{name, relationship, email, linkedin, notes}` |
| interviewer_profile | struct | **role & likely style only** — not a dossier on a named private person |

**User meta (the person's own view, separate from the system's)**

| Field | Type | Notes |
|---|---|---|
| interest_level | enum/int | **user-set — never derived from fit score** |
| priority | enum | |
| tags | list | |
| notes | text | |

### 3.4 Artifact

Separate, versioned objects the job points at — not fields inside the job.

| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| tracked_job_id | uuid (FK) | parent |
| type | enum | `resume` \| `cover_letter` \| `cheat_sheet` \| `question_pack` \| `mock_session` |
| version | int | a job may hold resume v1, v2, … |
| based_on_profile_version | int | provenance of what it was generated from |
| content / transcript | document ref | |
| created_at | timestamp | |

### 3.5 Share Grant (the second layer)

The **only** path into a student's actual applications. Student-created,
scoped, revocable.

| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| granted_by | uuid (FK) | the student (always the originator) |
| granted_to | uuid (FK) | a named advisor |
| scope | enum | `single_job` \| `whole_workspace` |
| tracked_job_id | uuid (FK) | set when scope = single_job |
| status | enum | `active` \| `revoked` |
| created_at / revoked_at | timestamp | |

---

## 4. Design decisions (load-bearing)

1. **Two dimensions, not one pipeline.** Outcome (funnel) and prep (checklist)
   are orthogonal. A job can be `applied` with zero prep, or fully prepped and
   still `saved`. Modeled separately on purpose.

2. **Fit score is a function of job × profile, so it goes stale.** It records
   `scored_against_profile_version`; when the profile advances, the app flags a
   recompute rather than showing a number that no longer means what it says.

3. **Interest ≠ fit.** `interest_level` is user-set and independent of
   `overall_score`. The score directs effort; it never gatekeeps or discourages
   a reach application.

4. **Artifacts are separate and versioned.** Referenced, not embedded, so a job
   can carry multiple resume versions and a resume can be reused across jobs.

5. **Status stored twice.** Denormalized `status` for display; append-only
   `status_events` for analytics. The event log — not the current status — is
   what makes the institutional funnel possible.

6. **Keep raw source forever.** `source_raw` survives a bad parse so it can be
   re-run later. URL ingestion is fragile; paste/OCR is the reliable fallback.

---

## 5. The two-layer visibility model

Two entirely separate mechanisms. Neither grants the other.

### Layer 1 — Institution (admin) sees aggregate only

- Anonymized cohort statistics and funnel rates (applied → response →
  interview → offer), plus outcome counts.
- **Minimum cohort size (~10)** before any statistic renders; smaller groups are
  suppressed to prevent re-identification.
- Not filterable down to an individual by stacking filters.
- Admin aggregate access confers **zero** ability to open any individual
  workspace.

### Layer 2 — Advisor sees an individual ONLY via a Share Grant

- Access flows **from student to advisor**, never from the institution.
- Student-initiated, scoped (one application or whole workspace), and revocable
  at any time.
- An advisor sees only students who invited them, and only what was shared.

**Structural guarantee:** there is no code path from the admin/aggregate layer to
an individual's data. The sole entry to a workspace is an `active` Share Grant
created by that workspace's owner. This is enforced by the model, not by policy.

### Why this shape

- **Student trust:** private by default; nobody watches unless invited. A tool
  students don't trust produces no data, which defeats Layer 1 too.
- **FERPA alignment:** students control their own records; consent-based sharing
  is the easy path through a privacy office, not the hard one.
- **Institutional value:** outcome analytics to report upward.
- **Advisor efficiency:** "one advisor supports more students" — but by
  invitation, not surveillance.
