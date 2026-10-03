CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE IF NOT EXISTS registry_record_number_seq START WITH 1;

CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_number text NOT NULL UNIQUE DEFAULT ('LT-UG-' || lpad(nextval('registry_record_number_seq')::text, 6, '0')),
  full_name text NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 180),
  other_names text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS people_name_lower_idx ON people (lower(full_name));
CREATE INDEX IF NOT EXISTS people_record_number_idx ON people (record_number);

CREATE TABLE IF NOT EXISTS parcels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_reference text NOT NULL,
  district text NOT NULL CHECK (length(trim(district)) BETWEEN 1 AND 100),
  region text,
  county text,
  sub_county text,
  parish text,
  village text,
  land_size numeric(14, 4),
  land_size_unit text CHECK (land_size_unit IN ('acres', 'hectares', 'square_metres', 'unknown')),
  source_book text,
  source_page text,
  verification_status text NOT NULL DEFAULT 'needs_review' CHECK (verification_status IN ('verified', 'needs_review', 'scan_pending')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS parcels_title_reference_lower_idx ON parcels (lower(title_reference));
CREATE INDEX IF NOT EXISTS parcels_district_lower_idx ON parcels (lower(district));
CREATE INDEX IF NOT EXISTS parcels_location_lower_idx ON parcels (lower(village), lower(parish), lower(sub_county));

CREATE TABLE IF NOT EXISTS parcel_owners (
  parcel_id uuid NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  ownership_label text NOT NULL DEFAULT 'Owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parcel_id, person_id)
);

CREATE INDEX IF NOT EXISTS parcel_owners_person_idx ON parcel_owners (person_id);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES people(id) ON DELETE CASCADE,
  parcel_id uuid REFERENCES parcels(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('person_photo', 'title_scan', 'supporting_document')),
  object_key text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 15728640),
  upload_status text NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'available')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  CONSTRAINT documents_one_parent CHECK (((person_id IS NOT NULL)::int + (parcel_id IS NOT NULL)::int) = 1)
);

CREATE INDEX IF NOT EXISTS documents_person_idx ON documents (person_id, category);
CREATE INDEX IF NOT EXISTS documents_parcel_idx ON documents (parcel_id, category);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx ON audit_events (actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS security_alert_throttles (
  email_hash text PRIMARY KEY,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 1
);