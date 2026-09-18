# RecruitU

Organize, tailor, and prepare a whole job hunt in one place — resume tailoring,
an explainable fit score, application tracking, interview prep, and (placeholder
today) mock interviews and admin-uploaded job postings.

**Status:** working prototype, in active development. Single-user auth, capture →
score → tailor → prep → track loop is fully built; advisor/admin surfaces and
voice mock interviews are designed but not yet built. See "What's built" below.

## Stack

- **Next.js 15 (App Router) + TypeScript** — server components for reads, server
  actions for mutations.
- **PostgreSQL + Drizzle ORM** — the relational model is the backbone.
- **Postgres Row-Level Security** — the two-layer visibility guarantee from
  `docs/data-model.md` §5 is enforced in the database, not by remembering a
  `WHERE` clause. See [Security model](#security-model).
- **Self-hosted session auth** (Argon2id, hashed opaque tokens) — provider-
  agnostic so institutional SSO plugs into the same seam later.
- **Anthropic SDK** (`claude-sonnet-5` / `claude-haiku-4-5`) — CV extraction, job
  parsing, fit scoring, document tailoring, interview prep generation.

## Quick start

```bash
cp .env.example .env          # fill in ANTHROPIC_API_KEY
docker compose up -d          # Postgres on :5432, creates the recruitu_app role
npm install
npm run db:setup              # push schema (admin) -> grant app role -> apply RLS
npm run dev                   # http://localhost:3000
```

`db:setup` runs three steps: `db:push` creates tables as the owner,
`db:grants` gives the restricted `recruitu_app` role table privileges, and
`db:rls` applies the policies in `db/rls.sql`. Re-run `db:grants` after any push
that adds tables.

## What's built

- **Onboarding** — paste/upload a CV → Claude extracts target roles, skills, and
  summary facts → `Master Profile` v1. Editing bumps the version (so fit scores
  can go stale honestly). A "Suggested roles" panel reasons over the whole
  profile to recommend positions/titles to target.
- **Capture** — paste text, a URL, or a screenshot → parsed into a job snapshot.
  `source_raw` is kept forever; a failed URL scrape degrades to "paste instead,"
  never a dead error.
- **Fit score** — job snapshot × master profile → a *structured* assessment:
  per-requirement met/partial/gap plus gaps framed as how-to-close, shown as a
  category (Strong Match / Good Fit / Worth Pursuing / Reach), never a bare
  number. Records `scoredAgainstProfileVersion` so a stale score is flagged, not
  silently trusted.
- **Tailoring** — a role-specific resume (multiple templates, ATS-formatted) and
  cover letter generated from the real profile, never fabricated, previewed
  inline with a "view full" modal and downloadable as PDF.
  - **Interview prep** — a company/role cheat sheet and a 20-30 question
  interview Q&A pack with model answers, same preview/modal/PDF pattern.
- **Dashboard** — every tracked job with both progress dimensions visible:
  outcome funnel ladder (A) and prep checklist (B), fit score, next action, plus
  an analytics section (stage funnel, fit-quality distribution, response rate).
- **Outcome log** — `status_events` is append-only from capture onward (the
  analytics substrate).
- **Company info refresh** — re-pull or hand-edit "About the company" any time
  after capture (URL, pasted text, or manual).

## Not yet built (placeholders exist)

- **Mock interviews** — voice-driven simulated interviews graded against the
  Q&A pack. UI placeholder exists on each job's page; no voice infrastructure
  yet.
- **Job postings** — admin-uploaded postings matched against a student's
  suggested roles/competencies. UI placeholder tab exists; no upload path or
  matching engine yet.
- **Advisor / admin surfaces** — the data model (`share_grants`, the aggregate
  view) supports both; no UI yet.
- **Institution roster sync / SSO** — companion spec, not started.

Job discovery itself (surfacing postings from the open web) is intentionally out
of scope — RecruitU's value starts once a job is brought in, not in competing
with LinkedIn/Indeed for discovery.

## Security model

Two separate layers, neither granting the other:

- **Layer 1 (institution/admin)** — aggregate only, served from separate
  pre-anonymized rollups with a minimum-cohort gate. There is **no RLS exception**
  that lets an admin open an individual workspace. That's the point.
- **Layer 2 (advisor)** — an individual's data is reachable *only* through an
  `active` Share Grant the student created. `db/rls.sql` encodes this as the sole
  read path into `tracked_jobs`.

Every request runs inside `withUser(userId, …)` (`db/index.ts`), which sets
`app.current_user_id` as a transaction-local so pooled connections can't leak
context. The app connects as a non-superuser role; **do not** point
`DATABASE_URL` at a superuser or a `BYPASSRLS` role, or the policies won't bite.

## Layout

```
app/
  login/                 auth (signup/login/logout)
  (app)/
    onboarding/          CV -> master profile, suggested roles
    jobs/new/             capture (paste / url / screenshot)
    jobs/[id]/            snapshot, fit assessment, tailoring, prep, mock-interview placeholder
    postings/             job-postings placeholder tab
    dashboard/            the tracker + analytics
db/
  schema.ts              full data model (all entities)
  rls.sql                the two-layer guarantee, in SQL
  grants.sql             app-role privileges
lib/
  anthropic.ts           extract / parse / score / tailor / prep-generate (guardrails in the prompts)
  auth.ts, session.ts    password hashing + sessions
  queries.ts             RLS-scoped reads
  scrape.ts, storage.ts  url ingest (graceful) + file seam
```

## Documentation

- `docs/PROTOTYPE_v1_2026-06-01.md` — the original working prototype (verbatim
  system spec) that started the product.
- `docs/core-loop.md` — the student-facing flow spec (onboarding, dashboard,
  per-job cycle).
- `docs/data-model.md` — the full data model, including the two-layer visibility
  model this app's RLS policies implement.
- `provenance/` — dated evidence of prior invention. See its README.

## Notes

- This is a **private** repository. It contains personal data and pre-release IP.
- Do not commit secrets (API keys, `.env` files). See `.gitignore`.
