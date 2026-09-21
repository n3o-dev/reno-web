-- The roster, confirmed for a month by a named person.
--
-- BAPP cannot generate against claimed attendance alone: the line-up is a
-- project leader typing names into WhatsApp, and the invoice needs someone
-- to stand behind it. This is the first thing in the system a person writes.

CREATE TABLE IF NOT EXISTS month_confirmations (
  site_id       text NOT NULL,
  -- 'YYYY-MM'
  month         text NOT NULL,
  confirmed_by  text NOT NULL REFERENCES accounts (account_id),
  confirmed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, month)
);
