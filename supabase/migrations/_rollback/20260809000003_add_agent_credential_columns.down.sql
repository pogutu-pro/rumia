-- Rollback 20260809000003_add_agent_credential_columns.sql
BEGIN;

ALTER TABLE public.agents
  DROP COLUMN IF EXISTS id_number,
  DROP COLUMN IF EXISTS hostel_name,
  DROP COLUMN IF EXISTS relationship_to_hostel,
  DROP COLUMN IF EXISTS owner_contact;

COMMIT;
