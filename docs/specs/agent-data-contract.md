# agent-data-contract

## Goal
Define and validate the record contract the Reno dashboard consumes from the Reno AI agent,
and ship a fixture set reproducing Living World Alam Sutera 10–13 September 2026 so every
downstream work item can be built and tested before the agent emits a single live record.

## Non-goals
- Building, modifying or specifying the agent. The agent exists; this states what the dashboard needs from it.
- Choosing the transport (database, REST, webhook, file drop). The contract is the record shape; transport is settled separately once the agent team responds.
- Reading WhatsApp directly. The dashboard never touches the group.
- Storing media. Photo records carry a reference the dashboard renders; the dashboard is not a media store.
- Deriving records the agent does not emit. If a field is absent, the dashboard shows it as unknown, never inferred.

## Record types

Eight types. Every record carries `record_id`, `site_id`, `source_message_id`, `sent_at`
(ISO 8601 with offset), `sender_raw`, `sender_person_id` (nullable) and `confidence`.

| Type | Carries |
|---|---|
| `message` | The raw group message: text, media references, reply-to, edited flag. The spine every other record cites. |
| `work_report` | A reported job: `area_id` (nullable), `job_text`, `photo_ids`, `is_before_after`, `shift`, `defects[]`. |
| `complaint` | `area_id`, `raised_by`, `raised_at`, `cause`, `state`, `state_history[]`, `closing_photo_id`, `blocked_reason_message_id`. |
| `work_order` | `title`, `document_id`, `requested_by`, `due_date`, `state`, `state_history[]`, `closing_photo_id`. |
| `lineup` | `shift`, `date`, `entries[{area_id, name_raw, person_id}]`, `total_mp`, `off_day`, `sakit`, `alfa`, `izin`. |
| `rkb_match` | Links a `work_report` to an RKB job row and date: `job_row_id`, `date`, `matched_by`, `confidence`. |
| `photo` | `captured_at` (nullable, from the Timemark watermark), `received_at`, `perceptual_hash`, `storage_ref`. |
| `person` | `person_id`, `canonical_name`, `aliases[]`, `role`, `area_default`, `active_from`, `active_to`. |

### Fields that carry unusual weight

- `photo.captured_at` and `photo.received_at` must be separate. The gap between them is a
  reported metric (25 photos arrived over three hours after capture) and cannot be recovered later.
- `photo.perceptual_hash` is what makes duplicate detection possible. Without it the
  reused-photo metric cannot exist.
- `complaint.cause` uses a closed enum: `hk_standard`, `tenant_project_event`,
  `engineering_equipment`, `spill`, `external_other`. Anything outside the enum is rejected, not coerced.
- `complaint.state` and `work_order.state` use a closed enum: `raised`, `answered`,
  `in_progress`, `blocked`, `closed_with_photo`, `closed_without_photo`.
- `blocked_reason_message_id` is mandatory whenever state is `blocked`. A blocked record
  without a citation is invalid and must be rejected at ingest, not rendered with a warning.
- `confidence` is a float 0–1 on every record. The dashboard renders low-confidence records
  differently; it never silently drops them.

## Acceptance criteria

- **AC-1**: A JSON Schema exists for each of the eight record types, and `pnpm test:contract` validates every file under `fixtures/agent/` against them with zero failures.
- **AC-2**: `pnpm test:contract` rejects a record whose `state` is `blocked` and whose `blocked_reason_message_id` is null, and rejects a `complaint.cause` outside the enum. Both rejections are covered by a failing-case test.
- **AC-3**: Every record type requires `record_id`, `site_id`, `source_message_id`, `sent_at`, `sender_raw` and `confidence`. A fixture missing any of these fails validation; a test asserts this per type.
- **AC-4**: The LWAS fixture set covers 10–13 September 2026 and reproduces the published case-study totals exactly. `pnpm test:fixtures` asserts: 1378 messages, 1052 photos, 639 work reports, 578 passing validation, 61 before-after, 75 complaints, 62 answered, 29 closed with photo, 3 duplicate photo pairs, 25 photos received over three hours after capture, 7 areas complained about on more than one day.
- **AC-5**: Per-day totals match the deck. `pnpm test:fixtures` asserts messages `[339,414,326,299]`, work reports `[166,149,170,154]`, complaints `[19,35,4,17]`, closed with photo `[9,10,3,7]`.
- **AC-6**: A typed client reads fixtures and live records through one interface, so no downstream code knows which it is holding. `pnpm typecheck` passes with no `any` in the client's public surface.
- **AC-7**: A written contract document exists at `docs/specs/agent-data-contract.md` (this file) listing every field, its type, its nullability and its enum where applicable, suitable to hand to the agent team unchanged.

## Verification
```
pnpm typecheck
pnpm test:contract
pnpm test:fixtures
```
