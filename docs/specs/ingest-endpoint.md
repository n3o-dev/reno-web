# ingest-endpoint

## Goal
Give the agent one place to put records and the dashboard one place to read them, so the
screens stop reading fixture files. A `POST` the agent calls as it extracts, records stored in
Postgres, and `RecordSource` backed by that instead of disk — with nothing above the service
layer changing.

Depends on [agent-data-contract](./agent-data-contract.md). Consumed by
[reno-dashboard](./reno-dashboard.md).

## Non-goals
- **A public API.** One caller, one purpose. No pagination for third parties, no OpenAPI, no versioning scheme beyond the path.
- **Reading records back out over HTTP.** The dashboard reads Postgres directly; it is the same process. An agent that needs its own records back can ask later.
- **Managing the agent's extraction.** No job control, no "re-run day 3", no backfill trigger. The agent decides what to send and when.
- **Multi-tenant auth.** One token per agent, checked against an allowlist. No user accounts, no scopes, no OAuth.
- **Replacing the fixture set.** Fixtures stay and stay authoritative for tests. A source that only works against a live database cannot be tested.

## Decisions

**The agent pushes; we do not poll.** The complaint SLA countdown is the most-used figure on
the operational screen and is worthless on day-old data, so latency belongs to the party that
knows when a record exists.

**Correction is an upsert; retraction is a delete.** Re-emitting the same fact with the same
`record_id` replaces it. A record that should never have existed — the agent read a caption as
a complaint — is withdrawn with `DELETE /api/records/:record_id`, not by emitting a fake
closing state. Both are visible: every accepted payload is kept, so a disputed figure can be
traced to what the agent said at the time, and a withdrawal is a tombstone rather than a gap.
This adds an endpoint to the contract but no field to the eight record shapes, so the document
already sent to the agent team stays correct about shape.

**One table, not eight.** Records are a union behind `RecordSource` and are validated by Zod
on the way in. Eight tables would restate those eight schemas in DDL and drift from them. The
envelope becomes columns because it is what every query filters on; the rest is `jsonb`.

**All-or-nothing per request.** A batch that is half-written is worse than one that failed:
the agent cannot tell what to resend, and the dashboard shows a figure built on half a day.

## Acceptance criteria

- **AC-1**: `POST /api/records` accepts a batch and stores every record. `pnpm test:ingest` posts a batch of each of the eight types and asserts all are readable afterwards.
- **AC-2**: A batch containing one invalid record stores none of it. A test posts a batch where the third record fails its schema, asserts a 422 naming index 2 and the failing field, and asserts the other records are absent.
- **AC-3**: An uncited blocked record is rejected. A test posts `state: "blocked"` with a null `blocked_reason_message_id` and asserts 422 — the rule the agent contract calls 4.1, enforced at the boundary rather than trusted.
- **AC-4**: Posting the same batch twice leaves the same rows. A test posts a batch, posts it again, and asserts the record count and every payload are unchanged.
- **AC-5**: Re-emitting a record with new content replaces it and keeps the old one. A test posts a record, posts it again with a different `confidence`, asserts the current value is the new one and that the previous payload is still retrievable.
- **AC-6**: `DELETE /api/records/:record_id` withdraws a record without destroying it. A test deletes a record, asserts it is absent from `RecordSource`, and asserts its payload is still in the revision history.
- **AC-7**: A request without a valid bearer token is refused. Tests assert 401 for a missing token, an unknown token and a revoked one, and that the response body never echoes the token.
- **AC-8**: Tokens are compared in constant time. A test asserts the comparison rejects a wrong token of the same length without an early return, as the client-link check does.
- **AC-9**: A record whose `site_id` does not match the token's site is rejected. A test posts a record for another site and asserts 403, so a compromised agent token cannot write into a site it does not serve.
- **AC-10**: `PostgresRecordSource` satisfies the same contract as the fixture source. The existing `source-agnostic` test runs against both and asserts the rules layer cannot tell them apart.
- **AC-11**: The dashboard reads Postgres when `DATABASE_URL` is set and fixtures otherwise, with no screen changing. A test renders a screen against a seeded database and asserts the same figures as the fixture run.
- **AC-12**: Migrations run forward from an empty database and are idempotent. `pnpm db:migrate` twice on a fresh database leaves the same schema and exits zero.
- **AC-13**: A batch larger than the cap is refused with a stated limit rather than timing out. A test posts one record over the cap and asserts 413 naming the cap.
- **AC-14**: The endpoint never logs a token, a record payload or a message body. A test drives a failing request with a log spy and asserts nothing matching the token or the message text is written.

## Verification
```
pnpm typecheck
pnpm lint
pnpm test
pnpm test:ingest
pnpm db:migrate
```
