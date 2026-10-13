ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS id_number text,
  ADD COLUMN IF NOT EXISTS hostel_name text,
  ADD COLUMN IF NOT EXISTS relationship_to_hostel text,
  ADD COLUMN IF NOT EXISTS owner_contact text;
