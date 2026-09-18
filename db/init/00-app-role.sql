-- Runs once on first container start. Creates the least-privilege role the app
-- connects as. It is NOT a superuser and does NOT have BYPASSRLS, so the
-- policies in rls.sql actually constrain it.
CREATE ROLE recruitu_app LOGIN PASSWORD 'app_password';
GRANT CONNECT ON DATABASE recruitu TO recruitu_app;
\connect recruitu
GRANT USAGE ON SCHEMA public TO recruitu_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO recruitu_app;
-- Tables created later by drizzle-kit (as postgres) need grants too; the
-- db:setup step re-grants after push. See README.
