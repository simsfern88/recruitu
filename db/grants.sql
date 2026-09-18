-- Grant the restricted app role privileges on the tables drizzle created (as
-- the owner). Run after every `db:push` that adds tables. Idempotent.
GRANT USAGE ON SCHEMA public TO recruitu_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO recruitu_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO recruitu_app;
-- Future tables created by the owner get the same grants automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO recruitu_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO recruitu_app;
