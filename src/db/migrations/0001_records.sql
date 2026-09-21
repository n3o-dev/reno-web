-- The agent's records.
--
-- One table, not eight. The eight record types are a union behind
-- RecordSource and are validated by Zod on the way in; restating those
-- schemas in DDL would give two definitions of the same thing and they would
-- drift. The envelope becomes columns because it is what every query filters
-- on; the rest stays as the agent sent it.

CREATE TABLE IF NOT EXISTS records (
  record_id          text PRIMARY KEY,
  site_id            text NOT NULL,
  type               text NOT NULL,
  sent_at            timestamptz NOT NULL,
  source_message_id  text NOT NULL,
  payload            jsonb NOT NULL,
  received_at        timestamptz NOT NULL DEFAULT now(),
  -- A withdrawn record is hidden, never deleted: a figure that moved has to
  -- stay explicable after the fact.
  retracted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS records_site_type_sent
  ON records (site_id, type, sent_at)
  WHERE retracted_at IS NULL;

CREATE INDEX IF NOT EXISTS records_source_message
  ON records (source_message_id);

-- Every payload the endpoint ever accepted, including the ones since
-- replaced. Append-only: a disputed invoice must be traceable to what the
-- agent actually said at the time, not to what it says now.
CREATE TABLE IF NOT EXISTS record_revisions (
  revision    bigserial PRIMARY KEY,
  record_id   text NOT NULL,
  type        text NOT NULL,
  payload     jsonb NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  -- 'upsert' or 'retract'. A retraction keeps the payload it withdrew.
  action      text NOT NULL
);

CREATE INDEX IF NOT EXISTS record_revisions_record
  ON record_revisions (record_id, revision);
