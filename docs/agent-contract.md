# Reno AI → Dashboard: record contract

**For:** the team building the Reno AI agent
**From:** the team building the Reno dashboard
**Site:** Living World Alam Sutera (one WhatsApp group, one site)

This document is the complete specification of what the dashboard needs the agent to
produce. It is self-contained — you should not need the dashboard codebase to implement
against it.

Everything below is generated from the schemas the dashboard actually validates with, so it
cannot drift from the real thing. Machine-readable JSON Schema files accompany this document
in `contract/*.schema.json`.

---

## 1. What the dashboard does with this

The dashboard turns the group's traffic into the four things Reno has to produce anyway: the
RKB realisation, the monthly client report, the manpower figure that reaches the invoice, and
the Pimpro scorecard. Every number it shows must click through to the WhatsApp message that
produced it.

That last sentence is the whole reason this contract is shaped the way it is. **The dashboard
displays nothing it cannot trace.** If the agent cannot evidence something, the correct output
is a null or an omitted record — never a guess.

---

## 2. The eight record types

| Type | One per | Purpose |
|---|---|---|
| `message` | group message | The spine. Every other record cites one of these. |
| `work_report` | reported job | A cleaner or team leader reporting work done. |
| `complaint` | complaint | Raised by a client PIC or a Reno superior. Runs a 24-hour clock. |
| `work_order` | client request | Usually a PDF. Runs to a client-set due date. |
| `lineup` | shift | The roster message. The only attendance record that exists. |
| `rkb_match` | matched job | Links a work report to one RKB job row on one date. |
| `photo` | photo | Capture time, receive time, and a perceptual hash. |
| `person` | person | The personnel master, including confirmed aliases. |

You emit records. The dashboard never asks you to compute a percentage, a median, or a score —
all of that is ours. Your job is to turn messages into facts.

---

## 3. The envelope

Every record of every type carries these seven fields:

| Field | Type | Notes |
|---|---|---|
| `record_id` | string | Stable and unique. Re-emitting the same fact must reuse the same id. |
| `site_id` | string | `lwas` for now. One site today, more later. |
| `source_message_id` | string | **The message this fact came from.** Non-negotiable — see §1. |
| `sent_at` | string | ISO 8601 **with offset**, e.g. `2026-09-13T19:55:00+07:00`. Not `Z`, not naive. |
| `sender_raw` | string | The WhatsApp display name, exactly as it appears, emoji and all. |
| `sender_person_id` | string \| null | Resolved person, or `null` when you could not resolve it. Required but nullable — say you don't know rather than omitting the field. |
| `confidence` | number | 0–1. Low-confidence records are rendered differently, never dropped. Send them. |

**Unknown fields are rejected.** Every schema is `additionalProperties: false`. If you need to
send something not listed here, tell us and we will add it — do not smuggle it through.

---

## 4. Seven rules that must hold

These are the invariants the dashboard depends on. Each one exists because a real number
breaks without it.

**4.1 — A blocked record must cite the message that justifies it.**
`state: "blocked"` requires a non-null `blocked_reason_message_id`. A block pauses the SLA
clock, which means it is the one state a supplier could use to make its own numbers look
better. An uncited block is rejected at ingest — it is invalid input, not a zero-duration
block. The schema enforces this structurally: the blocked variant is a separate shape.

**4.2 — `cause` and `state` are closed sets.**
Anything outside the enum is rejected, never coerced to a default. If a complaint does not fit
the five causes, use `external_other` and tell us — do not invent a value.

**4.3 — `captured_at` and `received_at` are separate instants.**
The gap between when a photo was taken and when it reached the group is a reported metric
(25 photos arrived over three hours late in the 10–13 Sep sample). It cannot be recovered
later. `captured_at` may be null when the image carries no Timemark stamp; `received_at`
never may be.

**4.4 — Every photo needs a perceptual hash.**
Without it, duplicate detection is impossible, and the reused-photo metric is the one that
maps to the SOP's *data fiktif* score. A cryptographic hash is not a substitute — it must
match visually identical images, not byte-identical ones.

**4.5 — A complaint and a work order run different clocks.**
A complaint runs 24 hours from `raised_at` (SOP/OPS/001 A.3). A work order runs to its
client-set `due_date`. Do not put a `due_date` on a complaint.

**4.6 — `state_history` is required, even when empty.**
We compute two medians from it — time to first reply, and time to a closing photo — and they
tell opposite stories. Each entry needs its own `source_message_id`.

**4.7 — Never guess an area.**
`area_id` is nullable on work reports and complaints. In the sample period, 36 of 639 reports
named no area. A null is a fact we can show; a guessed area is a number we have to defend.

---

## 5. Field reference

Generated from the schemas. `Required` means the key must be present; `Nullable` means the
value may be `null`.

> **Reading note.** `complaint` and `work_order` are each a union of two shapes, and the table
> below merges them. `blocked_reason_message_id` shows as nullable because it is nullable on a
> *non-blocked* record — on a blocked one it is a required string. Rule 4.1 is the binding
> statement, and `complaint.schema.json` enforces it with `anyOf`.

<!-- FIELDS:START — generated by pnpm schema:emit, do not edit -->

### `message`

| Field | Type | Required | Nullable | Allowed values |
|---|---|---|---|---|
| `record_id` | string | yes | no | — |
| `site_id` | string | yes | no | — |
| `source_message_id` | string | yes | no | — |
| `sent_at` | string (date-time) | yes | no | — |
| `sender_raw` | string | yes | no | — |
| `sender_person_id` | string | yes | yes | — |
| `confidence` | number | yes | no | — |
| `text` | string | yes | no | — |
| `photo_ids` | string[] | yes | no | — |
| `reply_to_message_id` | string | yes | yes | — |
| `edited` | boolean | yes | no | — |

### `work_report`

| Field | Type | Required | Nullable | Allowed values |
|---|---|---|---|---|
| `record_id` | string | yes | no | — |
| `site_id` | string | yes | no | — |
| `source_message_id` | string | yes | no | — |
| `sent_at` | string (date-time) | yes | no | — |
| `sender_raw` | string | yes | no | — |
| `sender_person_id` | string | yes | yes | — |
| `confidence` | number | yes | no | — |
| `area_id` | string | yes | yes | — |
| `job_text` | string | yes | no | — |
| `photo_ids` | string[] | yes | no | — |
| `is_before_after` | boolean | yes | no | — |
| `shift` | integer | yes | no | `1`, `2`, `3` |
| `defects` | string[] | yes | no | — |

### `complaint`

| Field | Type | Required | Nullable | Allowed values |
|---|---|---|---|---|
| `record_id` | string | yes | no | — |
| `site_id` | string | yes | no | — |
| `source_message_id` | string | yes | no | — |
| `sent_at` | string (date-time) | yes | no | — |
| `sender_raw` | string | yes | no | — |
| `sender_person_id` | string | yes | yes | — |
| `confidence` | number | yes | no | — |
| `area_id` | string | yes | yes | — |
| `raised_by` | string | yes | no | — |
| `raised_at` | string (date-time) | yes | no | — |
| `cause` | string | yes | no | `hk_standard`, `tenant_project_event`, `engineering_equipment`, `spill`, `external_other` |
| `state_history` | object[] | yes | no | — |
| `closing_photo_id` | string | yes | yes | — |
| `state` | string | yes | no | `raised`, `answered`, `in_progress`, `closed_with_photo`, `closed_without_photo`, `blocked` |
| `blocked_reason_message_id` | string | yes | yes | — |

### `work_order`

| Field | Type | Required | Nullable | Allowed values |
|---|---|---|---|---|
| `record_id` | string | yes | no | — |
| `site_id` | string | yes | no | — |
| `source_message_id` | string | yes | no | — |
| `sent_at` | string (date-time) | yes | no | — |
| `sender_raw` | string | yes | no | — |
| `sender_person_id` | string | yes | yes | — |
| `confidence` | number | yes | no | — |
| `title` | string | yes | no | — |
| `document_id` | string | yes | yes | — |
| `requested_by` | string | yes | no | — |
| `due_date` | string (date) | yes | no | — |
| `state_history` | object[] | yes | no | — |
| `closing_photo_id` | string | yes | yes | — |
| `state` | string | yes | no | `raised`, `answered`, `in_progress`, `closed_with_photo`, `closed_without_photo`, `blocked` |
| `blocked_reason_message_id` | string | yes | yes | — |

### `lineup`

| Field | Type | Required | Nullable | Allowed values |
|---|---|---|---|---|
| `record_id` | string | yes | no | — |
| `site_id` | string | yes | no | — |
| `source_message_id` | string | yes | no | — |
| `sent_at` | string (date-time) | yes | no | — |
| `sender_raw` | string | yes | no | — |
| `sender_person_id` | string | yes | yes | — |
| `confidence` | number | yes | no | — |
| `shift` | integer | yes | no | `1`, `2`, `3` |
| `date` | string (date) | yes | no | — |
| `entries` | object[] | yes | no | — |
| `total_mp` | integer | yes | no | — |
| `off_day` | integer | yes | no | — |
| `sakit` | integer | yes | no | — |
| `alfa` | integer | yes | no | — |
| `izin` | integer | yes | no | — |

### `rkb_match`

| Field | Type | Required | Nullable | Allowed values |
|---|---|---|---|---|
| `record_id` | string | yes | no | — |
| `site_id` | string | yes | no | — |
| `source_message_id` | string | yes | no | — |
| `sent_at` | string (date-time) | yes | no | — |
| `sender_raw` | string | yes | no | — |
| `sender_person_id` | string | yes | yes | — |
| `confidence` | number | yes | no | — |
| `job_row_id` | string | yes | no | — |
| `date` | string (date) | yes | no | — |
| `work_report_id` | string | yes | no | — |
| `matched_by` | string | yes | no | `agent`, `human_override` |

### `photo`

| Field | Type | Required | Nullable | Allowed values |
|---|---|---|---|---|
| `record_id` | string | yes | no | — |
| `site_id` | string | yes | no | — |
| `source_message_id` | string | yes | no | — |
| `sent_at` | string (date-time) | yes | no | — |
| `sender_raw` | string | yes | no | — |
| `sender_person_id` | string | yes | yes | — |
| `confidence` | number | yes | no | — |
| `captured_at` | string (date-time) | yes | yes | — |
| `received_at` | string (date-time) | yes | no | — |
| `perceptual_hash` | string | yes | no | — |
| `storage_ref` | string | yes | no | — |

### `person`

| Field | Type | Required | Nullable | Allowed values |
|---|---|---|---|---|
| `record_id` | string | yes | no | — |
| `site_id` | string | yes | no | — |
| `source_message_id` | string | yes | no | — |
| `sent_at` | string (date-time) | yes | no | — |
| `sender_raw` | string | yes | no | — |
| `sender_person_id` | string | yes | yes | — |
| `confidence` | number | yes | no | — |
| `person_id` | string | yes | no | — |
| `canonical_name` | string | yes | no | — |
| `aliases` | string[] | yes | no | — |
| `role` | string | yes | no | `operational_manager`, `project_coordinator`, `pimpro`, `team_leader`, `cleaner`, `admin`, `client_pic` |
| `area_default` | string | yes | yes | — |
| `active_from` | string (date) | yes | no | — |
| `active_to` | string (date) | yes | yes | — |

<!-- FIELDS:END -->

---

## 6. Worked examples

Every example below is validated against its own schema by our test suite, so none of them
can be wrong.

<!-- EXAMPLES:START — generated by pnpm schema:emit, do not edit -->

### `message`

The client PIC raising the Toilet LT2 complaint on 13 Sep. Every other record cites a message like this one.

```json
{
  "record_id": "msg_20260913_1955_001",
  "site_id": "lwas",
  "source_message_id": "msg_20260913_1955_001",
  "sent_at": "2026-09-13T19:55:00+07:00",
  "sender_raw": "Cristian B. Suryanto",
  "sender_person_id": "p_cristian",
  "confidence": 0.99,
  "text": "Malam Pak @Rachmad Adi, info Pak ada nya komplain dari customer tentang kebersihan toilet. untuk toilet disable dan toilet wanita lt.2 (dekat tenant rockstar) sangat kotor dan tidak bersih dan juga Exhaust yang ada di toilet dis…",
  "photo_ids": [
    "ph_20260913_1955_a"
  ],
  "reply_to_message_id": null,
  "edited": false
}
```

### `work_report`

Amartha reporting corridor washing with a before and an after shot. `area_id` is resolved; when it cannot be, send null rather than guessing.

```json
{
  "record_id": "wr_20260912_0737_014",
  "site_id": "lwas",
  "source_message_id": "msg_20260912_0737_014",
  "sent_at": "2026-09-12T07:37:00+07:00",
  "sender_raw": "🥀Amartha🥀",
  "sender_person_id": "p_amartha",
  "confidence": 0.93,
  "area_id": "koridor_lt2",
  "job_text": "Washing manual koridor area LT 2",
  "photo_ids": [
    "ph_20260912_0737_a",
    "ph_20260912_0737_b"
  ],
  "is_before_after": true,
  "shift": 1,
  "defects": []
}
```

### `complaint`

The same Toilet LT2 complaint as a tracked item. Answered two minutes later, never closed with a photo — so it stays `answered`, not `closed_without_photo`, until the day ends.

```json
{
  "record_id": "cmp_20260913_001",
  "site_id": "lwas",
  "source_message_id": "msg_20260913_1955_001",
  "sent_at": "2026-09-13T19:55:00+07:00",
  "sender_raw": "Cristian B. Suryanto",
  "sender_person_id": "p_cristian",
  "confidence": 0.96,
  "area_id": "toilet_lt2",
  "raised_by": "p_cristian",
  "raised_at": "2026-09-13T19:55:00+07:00",
  "cause": "hk_standard",
  "state": "answered",
  "state_history": [
    {
      "state": "answered",
      "at": "2026-09-13T19:57:00+07:00",
      "source_message_id": "msg_20260913_1957_002"
    }
  ],
  "closing_photo_id": null,
  "blocked_reason_message_id": null
}
```

### `work_order`

A client work order that arrived as a PDF. It runs to `due_date`, never the 24-hour complaint clock.

```json
{
  "record_id": "wo_20260910_003",
  "site_id": "lwas",
  "source_message_id": "msg_20260910_1231_088",
  "sent_at": "2026-09-10T12:31:00+07:00",
  "sender_raw": "Desak Made Meyasni",
  "sender_person_id": "p_desak",
  "confidence": 0.91,
  "title": "WO to HK — Take Out Kursi Area LDL & West Lobby",
  "document_id": "doc_20260910_003",
  "requested_by": "p_desak",
  "due_date": "2026-09-10",
  "state": "closed_with_photo",
  "state_history": [
    {
      "state": "closed_with_photo",
      "at": "2026-09-10T16:40:00+07:00",
      "source_message_id": "msg_20260910_1640_131"
    }
  ],
  "closing_photo_id": "ph_20260910_1640_a",
  "blocked_reason_message_id": null
}
```

### `lineup`

The shift-1 roster message. This is the only attendance record in the group, so the absence counts matter as much as the names.

```json
{
  "record_id": "lu_20260912_s1",
  "site_id": "lwas",
  "source_message_id": "msg_20260912_0720_003",
  "sent_at": "2026-09-12T07:20:00+07:00",
  "sender_raw": "🥀Amartha🥀",
  "sender_person_id": "p_amartha",
  "confidence": 0.88,
  "shift": 1,
  "date": "2026-09-12",
  "entries": [
    {
      "area_id": "lt2",
      "name_raw": "Hera",
      "person_id": "p_hera"
    },
    {
      "area_id": "lt2",
      "name_raw": "Iska",
      "person_id": "p_iska"
    },
    {
      "area_id": "gf",
      "name_raw": "Ani",
      "person_id": "p_ani"
    },
    {
      "area_id": "external",
      "name_raw": "Renno",
      "person_id": null
    }
  ],
  "total_mp": 34,
  "off_day": 0,
  "sakit": 0,
  "alfa": 0,
  "izin": 0
}
```

### `rkb_match`

Links a work report to one RKB job row on one date. `matched_by` records whether the agent or a human made the link.

```json
{
  "record_id": "rm_20260912_0041",
  "site_id": "lwas",
  "source_message_id": "msg_20260912_0737_014",
  "sent_at": "2026-09-12T07:37:00+07:00",
  "sender_raw": "🥀Amartha🥀",
  "sender_person_id": "p_amartha",
  "confidence": 0.82,
  "job_row_id": "koridor_dalam:LANTAI 2:4",
  "date": "2026-09-12",
  "work_report_id": "wr_20260912_0737_014",
  "matched_by": "agent"
}
```

### `photo`

Captured 07:34, received 07:37. Both instants are required and separate. The hash is what makes duplicate detection possible.

```json
{
  "record_id": "ph_20260912_0737_a",
  "site_id": "lwas",
  "source_message_id": "msg_20260912_0737_014",
  "sent_at": "2026-09-12T07:37:00+07:00",
  "sender_raw": "🥀Amartha🥀",
  "sender_person_id": "p_amartha",
  "confidence": 0.97,
  "captured_at": "2026-09-12T07:34:00+07:00",
  "received_at": "2026-09-12T07:37:00+07:00",
  "perceptual_hash": "p:9f2c1a77b3e40d58",
  "storage_ref": "s3://reno-media/lwas/2026-09-12/ph_20260912_0737_a.jpg"
}
```

### `person`

A cleaner with a confirmed alias. The agent proposes aliases; a human confirms them before they count.

```json
{
  "record_id": "per_p_dame",
  "site_id": "lwas",
  "source_message_id": "msg_20260912_0720_003",
  "sent_at": "2026-09-12T07:20:00+07:00",
  "sender_raw": "🥀Amartha🥀",
  "sender_person_id": "p_amartha",
  "confidence": 0.75,
  "person_id": "p_dame",
  "canonical_name": "Dame",
  "aliases": [
    "Damme"
  ],
  "role": "cleaner",
  "area_default": "ug",
  "active_from": "2026-01-01",
  "active_to": null
}
```

<!-- EXAMPLES:END -->

---

## 7. How to check your output

The JSON Schema files in `contract/` are draft 2020-12 and work with any standard validator.

```bash
npm i ajv ajv-formats
```

```js
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import schema from './contract/complaint.schema.json' with { type: 'json' }

const ajv = addFormats(new Ajv2020({ strict: true, allErrors: true }))
const validate = ajv.compile(schema)

if (!validate(record)) console.error(validate.errors)
```

If a record fails validation, that is the contract working. Send us the errors rather than
loosening anything.

---

## 8. The one thing we still need from you

**Transport.** This document specifies the record *shape*; it does not specify how the records
reach us. We have no preference strong enough to impose, so tell us which of these is least
work on your side:

1. **A database we read** — you write to Postgres, we read. Simplest for us, needs credentials and a stable schema.
2. **A REST endpoint we poll** — `GET /records?site=lwas&since=<cursor>`, returning a page of records. Needs a cursor that is stable across restarts.
3. **A webhook you push** — you POST batches to us as they are extracted. Lowest latency, needs a retry policy and idempotency on `record_id`.

Whichever it is, we need **near real time, not a nightly batch** — the complaint SLA countdown
is the most-used thing on the operational screen and is worthless on day-old data.

We also need to know whether you can **backfill** the period already in the group, or whether
records begin from the day you switch on.

---

## 9. Definition of done

- [ ] All eight record types emit, and every record validates against its schema
- [ ] Every record carries a real `source_message_id` that resolves to a message we also receive
- [ ] `sent_at` carries the `+07:00` offset
- [ ] No blocked record is emitted without a citation
- [ ] Photos carry both `captured_at` (or explicit null) and `received_at`
- [ ] Photos carry a perceptual hash that matches visually identical images
- [ ] `confidence` is a real score, not a constant
- [ ] Transport agreed and reachable from our environment
- [ ] Re-emitting the same fact reuses the same `record_id`

---

## 10. Questions

Anything unclear here is our fault, not yours — ask and we will tighten the document rather
than have you guess. The fastest thing you can send back is a single example record of any
type; we will validate it and tell you exactly what, if anything, is off.
