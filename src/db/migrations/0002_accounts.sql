-- Who may sign in, and who is currently signed in.
--
-- Accounts are per person rather than one shared team password, because the
-- override chain already claims to record who corrected a figure. "Sarwedi
-- corrected this" is only true if Sarwedi signed in as himself.

CREATE TABLE IF NOT EXISTS accounts (
  account_id     text PRIMARY KEY,
  email          text NOT NULL UNIQUE,
  display_name   text NOT NULL,
  -- scrypt output and its salt, encoded together. Never the password, and
  -- never a bare hash: the salt is what stops one leak becoming all of them.
  password_hash  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  disabled_at    timestamptz
);

-- The cookie carries this id and nothing else. A signed stateless cookie
-- could not be revoked; a row can be deleted the moment someone leaves.
CREATE TABLE IF NOT EXISTS sessions (
  session_id  text PRIMARY KEY,
  account_id  text NOT NULL REFERENCES accounts (account_id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires_at);

-- Failed sign-ins, so a slow password guess is slowed further. Successes
-- clear the count; the rows are pruned by age, not kept as a record of
-- anyone's typing.
CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_id  bigserial PRIMARY KEY,
  email       text NOT NULL,
  failed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_email ON login_attempts (email, failed_at);
