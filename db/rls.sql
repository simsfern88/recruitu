-- RecruitU — Row-Level Security
--
-- This file is the structural half of data-model.md §5. The application sets
-- `app.current_user_id` at the start of every request (see lib/db.ts). Every
-- policy below keys off that value, so "who can see this row" is decided by the
-- database, not by remembering to add a WHERE clause in each query.
--
-- The guarantee we are enforcing:
--   Layer 1 (institution/admin)  -> aggregate only; ZERO path to an individual.
--   Layer 2 (advisor)            -> an individual ONLY via an ACTIVE share grant
--                                   that the individual created.
--
-- Run this AFTER `drizzle-kit push` (which creates the tables). It is
-- idempotent: policies are dropped and recreated.
--
-- IMPORTANT: connect the application as a NON-superuser, non-BYPASSRLS role.
-- Superusers and table owners bypass RLS. See README "Database roles".

-- Helper: the current request's user id, or NULL if unset.
create or replace function app_current_user() returns uuid
language sql stable as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

-- Helper: does an active share grant give the current user access to a job?
create or replace function app_can_view_job(job_id uuid, job_owner uuid)
returns boolean language sql stable as $$
  select
    -- the owner always sees their own job
    job_owner = app_current_user()
    or exists (
      select 1 from share_grants g
      where g.status = 'active'
        and g.granted_to = app_current_user()
        and g.granted_by = job_owner
        and (
          g.scope = 'whole_workspace'
          or (g.scope = 'single_job' and g.tracked_job_id = job_id)
        )
    )
$$;

-- ------------------------------------------------------- auth lookups
-- The users_self/users_update/users_insert policies below correctly refuse
-- to let the app read a users row until it already knows who "you" are —
-- but signup (check for a duplicate email), login (find the row to check
-- the password against), and session validation (find the row a cookie
-- belongs to) all need to look a row up BEFORE that identity exists. These
-- SECURITY DEFINER functions are a narrow, audited exception: the app role
-- may call exactly these two lookups and nothing else outside its own
-- RLS-scoped request context.
create or replace function auth_user_by_email(p_email text)
returns table (
  id uuid, role text, institution_id uuid, program text, cohort text,
  email text, password_hash text, display_name text, created_at timestamptz
) language sql security definer set search_path = public stable as $$
  select id, role::text, institution_id, program, cohort,
         email, password_hash, display_name, created_at
  from users
  where email = p_email
$$;
revoke all on function auth_user_by_email(text) from public;
grant execute on function auth_user_by_email(text) to recruitu_app;

create or replace function auth_user_by_session(p_token_hash text)
returns table (
  id uuid, role text, institution_id uuid, program text, cohort text,
  email text, password_hash text, display_name text, created_at timestamptz
) language sql security definer set search_path = public stable as $$
  select u.id, u.role::text, u.institution_id, u.program, u.cohort,
         u.email, u.password_hash, u.display_name, u.created_at
  from sessions s
  join users u on u.id = s.user_id
  where s.id = p_token_hash and s.expires_at > now()
$$;
revoke all on function auth_user_by_session(text) from public;
grant execute on function auth_user_by_session(text) to recruitu_app;

-- ----------------------------------------------------------------- users
alter table users enable row level security;
alter table users force row level security;

drop policy if exists users_self on users;
create policy users_self on users
  for select
  using (id = app_current_user());

drop policy if exists users_update on users;
create policy users_update on users
  for update
  using (id = app_current_user())
  with check (id = app_current_user());

-- Signup runs with no user context yet (see unscopedDb in db/index.ts), so the
-- new row can't be checked against app_current_user(). Anyone may create an
-- account; the app controls what row actually gets inserted.
drop policy if exists users_insert on users;
create policy users_insert on users
  for insert
  with check (true);

-- ------------------------------------------------------- master_profiles
alter table master_profiles enable row level security;
alter table master_profiles force row level security;

drop policy if exists profiles_owner on master_profiles;
create policy profiles_owner on master_profiles
  using (user_id = app_current_user())
  with check (user_id = app_current_user());

-- ----------------------------------------------------------- tracked_jobs
alter table tracked_jobs enable row level security;
alter table tracked_jobs force row level security;

-- Reads: owner, or an advisor holding an active grant. This single policy is
-- the ONLY door into an individual's job data. There is deliberately no policy
-- that grants access by institution/admin role.
drop policy if exists jobs_read on tracked_jobs;
create policy jobs_read on tracked_jobs
  for select
  using (app_can_view_job(id, user_id));

-- Writes: owner only. Advisors read via a grant; they never mutate.
drop policy if exists jobs_write on tracked_jobs;
create policy jobs_write on tracked_jobs
  for all
  using (user_id = app_current_user())
  with check (user_id = app_current_user());

-- ---------------------------------------------------------- status_events
alter table status_events enable row level security;
alter table status_events force row level security;

drop policy if exists events_via_job on status_events;
create policy events_via_job on status_events
  using (exists (
    select 1 from tracked_jobs j
    where j.id = status_events.tracked_job_id
      and app_can_view_job(j.id, j.user_id)
  ))
  with check (exists (
    select 1 from tracked_jobs j
    where j.id = status_events.tracked_job_id
      and j.user_id = app_current_user()
  ));

-- --------------------------------------------------------------- artifacts
alter table artifacts enable row level security;
alter table artifacts force row level security;

drop policy if exists artifacts_via_job on artifacts;
create policy artifacts_via_job on artifacts
  using (exists (
    select 1 from tracked_jobs j
    where j.id = artifacts.tracked_job_id
      and app_can_view_job(j.id, j.user_id)
  ))
  with check (exists (
    select 1 from tracked_jobs j
    where j.id = artifacts.tracked_job_id
      and j.user_id = app_current_user()
  ));

-- ------------------------------------------------------------ share_grants
alter table share_grants enable row level security;
alter table share_grants force row level security;

-- A grant is visible to the student who made it and the advisor who received
-- it. Only the granting student may create/modify (revoke) it.
drop policy if exists grants_visible on share_grants;
create policy grants_visible on share_grants
  for select
  using (granted_by = app_current_user() or granted_to = app_current_user());

drop policy if exists grants_write on share_grants;
create policy grants_write on share_grants
  for all
  using (granted_by = app_current_user())
  with check (granted_by = app_current_user());

-- NOTE ON LAYER 1: the aggregate/institution layer is intentionally NOT a set
-- of RLS exceptions on these tables. It is served exclusively from separate,
-- pre-anonymized rollup views with a minimum-cohort (~10) gate. Those views are
-- built in the advisor/admin spec. Keeping them physically separate is what
-- makes "no code path from aggregate to individual data" true by construction.
