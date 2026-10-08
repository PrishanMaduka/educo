-- Local development only. Passwords equal the role names; real environments use managed credentials.
-- Runs once, as the postgres superuser, against the `quad` database on first start.

CREATE ROLE quad_owner LOGIN PASSWORD 'quad_owner' NOBYPASSRLS CREATEDB;
CREATE ROLE quad_app LOGIN PASSWORD 'quad_app' NOBYPASSRLS;
CREATE ROLE quad_platform LOGIN PASSWORD 'quad_platform' BYPASSRLS;

ALTER DATABASE quad OWNER TO quad_owner;
ALTER SCHEMA public OWNER TO quad_owner;

REVOKE ALL ON DATABASE quad FROM PUBLIC;
GRANT CONNECT ON DATABASE quad TO quad_owner, quad_app, quad_platform;
GRANT USAGE ON SCHEMA public TO quad_app, quad_platform;

-- Extensions are created by the superuser; they are available to every role.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- Tables and sequences that quad_owner creates later (migrations) are usable by quad_platform.
-- quad_app gets no default privileges: tenantRlsSql grants it DML per tenant table, so platform
-- tables stay closed to it. The first migration repeats these, because default privileges are
-- per database and per schema.
ALTER DEFAULT PRIVILEGES FOR ROLE quad_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO quad_platform;
ALTER DEFAULT PRIVILEGES FOR ROLE quad_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO quad_platform;
